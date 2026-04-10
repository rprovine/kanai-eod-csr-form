/**
 * POST /api/csr/validate-kpis — Server-side KPI validation.
 * Compares self-reported CSR numbers against GHL pipeline data.
 * Called at submission time to flag discrepancies.
 *
 * Returns:
 *   { valid: true/false, discrepancies: [...], ghl_data: {...} }
 *
 * Does NOT block submission — CSRs can still override GHL data.
 * But discrepancies are logged for management review.
 */
import { authorize } from '../_lib/authorize.js';
import { supabaseAdmin } from '../_lib/supabase-admin.js';
import {
  fetchOpportunities,
  fetchPipelineStages,
  ghlHeaders,
} from '../_lib/ghl-client.js';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { employee_id, ghl_user_id, report_date, reported } = req.body || {};
  if (!ghl_user_id || !report_date || !reported) {
    return res.status(400).json({ error: 'ghl_user_id, report_date, and reported fields required' });
  }

  try {
    // Fetch all opportunities for the date and CSR
    const stageMap = await fetchPipelineStages();
    const allOpps = await fetchOpportunities();

    // Filter to this CSR's assignments that were active on the report date
    const dateStart = new Date(report_date + 'T00:00:00-10:00'); // HST
    const dateEnd = new Date(report_date + 'T23:59:59-10:00');

    const csrOpps = allOpps.filter(opp => {
      if (opp.assignedTo !== ghl_user_id) return false;
      const updated = new Date(opp.lastStageChangeAt || opp.updatedAt || opp.createdAt);
      return updated >= dateStart && updated <= dateEnd;
    });

    // Categorize by stage
    const ghlCounts = { booked: 0, lost: 0, quoted: 0, non_qualified: 0, contacted: 0, total: csrOpps.length };
    for (const opp of csrOpps) {
      const stage = (stageMap[opp.pipelineStageId] || '').toLowerCase();
      if (stage.includes('booked')) ghlCounts.booked++;
      else if (stage.includes('lost')) ghlCounts.lost++;
      else if (stage.includes('quot') || stage.includes('estimate')) ghlCounts.quoted++;
      else if (stage.includes('non-qualified') || stage.includes('not qualified')) ghlCounts.non_qualified++;
      else if (stage.includes('contacted') || stage.includes('follow')) ghlCounts.contacted++;
    }

    // Compare self-reported vs GHL
    const discrepancies = [];
    const threshold = 2; // Allow +/- 2 difference before flagging

    if (reported.disp_booked !== undefined && Math.abs(reported.disp_booked - ghlCounts.booked) > threshold) {
      discrepancies.push({
        field: 'disp_booked',
        reported: reported.disp_booked,
        ghl: ghlCounts.booked,
        delta: reported.disp_booked - ghlCounts.booked,
      });
    }
    if (reported.disp_lost !== undefined && Math.abs(reported.disp_lost - ghlCounts.lost) > threshold) {
      discrepancies.push({
        field: 'disp_lost',
        reported: reported.disp_lost,
        ghl: ghlCounts.lost,
        delta: reported.disp_lost - ghlCounts.lost,
      });
    }

    // Log audit result
    if (supabaseAdmin && discrepancies.length > 0) {
      await supabaseAdmin.from('ai_orchestration_events').insert({
        system: 'csr_audit',
        decision: 'kpi_discrepancy',
        reason: `${discrepancies.length} discrepancy(s) for ${report_date}: ${discrepancies.map(d => `${d.field} reported=${d.reported} ghl=${d.ghl}`).join(', ')}`,
        context: {
          employee_id,
          ghl_user_id,
          report_date,
          reported,
          ghl_counts: ghlCounts,
          discrepancies,
        },
      }).then(() => {}).catch(() => {});
    }

    return res.json({
      valid: discrepancies.length === 0,
      discrepancies,
      ghl_data: ghlCounts,
      opportunities_checked: csrOpps.length,
    });
  } catch (err) {
    console.error('KPI validation error:', err);
    return res.status(500).json({ error: err.message });
  }
}
