import { supabaseAdmin } from '../_lib/supabase-admin.js';
import { authorize } from '../_lib/authorize.js';
import { fetchOpportunities, fetchPipelineStages, getCsrMappings, toHawaiiDate, ghlHeaders } from '../_lib/ghl-client.js';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';

/**
 * Sync follow-up tasks from GHL and flag overdue ones.
 * Runs hourly during business hours.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!authorize(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!supabaseAdmin) return res.status(500).json({ error: 'Database not configured' });

  const locationId = process.env.GHL_LOCATION_ID;
  const apiKey = process.env.GHL_API_KEY;
  if (!locationId || !apiKey) return res.status(500).json({ error: 'GHL not configured' });

  try {
    const mappings = await getCsrMappings(supabaseAdmin);
    if (!mappings.length) return res.status(200).json({ message: 'No CSR mappings', synced: 0 });

    const today = toHawaiiDate(new Date().toISOString());
    let synced = 0;
    let overdue = 0;

    for (const csr of mappings) {
      // Fetch contacts assigned to this CSR via conversations
      const convParams = new URLSearchParams({
        locationId,
        assignedTo: csr.ghl_user_id,
        limit: '100',
      });

      const convResponse = await fetch(
        `${GHL_API_BASE}/conversations/search?${convParams}`,
        { headers: ghlHeaders() }
      );

      if (!convResponse.ok) continue;
      const convData = await convResponse.json();
      const conversations = convData.conversations || [];

      // For each conversation, check for tasks
      for (const conv of conversations.slice(0, 50)) {
        const contactId = conv.contactId;
        if (!contactId) continue;

        try {
          const taskResponse = await fetch(
            `${GHL_API_BASE}/contacts/${contactId}/tasks?locationId=${locationId}`,
            { headers: ghlHeaders() }
          );

          if (!taskResponse.ok) continue;
          const taskData = await taskResponse.json();
          const tasks = taskData.tasks || [];

          for (const task of tasks) {
            if (task.completed) continue;

            const dueDate = task.dueDate ? toHawaiiDate(task.dueDate) : null;
            if (!dueDate) continue;

            const isOverdue = dueDate < today;

            await supabaseAdmin
              .from('ghl_followup_tasks')
              .upsert({
                opportunity_id: task.opportunityId || null,
                contact_id: contactId,
                contact_name: conv.contactName || conv.fullName || '',
                due_date: dueDate,
                task_type: task.title || task.body || 'follow-up',
                synced_at: new Date().toISOString(),
                is_overdue: isOverdue,
                csr_employee_id: csr.employee_id,
              }, { onConflict: 'contact_id,due_date', ignoreDuplicates: false });

            synced++;
            if (isOverdue) overdue++;
          }

          // Rate limit
          await new Promise(r => setTimeout(r, 100));
        } catch (err) {
          // Non-critical, continue
        }
      }
    }

    return res.status(200).json({
      synced,
      overdue,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Follow-up sync error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
