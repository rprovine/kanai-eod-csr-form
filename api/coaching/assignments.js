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

  const { employee_id } = req.query;

  try {
    let query = supabaseAdmin
      .from('coaching_assignments')
      .select('*, csr_employees(name)')
      .eq('status', 'active')
      .order('week_start', { ascending: false });

    if (employee_id) {
      query = query.eq('csr_employee_id', employee_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Assignments query error:', error);
      return res.status(500).json({ error: 'Database query failed' });
    }

    return res.status(200).json({ assignments: data || [] });
  } catch (error) {
    console.error('Assignments error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
