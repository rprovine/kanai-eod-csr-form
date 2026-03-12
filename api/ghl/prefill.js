import { supabaseAdmin } from '../_lib/supabase-admin.js';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';

// Convert an ISO date string to YYYY-MM-DD in Hawaii time
function toHawaiiDate(isoStr) {
  if (!isoStr) return null;
  const d = new Date(isoStr);
  if (isNaN(d)) return null;
  return d.toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });
}

// Fetch ALL messages from GHL messages export API for a target date
// Returns calls, SMS, FB, IG messages in categorized buckets
async function fetchAllMessages(ghlUserId, date) {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!apiKey || !locationId || !ghlUserId) {
    return { userCalls: [], totalInbound: 0, allDateMessages: [] };
  }

  const userCalls = [];
  let totalInbound = 0;
  const allDateMessages = []; // All messages on the target date for STL calc
  let cursor = null;

  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({ locationId, limit: '100' });
    if (cursor) params.set('cursor', cursor);

    try {
      const response = await fetch(
        `${GHL_API_BASE}/conversations/messages/export?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Version': '2021-07-28',
          },
        }
      );

      if (!response.ok) break;
      const data = await response.json();
      const messages = data.messages || [];
      if (messages.length === 0) break;

      let foundOlder = false;
      for (const msg of messages) {
        const msgDate = toHawaiiDate(msg.dateAdded);
        if (!msgDate) continue;

        if (msgDate === date) {
          const direction = (msg.direction || '').toLowerCase();
          const userId = msg.userId || null;
          const msgType = msg.type;

          // Collect ALL messages on this date for speed-to-lead and messaging metrics
          allDateMessages.push({
            type: msgType,
            direction,
            userId,
            dateAdded: msg.dateAdded,
            conversationId: msg.conversationId,
            contactId: msg.contactId,
            status: msg.meta?.call?.status || msg.status || '',
            duration: msg.meta?.call?.duration || 0,
          });

          // Call-specific tracking (type 1 = direct call, type 24 = IVR call)
          if (msgType === 1 || msgType === 24) {
            if (direction === 'inbound') totalInbound++;

            if (userId === ghlUserId) {
              userCalls.push({
                direction,
                duration: msg.meta?.call?.duration || 0,
                status: msg.meta?.call?.status || '',
                dateAdded: msg.dateAdded,
                contactId: msg.contactId,
              });
            }
          }
        } else if (msgDate && msgDate < date) {
          foundOlder = true;
          break;
        }
      }

      if (foundOlder) break;
      cursor = data.nextCursor;
      if (!cursor || messages.length < 100) break;
    } catch (err) {
      console.error('GHL messages export error:', err);
      break;
    }
  }

  return { userCalls, totalInbound, allDateMessages };
}

// Fetch conversation IDs assigned to a specific GHL user
async function fetchAssignedConversationIds(ghlUserId) {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!apiKey || !locationId || !ghlUserId) return new Set();

  const ids = new Set();
  try {
    // Fetch up to 100 assigned conversations
    const params = new URLSearchParams({
      locationId,
      assignedTo: ghlUserId,
      limit: '100',
    });

    const response = await fetch(
      `${GHL_API_BASE}/conversations/search?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Version': '2021-07-28',
        },
      }
    );

    if (!response.ok) return ids;
    const data = await response.json();
    for (const conv of (data.conversations || [])) {
      ids.add(conv.id);
    }
  } catch (err) {
    console.error('GHL conversations search error:', err);
  }
  return ids;
}

// Analyze call messages for a specific CSR
// Uses dual attribution for inbound IVR calls (which have no userId):
// 1. Conversation activity: CSR had outbound activity in that conversation
// 2. Conversation assignment: conversation is assigned to the CSR in GHL
function analyzeCallMessages(userCalls, totalLocationInbound, allDateMessages, ghlUserId, assignedConversationIds) {
  let outbound = 0;

  // Count outbound calls directly attributed to this user
  for (const call of userCalls) {
    if (call.direction === 'outbound') {
      outbound++;
    }
  }

  // Build set of conversations where this CSR had outbound activity today
  const activeConversations = new Set();
  for (const msg of allDateMessages) {
    if (msg.direction === 'outbound' && msg.userId === ghlUserId && msg.conversationId) {
      activeConversations.add(msg.conversationId);
    }
  }

  let inbound = 0;
  let missed = 0;
  const countedInbound = new Set();

  for (const msg of allDateMessages) {
    if ((msg.type === 1 || msg.type === 24) && msg.direction === 'inbound') {
      const convId = msg.conversationId;
      // Attribute to CSR if they had activity in this conversation OR it's assigned to them
      if (activeConversations.has(convId) || assignedConversationIds.has(convId)) {
        const key = `${convId}-${msg.dateAdded}`;
        if (!countedInbound.has(key)) {
          countedInbound.add(key);
          inbound++;
          if (msg.duration < 5 || msg.status === 'no-answer' || msg.status === 'busy') {
            missed++;
          }
        }
      }
    }
  }

  return { inbound, outbound, missed, total_location_inbound: totalLocationInbound };
}

// Analyze all messages for messaging metrics (SMS, FB, IG)
function analyzeMessagingMetrics(allDateMessages, ghlUserId) {
  const counts = {
    total_sms_sent: 0,
    total_sms_received: 0,
    total_fb_messages_sent: 0,
    total_fb_messages_received: 0,
    total_ig_messages_sent: 0,
    total_ig_messages_received: 0,
  };

  for (const msg of allDateMessages) {
    const isOutbound = msg.direction === 'outbound';
    const isInbound = msg.direction === 'inbound';
    const isThisUser = msg.userId === ghlUserId;

    switch (msg.type) {
      case 2: // TYPE_SMS
        if (isOutbound && isThisUser) counts.total_sms_sent++;
        if (isInbound) counts.total_sms_received++;
        break;
      case 11: // TYPE_FACEBOOK
        if (isOutbound && isThisUser) counts.total_fb_messages_sent++;
        if (isInbound) counts.total_fb_messages_received++;
        break;
      case 18: // TYPE_INSTAGRAM
        if (isOutbound && isThisUser) counts.total_ig_messages_sent++;
        if (isInbound) counts.total_ig_messages_received++;
        break;
    }
  }

  counts.total_messages_sent = counts.total_sms_sent + counts.total_fb_messages_sent + counts.total_ig_messages_sent;
  counts.total_messages_received = counts.total_sms_received + counts.total_fb_messages_received + counts.total_ig_messages_received;

  return counts;
}

// Classify a GHL message type into a channel
function getChannel(msgType) {
  if (msgType === 1 || msgType === 24) return 'calls';
  if (msgType === 2) return 'sms';
  if (msgType === 11) return 'facebook';
  if (msgType === 18) return 'instagram';
  return 'other';
}

// Summarize an array of gap values
function summarizeGaps(gaps) {
  if (gaps.length === 0) return null;
  const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  return {
    avg_minutes: Math.round(avg * 10) / 10,
    min_minutes: Math.round(Math.min(...gaps) * 10) / 10,
    max_minutes: Math.round(Math.max(...gaps) * 10) / 10,
    count: gaps.length,
  };
}

// Calculate speed-to-lead from message data
// Groups by conversation, finds first inbound → first outbound response gap
// Returns overall average plus per-channel breakdown (calls, sms, facebook, instagram)
function calculateSpeedToLead(allDateMessages, ghlUserId) {
  // Group messages by conversationId
  const convos = {};
  for (const msg of allDateMessages) {
    if (!msg.conversationId) continue;
    if (!convos[msg.conversationId]) convos[msg.conversationId] = [];
    convos[msg.conversationId].push(msg);
  }

  const allGaps = [];
  const channelGaps = { calls: [], sms: [], facebook: [], instagram: [] };

  for (const messages of Object.values(convos)) {
    // Sort by dateAdded ascending
    messages.sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));

    const firstToday = messages[0];
    if (!firstToday) continue;

    // Only count conversations where first message today is inbound (new lead reaching out)
    if (firstToday.direction !== 'inbound') continue;

    // Find first outbound response by this CSR
    const firstResponse = messages.find(m =>
      m.direction === 'outbound' &&
      m.userId === ghlUserId &&
      new Date(m.dateAdded) > new Date(firstToday.dateAdded)
    );

    if (!firstResponse) continue;

    const gapMs = new Date(firstResponse.dateAdded) - new Date(firstToday.dateAdded);
    const gapMinutes = gapMs / 60000;

    // Ignore gaps > 480 min (8 hours) as likely not same-context
    if (gapMinutes > 480 || gapMinutes < 0) continue;

    allGaps.push(gapMinutes);

    // Categorize by the channel of the inbound message (how the lead came in)
    const channel = getChannel(firstToday.type);
    if (channelGaps[channel]) {
      channelGaps[channel].push(gapMinutes);
    }
  }

  if (allGaps.length === 0) return null;

  const overall = summarizeGaps(allGaps);

  // Map to enum bucket
  let bucket;
  if (overall.avg_minutes < 5) bucket = 'under_5';
  else if (overall.avg_minutes < 10) bucket = '5_to_10';
  else if (overall.avg_minutes < 15) bucket = '10_to_15';
  else bucket = 'over_15';

  // Build per-channel breakdown (only include channels with data)
  const byChannel = {};
  for (const [ch, gaps] of Object.entries(channelGaps)) {
    const summary = summarizeGaps(gaps);
    if (summary) byChannel[ch] = summary;
  }

  return {
    avg_minutes: overall.avg_minutes,
    min_minutes: overall.min_minutes,
    max_minutes: overall.max_minutes,
    conversations_counted: allGaps.length,
    bucket,
    by_channel: byChannel,
  };
}

// Fetch opportunities assigned to a user
async function fetchGhlOpportunities(userId) {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!apiKey || !locationId) return [];

  try {
    const params = new URLSearchParams({
      location_id: locationId,
      assigned_to: userId,
      limit: '100',
    });

    const response = await fetch(
      `${GHL_API_BASE}/opportunities/search?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Version': '2021-07-28',
        },
      }
    );

    if (!response.ok) return [];
    const data = await response.json();
    return data.opportunities || [];
  } catch (err) {
    console.error('GHL opportunities fetch error:', err);
    return [];
  }
}

// Get pipeline stage names map
async function fetchPipelineStages() {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!apiKey || !locationId) return {};

  try {
    const response = await fetch(
      `${GHL_API_BASE}/opportunities/pipelines?locationId=${locationId}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Version': '2021-07-28',
        },
      }
    );

    if (!response.ok) return {};
    const data = await response.json();

    const stageMap = {};
    for (const pipeline of (data.pipelines || [])) {
      for (const stage of (pipeline.stages || [])) {
        stageMap[stage.id] = stage.name;
      }
    }
    return stageMap;
  } catch (err) {
    console.error('GHL pipelines fetch error:', err);
    return {};
  }
}

// Analyze opportunities for pipeline metrics and auto-fill dispositions
// Only opportunities that changed stage TODAY are counted as dispositions
// Non-qualified leads are tracked separately and excluded from booking rate
function analyzeOpportunities(opportunities, stageMap, date) {
  const booked = [];
  const lost = [];
  const quoted = [];
  const followup = [];
  const notQualified = [];
  const newLeads = [];
  const allOpps = [];

  for (const opp of opportunities) {
    const stageName = stageMap[opp.pipelineStageId] || opp.pipelineStageName || '';
    const stageL = stageName.toLowerCase();
    const contactName = opp.contact?.name || opp.name || '';
    const value = parseFloat(opp.monetaryValue || 0);
    const lastChange = (opp.lastStageChangeAt || opp.updatedAt || '').split('T')[0];

    const entry = {
      name: contactName,
      stage: stageName,
      value,
      movedAt: opp.lastStageChangeAt || opp.updatedAt,
      ghlId: opp.id,
    };

    if (lastChange === date) {
      // Booked: JR Booked, DR Booked, Booked, Closed Won, etc.
      if (stageL.includes('book') || stageL.includes('schedul') || stageL.includes('won')
          || stageL.includes('approved') || stageL.includes('submitted')) {
        booked.push(entry);
      }
      // Lost: JR Lost, DR Lost, Closed Lost, etc.
      else if (stageL.includes('lost') || stageL.includes('declined') || stageL.includes('cancel')) {
        lost.push(entry);
      }
      // Non-qualified: explicitly not a real lead
      else if (stageL.includes('non-qualified') || stageL.includes('not qualified') || stageL.includes('unqualified')) {
        notQualified.push(entry);
      }
      // Quoted: received pricing but hasn't committed
      else if (stageL.includes('quot') || stageL.includes('estimate') || stageL.includes('proposal')
               || stageL.includes('agreement sent') || stageL.includes('rental agreement')) {
        quoted.push(entry);
      }
      // Follow-up: interested, needs callback or nurture
      else if (stageL.includes('contacted') || stageL.includes('conversation')
               || stageL.includes('nurture') || stageL.includes('follow')) {
        followup.push(entry);
      }
      // Anything else that changed today but doesn't fit above = follow-up
      else if (!stageL.includes('new lead') && !stageL.includes('new')) {
        followup.push(entry);
      }
    }

    if (stageL.includes('new') || stageL === 'new lead') {
      newLeads.push(entry);
    }

    allOpps.push(entry);
  }

  return {
    booked_today: booked.length,
    lost_today: lost.length,
    new_leads_count: newLeads.length,
    total: allOpps.length,
    opportunities: booked,
    dispositions: {
      disp_booked: booked.length,
      disp_quoted: quoted.length,
      disp_followup_required: followup.length,
      disp_not_qualified: notQualified.length,
      disp_lost: lost.length,
    },
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const { employee_id, date } = req.query;
  if (!employee_id || !date) {
    return res.status(400).json({ error: 'employee_id and date are required' });
  }

  try {
    // Look up GHL user ID from employee mapping
    const { data: mapping } = await supabaseAdmin
      .from('ghl_user_mapping')
      .select('ghl_user_id')
      .eq('employee_id', employee_id)
      .single();

    if (!mapping) {
      return res.status(200).json({
        fields: {},
        pipeline: {},
        _sources: {},
        _computed_at: new Date().toISOString(),
        _warning: 'No GHL user mapping found for this employee',
      });
    }

    const ghlUserId = mapping.ghl_user_id;

    // Fetch all messages, opportunities, and assigned conversations in parallel
    const [messageData, opportunities, stageMap, assignedConvIds] = await Promise.all([
      fetchAllMessages(ghlUserId, date),
      fetchGhlOpportunities(ghlUserId),
      fetchPipelineStages(),
      fetchAssignedConversationIds(ghlUserId),
    ]);

    // Analyze the data
    const callMetrics = analyzeCallMessages(messageData.userCalls, messageData.totalInbound, messageData.allDateMessages, ghlUserId, assignedConvIds);
    const messagingMetrics = analyzeMessagingMetrics(messageData.allDateMessages, ghlUserId);
    const speedToLead = calculateSpeedToLead(messageData.allDateMessages, ghlUserId);
    const pipelineData = analyzeOpportunities(opportunities, stageMap, date);

    // Build prefill fields
    const fields = {};
    const sources = {};

    // Call metrics
    fields.total_outbound_calls = callMetrics.outbound;
    sources.total_outbound_calls = 'ghl_calls';

    // Inbound and missed calls: NOT auto-filled. GHL IVR calls don't
    // have userId attribution, so there's no way to know which CSR
    // answered (or missed) each call. CSR enters both manually.
    // Missed call rate is calculated client-side from those entries.

    // Messaging metrics (new)
    fields.total_sms_sent = messagingMetrics.total_sms_sent;
    fields.total_sms_received = messagingMetrics.total_sms_received;
    fields.total_fb_messages_sent = messagingMetrics.total_fb_messages_sent;
    fields.total_fb_messages_received = messagingMetrics.total_fb_messages_received;
    fields.total_ig_messages_sent = messagingMetrics.total_ig_messages_sent;
    fields.total_ig_messages_received = messagingMetrics.total_ig_messages_received;
    fields.total_messages_sent = messagingMetrics.total_messages_sent;
    fields.total_messages_received = messagingMetrics.total_messages_received;
    sources.total_sms_sent = 'ghl_messages';
    sources.total_sms_received = 'ghl_messages';
    sources.total_fb_messages_sent = 'ghl_messages';
    sources.total_fb_messages_received = 'ghl_messages';
    sources.total_ig_messages_sent = 'ghl_messages';
    sources.total_ig_messages_received = 'ghl_messages';
    sources.total_messages_sent = 'ghl_messages';
    sources.total_messages_received = 'ghl_messages';

    // Speed-to-lead
    if (speedToLead) {
      fields.speed_to_lead = speedToLead.bucket;
      fields.speed_to_lead_minutes = speedToLead.avg_minutes;
      fields.speed_to_lead_conversations = speedToLead.conversations_counted;
      sources.speed_to_lead = 'ghl_calculated';
      sources.speed_to_lead_minutes = 'ghl_calculated';
    }

    // Dispositions — auto-fill from GHL pipeline stage changes
    // Only qualified leads (booked, quoted, followup, lost) are included in booking rate
    // Non-qualified leads are tracked but excluded from the rate denominator
    const disps = pipelineData.dispositions;
    fields.disp_booked = disps.disp_booked;
    fields.disp_quoted = disps.disp_quoted;
    fields.disp_followup_required = disps.disp_followup_required;
    fields.disp_not_qualified = disps.disp_not_qualified;
    fields.disp_lost = disps.disp_lost;
    sources.disp_booked = 'ghl_pipeline';
    sources.disp_quoted = 'ghl_pipeline';
    sources.disp_followup_required = 'ghl_pipeline';
    sources.disp_not_qualified = 'ghl_pipeline';
    sources.disp_lost = 'ghl_pipeline';

    return res.status(200).json({
      fields,
      pipeline: {
        new_leads_count: pipelineData.new_leads_count,
        booked_today: pipelineData.booked_today,
        lost_today: pipelineData.lost_today,
        total: pipelineData.total,
        opportunities: pipelineData.opportunities,
      },
      speed_to_lead_detail: speedToLead,
      _sources: sources,
      _counts: {
        user_calls: messageData.userCalls.length,
        total_location_inbound: messageData.totalInbound,
        all_messages_today: messageData.allDateMessages.length,
        opportunities: opportunities.length,
      },
      _computed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('GHL prefill error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
