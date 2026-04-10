/**
 * GET /api/pricing — public pricing API.
 * Returns all active pricing rows from the centralized Supabase pricing table.
 * Any AI system or frontend can call this to get current prices without
 * reading from static JSON files or hardcoded constants.
 *
 * No auth required (pricing is public info). Cached for 5 minutes.
 */
import { supabaseAdmin } from '../_lib/supabase-admin.js';

let _cache = null;
let _cacheAt = 0;
const CACHE_TTL = 5 * 60 * 1000;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=300');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  // Serve from cache if fresh
  if (_cache && Date.now() - _cacheAt < CACHE_TTL) {
    return res.json(_cache);
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const { data, error } = await supabaseAdmin
    .from('pricing')
    .select('*')
    .eq('active', true)
    .order('sort_order');

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  // Group by category for easy consumption
  const grouped = {};
  for (const row of (data || [])) {
    if (!grouped[row.category]) grouped[row.category] = [];
    grouped[row.category].push(row);
  }

  const result = {
    pricing: grouped,
    total: (data || []).length,
    fetched_at: new Date().toISOString(),
  };

  _cache = result;
  _cacheAt = Date.now();

  return res.json(result);
}
