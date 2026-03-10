import { supabaseAdmin } from '../_lib/supabase-admin.js';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';

// Map average response time (seconds) to speed_to_lead bucket
function speedToLeadBucket(avgSeconds) {
  if (avgSeconds == null) return '';
  if (avgSeconds <= 300) return 'under_5';      // under 5 minutes
  if (avgSeconds <= 600) return '5_to_10';       // 5-10 minutes
  if (avgSeconds <= 900) return '10_to_15';      // 10-15 minutes
  return 'over_15';                               // over 15 minutes
}

// Convert a GHL timestamp (ms or ISO) to YYYY-MM-DD
function toDateStr(ts) {
  if (!ts) return null;
  // GHL uses millisecond timestamps
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  if (isNaN(d)) return null;
  return d.toISOString().split('T')[0];
}

// Fetch phone conversations from GHL API for a specific date
// GHL assigns calls to the location number, not individual users,
// so we fetch all phone conversations for the location on that date
async function fetchGhlConversations(userId, date) {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!apiKey || !locationId) return [];

  const allConversations = [];

  // Fetch recent phone conversations (sorted by last message, desc)
  // We paginate until we pass our target date
  let startAfterId = null;

  for (let page = 0; page < 10; page++) {
    const params = new URLSearchParams({
      locationId,
      limit: '100',
      sortBy: 'last_message_date',
      sortOrder: 'desc',
    });
    if (startAfterId) params.set('startAfterId', startAfterId);

    try {
      const response = await fetch(
        `${GHL_API_BASE}/conversations/search?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Version': '2021-07-28',
          },
        }
      );

      if (!response.ok) break;
      const data = await response.json();
      const convs = data.conversations || [];
      if (convs.length === 0) break;

      let foundOlder = false;
      for (const conv of convs) {
        // Only count phone/call conversations
        const type = (conv.type || '').toUpperCase();
        if (!type.includes('PHONE') && !type.includes('CALL')) continue;

        const msgDate = toDateStr(conv.lastMessageDate);

        if (msgDate === date) {
          allConversations.push(conv);
        } else if (msgDate && msgDate < date) {
          foundOlder = true;
          break;
        }
      }

      if (foundOlder) break;

      startAfterId = convs[convs.length - 1]?.id;
      if (convs.length < 100) break;
    } catch (err) {
      console.error('GHL conversations fetch error:', err);
      break;
    }
  }

  return allConversations;
}

// Fetch opportunities assigned to a user
async function fetchGhlOpportunities(userId, date) {
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

    // Build stage ID → name map
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

// Analyze conversations to extract call metrics
// Note: GHL tracks calls at the location level, so these are total
// location call counts for the day (not per-user)
function analyzeConversations(conversations) {
  let inbound = 0;
  let outbound = 0;
  let missed = 0;

  for (const conv of conversations) {
    const lastDir = (conv.lastMessageDirection || '').toLowerCase();
    const unread = conv.unreadCount || 0;
    const inbox = conv.inbox;

    if (lastDir === 'inbound' || lastDir === 'incoming') {
      inbound++;
      // Missed = inbound call still in inbox with no outbound response
      if (inbox && unread > 0 && !conv.lastOutboundMessageAction) {
        missed++;
      }
    } else if (lastDir === 'outbound' || lastDir === 'outgoing') {
      outbound++;
    }
  }

  return { inbound, outbound, missed };
}

// Analyze opportunities for pipeline metrics
function analyzeOpportunities(opportunities, stageMap, date) {
  const booked = [];
  const lost = [];
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

    // Only count today's movements for daily metrics
    if (lastChange === date) {
      if (stageL.includes('book') || stageL.includes('schedul') || stageL.includes('won')
          || stageL.includes('approved') || stageL.includes('submitted')) {
        booked.push(entry);
      }
      if (stageL.includes('lost') || stageL.includes('declined') || stageL.includes('cancel')) {
        lost.push(entry);
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
    opportunities: booked, // Only return booked ones for job suggestions
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

    // Pull data directly from GHL API (no webhooks needed)
    const [conversations, opportunities, stageMap] = await Promise.all([
      fetchGhlConversations(ghlUserId, date),
      fetchGhlOpportunities(ghlUserId, date),
      fetchPipelineStages(),
    ]);

    // Analyze the data
    const callMetrics = analyzeConversations(conversations);
    const pipelineData = analyzeOpportunities(opportunities, stageMap, date);

    // Build prefill fields
    const fields = {};
    const sources = {};

    if (conversations.length > 0) {
      fields.total_inbound_calls = callMetrics.inbound;
      fields.total_outbound_calls = callMetrics.outbound;
      fields.missed_calls = callMetrics.missed;
      sources.total_inbound_calls = 'ghl_calls';
      sources.total_outbound_calls = 'ghl_calls';
      sources.missed_calls = 'ghl_calls';

      // Auto-calc missed call rate
      if (callMetrics.inbound > 0) {
        fields.missed_call_rate = Math.round(
          (callMetrics.missed / callMetrics.inbound) * 100 * 10
        ) / 10;
        sources.missed_call_rate = 'ghl_calls';
      }
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
      _sources: sources,
      _counts: {
        conversations: conversations.length,
        opportunities: opportunities.length,
      },
      _computed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('GHL prefill error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
