import { supabaseAdmin } from '../_lib/supabase-admin.js';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';

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

// Detect stale opportunities (in early stages for >48 hours)
function detectStale(opportunities) {
  const now = Date.now();
  const staleThresholdMs = 48 * 60 * 60 * 1000; // 48 hours

  return opportunities.filter((opp) => {
    const stage = (opp.pipelineStageId || opp.stage || '').toLowerCase();
    const isEarlyStage = stage.includes('new') || stage.includes('lead')
      || stage.includes('quot') || stage.includes('contact');

    if (!isEarlyStage) return false;

    const lastUpdate = new Date(opp.lastStageChangeAt || opp.dateUpdated || opp.dateAdded);
    return (now - lastUpdate.getTime()) > staleThresholdMs;
  });
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
        if (stage.includes('book') || stage.includes('won') || stage.includes('schedul')) bookedToday++;
        if (stage.includes('lost') || stage.includes('dead')) lostToday++;
      }
    }

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
        stale_leads: staleOpps.map((o) => ({
          id: o.id,
          name: o.contactName || o.name,
          stage: o.pipelineStageName || o.stage,
          daysSinceUpdate: Math.round(
            (Date.now() - new Date(o.lastStageChangeAt || o.dateUpdated).getTime()) / 86400000
          ),
        })),
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
