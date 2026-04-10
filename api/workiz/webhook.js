import { supabaseAdmin } from '../_lib/supabase-admin.js';
import {
  ghlHeaders,
  fetchOpportunities,
  fetchPipelineStages,
  updateOpportunity,
  getCustomField,
  CF,
} from '../_lib/ghl-client.js';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';

function verifyAuth(req) {
  const secret = process.env.WORKIZ_WEBHOOK_SECRET;
  if (!secret) return true; // dev mode
  const queryToken = req.query?.secret || req.query?.token;
  const headerToken = req.headers['x-webhook-secret'] || req.headers['authorization'];
  return queryToken === secret || headerToken === secret || headerToken === `Bearer ${secret}`;
}

/**
 * Find the GHL opportunity that has a matching Workiz job UUID in custom fields.
 * Searches all opportunities and checks the CF.WORKIZ_JOB_ID field.
 */
async function findOpportunityByWorkizUUID(workizUUID) {
  const opps = await fetchOpportunities({ limit: 10 });
  for (const opp of opps) {
    const cfValue = getCustomField(opp, CF.WORKIZ_JOB_ID);
    if (cfValue && cfValue === workizUUID) {
      return opp;
    }
  }
  return null;
}

/**
 * Find the "Lost" stage ID from pipeline stages.
 */
async function findLostStageId(stageMap) {
  for (const [id, name] of Object.entries(stageMap)) {
    if (name.toLowerCase().includes('lost')) {
      return id;
    }
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Webhook-Secret');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!verifyAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = req.body || {};
  const jobUUID = body.UUID || body.uuid || body.JobUUID || '';
  const serialId = body.SerialId || body.serialId || body.JobNumber || '';
  const status = body.Status || body.status || '';
  const subTotal = parseFloat(body.SubTotal || body.subTotal || 0);

  if (!jobUUID && !serialId) {
    return res.status(200).json({ ok: true, skipped: 'No job identifier' });
  }

  // Respond quickly
  res.status(200).json({ ok: true, received: true });

  try {
    await processWorkizWebhook({ jobUUID, serialId, status, subTotal });
  } catch (err) {
    console.error('Workiz webhook processing error:', err);
  }
}

async function processWorkizWebhook({ jobUUID, serialId, status, subTotal }) {
  // --- Status change: sync to GHL opportunity stage ---
  if (status && jobUUID) {
    await handleStatusChange(jobUUID, status);
  }

  // --- Price/revenue update ---
  if (subTotal > 0 && serialId) {
    await handleRevenueUpdate(serialId, subTotal);
  }
}

async function handleStatusChange(jobUUID, status) {
  const statusLower = status.toLowerCase();

  // Completed jobs: keep their GHL stage + send review request
  if (statusLower === 'completed') {
    console.log(`Workiz job ${jobUUID} completed`);
    await sendReviewRequest(jobUUID);
    return;
  }

  // Only map Cancelled and No-show to Lost
  if (statusLower !== 'cancelled' && statusLower !== 'no-show') {
    return;
  }

  const opp = await findOpportunityByWorkizUUID(jobUUID);
  if (!opp) {
    console.log(`No GHL opportunity found for Workiz job UUID ${jobUUID}`);
    return;
  }

  const stageMap = await fetchPipelineStages();
  const lostStageId = await findLostStageId(stageMap);

  if (!lostStageId) {
    console.error('Could not find Lost stage in pipeline stages');
    return;
  }

  const ok = await updateOpportunity(opp.id, { pipelineStageId: lostStageId });
  if (ok) {
    console.log(`Moved opportunity ${opp.id} to Lost (Workiz status: ${status})`);
  } else {
    console.error(`Failed to update opportunity ${opp.id} to Lost stage`);
  }
}

const GOOGLE_REVIEW_URL = 'https://g.page/r/CRJGlAJIHCUxEBM/review';

async function sendReviewRequest(jobUUID) {
  try {
    // Find the GHL contact for this job
    const opp = await findOpportunityByWorkizUUID(jobUUID);
    if (!opp) {
      console.log(`[review-ask] No GHL opportunity for Workiz UUID ${jobUUID}, skipping`);
      return;
    }

    const contactId = opp.contact?.id || opp.contactId;
    if (!contactId) return;

    // Don't send review request if we already sent one for this contact
    if (supabaseAdmin) {
      const { data: existing } = await supabaseAdmin
        .from('ai_orchestration_events')
        .select('id')
        .eq('system', 'review_ask')
        .eq('contact_id', contactId)
        .limit(1);
      if (existing?.length > 0) {
        console.log(`[review-ask] Already sent review request to ${contactId}, skipping`);
        return;
      }
    }

    // Send the review request via GHL messaging
    const message = `Aloha! Mahalo so much for choosing Kanai's — we really appreciate your business! If you have a moment, a Google review would mean the world to us:\n\n${GOOGLE_REVIEW_URL}\n\nMahalo! 🤙`;

    const res = await fetch(`${GHL_API_BASE}/conversations/messages`, {
      method: 'POST',
      headers: ghlHeaders(),
      body: JSON.stringify({
        type: 'SMS',
        contactId,
        message,
      }),
    });

    if (res.ok) {
      console.log(`[review-ask] Review request sent to contact ${contactId}`);
      // Log to orchestration events for tracking
      if (supabaseAdmin) {
        await supabaseAdmin.from('ai_orchestration_events').insert({
          system: 'review_ask',
          contact_id: contactId,
          decision: 'review_request_sent',
          reason: `Job ${jobUUID} completed, review request sent via SMS`,
          context: { opportunity_id: opp.id, job_uuid: jobUUID },
        }).then(() => {}).catch(() => {});
      }
    } else {
      console.error(`[review-ask] Failed to send review request: HTTP ${res.status}`);
    }
  } catch (err) {
    console.error(`[review-ask] Error:`, err.message);
  }
}

async function handleRevenueUpdate(serialId, subTotal) {
  if (!supabaseAdmin) return;

  try {
    const jobNumber = String(serialId);
    const { data: rows } = await supabaseAdmin
      .from('csr_eod_jobs_booked')
      .select('id')
      .eq('job_number', jobNumber)
      .limit(1);

    if (rows && rows.length > 0) {
      await supabaseAdmin
        .from('csr_eod_jobs_booked')
        .update({ estimated_revenue: subTotal })
        .eq('id', rows[0].id);

      console.log(`Updated revenue for job ${jobNumber}: $${subTotal}`);
    }
  } catch (err) {
    console.error(`Revenue update error for job ${serialId}:`, err);
  }
}
