import { ghlHeaders } from '../_lib/ghl-client.js';

/**
 * Smart Opportunity Creation
 *
 * Called by GHL workflow instead of "Create Or Update Opportunity".
 * Checks if the contact already has an active opportunity in the LEADS pipeline
 * before creating a new one. Prevents duplicate opportunities from repeat callers.
 *
 * POST /api/ghl/smart-opportunity
 * Body (from GHL workflow custom webhook):
 * {
 *   "contact": { "id": "...", "name": "...", "phone": "..." },
 *   "callDirection": "inbound"
 * }
 */

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const PIPELINE_ID = process.env.GHL_PIPELINE_ID;
const LOCATION_ID = process.env.GHL_LOCATION_ID;

// Stages that mean the opportunity is still active (not resolved)
const ACTIVE_STAGE_KEYWORDS = [
  'new lead', 'contacted', 'follow', 'estimate', 'quote', 'agreement',
  'conversation', 'nurture', 'discovery',
];

// Stages that mean the opportunity is resolved (don't count as active)
const RESOLVED_STAGE_KEYWORDS = [
  'booked', 'won', 'lost', 'declined', 'non-qualified', 'closed',
];

function verifyAuth(req) {
  const secret = process.env.GHL_WEBHOOK_SECRET;
  if (!secret) return true;
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
  const contact = body.contact || {};
  const contactId = contact.id || body.contactId || body.contact_id;
  const contactName = contact.name || body.contactName || body.contact_name || 'Unknown';
  const contactPhone = contact.phone || body.contactPhone || body.phone || '';

  console.log(`[smart-opp] Contact: ${contactName} (${contactId}) phone: ${contactPhone}`);

  if (!contactId) {
    return res.status(200).json({
      action: 'skipped',
      reason: 'No contact ID provided'
    });
  }

  try {
    // Step 1: Search for existing opportunities for this contact
    const existingOpps = await findContactOpportunities(contactId);

    console.log(`[smart-opp] Found ${existingOpps.length} existing opportunities for ${contactName}`);

    // Step 2: Check if any are in active stages
    const activeOpps = existingOpps.filter(opp => {
      const stageName = (opp.stageName || '').toLowerCase();
      // If it matches a resolved stage, it's not active
      if (RESOLVED_STAGE_KEYWORDS.some(kw => stageName.includes(kw))) return false;
      // Everything else is active (including unknown stages)
      return true;
    });

    if (activeOpps.length > 0) {
      const activeOpp = activeOpps[0];
      console.log(`[smart-opp] SKIP: ${contactName} already has active opportunity "${activeOpp.name}" in stage "${activeOpp.stageName}"`);

      return res.status(200).json({
        action: 'skipped',
        reason: 'Contact already has active opportunity',
        existingOpportunity: {
          id: activeOpp.id,
          name: activeOpp.name,
          stage: activeOpp.stageName,
          pipelineId: activeOpp.pipelineId,
        },
        contactName,
        contactId,
      });
    }

    // Step 2b: Check if any resolved opportunity was updated in the last 30 days
    // If so, the customer is likely calling about their recent job — don't create a new lead
    const RECENT_DAYS = 30;
    const recentCutoff = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000);
    const recentResolvedOpps = existingOpps.filter(opp => {
      const stageName = (opp.stageName || '').toLowerCase();
      const isResolved = RESOLVED_STAGE_KEYWORDS.some(kw => stageName.includes(kw));
      if (!isResolved) return false;
      const lastChange = new Date(opp.lastStageChangeAt || opp.updatedAt || 0);
      return lastChange > recentCutoff;
    });

    if (recentResolvedOpps.length > 0) {
      const recentOpp = recentResolvedOpps[0];
      console.log(`[smart-opp] SKIP: ${contactName} has recently resolved opportunity "${recentOpp.name}" in stage "${recentOpp.stageName}" (within ${RECENT_DAYS} days)`);

      return res.status(200).json({
        action: 'skipped',
        reason: `Contact has recently resolved opportunity (within ${RECENT_DAYS} days)`,
        existingOpportunity: {
          id: recentOpp.id,
          name: recentOpp.name,
          stage: recentOpp.stageName,
          pipelineId: recentOpp.pipelineId,
        },
        contactName,
        contactId,
      });
    }

    // Step 3: No active or recent opportunity — create a new one
    console.log(`[smart-opp] CREATE: New opportunity for ${contactName} (no active or recent opportunities)`);

    const newOpp = await createOpportunity(contactId, contactName, contactPhone);

    if (!newOpp) {
      return res.status(200).json({
        action: 'error',
        reason: 'Failed to create opportunity',
        contactName,
        contactId,
      });
    }

    console.log(`[smart-opp] Created opportunity ${newOpp.id} for ${contactName}`);

    return res.status(200).json({
      action: 'created',
      opportunity: {
        id: newOpp.id,
        name: newOpp.name,
        pipelineId: newOpp.pipelineId,
        pipelineStageId: newOpp.pipelineStageId,
      },
      contactName,
      contactId,
    });

  } catch (err) {
    console.error('[smart-opp] Error:', err);
    return res.status(200).json({
      action: 'error',
      reason: err.message,
      contactName,
      contactId,
    });
  }
}

/**
 * Find all opportunities for a contact across all pipelines
 */
async function findContactOpportunities(contactId) {
  try {
    // Search opportunities by contact ID
    const params = new URLSearchParams({
      location_id: LOCATION_ID,
      contact_id: contactId,
      limit: '20',
    });

    if (PIPELINE_ID) {
      params.set('pipeline_id', PIPELINE_ID);
    }

    const response = await fetch(
      `${GHL_API_BASE}/opportunities/search?${params}`,
      { headers: ghlHeaders() }
    );

    if (!response.ok) {
      console.error(`[smart-opp] GHL search returned ${response.status}`);
      return [];
    }

    const data = await response.json();
    const opps = data.opportunities || [];

    // Get stage names
    const stageMap = await getStageMap();

    return opps.map(opp => ({
      id: opp.id,
      name: opp.name || opp.contact?.name || '',
      pipelineId: opp.pipelineId,
      pipelineStageId: opp.pipelineStageId,
      stageName: stageMap[opp.pipelineStageId] || '',
      status: opp.status,
      contactId: opp.contact?.id || opp.contactId,
      assignedTo: opp.assignedTo,
      lastStageChangeAt: opp.lastStageChangeAt,
      updatedAt: opp.updatedAt,
    }));
  } catch (err) {
    console.error('[smart-opp] Error searching opportunities:', err);
    return [];
  }
}

/**
 * Create a new opportunity in the New Lead stage
 */
async function createOpportunity(contactId, contactName, contactPhone) {
  try {
    const stageMap = await getStageMap();

    // Find "New Lead" stage ID
    let newLeadStageId = null;
    for (const [id, name] of Object.entries(stageMap)) {
      if (name.toLowerCase() === 'new lead') {
        newLeadStageId = id;
        break;
      }
    }

    if (!newLeadStageId) {
      console.error('[smart-opp] Could not find "New Lead" stage');
      return null;
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
        source: 'Inbound Call',
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[smart-opp] Create failed ${response.status}: ${text}`);
      return null;
    }

    const data = await response.json();
    return data.opportunity || data;
  } catch (err) {
    console.error('[smart-opp] Create error:', err);
    return null;
  }
}

// Cache stage map for 5 minutes
let stageMapCache = null;
let stageMapCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function getStageMap() {
  if (stageMapCache && Date.now() - stageMapCacheTime < CACHE_TTL) {
    return stageMapCache;
  }

  try {
    const response = await fetch(
      `${GHL_API_BASE}/opportunities/pipelines?locationId=${LOCATION_ID}`,
      { headers: ghlHeaders() }
    );

    if (!response.ok) return stageMapCache || {};

    const data = await response.json();
    const map = {};
    for (const pipeline of (data.pipelines || [])) {
      for (const stage of (pipeline.stages || [])) {
        map[stage.id] = stage.name;
      }
    }

    stageMapCache = map;
    stageMapCacheTime = Date.now();
    return map;
  } catch (err) {
    return stageMapCache || {};
  }
}
