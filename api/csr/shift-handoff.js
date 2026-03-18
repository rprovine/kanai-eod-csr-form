import { authorize } from '../_lib/authorize.js';
import { supabaseAdmin } from '../_lib/supabase-admin.js';
import {
  fetchOpportunities,
  fetchPipelineStages,
  toHawaiiDate,
} from '../_lib/ghl-client.js';
import { sendNotification } from '../_lib/ghl-notify.js';

export const maxDuration = 30;

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

    // Filter to "New Lead" or "New" stage opportunities
    const newLeads = opportunities.filter((opp) => {
      const stageName = stageMap[opp.pipelineStageId] || opp.pipelineStageName || '';
      const stageL = stageName.toLowerCase();
      return stageL.includes('new lead') || stageL === 'new';
    });

    if (newLeads.length === 0) {
      return res.status(200).json({
        message: 'No new leads in pipeline',
        date: today,
        unworked: 0,
      });
    }

    // Check which new leads have outbound activity today
    const contactIds = newLeads
      .map((opp) => opp.contact?.id || opp.contactId)
      .filter(Boolean);

    const { data: activityLogs } = await supabaseAdmin
      .from('lead_activity_log')
      .select('contact_id')
      .eq('action_date', today)
      .in('contact_id', contactIds);

    const workedContacts = new Set((activityLogs || []).map((a) => a.contact_id));

    // Find unworked new leads
    const unworked = newLeads.filter((opp) => {
      const contactId = opp.contact?.id || opp.contactId;
      return !workedContacts.has(contactId);
    });

    if (unworked.length === 0) {
      return res.status(200).json({
        message: 'All new leads have been worked today',
        date: today,
        unworked: 0,
      });
    }

    // Build and send handoff message
    const names = unworked.map((opp) => opp.contact?.name || opp.name || 'Unknown');
    const nameList = names.slice(0, 10).join(', ');
    let message = `Shift handoff: ${unworked.length} new lead${unworked.length !== 1 ? 's' : ''} unworked today: ${nameList}`;
    if (names.length > 10) {
      message += ` (+${names.length - 10} more)`;
    }

    const managerPhone = process.env.MANAGER_PHONE_NUMBER;
    let sent = false;
    if (managerPhone) {
      sent = await sendNotification(managerPhone, null, message);
    }

    return res.status(200).json({
      date: today,
      total_new_leads: newLeads.length,
      unworked: unworked.length,
      unworked_names: names,
      alert_sent: sent,
    });
  } catch (error) {
    console.error('Shift handoff error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
