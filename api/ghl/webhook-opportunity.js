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

  const body = req.body || {};
  const webhookOpp = body.opportunity || {};
  const webhookContact = body.contact || webhookOpp.contact || {};
  const opportunityId = webhookOpp.id;

  if (!opportunityId) {
    return res.status(200).json({ ok: true, skipped: 'No opportunity ID' });
  }

  // Fetch full opportunity from GHL API — webhook template vars don't resolve
  try {
    const apiResponse = await fetchOpportunityById(opportunityId);
    if (!apiResponse) {
      console.error(`[WEBHOOK] Could not fetch opportunity ${opportunityId}`);
      return res.status(200).json({ ok: true, error: 'Could not fetch opportunity' });
    }

    // GHL API nests the opportunity under an "opportunity" key
    const opp = apiResponse.opportunity || apiResponse;

    // Merge contact info from webhook payload if API response lacks it
    if (!opp.contact && webhookContact.id) {
      opp.contact = webhookContact;
    }

    const result = await processWebhook(opp);

    // Log to Supabase for audit trail
    if (supabaseAdmin) {
      await supabaseAdmin.from('webhook_log').insert({
        source: 'ghl-opportunity',
        payload: {
          type: body.type,
          opportunityId: opp.id,
          contactName: opp.contact?.name || opp.name,
          pipelineStageId: opp.pipelineStageId,
          assignedTo: opp.assignedTo,
          action: result,
        },
        received_at: new Date().toISOString(),
      }).then(() => {}).catch(() => {});
    }
  } catch (err) {
    console.error('webhook-opportunity error:', err);
  }

  return res.status(200).json({ ok: true, received: true });
}

async function fetchOpportunityById(opportunityId) {
  try {
    const response = await fetch(
      `${GHL_API_BASE}/opportunities/${opportunityId}`,
      { headers: ghlHeaders() }
    );
    if (!response.ok) {
      console.error(`[WEBHOOK] GHL API ${response.status} for ${opportunityId}`);
      return null;
    }
    return await response.json();
  } catch (err) {
    console.error(`[WEBHOOK] Fetch failed for ${opportunityId}:`, err);
    return null;
  }
}

async function processWebhook(opportunity) {
  const opportunityId = opportunity.id;
  const contactId = opportunity.contact?.id || opportunity.contactId;
  const contactName = opportunity.contact?.name || opportunity.name || 'Unknown';
  const stageId = opportunity.pipelineStageId;

  console.log(`[WEBHOOK] ${contactName}: opp=${opportunityId} stage=${stageId} assigned=${opportunity.assignedTo}`);

  // --- Auto-fix Spanish source text from Workiz Manager integration ---
  const source = opportunity.source || '';
  if (source && /necesito|pégalo|proporciona|evaluar|matchear|source para/i.test(source)) {
    console.log(`[WEBHOOK] Fixing Spanish source on ${contactName}: "${source.substring(0, 40)}..."`);
    await updateOpportunity(opportunityId, { source: 'Inbound Call' });
  }

  // --- Auto-assignment: no assignedTo ---
  let autoAssigned = false;
  if (!opportunity.assignedTo && contactId) {
    await handleAutoAssign(opportunityId, contactId, contactName);
    autoAssigned = true;
  }

  // --- Stage change detection ---
  if (!stageId) return autoAssigned ? 'auto-assigned' : 'no-stage';

  const stageMap = await fetchPipelineStages();
  const stageName = (stageMap[stageId] || '').toLowerCase();
  console.log(`[WEBHOOK] ${contactName}: stage="${stageName}"`);

  const prefix = autoAssigned ? 'auto-assigned+' : '';

  if (BOOKED_KEYWORDS.some(kw => stageName.includes(kw))) {
    await handleBooked(opportunity, contactName);
    return `${prefix}booked:${stageName}`;
  } else if (LOST_KEYWORDS.some(kw => stageName.includes(kw))) {
    await handlePrematureLost(opportunity, contactId, contactName, stageName);
    return `${prefix}lost:${stageName}`;
  }

  return `${prefix}stage:${stageName}`;
}

async function handleAutoAssign(opportunityId, contactId, contactName) {
  if (!supabaseAdmin) return;

  try {
    const { data: mappings } = await supabaseAdmin
      .from('ghl_user_mapping')
      .select('employee_id, ghl_user_id, ghl_user_name');

    if (!mappings || mappings.length === 0) return;

    const ghlUserIds = new Set(mappings.map(m => m.ghl_user_id));
    const ghlUserNames = {};
    for (const m of mappings) {
      ghlUserNames[m.ghl_user_id] = m.ghl_user_name;
    }

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
      console.log(`[WEBHOOK] Auto-assigned ${contactName} to ${ghlUserNames[assignToUserId] || assignToUserId}`);
    }
  } catch (err) {
    console.error(`[WEBHOOK] Auto-assign error for ${opportunityId}:`, err);
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

      console.log(`[WEBHOOK] Updated revenue for ${job.jobNumber} (${contactName}): $${job.revenue}`);
    }
  } catch (err) {
    console.error(`[WEBHOOK] Booked handler error for ${opportunity.id}:`, err);
  }
}

async function handlePrematureLost(opportunity, contactId, contactName, stageName) {
  if (!contactId) return;

  try {
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
    console.log(`[WEBHOOK] ${message}`);

    if (MANAGER_PHONE_NUMBER) {
      await sendNotification(MANAGER_PHONE_NUMBER, null, message);
    }
  } catch (err) {
    console.error(`[WEBHOOK] Premature lost error for ${opportunity.id}:`, err);
  }
}
