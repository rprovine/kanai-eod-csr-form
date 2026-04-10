/**
 * Sync GHL users → Supabase ghl_user_mapping.
 * Runs weekly via cron, or manually triggered.
 * Creates mapping rows for any GHL users not already in the table.
 */
import { authorize } from '../_lib/authorize.js';
import { supabaseAdmin } from '../_lib/supabase-admin.js';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';

function ghlHeaders() {
  return {
    'Authorization': `Bearer ${(process.env.GHL_API_KEY || '').trim()}`,
    'Version': '2021-07-28',
    'Content-Type': 'application/json',
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!authorize(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!supabaseAdmin) return res.status(500).json({ error: 'Database not configured' });

  try {
    const locationId = (process.env.GHL_LOCATION_ID || '').trim();
    const resp = await fetch(`${GHL_API_BASE}/users/?locationId=${locationId}`, {
      headers: ghlHeaders(),
    });
    if (!resp.ok) return res.status(502).json({ error: `GHL returned ${resp.status}` });

    const { users } = await resp.json();
    if (!users?.length) return res.json({ synced: 0, message: 'No GHL users found' });

    // Get existing mappings
    const { data: existing } = await supabaseAdmin
      .from('ghl_user_mapping')
      .select('ghl_user_id');
    const existingIds = new Set((existing || []).map(r => r.ghl_user_id));

    // Insert new users
    const newUsers = users.filter(u => u.id && !existingIds.has(u.id));
    let inserted = 0;
    for (const u of newUsers) {
      const name = `${u.firstName || ''} ${u.lastName || ''}`.trim();
      if (!name || name === 'Implementation Team' || name === 'Hypertek Solutions') continue; // skip system accounts

      const { error } = await supabaseAdmin
        .from('ghl_user_mapping')
        .insert({
          ghl_user_id: u.id,
          ghl_user_name: name,
        });
      if (!error) inserted++;
    }

    // Update names on existing rows (in case names changed)
    let updated = 0;
    for (const u of users) {
      if (!existingIds.has(u.id)) continue;
      const name = `${u.firstName || ''} ${u.lastName || ''}`.trim();
      if (!name) continue;
      const { error } = await supabaseAdmin
        .from('ghl_user_mapping')
        .update({ ghl_user_name: name })
        .eq('ghl_user_id', u.id);
      if (!error) updated++;
    }

    return res.json({
      total_ghl_users: users.length,
      already_mapped: existingIds.size,
      new_inserted: inserted,
      names_updated: updated,
    });
  } catch (err) {
    console.error('GHL user sync error:', err);
    return res.status(500).json({ error: err.message });
  }
}
