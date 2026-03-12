import { supabaseAdmin } from '../_lib/supabase-admin.js';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';

// Convert an ISO date string to YYYY-MM-DD in Hawaii time
function toHawaiiDate(isoStr) {
  if (!isoStr) return null;
  const d = new Date(isoStr);
  if (isNaN(d)) return null;
  return d.toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });
}

// Fetch individual call messages from GHL messages export API
// Paginates backward through all messages until we pass the target date
async function fetchCallMessages(ghlUserId, date) {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!apiKey || !locationId || !ghlUserId) return { userCalls: [], totalInbound: 0 };

  const userCalls = [];
  let totalInbound = 0;
  let cursor = null;

  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({
      locationId,
      limit: '100',
    });
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
        // type 1 = TYPE_CALL (direct calls, usually outbound with userId)
        // type 24 = TYPE_IVR_CALL (IVR-routed calls, usually inbound, no userId)
        if (msg.type !== 1 && msg.type !== 24) continue;

        const msgDate = toHawaiiDate(msg.dateAdded);
        if (!msgDate) continue;

        if (msgDate === date) {
          const direction = (msg.direction || '').toLowerCase();
          const userId = msg.userId || null;
          const duration = msg.meta?.call?.duration || 0;
          const status = msg.meta?.call?.status || '';

          // Count total location inbound (IVR calls can't be attributed to a CSR)
          if (direction === 'inbound') {
            totalInbound++;
          }

          // Count calls attributed to this CSR (outbound have userId, IVR inbound don't)
          if (userId === ghlUserId) {
            userCalls.push({
              direction,
              duration,
              status,
              dateAdded: msg.dateAdded,
              contactId: msg.contactId,
            });
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

  return { userCalls, totalInbound };
}

// Analyze call messages for a specific CSR
function analyzeCallMessages(userCalls, totalLocationInbound) {
  let inbound = 0;
  let outbound = 0;
  let missed = 0;

  for (const call of userCalls) {
    if (call.direction === 'inbound') {
      inbound++;
      // A missed call has very short duration (< 5 seconds) or no-answer status
      if (call.duration < 5 || call.status === 'no-answer' || call.status === 'busy') {
        missed++;
      }
    } else if (call.direction === 'outbound') {
      outbound++;
    }
  }

  return {
    inbound,
    outbound,
    missed,
    total_location_inbound: totalLocationInbound,
  };
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
    opportunities: booked,
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

    // Fetch call messages and opportunities in parallel
    const [callData, opportunities, stageMap] = await Promise.all([
      fetchCallMessages(ghlUserId, date),
      fetchGhlOpportunities(ghlUserId, date),
      fetchPipelineStages(),
    ]);

    // Analyze the data
    const callMetrics = analyzeCallMessages(callData.userCalls, callData.totalInbound);
    const pipelineData = analyzeOpportunities(opportunities, stageMap, date);

    // Build prefill fields
    const fields = {};
    const sources = {};

    // Auto-fill outbound calls (accurately attributed per-CSR via userId)
    fields.total_outbound_calls = callMetrics.outbound;
    sources.total_outbound_calls = 'ghl_calls';

    // Inbound calls from IVR can't be attributed to a specific CSR,
    // so we auto-fill with the CSR's attributed inbound count (if any)
    // and provide total location inbound as context
    fields.total_inbound_calls = callMetrics.inbound;
    sources.total_inbound_calls = 'ghl_calls';

    // Missed calls from attributed inbound
    fields.missed_calls = callMetrics.missed;
    sources.missed_calls = 'ghl_calls';

    // Auto-calc missed call rate if we have inbound data
    if (callMetrics.inbound > 0) {
      fields.missed_call_rate = Math.round(
        (callMetrics.missed / callMetrics.inbound) * 100 * 10
      ) / 10;
      sources.missed_call_rate = 'ghl_calls';
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
        user_calls: callData.userCalls.length,
        total_location_inbound: callData.totalInbound,
        opportunities: opportunities.length,
      },
      _computed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('GHL prefill error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
