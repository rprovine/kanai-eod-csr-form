import { authorize } from '../_lib/authorize.js';
import { supabaseAdmin } from '../_lib/supabase-admin.js';
import {
  getCsrMappings,
  fetchOpportunities,
  fetchPipelineStages,
  detectStaleLeads,
} from '../_lib/ghl-client.js';
import { sendNotification } from '../_lib/ghl-notify.js';

export const maxDuration = 60;

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
    // Get all CSR mappings (employee_id -> ghl_user_id)
    const mappings = await getCsrMappings(supabaseAdmin);
    if (!mappings || mappings.length === 0) {
      return res.status(200).json({ message: 'No CSR mappings found', sent: 0 });
    }

    // Get phone numbers for each CSR
    const employeeIds = mappings.map((m) => m.employee_id);
    const { data: csrs } = await supabaseAdmin
      .from('csr_employees')
      .select('id, name, phone')
      .in('id', employeeIds)
      .eq('is_active', true);

    if (!csrs || csrs.length === 0) {
      return res.status(200).json({ message: 'No active CSRs with mappings', sent: 0 });
    }

    const csrById = {};
    for (const csr of csrs) {
      csrById[csr.id] = csr;
    }

    // Fetch opportunities and stages once
    const [opportunities, stageMap] = await Promise.all([
      fetchOpportunities(),
      fetchPipelineStages(),
    ]);

    // Detect all stale leads
    const allStaleLeads = detectStaleLeads(opportunities, stageMap);

    let sentCount = 0;
    const results = [];

    for (const mapping of mappings) {
      const csr = csrById[mapping.employee_id];
      if (!csr || !csr.phone) continue;

      const ghlUserId = mapping.ghl_user_id;

      // Filter opportunities assigned to this CSR
      const myOpps = opportunities.filter((opp) => opp.assignedTo === ghlUserId);

      // Count new leads
      const newLeads = myOpps.filter((opp) => {
        const stageName = stageMap[opp.pipelineStageId] || opp.pipelineStageName || '';
        return stageName.toLowerCase().includes('new');
      });

      // Count stale leads for this CSR
      const myStaleLeads = allStaleLeads.filter((s) => s.assignedTo === ghlUserId);

      // Build message
      let message = `Good morning ${csr.name}! Today's briefing:\n`;
      message += `• ${myStaleLeads.length} stale lead${myStaleLeads.length !== 1 ? 's' : ''} needing follow-up\n`;
      message += `• ${newLeads.length} new lead${newLeads.length !== 1 ? 's' : ''} to work\n`;
      message += `• ${myOpps.length} total in your pipeline`;

      // Include stale lead names (up to 5)
      if (myStaleLeads.length > 0) {
        const staleNames = myStaleLeads
          .slice(0, 5)
          .map((s) => s.name)
          .join(', ');
        message += `\n\nStale leads: ${staleNames}`;
        if (myStaleLeads.length > 5) {
          message += ` (+${myStaleLeads.length - 5} more)`;
        }
      }

      const sent = await sendNotification(csr.phone, null, message);
      if (sent) sentCount++;

      results.push({
        name: csr.name,
        stale: myStaleLeads.length,
        new: newLeads.length,
        total: myOpps.length,
        sent,
      });
    }

    return res.status(200).json({
      message: 'Morning briefings sent',
      sent: sentCount,
      total_csrs: mappings.length,
      results,
    });
  } catch (error) {
    console.error('Morning briefing error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
