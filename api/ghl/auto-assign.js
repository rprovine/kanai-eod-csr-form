import { supabaseAdmin } from '../_lib/supabase-admin.js';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';

function ghlHeaders() {
  return {
    'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
    'Version': '2021-07-28',
    'Content-Type': 'application/json',
  };
}

/**
 * Auto-assign GHL opportunities to CSRs based on conversation activity.
 *
 * Logic: For each unassigned opportunity, find who has outbound messages
 * in the linked conversation. The first CSR to respond gets the assignment.
 *
 * Runs on cron (every 30 min during business hours, every 5 min 4:00-4:30pm HST for EOD)
 * and can be triggered manually.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!process.env.CRON_SECRET) {
    // allow in dev
  } else {
    const auth = req.headers['authorization'];
    if (auth !== `Bearer ${process.env.CRON_SECRET}` && req.query?.token !== process.env.CRON_SECRET) {
      const referer = req.headers['referer'] || '';
      if (!referer.includes('kanai-eod-csr-form')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const locationId = process.env.GHL_LOCATION_ID;
  const apiKey = process.env.GHL_API_KEY;
  if (!locationId || !apiKey) {
    return res.status(500).json({ error: 'GHL not configured' });
  }

  try {
    // 1. Get all GHL user mappings (CSR employee → GHL user ID)
    const { data: mappings } = await supabaseAdmin
      .from('ghl_user_mapping')
      .select('employee_id, ghl_user_id, ghl_user_name');

    if (!mappings || mappings.length === 0) {
      return res.status(200).json({ message: 'No CSR mappings found', assigned: 0 });
    }

    const ghlUserIds = new Set(mappings.map(m => m.ghl_user_id));
    const ghlUserNames = {};
    for (const m of mappings) {
      ghlUserNames[m.ghl_user_id] = m.ghl_user_name;
    }

    // 2. Fetch all unassigned opportunities from GHL
    const unassignedOpps = [];
    let page = 0;
    let hasMore = true;

    while (hasMore && page < 5) {
      const params = new URLSearchParams({
        location_id: locationId,
        limit: '100',
        startAfterId: unassignedOpps.length > 0 ? unassignedOpps[unassignedOpps.length - 1].id : '',
      });

      const response = await fetch(
        `${GHL_API_BASE}/opportunities/search?${params}`,
        { headers: ghlHeaders() }
      );

      if (!response.ok) break;
      const data = await response.json();
      const opps = data.opportunities || [];

      for (const opp of opps) {
        if (!opp.assignedTo) {
          unassignedOpps.push(opp);
        }
      }

      hasMore = opps.length === 100;
      page++;
    }

    if (unassignedOpps.length === 0) {
      return res.status(200).json({ message: 'No unassigned opportunities', assigned: 0 });
    }

    // 3. For each unassigned opportunity, check conversation for CSR activity
    let assigned = 0;
    let checked = 0;
    const results = [];

    for (const opp of unassignedOpps) {
      const contactId = opp.contact?.id || opp.contactId;
      if (!contactId) continue;
      checked++;

      // Find conversation for this contact
      try {
        const convParams = new URLSearchParams({
          locationId,
          contactId,
          limit: '1',
        });

        const convResponse = await fetch(
          `${GHL_API_BASE}/conversations/search?${convParams}`,
          { headers: ghlHeaders() }
        );

        if (!convResponse.ok) continue;
        const convData = await convResponse.json();
        const conversation = (convData.conversations || [])[0];
        if (!conversation?.id) continue;

        // Fetch messages to find first CSR outbound
        const msgResponse = await fetch(
          `${GHL_API_BASE}/conversations/${conversation.id}/messages`,
          { headers: ghlHeaders() }
        );

        if (!msgResponse.ok) continue;
        const msgData = await msgResponse.json();
        const messages = msgData.messages?.messages || msgData.messages || [];

        // Find the first outbound message from a known CSR
        let assignToUserId = null;
        for (const msg of messages) {
          if ((msg.direction || '').toLowerCase() === 'outbound' && msg.userId && ghlUserIds.has(msg.userId)) {
            assignToUserId = msg.userId;
            break; // First responder gets credit
          }
        }

        if (!assignToUserId) continue;

        // 4. Assign the opportunity to this CSR
        const updateResponse = await fetch(
          `${GHL_API_BASE}/opportunities/${opp.id}`,
          {
            method: 'PUT',
            headers: ghlHeaders(),
            body: JSON.stringify({ assignedTo: assignToUserId }),
          }
        );

        if (updateResponse.ok) {
          assigned++;
          results.push({
            opportunity: opp.contact?.name || opp.name || opp.id,
            assignedTo: ghlUserNames[assignToUserId] || assignToUserId,
          });
        }

        // Rate limit
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        console.error(`Error processing opp ${opp.id}:`, err);
      }
    }

    return res.status(200).json({
      total_unassigned: unassignedOpps.length,
      checked,
      assigned,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Auto-assign error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
