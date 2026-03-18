import { supabaseAdmin } from '../_lib/supabase-admin.js';
import { authorize } from '../_lib/authorize.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  if (!authorize(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const { start_date, end_date, employee_id } = req.query;
  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'start_date and end_date parameters required' });
  }

  try {
    let query = supabaseAdmin
      .from('lead_activity_log')
      .select('*')
      .gte('created_at', `${start_date}T00:00:00`)
      .lte('created_at', `${end_date}T23:59:59`)
      .order('created_at', { ascending: true });

    if (employee_id) {
      query = query.eq('employee_id', employee_id);
    }

    const { data: activities, error } = await query;

    if (error) {
      console.error('Funnel timing query error:', error);
      return res.status(500).json({ error: 'Database query failed' });
    }

    if (!activities || activities.length === 0) {
      return res.status(200).json({
        conversionTimes: { median: null, average: null, min: null, max: null, count: 0 },
        stageDistribution: [],
      });
    }

    // Group activities by opportunity_id
    const opportunities = {};
    for (const act of activities) {
      const oppId = act.opportunity_id;
      if (!oppId) continue;
      if (!opportunities[oppId]) {
        opportunities[oppId] = [];
      }
      opportunities[oppId].push(act);
    }

    // Calculate conversion times (first_contact -> booked)
    const conversionHours = [];
    const stageCounts = { 'New Lead': 0, 'Contacted': 0, 'Quoted': 0, 'Booked': 0, 'Lost': 0 };

    for (const [oppId, acts] of Object.entries(opportunities)) {
      const firstContact = acts.find(a => a.action === 'first_contact');
      const booked = acts.find(a => a.action === 'booked');

      if (firstContact && booked) {
        const contactTime = new Date(firstContact.created_at);
        const bookedTime = new Date(booked.created_at);
        const deltaHours = (bookedTime - contactTime) / (1000 * 60 * 60);
        if (deltaHours >= 0) {
          conversionHours.push(Math.round(deltaHours * 10) / 10);
        }
      }

      // Determine current stage from most recent action
      const lastAction = acts[acts.length - 1];
      const actionToStage = {
        'new_lead': 'New Lead',
        'first_contact': 'Contacted',
        'contacted': 'Contacted',
        'quoted': 'Quoted',
        'booked': 'Booked',
        'lost': 'Lost',
        'closed_lost': 'Lost',
      };
      const stage = actionToStage[lastAction.action] || 'New Lead';
      if (stageCounts[stage] !== undefined) {
        stageCounts[stage]++;
      }
    }

    // Calculate stats
    let conversionStats = { median: null, average: null, min: null, max: null, count: 0 };
    if (conversionHours.length > 0) {
      conversionHours.sort((a, b) => a - b);
      const mid = Math.floor(conversionHours.length / 2);
      const median = conversionHours.length % 2 === 0
        ? Math.round((conversionHours[mid - 1] + conversionHours[mid]) / 2 * 10) / 10
        : conversionHours[mid];
      const average = Math.round(conversionHours.reduce((s, v) => s + v, 0) / conversionHours.length * 10) / 10;

      conversionStats = {
        median,
        average,
        min: conversionHours[0],
        max: conversionHours[conversionHours.length - 1],
        count: conversionHours.length,
      };
    }

    const stageDistribution = Object.entries(stageCounts)
      .map(([stage, count]) => ({ stage, count }))
      .filter(s => s.count > 0);

    return res.status(200).json({
      conversionTimes: conversionStats,
      stageDistribution,
    });
  } catch (error) {
    console.error('Funnel timing error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
