import { supabaseAdmin } from '../_lib/supabase-admin.js';
import {
  ghlHeaders,
  getCustomField,
  updateOpportunity,
  fetchPipelineStages,
  CF,
} from '../_lib/ghl-client.js';
import { sendNotification } from '../_lib/ghl-notify.js';
import { getJobByNumber } from '../_lib/workiz-client.js';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const MANAGER_PHONE_NUMBER = process.env.MANAGER_PHONE_NUMBER;

const BOOKED_KEYWORDS = ['book', 'won', 'approved', 'estimate scheduled'];
const LOST_KEYWORDS = ['lost', 'declined'];

function verifyAuth(req) {
  const secret = process.env.GHL_WEBHOOK_SECRET;
  if (!secret) return true; // dev mode
  const queryToken = req.query?.secret || req.query?.token;
  const headerToken = req.headers['x-webhook-secret'] || req.headers['authorization'];
  return queryToken === secret || headerToken === secret || headerToken === `Bearer ${secret}`;
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

  // Respond quickly to avoid webhook timeout
  const body = req.body || {};
  const opportunity = body.opportunity || {};
  const opportunityId = opportunity.id;

  if (!opportunityId) {
    return res.status(200).json({ ok: true, skipped: 'No opportunity ID' });
  }

  // Process asynchronously after acknowledging receipt
  res.status(200).json({ ok: true, received: true });

  try {
    await processWebhook(body, opportunity);
  } catch (err) {
    console.error('webhook-opportunity processing error:', err);
  }
}

async function processWebhook(body, opportunity) {
  const opportunityId = opportunity.id;
  const contactId = opportunity.contact?.id;
  const contactName = opportunity.contact?.name || 'Unknown';

  // --- Auto-assignment: no assignedTo ---
  if (!opportunity.assignedTo && contactId) {
    await handleAutoAssign(opportunityId, contactId, contactName);
  }

  // --- Stage change detection ---
  const stageId = opportunity.pipelineStageId;
  if (!stageId) return;

  const stageMap = await fetchPipelineStages();
  const stageName = (stageMap[stageId] || '').toLowerCase();

  if (BOOKED_KEYWORDS.some(kw => stageName.includes(kw))) {
    await handleBooked(opportunity, contactName);
  } else if (LOST_KEYWORDS.some(kw => stageName.includes(kw))) {
    await handlePrematureLost(opportunity, contactId, contactName, stageName);
  }
}

async function handleAutoAssign(opportunityId, contactId, contactName) {
  if (!supabaseAdmin) return;

  try {
    // Get CSR mappings
    const { data: mappings } = await supabaseAdmin
      .from('ghl_user_mapping')
      .select('employee_id, ghl_user_id, ghl_user_name');

    if (!mappings || mappings.length === 0) return;

    const ghlUserIds = new Set(mappings.map(m => m.ghl_user_id));
    const ghlUserNames = {};
    for (const m of mappings) {
      ghlUserNames[m.ghl_user_id] = m.ghl_user_name;
    }

    // Find conversation for this contact
    const convParams = new URLSearchParams({
      locationId: process.env.GHL_LOCATION_ID,
      contactId,
      limit: '1',
    });
    const convResponse = await fetch(
      `${GHL_API_BASE}/conversations/search?${convParams}`,
      { headers: ghlHeaders() }
    );
    if (!convResponse.ok) return;

    const convData = await convResponse.json();
    const conversation = (convData.conversations || [])[0];
    if (!conversation?.id) return;

    // Fetch messages to find first outbound from a known CSR
    const msgResponse = await fetch(
      `${GHL_API_BASE}/conversations/${conversation.id}/messages`,
      { headers: ghlHeaders() }
    );
    if (!msgResponse.ok) return;

    const msgData = await msgResponse.json();
    const messages = msgData.messages?.messages || msgData.messages || [];

    let assignToUserId = null;
    for (const msg of messages) {
      if ((msg.direction || '').toLowerCase() === 'outbound' && msg.userId && ghlUserIds.has(msg.userId)) {
        assignToUserId = msg.userId;
        break;
      }
    }

    if (!assignToUserId) return;

    const ok = await updateOpportunity(opportunityId, { assignedTo: assignToUserId });
    if (ok) {
      console.log(`Auto-assigned opportunity ${opportunityId} (${contactName}) to ${ghlUserNames[assignToUserId] || assignToUserId}`);
    }
  } catch (err) {
    console.error(`Auto-assign error for opportunity ${opportunityId}:`, err);
  }
}

async function handleBooked(opportunity, contactName) {
  if (!supabaseAdmin) return;

  const workizJobUUID = getCustomField(opportunity, CF.WORKIZ_JOB_ID);
  if (!workizJobUUID) return;

  try {
    const job = await getJobByNumber(workizJobUUID);
    if (!job) return;

    const { data: rows } = await supabaseAdmin
      .from('csr_eod_jobs_booked')
      .select('id, estimated_revenue')
      .eq('job_number', job.jobNumber)
      .limit(1);

    if (rows && rows.length > 0 && job.revenue > 0) {
      await supabaseAdmin
        .from('csr_eod_jobs_booked')
        .update({ estimated_revenue: job.revenue })
        .eq('id', rows[0].id);

      console.log(`Updated revenue for job ${job.jobNumber} (${contactName}): $${job.revenue}`);
    }
  } catch (err) {
    console.error(`Booked handler error for opportunity ${opportunity.id}:`, err);
  }
}

async function handlePrematureLost(opportunity, contactId, contactName, stageName) {
  if (!contactId) return;

  try {
    // Count contact attempts (distinct outbound days)
    const convParams = new URLSearchParams({
      locationId: process.env.GHL_LOCATION_ID,
      contactId,
      limit: '1',
    });
    const convResponse = await fetch(
      `${GHL_API_BASE}/conversations/search?${convParams}`,
      { headers: ghlHeaders() }
    );
    if (!convResponse.ok) return;

    const convData = await convResponse.json();
    const conversation = (convData.conversations || [])[0];
    if (!conversation?.id) return;

    const msgResponse = await fetch(
      `${GHL_API_BASE}/conversations/${conversation.id}/messages`,
      { headers: ghlHeaders() }
    );
    if (!msgResponse.ok) return;

    const msgData = await msgResponse.json();
    const messages = msgData.messages?.messages || msgData.messages || [];

    const outboundDays = new Set();
    for (const msg of messages) {
      if ((msg.direction || '').toLowerCase() === 'outbound') {
        const day = (msg.dateAdded || '').split('T')[0];
        if (day) outboundDays.add(day);
      }
    }

    const attempts = outboundDays.size;
    const lostReason = getCustomField(opportunity, CF.LOST_REASON);

    if (attempts >= 3 || lostReason) return;

    const message = `Premature lost alert: "${contactName}" moved to ${stageName} with only ${attempts} contact attempt(s) and no lost reason. Opportunity ID: ${opportunity.id}`;
    console.log(message);

    if (MANAGER_PHONE_NUMBER) {
      await sendNotification(MANAGER_PHONE_NUMBER, null, message);
    }
  } catch (err) {
    console.error(`Premature lost check error for opportunity ${opportunity.id}:`, err);
  }
}
