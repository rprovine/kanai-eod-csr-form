import { authorize } from '../_lib/authorize.js';
import { supabaseAdmin } from '../_lib/supabase-admin.js';
import {
  fetchOpportunities,
  fetchPipelineStages,
  countContactAttempts,
  detectPrematureLost,
  toHawaiiDate,
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
    const today = toHawaiiDate(new Date().toISOString());

    // Fetch opportunities and stages
    const [opportunities, stageMap] = await Promise.all([
      fetchOpportunities(),
      fetchPipelineStages(),
    ]);

    // Filter to opps moved to lost/declined today
    const lostToday = opportunities.filter((opp) => {
      const stageName = stageMap[opp.pipelineStageId] || opp.pipelineStageName || '';
      const stageL = stageName.toLowerCase();
      if (!stageL.includes('lost') && !stageL.includes('declined')) return false;
      const lastChange = toHawaiiDate(opp.lastStageChangeAt || opp.updatedAt);
      return lastChange === today;
    });

    if (lostToday.length === 0) {
      return res.status(200).json({
        message: 'No leads moved to lost/declined today',
        date: today,
        alerts_sent: 0,
      });
    }

    // Count contact attempts for these leads
    const contactIds = lostToday
      .map((opp) => opp.contact?.id || opp.contactId)
      .filter(Boolean);

    const contactAttempts = await countContactAttempts([...new Set(contactIds)]);

    // Detect premature lost leads
    const warnings = detectPrematureLost(lostToday, stageMap, contactAttempts, today);

    if (warnings.length === 0) {
      return res.status(200).json({
        message: 'No premature lost leads detected',
        date: today,
        lost_today: lostToday.length,
        alerts_sent: 0,
      });
    }

    // Check for existing alerts today to avoid duplicates
    const oppIds = warnings.map((w) => w.id);
    const { data: existingAlerts } = await supabaseAdmin
      .from('premature_lost_alerts')
      .select('opportunity_id')
      .eq('alert_date', today)
      .in('opportunity_id', oppIds);

    const alreadyAlerted = new Set((existingAlerts || []).map((a) => a.opportunity_id));
    const newWarnings = warnings.filter((w) => !alreadyAlerted.has(w.id));

    if (newWarnings.length === 0) {
      return res.status(200).json({
        message: 'All premature lost leads already alerted',
        date: today,
        alerts_sent: 0,
      });
    }

    // Send SMS to manager
    const managerPhone = process.env.MANAGER_PHONE_NUMBER;
    let alertsSent = 0;

    for (const warning of newWarnings) {
      const message = `Lost lead alert: ${warning.name} moved to "${warning.stage}" with only ${warning.attempts} contact attempt${warning.attempts !== 1 ? 's' : ''} and no lost reason. Please review.`;

      if (managerPhone) {
        const sent = await sendNotification(managerPhone, null, message);
        if (sent) alertsSent++;
      }

      // Record alert to prevent duplicates
      await supabaseAdmin.from('premature_lost_alerts').insert({
        opportunity_id: warning.id,
        contact_id: warning.contactId,
        contact_name: warning.name,
        stage: warning.stage,
        attempts: warning.attempts,
        alert_date: today,
        created_at: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      date: today,
      lost_today: lostToday.length,
      premature_warnings: newWarnings.length,
      alerts_sent: alertsSent,
      warnings: newWarnings.map((w) => ({
        name: w.name,
        stage: w.stage,
        attempts: w.attempts,
      })),
    });
  } catch (error) {
    console.error('Lost reason check error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
