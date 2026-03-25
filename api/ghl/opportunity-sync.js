import { ghlHeaders, fetchPipelineStages } from '../_lib/ghl-client.js';

/**
 * Opportunity Sync — catches leads that slip through
 *
 * Two modes:
 * 1. POST (webhook) — Called by GHL "Contact Created" workflow for real-time sync
 * 2. GET (cron) — Runs every 5 min during business hours as a safety net
 *
 * Covers all lead sources: phone calls, Workiz, online submissions,
 * web forms, Facebook, etc.
 */

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const PIPELINE_ID = process.env.GHL_PIPELINE_ID;
const LOCATION_ID = process.env.GHL_LOCATION_ID;
const LOOKBACK_MINUTES = 30; // Check contacts created in the last 30 min

// Tags that indicate the contact is a lead (not internal staff)
const LEAD_TAGS = ['lead', 'workiz lead', 'workiz job', 'free on-site estimate'];

// Tags that indicate the contact should NOT get an opportunity
const SKIP_TAGS = ['kanai-internal', 'eod-notifications', 'do-not-contact'];

// Resolved stage keywords — don't count these as "has active opportunity"
const RESOLVED_KEYWORDS = ['booked', 'won', 'lost', 'declined', 'non-qualified', 'closed'];

function authorize(req) {
  if (!process.env.CRON_SECRET) return true;
  const auth = req.headers['authorization'];
  if (auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  const referer = req.headers['referer'] || '';
  if (referer.includes('kanai-eod-csr-form')) return true;
  if (req.query?.token === process.env.CRON_SECRET) return true;
  return false;
}

export const maxDuration = 30;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Webhook-Secret');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!authorize(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!process.env.GHL_API_KEY || !LOCATION_ID) {
    return res.status(500).json({ error: 'GHL not configured' });
  }

  // POST = webhook from GHL "Contact Created" workflow
  if (req.method === 'POST') {
    return handleWebhook(req, res);
  }

  // GET = cron safety net (not currently functional due to contacts API limitation)
  return res.status(200).json({ message: 'Use POST with contact data from GHL workflow', mode: 'webhook' });
}

async function handleWebhook(req, res) {
  const body = req.body || {};
  const contact = body.contact || {};
  const contactId = contact.id || body.contactId || body.contact_id;
  const contactName = contact.name || contact.firstName || body.contactName || 'Unknown';
  const contactPhone = contact.phone || body.phone || '';
  const contactEmail = contact.email || body.email || '';
  const contactSource = contact.source || body.source || '';

  console.log(`[opp-sync] Webhook: ${contactName} (${contactId}) phone:${contactPhone}`);

  if (!contactId) {
    return res.status(200).json({ action: 'skipped', reason: 'No contact ID' });
  }

  // Skip internal/system contacts
  const tags = (contact.tags || body.tags || []).map(t => (t || '').toLowerCase());
  if (SKIP_TAGS.some(t => tags.includes(t))) {
    return res.status(200).json({ action: 'skipped', reason: 'Internal contact' });
  }

  // Skip contacts with no phone and no email
  if (!contactPhone && !contactEmail) {
    return res.status(200).json({ action: 'skipped', reason: 'No phone or email' });
  }

  try {
    const stageMap = await fetchPipelineStages();
    const hasActive = await hasActiveOpportunity(contactId, stageMap);

    if (hasActive) {
      console.log(`[opp-sync] SKIP: ${contactName} already has active/recent opportunity`);
      return res.status(200).json({ action: 'skipped', reason: 'Has active or recent opportunity', contactName });
    }

    // Determine source
    let source = contactSource || 'New Lead';
    if (/necesito|pégalo|proporciona|evaluar|matchear/i.test(source)) {
      source = 'New Lead';
    }

    const newOpp = await createOpportunity(contactId, contactName, source);
    if (!newOpp) {
      return res.status(200).json({ action: 'error', reason: 'Failed to create opportunity', contactName });
    }

    console.log(`[opp-sync] Created opportunity for ${contactName} (source: ${source})`);
    return res.status(200).json({
      action: 'created',
      contactName,
      source,
      opportunityId: newOpp.id,
    });
  } catch (err) {
    console.error('[opp-sync] Error:', err);
    return res.status(200).json({ action: 'error', reason: err.message });
  }
}

async function hasActiveOpportunity(contactId, stageMap) {
  try {
    const params = new URLSearchParams({
      location_id: LOCATION_ID,
      contact_id: contactId,
      limit: '10',
    });

    if (PIPELINE_ID) params.set('pipeline_id', PIPELINE_ID);

    const response = await fetch(
      `${GHL_API_BASE}/opportunities/search?${params}`,
      { headers: ghlHeaders() }
    );

    if (!response.ok) return false;

    const data = await response.json();
    const opps = data.opportunities || [];

    // Check for any active (non-resolved) opportunity
    const recentCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    for (const opp of opps) {
      const stageName = (stageMap[opp.pipelineStageId] || '').toLowerCase();
      const isResolved = RESOLVED_KEYWORDS.some(kw => stageName.includes(kw));

      if (!isResolved) return true; // Active opportunity exists

      // Recently resolved also counts (within 30 days)
      const lastChange = new Date(opp.lastStageChangeAt || opp.updatedAt || 0);
      if (lastChange > recentCutoff) return true;
    }

    return false;
  } catch (err) {
    console.error(`[opp-sync] Error checking opportunities for ${contactId}:`, err);
    return false; // If we can't check, don't create (safer)
  }
}

async function createOpportunity(contactId, contactName, source) {
  try {
    const stageMap = await fetchPipelineStages();
    let newLeadStageId = null;
    for (const [id, name] of Object.entries(stageMap)) {
      if (name.toLowerCase() === 'new lead') {
        newLeadStageId = id;
        break;
      }
    }

    if (!newLeadStageId || !PIPELINE_ID) return null;

    // Clean source if it has Spanish text
    let cleanSource = source;
    if (/necesito|pégalo|proporciona|evaluar|matchear/i.test(source)) {
      cleanSource = 'Auto-Detected Lead';
    }

    const response = await fetch(`${GHL_API_BASE}/opportunities/`, {
      method: 'POST',
      headers: ghlHeaders(),
      body: JSON.stringify({
        pipelineId: PIPELINE_ID,
        pipelineStageId: newLeadStageId,
        locationId: LOCATION_ID,
        contactId,
        name: contactName,
        status: 'open',
        source: cleanSource,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[opp-sync] Create failed ${response.status}: ${text.substring(0, 200)}`);
      return null;
    }

    const data = await response.json();
    return data.opportunity || data;
  } catch (err) {
    console.error(`[opp-sync] Create error:`, err);
    return null;
  }
}
