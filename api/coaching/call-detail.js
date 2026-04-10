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

  const { call_id } = req.query;
  if (!call_id) {
    return res.status(400).json({ error: 'call_id parameter required' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('coaching_calls')
      .select('*, coaching_call_scores(*)')
      .eq('id', call_id)
      .single();

    if (error) {
      console.error('Call detail query error:', error);
      return res.status(500).json({ error: 'Database query failed' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Call not found' });
    }

    return res.status(200).json({ call: data });
  } catch (error) {
    console.error('Call detail error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
