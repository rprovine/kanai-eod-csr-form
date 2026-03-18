import { supabaseAdmin } from '../_lib/supabase-admin.js';
import {
  fetchOpportunities,
  fetchPipelineStages,
  getCsrMappings,
} from '../_lib/ghl-client.js';
import { sendNotification } from '../_lib/ghl-notify.js';

const ESTIMATE_KEYWORDS = ['estimate', 'quote', 'proposal', 'agreement sent', 'rental agreement'];

function authorize(req) {
  if (!process.env.CRON_SECRET) return true;
  const auth = req.headers['authorization'];
  if (auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  const referer = req.headers['referer'] || '';
  if (referer.includes('kanai-eod-csr-form')) return true;
  if (req.query?.token === process.env.CRON_SECRET) return true;
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

  try {
    // Fetch opportunities and stages from GHL
    const [opportunities, stageMap] = await Promise.all([
      fetchOpportunities(),
      fetchPipelineStages(),
    ]);

    // Filter to estimate-related stages
    const estimates = opportunities.filter((opp) => {
      const stageName = stageMap[opp.pipelineStageId] || '';
      const stageL = stageName.toLowerCase();
      return ESTIMATE_KEYWORDS.some((kw) => stageL.includes(kw));
    });

    if (estimates.length === 0) {
      return res.status(200).json({ message: 'No open estimates', sent: false });
    }

    // Get CSR mappings to resolve assignedTo IDs to names
    const csrMap = {};
    if (supabaseAdmin) {
      const mappings = await getCsrMappings(supabaseAdmin);
      for (const m of mappings) {
        csrMap[m.ghl_user_id] = m.ghl_user_name;
      }
    }

    // Group by assigned CSR
    const csrGroups = {};
    for (const opp of estimates) {
      const csrName = csrMap[opp.assignedTo] || 'Unassigned';
      const stageName = stageMap[opp.pipelineStageId] || 'Unknown';
      if (!csrGroups[csrName]) {
        csrGroups[csrName] = { count: 0, stages: {} };
      }
      csrGroups[csrName].count++;
      csrGroups[csrName].stages[stageName] = (csrGroups[csrName].stages[stageName] || 0) + 1;
    }

    // Build digest message
    const lines = [`Open Estimates: ${estimates.length} total`];
    for (const [csr, info] of Object.entries(csrGroups)) {
      const stageDetail = Object.entries(info.stages)
        .map(([s, c]) => `${c} ${s}`)
        .join(', ');
      lines.push(`${csr}: ${info.count} (${stageDetail})`);
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
      csrs: csrGroups,
      message,
      sent,
    });
  } catch (error) {
    console.error('Estimates digest error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
