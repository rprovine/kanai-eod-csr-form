import { supabaseAdmin } from '../_lib/supabase-admin.js';

// Verify GHL webhook authenticity
function verifyWebhook(req) {
  const secret = process.env.GHL_WEBHOOK_SECRET;
  if (!secret) return true; // No secret = accept all (dev mode)

  const authHeader = req.headers['authorization'];
  const webhookSecret = req.headers['x-webhook-secret'];
  const ghlSignature = req.headers['x-ghl-signature'];

  if (authHeader === `Bearer ${secret}`) return true;
  if (webhookSecret === secret) return true;
  if (ghlSignature === secret) return true;
  if (req.query?.token === secret) return true;

  return false;
}

// Extract event date from GHL payload
function extractEventDate(payload, eventType) {
  // Call events have dateAdded or startedAt
  const raw = payload.dateAdded || payload.startedAt || payload.dateUpdated
    || payload.date || payload.createdAt;
  if (!raw) return new Date().toISOString().split('T')[0]; // fallback to today
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (isNaN(d)) return new Date().toISOString().split('T')[0];
  return d.toISOString().split('T')[0];
}

// Extract GHL user info from payload
function extractUser(payload) {
  // GHL payloads vary by event type
  return {
    userId: payload.userId || payload.assignedTo || payload.user?.id || '',
    userName: payload.user?.name || payload.userName || payload.assignedToName || '',
  };
}

// Extract a unique GHL entity ID for dedup
function extractGhlId(payload, eventType) {
  return payload.id || payload.callId || payload.opportunityId
    || payload.contactId || payload.noteId || '';
}

export default async function handler(req, res) {
  // CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-webhook-secret, x-ghl-signature');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. POST only.' });
  }

  if (!verifyWebhook(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  try {
    const body = req.body;
    const events = Array.isArray(body) ? body : [body];
    const results = [];

    for (const event of events) {
      // GHL sends event type in the payload or as a wrapper
      const eventType = event.type || event.event || event.eventType
        || req.query?.type || 'unknown';
      const payload = event.data || event;
      const ghlId = extractGhlId(payload, eventType);
      const { userId, userName } = extractUser(payload);
      const eventDate = extractEventDate(payload, eventType);

      // Skip duplicates by ghl_id
      if (ghlId) {
        const { data: existing } = await supabaseAdmin
          .from('ghl_webhook_events')
          .select('id')
          .eq('ghl_id', ghlId)
          .eq('event_type', eventType)
          .limit(1);

        if (existing && existing.length > 0) {
          results.push({ ghl_id: ghlId, status: 'skipped', reason: 'duplicate' });
          continue;
        }
      }

      const { error } = await supabaseAdmin
        .from('ghl_webhook_events')
        .insert({
          event_type: eventType,
          ghl_id: ghlId || null,
          payload,
          event_date: eventDate,
          user_id: userId || null,
          user_name: userName || null,
        });

      if (error) {
        console.error('Error storing GHL webhook event:', error);
        results.push({ ghl_id: ghlId, status: 'error', message: error.message });
      } else {
        results.push({ ghl_id: ghlId, status: 'stored' });
      }
    }

    return res.status(200).json({
      received: events.length,
      results,
    });
  } catch (error) {
    console.error('GHL webhook handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
