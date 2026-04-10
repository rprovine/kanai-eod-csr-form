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

  const { employee_id, start_date, end_date, limit = '50', offset = '0' } = req.query;
  const pageLimit = Math.min(parseInt(limit) || 50, 100);
  const pageOffset = parseInt(offset) || 0;

  try {
    let query = supabaseAdmin
      .from('coaching_calls')
      .select('*, coaching_call_scores(*)')
      .eq('status', 'scored')
      .order('call_timestamp', { ascending: false })
      .range(pageOffset, pageOffset + pageLimit - 1);

    if (employee_id) {
      query = query.eq('csr_employee_id', employee_id);
    }

    if (start_date) {
      query = query.gte('call_timestamp', `${start_date}T00:00:00`);
    }

    if (end_date) {
      query = query.lte('call_timestamp', `${end_date}T23:59:59`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Calls query error:', error);
      return res.status(500).json({ error: 'Database query failed' });
    }

    return res.status(200).json({
      calls: data || [],
      limit: pageLimit,
      offset: pageOffset,
    });
  } catch (error) {
    console.error('Calls error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
