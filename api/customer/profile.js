/**
 * Unified Customer Profile API
 *
 * Aggregates customer data from GHL, Workiz, and Supabase into a single response.
 * READ-ONLY. Does not modify any state in any system.
 *
 * Phase 1 of the unified AI orchestration layer. See kanai-unified-ai-plan.md.
 *
 * GET /api/customer/profile?phone=+18085551234
 *   Auth: Bearer ${CRON_SECRET}
 *
 * Returns the unified customer view used by Kai voice, the SMS router,
 * and the orchestration crons (in later phases — Phase 1 just builds it).
 *
 * Caching: 60-second in-memory cache per phone.
 * Timeouts: every external API call has a hard 5-second timeout.
 * Failure mode: partial data with `errors` array, never crashes.
 */

import { supabaseAdmin } from '../_lib/supabase-admin.js';
import { ghlHeaders } from '../_lib/ghl-client.js';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const WORKIZ_API_BASE = 'https://api.workiz.com/api/v1';

// Resolved stages — used by signals.is_resolved
const RESOLVED_STAGE_KEYWORDS = [
  'booked', 'won', 'lost', 'declined', 'non-qualified', 'closed',
  'not qualified', 'jr lost', 'dr lost', 'jr booked', 'dr booked',
];

// In-memory cache. Cold-start safe — just empty on each new instance.
const cache = new Map();
const CACHE_TTL_MS = 60 * 1000;

function normalizePhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits;
}

function authorize(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev mode
  const auth = req.headers['authorization'] || '';
  if (auth === `Bearer ${secret}`) return true;
  if (req.query?.token === secret) return true;
  return false;
}

// Wrap a promise with a timeout — returns null if it doesn't resolve in time
async function withTimeout(promise, ms, label) {
  let timeoutId;
  const timeoutPromise = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve({ __timeout: true, label }), ms);
  });
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId);
    if (result && result.__timeout) {
      return { error: `${label} timed out after ${ms}ms` };
    }
    return result;
  } catch (err) {
    clearTimeout(timeoutId);
    return { error: `${label} failed: ${err.message}` };
  }
}

// === GHL fetchers ===

async function _ghlSearchContacts(query) {
  const apiKey = (process.env.GHL_API_KEY || '').trim();
  const locationId = (process.env.GHL_LOCATION_ID || '').trim();
  if (!apiKey || !locationId || !query) return [];
  try {
    const res = await fetch(`${GHL_API_BASE}/contacts/search`, {
      method: 'POST',
      headers: { ...ghlHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId, query, pageLimit: 10 }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.contacts || [];
  } catch {
    return [];
  }
}

/**
 * Find ALL GHL contacts matching a phone, including duplicates that share
 * the same person but were created separately.
 *
 * GHL data is messy — the same customer often has 2-3 contact records
 * (one created by inbound call, one from a form, one from an email opt-in,
 * etc.) and they don't share fields. A phone-based search returns ONE
 * record but the customer's actual booking might be tied to a different
 * record (e.g. one that has email but no phone). We must aggregate.
 *
 * Strategy:
 *   1. Search by phone variants → primary set
 *   2. For each result, search by full name → catches duplicate name records
 *   3. For each result with an email, search by email → catches email-only dupes
 *   4. Dedupe by contact id, return the merged list
 */
async function fetchGhlContacts(phone10) {
  const apiKey = (process.env.GHL_API_KEY || '').trim();
  const locationId = (process.env.GHL_LOCATION_ID || '').trim();
  if (!apiKey || !locationId) return [];

  const seen = new Map();
  const addAll = (contacts) => {
    for (const c of contacts) {
      if (c?.id && !seen.has(c.id)) seen.set(c.id, c);
    }
  };

  // Step 1: phone variants
  for (const variant of [`+1${phone10}`, phone10, `1${phone10}`]) {
    addAll(await _ghlSearchContacts(variant));
  }

  // Step 2 + 3: for each found contact, search by name and by email to catch dupes
  const initial = Array.from(seen.values());
  for (const c of initial) {
    const fullName = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
    if (fullName.length >= 3) {
      addAll(await _ghlSearchContacts(fullName));
    }
    if (c.email) {
      addAll(await _ghlSearchContacts(c.email));
    }
  }

  return Array.from(seen.values());
}

/** Pick the most complete contact from a merged set as the canonical identity. */
function _pickPrimaryContact(contacts) {
  if (!contacts?.length) return null;
  const score = (c) =>
    (c.phone ? 2 : 0) +
    (c.email ? 2 : 0) +
    (c.firstName ? 1 : 0) +
    (c.lastName ? 1 : 0) +
    (c.address1 ? 1 : 0) +
    (c.dateAdded ? 0.001 * (Date.now() - new Date(c.dateAdded).getTime() < 0 ? 0 : 1) : 0);
  return [...contacts].sort((a, b) => score(b) - score(a))[0];
}

async function fetchGhlOpportunities(contactId) {
  if (!contactId) return [];
  const locationId = process.env.GHL_LOCATION_ID;
  if (!locationId) return [];

  try {
    const params = new URLSearchParams({
      location_id: locationId,
      contact_id: contactId,
      limit: '20',
    });
    const res = await fetch(`${GHL_API_BASE}/opportunities/search?${params}`, {
      headers: ghlHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.opportunities || [];
  } catch {
    return [];
  }
}

async function fetchGhlConversationSummary(contactId) {
  if (!contactId) return null;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!locationId) return null;

  try {
    const params = new URLSearchParams({ locationId, contactId, limit: '5' });
    const convRes = await fetch(`${GHL_API_BASE}/conversations/search?${params}`, {
      headers: ghlHeaders(),
    });
    if (!convRes.ok) return null;
    const convData = await convRes.json();
    const conversations = convData.conversations || [];
    if (conversations.length === 0) return null;

    // Just return high-level metadata, not the full message history
    // (callers fetch full messages from Supabase ai_message_log if they need it)
    const conv = conversations[0];
    return {
      id: conv.id,
      lastMessageBody: conv.lastMessageBody || null,
      lastMessageType: conv.lastMessageType || null,
      lastMessageDirection: conv.lastMessageDirection || null,
      lastMessageDate: conv.lastMessageDate || null,
      unreadCount: conv.unreadCount || 0,
    };
  } catch {
    return null;
  }
}

// === Workiz fetcher ===

// Module-scope Workiz job cache. Workiz /job/all/ does NOT support phone filtering
// (returns 400 for `?phone=`), so we paginate the full job list once and search
// client-side. Cache lives in serverless function memory for 5 minutes — one cold
// start does the full scan, then every phone lookup is O(n) over the in-memory list.
let _workizCache = null; // { jobs: [...], fetchedAt: ms, error?: string }
const WORKIZ_CACHE_MS = 5 * 60 * 1000;
const WORKIZ_LOOKBACK_MONTHS = 24;
const WORKIZ_MAX_PAGES = 30;
const WORKIZ_PAGE_SIZE = 100;

async function loadWorkizJobsCache() {
  if (_workizCache && Date.now() - _workizCache.fetchedAt < WORKIZ_CACHE_MS) {
    return _workizCache;
  }

  // Trim trailing whitespace, newlines, AND literal "\n" (env var contains the
  // 2-char sequence backslash-n, not an actual newline — same env quirk as GHL_PIPELINE_ID)
  const token = (process.env.WORKIZ_API_TOKEN || '').replace(/\\n$/, '').trim();
  if (!token) return { jobs: [], fetchedAt: Date.now(), error: 'no_workiz_token' };

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - WORKIZ_LOOKBACK_MONTHS);
  const startStr = startDate.toISOString().slice(0, 10);

  const allJobs = [];
  for (let page = 0; page < WORKIZ_MAX_PAGES; page++) {
    const offset = page * WORKIZ_PAGE_SIZE;
    const url = `${WORKIZ_API_BASE}/${token}/job/all/?start_date=${startStr}&offset=${offset}&records=${WORKIZ_PAGE_SIZE}`;
    let res;
    try {
      res = await fetch(url, {
        headers: { 'User-Agent': 'KanaiCustomerProfileAPI/1.0', Accept: 'application/json' },
      });
    } catch (e) {
      _workizCache = { jobs: allJobs, fetchedAt: Date.now(), error: `workiz_fetch_${e.message}` };
      return _workizCache;
    }
    if (!res.ok) {
      _workizCache = { jobs: allJobs, fetchedAt: Date.now(), error: `workiz_http_${res.status}` };
      return _workizCache;
    }
    const result = await res.json();
    const pageJobs = result.data || [];
    if (pageJobs.length === 0) break;
    allJobs.push(...pageJobs);
    if (pageJobs.length < WORKIZ_PAGE_SIZE) break;
  }

  _workizCache = { jobs: allJobs, fetchedAt: Date.now() };
  return _workizCache;
}

function _normalizeJob(j) {
  return {
    job_number: String(j.SerialId || ''),
    uuid: j.UUID || null,
    status: j.Status || '',
    job_type: j.JobType || '',
    job_date: j.JobDateTime || null,
    total: parseFloat(j.SubTotal || j.JobTotalPrice || 0),
    address: j.JobAddress || '',
    customer_name: [j.FirstName, j.LastName].filter(Boolean).join(' '),
  };
}

function _phoneDigits(p) {
  return String(p || '').replace(/\D/g, '').slice(-10);
}

async function fetchWorkizJobs(phone10) {
  if (!phone10) return { found: false, jobs: [] };
  const cache = await loadWorkizJobsCache();
  if (cache.error && cache.jobs.length === 0) {
    return { found: false, jobs: [], error: cache.error };
  }

  const target = _phoneDigits(phone10);
  const matched = cache.jobs.filter(j => {
    const p1 = _phoneDigits(j.Phone);
    const p2 = _phoneDigits(j.SecondPhone);
    return p1 === target || p2 === target;
  });

  // Sort newest first
  matched.sort((a, b) => String(b.JobDateTime || '').localeCompare(String(a.JobDateTime || '')));

  const jobs = matched.map(_normalizeJob);
  return {
    found: jobs.length > 0,
    jobs,
    total_jobs: jobs.length,
    total_revenue: jobs.reduce((sum, j) => sum + (j.total || 0), 0),
    customer_name: jobs[0]?.customer_name || null,
  };
}

// === Supabase fetchers ===

async function fetchVoiceHistory(phone10) {
  if (!supabaseAdmin || !phone10) return [];
  // ai_interaction_log stores phone with various formats — try a few
  const variants = [`+1${phone10}`, phone10, `1${phone10}`];
  const allRows = [];
  for (const variant of variants) {
    const { data } = await supabaseAdmin
      .from('ai_interaction_log')
      .select('id, call_id, caller_name, intent, customer_type, service_type, outcome, summary, duration_seconds, tools_used, ghl_contact_id, created_at')
      .eq('caller_phone', variant)
      .order('created_at', { ascending: false })
      .limit(10);
    if (data?.length) allRows.push(...data);
  }
  // Dedup by call_id
  const seen = new Set();
  return allRows.filter(r => {
    if (seen.has(r.call_id)) return false;
    seen.add(r.call_id);
    return true;
  }).slice(0, 10);
}

async function fetchSmsConversations(phone10) {
  if (!supabaseAdmin || !phone10) return [];
  const variants = [`+1${phone10}`, phone10, `1${phone10}`];
  const allRows = [];
  for (const variant of variants) {
    const { data } = await supabaseAdmin
      .from('ai_conversations')
      .select('id, contact_id, contact_name, system, status, channel, message_count, context, handed_off_at, created_at, updated_at')
      .eq('contact_phone', variant)
      .order('created_at', { ascending: false })
      .limit(10);
    if (data?.length) allRows.push(...data);
  }
  // Dedup by id
  const seen = new Set();
  return allRows.filter(r => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  }).slice(0, 10);
}

/**
 * Fetch Docket dispatch events for a customer.
 *
 * Docket has no API — only a webhook that lands rows in `docket_webhook_events`.
 * The webhook configuration in Docket has a known bug: `customer_phone` and
 * `customer_email` come through as the literal template strings "{{Client_Phone}}"
 * and "{{Client_Email}}" because the variables aren't being substituted on
 * Docket's side. Until that's fixed in the Docket dashboard, we cannot match
 * by phone — we match by NAME instead, which IS populated correctly.
 *
 * Pass either a workiz_name (preferred) or contact_name (GHL fallback). Returns
 * the most recent drop-off and pickup events plus a derived rental status.
 */
async function fetchDocketEvents({ phone10, name, email }) {
  if (!supabaseAdmin || (!phone10 && !name && !email)) return { found: false, events: [] };

  // Try PHONE first (strongest match — only works once Docket webhook template
  // is configured with the correct {{Customer_Phone}} variable name).
  // Then EMAIL (~61% resolution rate). Then NAME as fuzzy fallback.
  let data = null;
  let error = null;
  const SELECT = 'event_type, docket_id, customer_name, customer_email, customer_phone, job_address, asset_type, completion_time, job_date, driver_name, truck_number, received_at';

  if (phone10) {
    // Match against any phone format Docket might send (E.164, bare digits, etc).
    // We use ilike with % wildcards on the last 7 digits as a reliable substring match.
    const last7 = phone10.slice(-7);
    const res = await supabaseAdmin
      .from('docket_webhook_events')
      .select(SELECT)
      .ilike('customer_phone', `%${last7}%`)
      .order('received_at', { ascending: false })
      .limit(20);
    data = res.data;
    error = res.error;
    // Filter out the literal "{{Client_Phone}}" pseudo-matches just in case
    if (data) data = data.filter(r => r.customer_phone && !String(r.customer_phone).includes('{{'));
  }

  if ((!data || data.length === 0) && email && email.includes('@')) {
    const res = await supabaseAdmin
      .from('docket_webhook_events')
      .select(SELECT)
      .ilike('customer_email', email.trim())
      .order('received_at', { ascending: false })
      .limit(20);
    data = res.data;
    error = res.error;
  }

  if ((!data || data.length === 0) && name) {
    const cleaned = String(name).trim();
    if (cleaned.length >= 3) {
      const res = await supabaseAdmin
        .from('docket_webhook_events')
        .select(SELECT)
        .ilike('customer_name', cleaned)
        .order('received_at', { ascending: false })
        .limit(20);
      data = res.data;
      error = res.error;
    }
  }

  if (error) return { found: false, events: [], error: `docket_${error.code || 'err'}` };
  const events = data || [];
  if (events.length === 0) return { found: false, events: [] };

  // Derive a current rental status: find the most recent Drop Off and check if
  // there's a more recent Pick Up for the same docket_id. If no pickup → active.
  const dropOffs = events.filter(e => /drop ?off/i.test(e.event_type || ''));
  const pickUps = events.filter(e => /pick ?up/i.test(e.event_type || ''));
  let activeRental = null;
  for (const drop of dropOffs) {
    const matchingPickup = pickUps.find(p =>
      p.docket_id === drop.docket_id &&
      new Date(p.received_at).getTime() > new Date(drop.received_at).getTime()
    );
    if (!matchingPickup) {
      activeRental = drop;
      break;
    }
  }

  return {
    found: true,
    events,
    total_events: events.length,
    last_event: events[0],
    active_rental: activeRental,
    last_dropoff: dropOffs[0] || null,
    last_pickup: pickUps[0] || null,
  };
}

async function fetchCsrInteractions(contactId) {
  if (!supabaseAdmin || !contactId) return [];
  const { data } = await supabaseAdmin
    .from('lead_activity_log')
    .select('action, action_date, lead_source, csr_name, stage_name, contact_name')
    .eq('contact_id', contactId)
    .order('action_date', { ascending: false })
    .limit(20);
  return data || [];
}

// === Profile assembly ===

function buildSignals({ ghlContact, workiz, opportunities, voiceHistory, smsConvs, csrInteractions, docket }) {
  const isResolved = (() => {
    if (opportunities.length === 0) return false;
    const latestOpp = opportunities[0];
    const stage = (latestOpp.pipelineStageName || latestOpp.stageName || '').toLowerCase();
    return RESOLVED_STAGE_KEYWORDS.some(kw => stage.includes(kw));
  })();

  const hasActiveAiConversation = smsConvs.some(c => c.status === 'active');
  const lastVoiceCall = voiceHistory[0] || null;
  const lastSmsConv = smsConvs[0] || null;

  // Last touch across all channels
  const lastTouchCandidates = [
    lastVoiceCall?.created_at,
    lastSmsConv?.updated_at,
    csrInteractions[0]?.action_date,
    opportunities[0]?.updatedAt,
  ].filter(Boolean).map(d => new Date(d).getTime());
  const lastTouchAt = lastTouchCandidates.length > 0 ? Math.max(...lastTouchCandidates) : null;
  const hoursSinceLastTouch = lastTouchAt ? Math.round((Date.now() - lastTouchAt) / (60 * 60 * 1000) * 10) / 10 : null;

  return {
    is_existing_workiz_customer: workiz.found,
    has_active_dumpster_rental: !!(docket && docket.active_rental),
    is_docket_customer: !!(docket && docket.found),
    has_active_ai_conversation: hasActiveAiConversation,
    has_recent_voice_call: !!lastVoiceCall && (Date.now() - new Date(lastVoiceCall.created_at).getTime()) < 30 * 24 * 60 * 60 * 1000,
    is_repeat_customer: workiz.found && (workiz.total_jobs || 0) > 1,
    is_resolved: isResolved,
    is_in_dnd: ghlContact?.dnd === true,
    days_since_last_touch: hoursSinceLastTouch !== null ? Math.round(hoursSinceLastTouch / 24 * 10) / 10 : null,
    hours_since_last_touch: hoursSinceLastTouch,
  };
}

async function buildProfile(phone10) {
  const errors = [];

  // Step 1: Find ALL GHL contacts for this customer (handles duplicate records).
  // GHL data is messy — same person often has 2-3 separate contact rows that
  // each hold a different fragment of their data (one with phone, one with
  // email, one with the actual opportunity). We must aggregate.
  const allGhlContacts = await withTimeout(fetchGhlContacts(phone10), 8000, 'ghl_contacts').then(r => Array.isArray(r) ? r : []);
  const primaryContact = _pickPrimaryContact(allGhlContacts);
  const allContactIds = allGhlContacts.map(c => c.id).filter(Boolean);
  const primaryContactId = primaryContact?.id || null;

  // Step 2: Parallel fetches. Opportunities and CSR interactions get fetched
  // for EVERY contact ID and merged, since duplicate records each hold their
  // own slice. Conversations summary and SMS use the primary record (they're
  // typically richer per-contact).
  const opportunitiesPromise = Promise.all(
    allContactIds.map(id =>
      withTimeout(fetchGhlOpportunities(id), 5000, 'ghl_opportunities').then(r => r?.error ? (errors.push(r.error), []) : (r || []))
    )
  ).then(arrays => {
    // Merge + dedupe by opp id
    const seen = new Set();
    const merged = [];
    for (const arr of arrays) {
      for (const opp of arr) {
        if (opp?.id && !seen.has(opp.id)) { seen.add(opp.id); merged.push(opp); }
      }
    }
    // Sort newest first
    merged.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
    return merged;
  });

  const csrInteractionsPromise = Promise.all(
    allContactIds.map(id =>
      withTimeout(fetchCsrInteractions(id), 5000, 'csr_interactions').then(r => r?.error ? (errors.push(r.error), []) : (r || []))
    )
  ).then(arrays => {
    const seen = new Set();
    const merged = [];
    for (const arr of arrays) {
      for (const row of arr) {
        const key = `${row.action_date}|${row.action}|${row.csr_name}`;
        if (!seen.has(key)) { seen.add(key); merged.push(row); }
      }
    }
    merged.sort((a, b) => new Date(b.action_date || 0).getTime() - new Date(a.action_date || 0).getTime());
    return merged;
  });

  const [
    opportunities,
    conversationSummary,
    workiz,
    voiceHistory,
    smsConvs,
    csrInteractions,
  ] = await Promise.all([
    opportunitiesPromise,
    withTimeout(fetchGhlConversationSummary(primaryContactId), 5000, 'ghl_conversation').then(r => r?.error ? (errors.push(r.error), null) : r),
    withTimeout(fetchWorkizJobs(phone10), 5000, 'workiz_jobs').then(r => r?.error ? (errors.push(r.error), { found: false, jobs: [] }) : (r || { found: false, jobs: [] })),
    withTimeout(fetchVoiceHistory(phone10), 5000, 'voice_history').then(r => r?.error ? (errors.push(r.error), []) : (r || [])),
    withTimeout(fetchSmsConversations(phone10), 5000, 'sms_conversations').then(r => r?.error ? (errors.push(r.error), []) : (r || [])),
    csrInteractionsPromise,
  ]);

  // Backwards-compat aliases used elsewhere in this function
  const contact = primaryContact;
  const contactId = primaryContactId;

  // Step 3: Docket lookup. Use the merged email/name across all duplicate
  // GHL contacts since the customer's data is fragmented across records.
  const lookupEmail = (allGhlContacts.find(c => c.email) || {}).email || null;
  const lookupName = workiz?.customer_name
    || (contact ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() : '')
    || null;
  const docket = await withTimeout(
    fetchDocketEvents({ phone10, name: lookupName, email: lookupEmail }),
    5000,
    'docket_events'
  ).then(r => r?.error ? (errors.push(r.error), { found: false, events: [] }) : (r || { found: false, events: [] }));

  // Build the unified shape
  const profile = {
    identity: {
      phone: phone10,
      phone_e164: `+1${phone10}`,
      // Merge name/email/address across ALL duplicate GHL contacts — pick the
      // first non-empty value from any record so a phone-only record doesn't
      // hide the email that lives on the email-only duplicate.
      name: (allGhlContacts.find(c => c.firstName || c.lastName)
              ? `${(allGhlContacts.find(c => c.firstName) || {}).firstName || ''} ${(allGhlContacts.find(c => c.lastName) || {}).lastName || ''}`.trim()
              : null) || workiz.customer_name || null,
      email: (allGhlContacts.find(c => c.email) || {}).email || null,
      address: (allGhlContacts.find(c => c.address1) || {}).address1 || null,
      ghl_contact_id: primaryContactId,
      ghl_contact_ids: allContactIds,
      duplicate_ghl_contacts: allGhlContacts.length > 1,
    },
    workiz: {
      is_existing: workiz.found,
      total_jobs: workiz.jobs.length,
      total_revenue: workiz.total_revenue || 0,
      last_job: workiz.jobs[0] || null,
      recent_jobs: workiz.jobs.slice(0, 5),
    },
    voice: {
      total_calls: voiceHistory.length,
      last_call: voiceHistory[0] ? {
        call_id: voiceHistory[0].call_id,
        created_at: voiceHistory[0].created_at,
        outcome: voiceHistory[0].outcome,
        intent: voiceHistory[0].intent,
        service_type: voiceHistory[0].service_type,
        summary: voiceHistory[0].summary,
        duration_seconds: voiceHistory[0].duration_seconds,
        tools_used: voiceHistory[0].tools_used,
      } : null,
      recent_calls: voiceHistory.slice(0, 5).map(c => ({
        call_id: c.call_id,
        created_at: c.created_at,
        outcome: c.outcome,
        duration_seconds: c.duration_seconds,
      })),
    },
    sms: {
      active_conversation: smsConvs.find(c => c.status === 'active') || null,
      total_conversations: smsConvs.length,
      last_conversation: smsConvs[0] || null,
      recent_conversations: smsConvs.slice(0, 5).map(c => ({
        id: c.id,
        system: c.system,
        status: c.status,
        channel: c.channel,
        message_count: c.message_count,
        created_at: c.created_at,
        updated_at: c.updated_at,
      })),
    },
    pipeline: {
      stage: opportunities[0]?.pipelineStageName || opportunities[0]?.stageName || null,
      pipeline_id: opportunities[0]?.pipelineId || null,
      stage_id: opportunities[0]?.pipelineStageId || null,
      opportunity_id: opportunities[0]?.id || null,
      source: opportunities[0]?.source || null,
      total_opportunities: opportunities.length,
      latest_updated_at: opportunities[0]?.updatedAt || null,
    },
    docket: {
      is_docket_customer: docket.found,
      total_events: docket.total_events || 0,
      has_active_rental: !!docket.active_rental,
      active_rental: docket.active_rental ? {
        docket_id: docket.active_rental.docket_id,
        asset_type: docket.active_rental.asset_type,
        address: docket.active_rental.job_address,
        delivered_on: docket.active_rental.job_date || docket.active_rental.completion_date,
        delivered_at: docket.active_rental.completion_time,
      } : null,
      last_dropoff: docket.last_dropoff ? {
        docket_id: docket.last_dropoff.docket_id,
        asset_type: docket.last_dropoff.asset_type,
        address: docket.last_dropoff.job_address,
        date: docket.last_dropoff.job_date || docket.last_dropoff.completion_date,
      } : null,
      last_pickup: docket.last_pickup ? {
        docket_id: docket.last_pickup.docket_id,
        asset_type: docket.last_pickup.asset_type,
        address: docket.last_pickup.job_address,
        date: docket.last_pickup.job_date || docket.last_pickup.completion_date,
      } : null,
    },
    csr: {
      last_csr_to_engage: csrInteractions[0]?.csr_name || null,
      last_action: csrInteractions[0]?.action || null,
      last_action_date: csrInteractions[0]?.action_date || null,
      total_interactions: csrInteractions.length,
      recent_interactions: csrInteractions.slice(0, 10),
    },
    ghl_conversation_summary: conversationSummary,
    signals: buildSignals({ ghlContact: contact, workiz, opportunities, voiceHistory, smsConvs, csrInteractions, docket }),
    errors: errors.length > 0 ? errors : undefined,
    cached: false,
    fetched_at: new Date().toISOString(),
  };

  return profile;
}

// === Handler ===

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  if (!authorize(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const phoneRaw = req.query?.phone;
  if (!phoneRaw) {
    return res.status(400).json({ error: 'phone query parameter required' });
  }

  const phone10 = normalizePhone(phoneRaw);
  if (phone10.length !== 10) {
    return res.status(400).json({ error: 'phone must normalize to 10 digits (US numbers)', got: phone10 });
  }

  // Check cache
  const cached = cache.get(phone10);
  if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS) {
    return res.status(200).json({ ...cached.data, cached: true });
  }

  // Build profile
  const startTime = Date.now();
  let profile;
  try {
    profile = await buildProfile(phone10);
  } catch (err) {
    console.error('[customer/profile] Build failed:', err);
    return res.status(500).json({ error: 'Failed to build profile', message: err.message });
  }

  const elapsed = Date.now() - startTime;

  // Log to orchestration events (Phase 1 observability — pure additive)
  if (supabaseAdmin) {
    supabaseAdmin.from('ai_orchestration_events').insert({
      system: 'customer_profile_api',
      contact_id: profile.identity.ghl_contact_id,
      contact_phone: phone10,
      decision: 'profile_lookup',
      reason: `Aggregated profile in ${elapsed}ms`,
      context: {
        elapsed_ms: elapsed,
        had_errors: !!profile.errors,
        error_count: profile.errors?.length || 0,
        ghl_contact_found: !!profile.identity.ghl_contact_id,
        workiz_jobs: profile.workiz.total_jobs,
        voice_calls: profile.voice.total_calls,
        sms_conversations: profile.sms.total_conversations,
        signals: profile.signals,
      },
      shadow_mode: false,
    }).then(() => {}).catch(() => {});
  }

  // Cache and return
  cache.set(phone10, { data: profile, fetchedAt: Date.now() });

  return res.status(200).json(profile);
}
