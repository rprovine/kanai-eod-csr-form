import { authorize } from '../_lib/authorize.js';
import { supabaseAdmin } from '../_lib/supabase-admin.js';
import { fetchRecentMessages, toHawaiiDate } from '../_lib/ghl-client.js';
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
    const now = Date.now();
    const UNANSWERED_THRESHOLD_MS = 5 * 60 * 1000;

    // Fetch messages from the last 15 minutes
    const messages = await fetchRecentMessages(15);

    if (messages.length === 0) {
      return res.status(200).json({ message: 'No recent messages', alerts_sent: 0 });
    }

    // Group messages by conversationId
    const conversations = {};
    for (const msg of messages) {
      const convId = msg.conversationId;
      if (!convId) continue;
      if (!conversations[convId]) conversations[convId] = [];
      conversations[convId].push(msg);
    }

    // Find conversations where most recent message is inbound and older than 5 minutes
    // with no outbound response after it
    const unanswered = [];
    for (const [convId, msgs] of Object.entries(conversations)) {
      // Sort by dateAdded descending
      msgs.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));

      const mostRecent = msgs[0];
      const direction = (mostRecent.direction || '').toLowerCase();
      if (direction !== 'inbound') continue;

      const msgTime = new Date(mostRecent.dateAdded).getTime();
      if (now - msgTime < UNANSWERED_THRESHOLD_MS) continue;

      // Verify no outbound message exists after the inbound one
      const hasOutboundAfter = msgs.some((m) => {
        const d = (m.direction || '').toLowerCase();
        return d === 'outbound' && new Date(m.dateAdded) > new Date(mostRecent.dateAdded);
      });
      if (hasOutboundAfter) continue;

      unanswered.push({
        conversationId: convId,
        contactId: mostRecent.contactId,
        contactName: mostRecent.contactName || mostRecent.contactId,
        contactPhone: mostRecent.phone || '',
        messageTime: mostRecent.dateAdded,
      });
    }

    if (unanswered.length === 0) {
      return res.status(200).json({ message: 'No unanswered leads', alerts_sent: 0 });
    }

    // Check for existing alerts today to avoid duplicates
    const convIds = unanswered.map((u) => u.conversationId);
    const { data: existingAlerts } = await supabaseAdmin
      .from('unanswered_lead_alerts')
      .select('conversation_id')
      .eq('alert_date', today)
      .in('conversation_id', convIds);

    const alreadyAlerted = new Set((existingAlerts || []).map((a) => a.conversation_id));
    const newAlerts = unanswered.filter((u) => !alreadyAlerted.has(u.conversationId));

    if (newAlerts.length === 0) {
      return res.status(200).json({ message: 'All unanswered leads already alerted', alerts_sent: 0 });
    }

    // Send SMS to manager
    const managerPhone = process.env.MANAGER_PHONE_NUMBER;
    let alertsSent = 0;

    for (const alert of newAlerts) {
      const message = `Unanswered lead alert: ${alert.contactName}${alert.contactPhone ? ` (${alert.contactPhone})` : ''} has had no response for 5+ minutes.`;

      if (managerPhone) {
        const sent = await sendNotification(managerPhone, null, message);
        if (sent) alertsSent++;
      }

      // Record alert to prevent duplicates
      await supabaseAdmin.from('unanswered_lead_alerts').insert({
        conversation_id: alert.conversationId,
        contact_id: alert.contactId,
        contact_name: alert.contactName,
        alert_date: today,
        created_at: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      date: today,
      unanswered_found: newAlerts.length,
      alerts_sent: alertsSent,
      contacts: newAlerts.map((a) => a.contactName),
    });
  } catch (error) {
    console.error('Unanswered lead check error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
