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

  const { weeks = '1' } = req.query;
  const weekCount = Math.min(parseInt(weeks) || 1, 12);

  try {
    // Fetch recent summaries
    const { data: summaries, error } = await supabaseAdmin
      .from('coaching_csr_weekly_summary')
      .select('*')
      .order('week_start', { ascending: false })
      .limit(weekCount * 20);

    if (error) {
      console.error('Leaderboard query error:', error);
      return res.status(500).json({ error: 'Database query failed' });
    }

    if (!summaries || summaries.length === 0) {
      return res.status(200).json({ leaderboard: [] });
    }

    // Find the N most recent distinct weeks
    const distinctWeeks = [...new Set(summaries.map(s => s.week_start))].slice(0, weekCount);
    const filtered = summaries.filter(s => distinctWeeks.includes(s.week_start));

    // Aggregate by CSR across selected weeks
    const csrMap = {};
    for (const row of filtered) {
      const id = row.csr_employee_id;
      if (!csrMap[id]) {
        csrMap[id] = {
          csr_employee_id: id,
          csr_name: row.csr_name,
          total_calls: 0,
          scored_calls: 0,
          booked_count: 0,
          qualified_leads: 0,
          sum_overall: 0,
          sum_greeting: 0,
          sum_needs: 0,
          sum_pricing: 0,
          sum_objection: 0,
          sum_close: 0,
          count: 0,
        };
      }
      const c = csrMap[id];
      c.total_calls += row.total_calls || 0;
      c.scored_calls += row.scored_calls || 0;
      c.booked_count += row.booked_count || 0;
      c.qualified_leads += row.qualified_leads || 0;
      c.sum_overall += parseFloat(row.avg_overall_score || 0);
      c.sum_greeting += parseFloat(row.avg_greeting || 0);
      c.sum_needs += parseFloat(row.avg_needs_discovery || 0);
      c.sum_pricing += parseFloat(row.avg_pricing_confidence || 0);
      c.sum_objection += parseFloat(row.avg_objection_handling || 0);
      c.sum_close += parseFloat(row.avg_close_attempt || 0);
      c.count++;
    }

    const leaderboard = Object.values(csrMap)
      .map(c => ({
        csr_employee_id: c.csr_employee_id,
        csr_name: c.csr_name,
        total_calls: c.total_calls,
        scored_calls: c.scored_calls,
        booked_count: c.booked_count,
        qualified_leads: c.qualified_leads,
        booking_rate: c.qualified_leads > 0 ? Math.round((c.booked_count / c.qualified_leads) * 1000) / 10 : 0,
        avg_overall: c.count > 0 ? Math.round((c.sum_overall / c.count) * 100) / 100 : 0,
        avg_greeting: c.count > 0 ? Math.round((c.sum_greeting / c.count) * 100) / 100 : 0,
        avg_needs_discovery: c.count > 0 ? Math.round((c.sum_needs / c.count) * 100) / 100 : 0,
        avg_pricing_confidence: c.count > 0 ? Math.round((c.sum_pricing / c.count) * 100) / 100 : 0,
        avg_objection_handling: c.count > 0 ? Math.round((c.sum_objection / c.count) * 100) / 100 : 0,
        avg_close_attempt: c.count > 0 ? Math.round((c.sum_close / c.count) * 100) / 100 : 0,
        weeks_included: c.count,
      }))
      .sort((a, b) => b.avg_overall - a.avg_overall);

    return res.status(200).json({ leaderboard, weeks: distinctWeeks });
  } catch (error) {
    console.error('Leaderboard error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
