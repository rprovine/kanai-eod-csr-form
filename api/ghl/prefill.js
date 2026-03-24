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
  let totalLocationMissed = 0;
  const countedInbound = new Set();

  for (const msg of allDateMessages) {
    if ((msg.type === 1 || msg.type === 24) && msg.direction === 'inbound') {
      // Track location-wide missed calls
      if (msg.duration < 5 || msg.status === 'no-answer' || msg.status === 'busy') {
        totalLocationMissed++;
      }

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

  return { inbound, outbound, missed, total_location_inbound: totalLocationInbound, total_location_missed: totalLocationMissed };
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

// Summarize an array of gap values (uses median to resist outlier skew)
function summarizeGaps(gaps) {
  if (gaps.length === 0) return null;
  const sorted = [...gaps].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
  const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  return {
    median_minutes: Math.round(median * 10) / 10,
    avg_minutes: Math.round(avg * 10) / 10,
    min_minutes: Math.round(sorted[0] * 10) / 10,
    max_minutes: Math.round(sorted[sorted.length - 1] * 10) / 10,
    count: gaps.length,
  };
}

// Check if a timestamp falls within shift hours (Hawaii time)
function isDuringShift(isoStr, shiftHours) {
  const d = new Date(isoStr);
  // Convert to Hawaii time components
  const parts = d.toLocaleString('en-US', {
    timeZone: 'Pacific/Honolulu',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).split(':');
  const hour = parseInt(parts[0]);
  const minute = parseInt(parts[1]);
  const timeMinutes = hour * 60 + minute;
  const startMinutes = shiftHours.shiftStartHour * 60 + shiftHours.shiftStartMin;
  const endMinutes = shiftHours.shiftEndHour * 60 + shiftHours.shiftEndMin;
  return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
}

// Calculate speed-to-lead from message data
// Groups by conversation, finds first inbound → first outbound response gap
// Only counts inbound messages that arrived during shift hours
// Returns overall average plus per-channel breakdown (calls, sms, facebook, instagram)
function calculateSpeedToLead(allDateMessages, ghlUserId, date, shiftHours) {
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

    // Skip inbound messages that arrived outside shift hours
    if (shiftHours && !isDuringShift(firstToday.dateAdded, shiftHours)) continue;

    // Find first outbound response by this CSR
    const firstResponse = messages.find(m =>
      m.direction === 'outbound' &&
      m.userId === ghlUserId &&
      new Date(m.dateAdded) > new Date(firstToday.dateAdded)
    );

    if (!firstResponse) continue;

    const gapMs = new Date(firstResponse.dateAdded) - new Date(firstToday.dateAdded);
    const gapMinutes = gapMs / 60000;

    // Cap at 60 min — longer gaps are likely existing conversations, not fresh leads
    if (gapMinutes > 60 || gapMinutes < 0) continue;

    allGaps.push(gapMinutes);

    // Categorize by the channel of the inbound message (how the lead came in)
    const channel = getChannel(firstToday.type);
    if (channelGaps[channel]) {
      channelGaps[channel].push(gapMinutes);
    }
  }

  if (allGaps.length === 0) return null;

  const overall = summarizeGaps(allGaps);

  // Map to enum bucket (based on median)
  let bucket;
  if (overall.median_minutes < 5) bucket = 'under_5';
  else if (overall.median_minutes < 10) bucket = '5_to_10';
  else if (overall.median_minutes < 15) bucket = '10_to_15';
  else bucket = 'over_15';

  // Build per-channel breakdown (only include channels with data)
  const byChannel = {};
  for (const [ch, gaps] of Object.entries(channelGaps)) {
    const summary = summarizeGaps(gaps);
    if (summary) byChannel[ch] = summary;
  }

  return {
    median_minutes: overall.median_minutes,
    avg_minutes: overall.avg_minutes,
    min_minutes: overall.min_minutes,
    max_minutes: overall.max_minutes,
    conversations_counted: allGaps.length,
    bucket,
    by_channel: byChannel,
  };
}

// Fetch ALL opportunities for the location using shared client
// Uses pipeline filtering when GHL_PIPELINE_ID is set to avoid the 100-opp pagination cap
async function fetchAllOpportunities() {
  const { fetchOpportunities } = await import('../_lib/ghl-client.js');
  return fetchOpportunities({ limit: 10 });
}

// Filter opportunities to those where this CSR had conversation activity
function filterOpportunitiesByCsrActivity(opportunities, allDateMessages, ghlUserId, assignedConversationIds) {
  // Build set of contactIds where this CSR had outbound activity
  const csrContactIds = new Set();
  for (const msg of allDateMessages) {
    if (msg.direction === 'outbound' && msg.userId === ghlUserId && msg.contactId) {
      csrContactIds.add(msg.contactId);
    }
  }

  // Also include contacts from assigned conversations
  const assignedContactIds = new Set();
  for (const msg of allDateMessages) {
    if (msg.conversationId && assignedConversationIds.has(msg.conversationId) && msg.contactId) {
      assignedContactIds.add(msg.contactId);
    }
  }

  return opportunities.filter(opp => {
    const contactId = opp.contact?.id || opp.contactId || '';
    // CSR interacted with this contact OR it's assigned to them in GHL
    return csrContactIds.has(contactId) || assignedContactIds.has(contactId) || opp.assignedTo === ghlUserId;
  });
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

// GHL custom field IDs for Workiz integration
const CF_WORKIZ_JOB_ID = 'EILH2dteMrekSHTjbzOR';
const CF_WORKIZ_LEAD_ID = 'YcLhZO3aQtXAANTY0P9f';
const CF_JOB_SOURCE = 'MAlXRZPVHa2b5YONicGz';
const CF_START_DATE = 'hdGeah9nPBb5ipGnzRv5';
const CF_SERVICE_TYPE = '7bkN5I5XUjtsJ0T3FKKB';

function getCustomField(opp, fieldId) {
  for (const f of (opp.customFields || [])) {
    if (f.id === fieldId) return f.fieldValue || f.fieldValueString || '';
  }
  return '';
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

  const allBooked = []; // All currently booked opps (for revenue enrichment)

  for (const opp of opportunities) {
    const stageName = stageMap[opp.pipelineStageId] || opp.pipelineStageName || '';
    const stageL = stageName.toLowerCase();
    const contactName = opp.contact?.name || opp.name || '';
    const value = parseFloat(opp.monetaryValue || 0);
    const lastChange = toHawaiiDate(opp.lastStageChangeAt || opp.updatedAt);

    const isBookedStage = stageL.includes('book') || stageL.includes('estimate scheduled')
        || stageL.includes('won') || stageL.includes('approved');

    const entry = {
      name: contactName,
      stage: stageName,
      value,
      movedAt: opp.lastStageChangeAt || opp.updatedAt,
      ghlId: opp.id,
      workizJobId: getCustomField(opp, CF_WORKIZ_JOB_ID),
      workizLeadId: getCustomField(opp, CF_WORKIZ_LEAD_ID),
      scheduledDate: getCustomField(opp, CF_START_DATE),
      jobSource: getCustomField(opp, CF_JOB_SOURCE),
    };

    // Track ALL currently booked opps regardless of when they moved (for revenue enrichment)
    if (isBookedStage) {
      allBooked.push(entry);
    }

    if (lastChange === date) {
      // Booked: JR Booked, DR Booked, Booked, Onsite Estimate Scheduled, Closed Won, etc.
      if (isBookedStage) {
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
      // Estimate Completed: field team gave pricing — should be moved to Booked or Lost
      // Treated as follow-up since it needs a final disposition update
      else if (stageL.includes('estimate completed')) {
        followup.push(entry);
      }
      // Quoted: received pricing but hasn't committed (quote sent, dumpster quote, etc.)
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
    // Include ALL booked opps for Workiz revenue enrichment (not just today's)
    opportunities: allBooked,
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

  const { employee_id, date, shift_start, shift_end } = req.query;
  if (!employee_id || !date) {
    return res.status(400).json({ error: 'employee_id and date are required' });
  }

  // Shift hours for speed-to-lead filtering (default: 08:00-16:30 HST)
  const shiftStartHour = shift_start ? parseInt(shift_start.split(':')[0]) : 8;
  const shiftStartMin = shift_start ? parseInt(shift_start.split(':')[1]) : 0;
  const shiftEndHour = shift_end ? parseInt(shift_end.split(':')[0]) : 16;
  const shiftEndMin = shift_end ? parseInt(shift_end.split(':')[1]) : 30;

  try {
    // Look up GHL user ID from employee mapping
    const { data: mapping } = await supabaseAdmin
      .from('ghl_user_mapping')
      .select('ghl_user_id, ghl_user_name')
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

    // Fetch all messages, ALL opportunities, and assigned conversations in parallel
    const [messageData, allOpportunities, stageMap, assignedConvIds] = await Promise.all([
      fetchAllMessages(ghlUserId, date),
      fetchAllOpportunities(),
      fetchPipelineStages(),
      fetchAssignedConversationIds(ghlUserId),
    ]);

    // Filter to opportunities where this CSR had activity
    const opportunities = filterOpportunitiesByCsrActivity(
      allOpportunities, messageData.allDateMessages, ghlUserId, assignedConvIds
    );

    // Analyze the data
    const callMetrics = analyzeCallMessages(messageData.userCalls, messageData.totalInbound, messageData.allDateMessages, ghlUserId, assignedConvIds);
    const messagingMetrics = analyzeMessagingMetrics(messageData.allDateMessages, ghlUserId);
    const speedToLead = calculateSpeedToLead(messageData.allDateMessages, ghlUserId, date, { shiftStartHour, shiftStartMin, shiftEndHour, shiftEndMin });
    const pipelineData = analyzeOpportunities(opportunities, stageMap, date);

    // Enrich booked opportunities with Workiz serial numbers
    const workizToken = process.env.WORKIZ_API_TOKEN;
    if (workizToken && pipelineData.opportunities.length > 0) {
      await Promise.all(pipelineData.opportunities.map(async (opp) => {
        const uuid = opp.workizJobId || opp.workizLeadId;
        if (!uuid) {
          // No Workiz link — use GHL monetary value as estimated revenue
          if (!opp.revenue && opp.value > 0) opp.revenue = opp.value;
          return;
        }
        try {
          // Try job endpoint first, then lead
          const endpoint = opp.workizJobId ? 'job' : 'lead';
          const r = await fetch(`https://api.workiz.com/api/v1/${workizToken}/${endpoint}/get/${uuid}/`);
          if (r.ok) {
            const text = await r.text();
            if (text) {
              const d = JSON.parse(text);
              const item = Array.isArray(d.data) ? d.data[0] : d.data;
              if (item?.SerialId) {
                opp.jobNumber = String(item.SerialId);
                const workizRev = parseFloat(item.SubTotal || item.JobTotalPrice || 0);
                // Use Workiz revenue if available, otherwise fall back to GHL monetary value
                opp.revenue = workizRev > 0 ? workizRev : opp.value || 0;
              }
            }
          }
        } catch (err) {
          // Non-critical — fall back to UUID
        }
      }));
    }

    // Enrich booked opportunities with Docket task numbers
    // For DR opportunities without a jobNumber, look up the docket_ghl_mapping table
    if (pipelineData.opportunities.length > 0) {
      const drOpps = pipelineData.opportunities.filter(opp => {
        const stageL = (opp.stage || '').toLowerCase();
        return !opp.jobNumber && (stageL.includes('dr ') || stageL.includes('dumpster'));
      });

      if (drOpps.length > 0) {
        const ghlIds = drOpps.map(o => o.ghlId).filter(Boolean);
        if (ghlIds.length > 0) {
          const { data: mappings } = await supabaseAdmin
            .from('docket_ghl_mapping')
            .select('docket_task_number, ghl_opportunity_id')
            .in('ghl_opportunity_id', ghlIds);

          if (mappings && mappings.length > 0) {
            const mapByOpp = {};
            for (const m of mappings) mapByOpp[m.ghl_opportunity_id] = m.docket_task_number;
            for (const opp of drOpps) {
              if (opp.ghlId && mapByOpp[opp.ghlId]) {
                opp.jobNumber = mapByOpp[opp.ghlId];
              }
            }
          }
        }
      }
    }

    // Final enrichment: cross-reference completed jobs in field supervisor data for actual revenue
    // This catches revenue for jobs that have been completed and invoiced in Workiz
    const oppsNeedingRevenue = pipelineData.opportunities.filter(o => !o.revenue && o.jobNumber);
    if (oppsNeedingRevenue.length > 0) {
      const jobNumbers = oppsNeedingRevenue.map(o => o.jobNumber).filter(Boolean);
      if (jobNumbers.length > 0) {
        const { data: completedJobs } = await supabaseAdmin
          .from('junk_removal_jobs')
          .select('job_number, revenue')
          .in('job_number', jobNumbers)
          .gt('revenue', 0);

        if (completedJobs?.length > 0) {
          const revMap = {};
          for (const j of completedJobs) revMap[j.job_number] = parseFloat(j.revenue);
          for (const opp of oppsNeedingRevenue) {
            if (opp.jobNumber && revMap[opp.jobNumber]) {
              opp.revenue = revMap[opp.jobNumber];
            }
          }
        }
      }
    }

    // Build prefill fields
    const fields = {};
    const sources = {};

    // Call metrics
    fields.total_outbound_calls = callMetrics.outbound;
    sources.total_outbound_calls = 'ghl_calls';

    // Inbound and missed calls: use total location numbers from GHL
    fields.total_inbound_calls = callMetrics.total_location_inbound;
    fields.missed_calls = callMetrics.total_location_missed;
    sources.total_inbound_calls = 'ghl_calls';
    sources.missed_calls = 'ghl_calls';

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
      fields.speed_to_lead_minutes = speedToLead.median_minutes;
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

    // Log lead activity for this CSR — tracks who did what for multi-CSR attribution
    // Maps disposition type → action for the activity log
    const ACTION_MAP = {
      booked: 'booked',
      quoted: 'quoted',
      followup: 'follow_up',
      lost: 'lost',
      notQualified: 'not_qualified',
    };
    const dispBuckets = { booked: pipelineData.opportunities || [], quoted: [], followup: [], lost: [], notQualified: [] };
    // Rebuild buckets from analyzeOpportunities internal data
    for (const opp of opportunities) {
      const stageName = stageMap[opp.pipelineStageId] || opp.pipelineStageName || '';
      const stageL = stageName.toLowerCase();
      const lastChange = toHawaiiDate(opp.lastStageChangeAt || opp.updatedAt);
      if (lastChange !== date) continue;
      const entry = { id: opp.id, contactId: opp.contact?.id || opp.contactId, name: opp.contact?.name || opp.name || '', stage: stageName, leadSource: getCustomField(opp, CF_JOB_SOURCE) };

      if (stageL.includes('book') || stageL.includes('estimate scheduled') || stageL.includes('won') || stageL.includes('approved')) {
        dispBuckets.booked.push(entry);
      } else if (stageL.includes('lost') || stageL.includes('declined') || stageL.includes('cancel')) {
        dispBuckets.lost.push(entry);
      } else if (stageL.includes('non-qualified') || stageL.includes('not qualified') || stageL.includes('unqualified')) {
        dispBuckets.notQualified.push(entry);
      } else if (stageL.includes('quot') || stageL.includes('estimate') || stageL.includes('proposal') || stageL.includes('agreement')) {
        dispBuckets.quoted.push(entry);
      } else if (!stageL.includes('new')) {
        dispBuckets.followup.push(entry);
      }
    }

    // Also log first_contact for any conversation where this CSR was the first responder today
    const firstContactOpps = [];
    if (speedToLead && speedToLead.conversations_counted > 0) {
      // CSR responded to new leads today — log as first_contact
      // We already have the contact IDs from message analysis
      const respondedContactIds = new Set();
      for (const msg of messageData.allDateMessages) {
        if (msg.direction === 'outbound' && msg.userId === ghlUserId && msg.contactId) {
          respondedContactIds.add(msg.contactId);
        }
      }
      for (const opp of opportunities) {
        const cid = opp.contact?.id || opp.contactId;
        if (cid && respondedContactIds.has(cid)) {
          const stageName = stageMap[opp.pipelineStageId] || opp.pipelineStageName || '';
          firstContactOpps.push({ id: opp.id, contactId: cid, name: opp.contact?.name || opp.name || '', stage: stageName });
        }
      }
    }

    // Build activity log rows
    const activityRows = [];
    const seen = new Set();
    for (const [bucket, entries] of Object.entries(dispBuckets)) {
      const action = ACTION_MAP[bucket];
      if (!action) continue;
      for (const e of entries) {
        const key = `${e.id}-${action}-${date}`;
        if (seen.has(key)) continue;
        seen.add(key);
        activityRows.push({
          opportunity_id: e.id || e.ghlId,
          contact_id: e.contactId || null,
          contact_name: e.name,
          csr_employee_id: employee_id,
          csr_name: mapping.ghl_user_name || '',
          action,
          action_date: date,
          stage_name: e.stage,
          lead_source: e.leadSource || null,
        });
      }
    }
    for (const e of firstContactOpps) {
      const key = `${e.id}-first_contact-${date}`;
      if (seen.has(key)) continue;
      seen.add(key);
      activityRows.push({
        opportunity_id: e.id,
        contact_id: e.contactId || null,
        contact_name: e.name,
        csr_employee_id: employee_id,
        csr_name: mapping.ghl_user_name || '',
        action: 'first_contact',
        action_date: date,
        stage_name: e.stage,
        lead_source: e.leadSource || null,
      });
    }

    // Upsert activity log (idempotent on opportunity_id + csr + action + date)
    if (activityRows.length > 0) {
      await supabaseAdmin
        .from('lead_activity_log')
        .upsert(activityRows, { onConflict: 'opportunity_id,csr_employee_id,action,action_date', ignoreDuplicates: true })
        .then(() => {})
        .catch(err => console.error('Lead activity log error:', err));
    }

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
