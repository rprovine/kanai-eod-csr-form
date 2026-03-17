import { supabaseAdmin } from '../_lib/supabase-admin.js';
import { sendNotification } from '../_lib/ghl-notify.js';

function authorize(req) {
  const auth = req.headers['authorization'];
  if (auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  const referer = req.headers['referer'] || '';
  if (referer.includes('kanai-eod-csr-form.vercel.app')) return true;
  return false;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!authorize(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  try {
    // Query open estimates
    const { data: estimates, error: estError } = await supabaseAdmin
      .from('estimate_tracker')
      .select('id, tech_name, created_at')
      .eq('status', 'open');

    if (estError) throw estError;
    if (!estimates || estimates.length === 0) {
      return res.status(200).json({ message: 'No open estimates', sent: false });
    }

    // Group by tech_name
    const now = new Date();
    const techGroups = {};
    for (const est of estimates) {
      const tech = est.tech_name || 'Unassigned';
      if (!techGroups[tech]) {
        techGroups[tech] = { count: 0, oldestDate: null };
      }
      techGroups[tech].count++;
      const createdAt = new Date(est.created_at);
      if (!techGroups[tech].oldestDate || createdAt < techGroups[tech].oldestDate) {
        techGroups[tech].oldestDate = createdAt;
      }
    }

    // Build digest message
    const lines = ['Open Estimates:'];
    for (const [tech, info] of Object.entries(techGroups)) {
      const daysSinceOldest = Math.floor((now - info.oldestDate) / (1000 * 60 * 60 * 24));
      lines.push(`${tech}: ${info.count} open (${daysSinceOldest}d oldest)`);
    }
    const message = lines.join('\n');

    // Send to manager
    const managerPhone = process.env.MANAGER_PHONE_NUMBER;
    let sent = false;
    if (managerPhone) {
      sent = await sendNotification(managerPhone, null, message);
    }

    return res.status(200).json({
      total_open: estimates.length,
      techs: techGroups,
      message,
      sent,
    });
  } catch (error) {
    console.error('Estimates digest error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
