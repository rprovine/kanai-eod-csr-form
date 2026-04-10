/**
 * Auto-close stale/unresponsive leads.
 *
 * Rules:
 * 1. "New Lead" 48+ hours, 3+ contact attempts, zero inbound response → Non-Qualified
 *    Reason: "No Response - Unqualified"
 *
 * 2. "Contacted" 7+ days, attempts made, zero inbound response → Non-Qualified
 *    Reason: "No Response After Contact - Unqualified"
 *
 * 3. "Quoted"/"Estimate Completed" 14+ days, no response → JR Lost or DR Lost
 *    Reason: "No Response After Quote - 14 Day Auto-Close"
 *
 * Leads with ANY inbound response (two-way conversation) are NOT touched.
 *
 * Runs via cron: once daily at 3 AM HST (13:00 UTC)
 */

import { authorize } from '../_lib/authorize.js';
import { supabaseAdmin } from '../_lib/supabase-admin.js';
import {
  fetchOpportunities,
  fetchPipelineStages,
  updateOpportunity,
  getCustomField,
  toHawaiiDate,
  ghlHeaders,
  CF,
} from '../_lib/ghl-client.js';
import { sendNotification } from '../_lib/ghl-notify.js';

// Lightweight Customer Profile API check — only used for leads about to be
// auto-closed, to protect existing Workiz customers and active dumpster rentals.
const PROFILE_API_URL = 'https://kanai-eod-csr-form.vercel.app/api/customer/profile';
async function isProtectedCustomer(phone) {
  if (!phone) return { protected: false };
  const secret = (process.env.CRON_SECRET || '').trim();
  if (!secret) return { protected: false };
  try {
    const res = await fetch(`${PROFILE_API_URL}?phone=${encodeURIComponent(phone)}`, {
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { protected: false };
    const profile = await res.json();
    const sig = profile.signals || {};
    if (sig.is_existing_workiz_customer) return { protected: true, reason: 'existing_workiz_customer' };
    if (sig.has_active_dumpster_rental) return { protected: true, reason: 'active_dumpster_rental' };
    if (sig.is_docket_customer) return { protected: true, reason: 'docket_customer' };
    return { protected: false };
  } catch {
    return { protected: false }; // On failure, don't block auto-close
  }
}

export const maxDuration = 120;

const GHL_API_BASE = 'https://services.leadconnectorhq.com';

// How long before auto-close (in hours)
const RULES = {
  new_lead: { hoursStale: 48, minAttempts: 3 },
  contacted: { hoursStale: 168 },       // 7 days
  quoted: { hoursStale: 336 },           // 14 days
};

/**
 * Get all messages for a contact (SMS, chat, calls — all touchpoints).
 * GHL message types: 1=call, 2=SMS, 11=Facebook, 18=Instagram, 24=IVR call
 * Calls have direction "inbound"/"outbound" just like messages.
 */
async function getContactMessages(contactId) {
  if (!contactId) return [];

  const locationId = process.env.GHL_LOCATION_ID;
  try {
    const convParams = new URLSearchParams({ locationId, contactId, limit: '5' });
    const convRes = await fetch(
      `${GHL_API_BASE}/conversations/search?${convParams}`,
      { headers: ghlHeaders() }
    );
    if (!convRes.ok) return [];
    const convData = await convRes.json();
    const conversations = convData.conversations || [];

    const allMessages = [];
    for (const conv of conversations) {
      if (!conv.id) continue;
      const msgRes = await fetch(
        `${GHL_API_BASE}/conversations/${conv.id}/messages`,
        { headers: ghlHeaders() }
      );
      if (!msgRes.ok) continue;
      const msgData = await msgRes.json();
      const messages = msgData.messages?.messages || msgData.messages || [];
      allMessages.push(...messages);
    }
    return allMessages;
  } catch (err) {
    console.error(`Error fetching messages for ${contactId}:`, err);
    return [];
  }
}

/**
 * Check if a contact has any inbound touchpoint (message, call, or reply).
 * Counts ALL channels: SMS, calls, Facebook, Instagram, chat.
 * If they responded or called even once, they're a real lead — don't auto-close.
 */
async function hasInboundResponse(contactId) {
  const messages = await getContactMessages(contactId);
  for (const msg of messages) {
    if ((msg.direction || '').toLowerCase() === 'inbound') {
      return true;
    }
  }
  return false;
}

/**
 * Count outbound contact attempts across ALL channels (distinct days).
 * Includes: calls made, SMS sent, chat messages, social messages.
 */
async function countOutboundAttempts(contactId) {
  const messages = await getContactMessages(contactId);
  const outboundDays = new Set();
  for (const msg of messages) {
    if ((msg.direction || '').toLowerCase() === 'outbound') {
      const day = (msg.dateAdded || '').split('T')[0];
      if (day) outboundDays.add(day);
    }
  }
  return outboundDays.size;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!authorize(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (process.env.AI_ORCHESTRATION_KILL_SWITCH === 'true') {
    await supabaseAdmin.from('ai_orchestration_events').insert({
      system: 'auto_close',
      decision: 'killed_by_killswitch',
      reason: 'AI_ORCHESTRATION_KILL_SWITCH=true',
    }).then(() => {}).catch(() => {});
    return res.status(200).json({ killed: true, reason: 'AI_ORCHESTRATION_KILL_SWITCH' });
  }

  try {
    const [opportunities, stageMap] = await Promise.all([
      fetchOpportunities(),
      fetchPipelineStages(),
    ]);

    const now = Date.now();
    const results = { moved_to_non_qualified: 0, moved_to_lost: 0, skipped_has_response: 0, skipped_existing_customer: 0, checked: 0, errors: [] };

    // Build reverse stage map: name → id
    const stageIdByName = {};
    for (const [id, name] of Object.entries(stageMap)) {
      stageIdByName[name.toLowerCase()] = id;
    }

    // Find target stage IDs
    const nonQualifiedStageId = Object.entries(stageMap).find(([, name]) =>
      name.toLowerCase().includes('non-qualified') || name.toLowerCase().includes('not qualified')
    )?.[0];

    const jrLostStageId = Object.entries(stageMap).find(([, name]) =>
      name.toLowerCase() === 'jr lost' || name.toLowerCase() === 'jr - lost'
    )?.[0] || Object.entries(stageMap).find(([, name]) =>
      name.toLowerCase().includes('lost') && name.toLowerCase().includes('jr')
    )?.[0];

    const drLostStageId = Object.entries(stageMap).find(([, name]) =>
      name.toLowerCase() === 'dr lost' || name.toLowerCase() === 'dr - lost'
    )?.[0] || Object.entries(stageMap).find(([, name]) =>
      name.toLowerCase().includes('lost') && name.toLowerCase().includes('dr')
    )?.[0];

    // Fallback: generic lost stage
    const genericLostStageId = Object.entries(stageMap).find(([, name]) =>
      name.toLowerCase() === 'lost'
    )?.[0];

    console.log(`Stages found: non-qualified=${nonQualifiedStageId}, JR lost=${jrLostStageId}, DR lost=${drLostStageId}, generic lost=${genericLostStageId}`);

    for (const opp of opportunities) {
      const stageName = stageMap[opp.pipelineStageId] || opp.pipelineStageName || '';
      const stageL = stageName.toLowerCase();
      const contactId = opp.contact?.id || opp.contactId || '';
      const contactName = opp.contact?.name || opp.name || 'Unknown';
      const lastUpdate = new Date(opp.lastStageChangeAt || opp.updatedAt || opp.createdAt);
      const hoursStale = (now - lastUpdate.getTime()) / (1000 * 60 * 60);

      let rule = null;
      let targetStageId = null;
      let lostReason = '';

      // Rule 1: New Lead, 48+ hours, 3+ attempts, no response
      if (stageL.includes('new lead') || stageL === 'new') {
        if (hoursStale >= RULES.new_lead.hoursStale) {
          rule = 'new_lead';
          targetStageId = nonQualifiedStageId;
          lostReason = 'No Response - Unqualified';
        }
      }
      // Rule 2: Contacted, 7+ days, no response
      else if (stageL.includes('contacted') || stageL.includes('follow-up') || stageL.includes('follow up') || stageL.includes('nurture')) {
        if (hoursStale >= RULES.contacted.hoursStale) {
          rule = 'contacted';
          targetStageId = nonQualifiedStageId;
          lostReason = 'No Response After Contact - Unqualified';
        }
      }
      // Rule 3: Quoted/Estimate Completed, 14+ days
      else if (stageL.includes('quot') || stageL.includes('estimate completed') || stageL.includes('agreement sent')) {
        if (hoursStale >= RULES.quoted.hoursStale) {
          rule = 'quoted';
          // Determine JR vs DR from stage name
          if (stageL.includes('dr')) {
            targetStageId = drLostStageId || genericLostStageId;
          } else {
            targetStageId = jrLostStageId || genericLostStageId;
          }
          lostReason = 'No Response After Quote - 14 Day Auto-Close';
        }
      }

      if (!rule || !targetStageId) continue;

      results.checked++;

      // Check if lead has actually responded (two-way conversation)
      const responded = await hasInboundResponse(contactId);
      if (responded) {
        results.skipped_has_response++;
        continue;
      }

      // For new leads, verify minimum contact attempts
      if (rule === 'new_lead') {
        const attempts = await countOutboundAttempts(contactId);
        if (attempts < RULES.new_lead.minAttempts) continue;
      }

      // Phase 7B: Protect existing customers from auto-close.
      // If the contact is a known Workiz customer or has an active dumpster rental,
      // skip auto-close — they're a real customer, not an unresponsive cold lead.
      const contactPhone = opp.contact?.phone || '';
      if (contactPhone) {
        const check = await isProtectedCustomer(contactPhone);
        if (check.protected) {
          await supabaseAdmin.from('ai_orchestration_events').insert({
            system: 'auto_close',
            contact_id: contactId,
            contact_phone: contactPhone,
            decision: 'skipped_existing_customer',
            reason: `Would have auto-closed (${rule}: ${lostReason}) but customer is ${check.reason}`,
            context: { opportunity_id: opp.id, stage: stageName, hours_stale: Math.round(hoursStale) },
          }).then(() => {}).catch(() => {});
          console.log(`Auto-close SKIPPED: ${contactName} — ${check.reason}`);
          results.skipped_existing_customer++;

          // Alert management — an existing customer is sitting stale in the pipeline
          try {
            const RENO_PHONE = process.env.NOTIFY_PHONE || '8082012668';
            await sendNotification(RENO_PHONE, null,
              `⚠️ Auto-Close Alert: ${contactName} is a ${check.reason} but has been stale for ${Math.round(hoursStale)}h in "${stageName}". Auto-close was blocked — someone should follow up personally.`
            );
          } catch {}
          continue;
        }
      }

      // Move the opportunity
      try {
        const updateFields = { pipelineStageId: targetStageId };

        const ok = await updateOpportunity(opp.id, updateFields);
        if (ok) {
          // Set lost reason custom field
          if (lostReason) {
            await fetch(`${GHL_API_BASE}/contacts/${contactId}`, {
              method: 'PUT',
              headers: ghlHeaders(),
              body: JSON.stringify({
                customFields: [
                  { id: CF.LOST_REASON, field_value: lostReason },
                ],
              }),
            });
          }

          if (rule === 'quoted') {
            results.moved_to_lost++;
          } else {
            results.moved_to_non_qualified++;
          }
          console.log(`Auto-closed: ${contactName} (${rule}) → ${stageName} → ${lostReason}`);
        }
      } catch (err) {
        results.errors.push({ name: contactName, error: err.message });
      }

      // Rate limit: don't hammer GHL API
      await new Promise(r => setTimeout(r, 500));
    }

    return res.status(200).json({
      message: 'Auto-close complete',
      ...results,
    });
  } catch (error) {
    console.error('Auto-close stale error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
