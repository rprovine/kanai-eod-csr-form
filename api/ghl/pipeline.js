import { supabaseAdmin } from '../_lib/supabase-admin.js';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const MIN_CONTACT_ATTEMPTS = 3;

// Fetch opportunities from GHL API v2
async function fetchGhlOpportunities(pipelineId, assignedTo) {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;

  if (!apiKey || !locationId) return null;

  const params = new URLSearchParams({
    location_id: locationId,
    ...(pipelineId && { pipeline_id: pipelineId }),
    ...(assignedTo && { assigned_to: assignedTo }),
    limit: '100',
  });

  const response = await fetch(
    `${GHL_API_BASE}/opportunities/search?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    console.error('GHL API error:', response.status, await response.text());
    return null;
  }

  const data = await response.json();
  return data.opportunities || [];
}

// Detect stale opportunities (in early/mid stages for >48 hours without movement)
function detectStale(opportunities) {
  const now = Date.now();
  const staleThresholdMs = 48 * 60 * 60 * 1000; // 48 hours

  return opportunities.filter((opp) => {
    const stageName = (opp.pipelineStageName || opp.stage || '').toLowerCase();
    // Flag leads sitting in stages that require CSR action
    const isActionableStage = stageName.includes('new') || stageName.includes('lead')
      || stageName.includes('contact')
      || stageName.includes('quot')
      || stageName.includes('estimate')
      || stageName.includes('conversation')
      || stageName.includes('nurture')
      || stageName.includes('agreement sent');

    // Don't flag terminal stages (booked, lost, won, non-qualified)
    const isTerminal = stageName.includes('book') || stageName.includes('lost')
      || stageName.includes('won') || stageName.includes('non-qualified')
      || stageName.includes('not qualified') || stageName.includes('activated');

    if (!isActionableStage || isTerminal) return false;

    const lastUpdate = new Date(opp.lastStageChangeAt || opp.dateUpdated || opp.dateAdded);
    return (now - lastUpdate.getTime()) > staleThresholdMs;
  });
}

// Count outbound contact attempts for a list of contacts via GHL conversations
// Returns a map of contactId → { attempts, lastContactDate }
async function countContactAttempts(contactIds) {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!apiKey || !locationId || contactIds.length === 0) return {};

  const results = {};

  // Fetch conversations for each contact (limit to 10 to avoid rate limits)
  const batch = contactIds.slice(0, 10);
  await Promise.all(batch.map(async (contactId) => {
    try {
      const params = new URLSearchParams({
        locationId,
        contactId,
        limit: '1',
      });
      const convResponse = await fetch(
        `${GHL_API_BASE}/conversations/search?${params}`,
        { headers: { 'Authorization': `Bearer ${apiKey}`, 'Version': '2021-07-28' } }
      );
      if (!convResponse.ok) return;
      const convData = await convResponse.json();
      const conversation = (convData.conversations || [])[0];
      if (!conversation?.id) return;

      // Fetch messages for this conversation
      const msgResponse = await fetch(
        `${GHL_API_BASE}/conversations/${conversation.id}/messages`,
        { headers: { 'Authorization': `Bearer ${apiKey}`, 'Version': '2021-07-28' } }
      );
      if (!msgResponse.ok) return;
      const msgData = await msgResponse.json();
      const messages = msgData.messages?.messages || msgData.messages || [];

      // Count distinct outbound contact days (each day with outbound = 1 attempt)
      const outboundDays = new Set();
      let lastOutbound = null;
      for (const msg of messages) {
        if ((msg.direction || '').toLowerCase() === 'outbound') {
          const day = (msg.dateAdded || '').split('T')[0];
          if (day) outboundDays.add(day);
          if (!lastOutbound || msg.dateAdded > lastOutbound) lastOutbound = msg.dateAdded;
        }
      }

      results[contactId] = {
        attempts: outboundDays.size,
        lastContactDate: lastOutbound,
      };
    } catch (err) {
      console.error(`Error counting attempts for contact ${contactId}:`, err);
    }
  }));

  return results;
}

// Check leads moved to Lost today — flag those with insufficient contact attempts
function detectPrematureLost(opportunities, contactAttempts, date) {
  const warnings = [];
  for (const opp of opportunities) {
    const stageName = (opp.pipelineStageName || '').toLowerCase();
    const lastChange = (opp.lastStageChangeAt || opp.dateUpdated || '').split('T')[0];
    if (lastChange !== date) continue;
    if (!stageName.includes('lost') && !stageName.includes('declined')) continue;

    const contactId = opp.contact?.id || opp.contactId || '';
    const attempts = contactAttempts[contactId]?.attempts || 0;
    if (attempts < MIN_CONTACT_ATTEMPTS) {
      warnings.push({
        id: opp.id,
        name: opp.contact?.name || opp.contactName || opp.name || '',
        stage: opp.pipelineStageName || opp.stage || '',
        attempts,
        required: MIN_CONTACT_ATTEMPTS,
      });
    }
  }
  return warnings;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' });
  }

  const apiKey = process.env.GHL_API_KEY;
  if (!apiKey) {
    return res.status(200).json({
      pipeline: {},
      _warning: 'GHL_API_KEY not configured',
    });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const { employee_id, date } = req.query;
  if (!employee_id) {
    return res.status(400).json({ error: 'employee_id is required' });
  }

  try {
    // Look up GHL user ID
    const { data: mapping } = await supabaseAdmin
      .from('ghl_user_mapping')
      .select('ghl_user_id')
      .eq('employee_id', employee_id)
      .single();

    if (!mapping) {
      return res.status(200).json({
        pipeline: {},
        _warning: 'No GHL user mapping found',
      });
    }

    // Fetch opportunities from GHL API
    const opportunities = await fetchGhlOpportunities(null, mapping.ghl_user_id);

    if (!opportunities) {
      return res.status(200).json({
        pipeline: {},
        _warning: 'Could not fetch GHL opportunities',
      });
    }

    // Categorize by stage
    const stageGroups = {};
    for (const opp of opportunities) {
      const stage = opp.pipelineStageName || opp.stage || 'Unknown';
      if (!stageGroups[stage]) stageGroups[stage] = [];
      stageGroups[stage].push({
        id: opp.id,
        name: opp.contactName || opp.name || '',
        value: parseFloat(opp.monetaryValue || 0),
        stage,
        lastUpdated: opp.lastStageChangeAt || opp.dateUpdated,
      });
    }

    // Detect stale leads
    const staleOpps = detectStale(opportunities);

    // Count today's movements (if date provided)
    let bookedToday = 0;
    let lostToday = 0;
    if (date) {
      for (const opp of opportunities) {
        const updateDate = (opp.lastStageChangeAt || opp.dateUpdated || '').split('T')[0];
        if (updateDate !== date) continue;
        const stage = (opp.pipelineStageName || '').toLowerCase();
        if (stage.includes('book') || stage.includes('won') || stage.includes('estimate scheduled')) bookedToday++;
        if (stage.includes('lost') || stage.includes('dead')) lostToday++;
      }
    }

    // Collect contact IDs from stale leads + today's lost leads for attempt counting
    const contactIdsToCheck = new Set();
    for (const opp of staleOpps) {
      const cid = opp.contact?.id || opp.contactId;
      if (cid) contactIdsToCheck.add(cid);
    }
    if (date) {
      for (const opp of opportunities) {
        const updateDate = (opp.lastStageChangeAt || opp.dateUpdated || '').split('T')[0];
        const stage = (opp.pipelineStageName || '').toLowerCase();
        if (updateDate === date && (stage.includes('lost') || stage.includes('declined'))) {
          const cid = opp.contact?.id || opp.contactId;
          if (cid) contactIdsToCheck.add(cid);
        }
      }
    }

    // Count contact attempts for stale + lost leads
    const contactAttempts = await countContactAttempts([...contactIdsToCheck]);

    // Detect leads moved to Lost with < 3 contact attempts
    const prematureLostWarnings = date ? detectPrematureLost(opportunities, contactAttempts, date) : [];

    // Cache the snapshot in Supabase
    await supabaseAdmin
      .from('ghl_daily_pipeline_summary')
      .upsert({
        employee_id,
        summary_date: date || new Date().toISOString().split('T')[0],
        new_leads_count: (stageGroups['New Lead'] || stageGroups['New'] || []).length,
        stale_leads_count: staleOpps.length,
        booked_today: bookedToday,
        lost_today: lostToday,
        quoted_pending: (stageGroups['Quoted'] || stageGroups['Quote Sent'] || []).length,
        opportunities: opportunities.slice(0, 50), // cap at 50 for storage
        computed_at: new Date().toISOString(),
      }, { onConflict: 'employee_id,summary_date' });

    return res.status(200).json({
      pipeline: {
        total: opportunities.length,
        stages: stageGroups,
        stale_count: staleOpps.length,
        stale_leads: staleOpps.map((o) => {
          const cid = o.contact?.id || o.contactId;
          const attempts = contactAttempts[cid]?.attempts || 0;
          return {
            id: o.id,
            name: o.contactName || o.name,
            stage: o.pipelineStageName || o.stage,
            daysSinceUpdate: Math.round(
              (Date.now() - new Date(o.lastStageChangeAt || o.dateUpdated).getTime()) / 86400000
            ),
            contactAttempts: attempts,
            needsFollowUp: attempts < MIN_CONTACT_ATTEMPTS,
          };
        }),
        premature_lost: prematureLostWarnings,
        min_contact_attempts: MIN_CONTACT_ATTEMPTS,
        booked_today: bookedToday,
        lost_today: lostToday,
      },
      _computed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('GHL pipeline error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
