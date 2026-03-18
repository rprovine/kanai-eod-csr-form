const GHL_API_BASE = 'https://services.leadconnectorhq.com';

export function ghlHeaders() {
  return {
    'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
    'Version': '2021-07-28',
    'Content-Type': 'application/json',
  };
}

export function toHawaiiDate(isoStr) {
  if (!isoStr) return null;
  const d = new Date(isoStr);
  if (isNaN(d)) return null;
  return d.toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });
}

export function getCustomField(opp, fieldId) {
  for (const f of (opp.customFields || [])) {
    if (f.id === fieldId) return f.fieldValue || f.fieldValueString || '';
  }
  return '';
}

// GHL custom field IDs
export const CF = {
  WORKIZ_JOB_ID: 'EILH2dteMrekSHTjbzOR',
  WORKIZ_LEAD_ID: 'YcLhZO3aQtXAANTY0P9f',
  JOB_SOURCE: 'MAlXRZPVHa2b5YONicGz',
  START_DATE: 'hdGeah9nPBb5ipGnzRv5',
  SERVICE_TYPE: '7bkN5I5XUjtsJ0T3FKKB',
  LOST_REASON: 'uX3IBwxytiZv9bSiInm5',
  LOST_SUB_REASON: 'OUFLLOGOnYiNYmQV3QDG',
};

// Fetch opportunities with deduplication and pipeline filtering
// Options: { pipelineId, status, assignedTo, limit (pages) }
export async function fetchOpportunities(opts = {}) {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!apiKey || !locationId) return [];

  const pipelineId = opts.pipelineId || process.env.GHL_PIPELINE_ID;
  const maxPages = opts.limit || 10;
  const allOpps = [];
  const seenIds = new Set();
  let startAfterId = '';

  for (let page = 0; page < maxPages; page++) {
    try {
      const params = new URLSearchParams({
        location_id: locationId,
        limit: '100',
      });
      if (pipelineId) params.set('pipeline_id', pipelineId);
      if (opts.status) params.set('status', opts.status);
      if (opts.assignedTo) params.set('assigned_to', opts.assignedTo);
      if (startAfterId) params.set('startAfterId', startAfterId);

      const response = await fetch(
        `${GHL_API_BASE}/opportunities/search?${params}`,
        { headers: ghlHeaders() }
      );

      if (!response.ok) break;
      const data = await response.json();
      const opps = data.opportunities || [];

      let newCount = 0;
      for (const opp of opps) {
        if (!seenIds.has(opp.id)) {
          seenIds.add(opp.id);
          allOpps.push(opp);
          newCount++;
        }
      }

      if (newCount === 0 || opps.length < 100) break;
      startAfterId = opps[opps.length - 1].id;
    } catch (err) {
      console.error('GHL opportunities fetch error:', err);
      break;
    }
  }

  return allOpps;
}

// Fetch pipeline stages as { stageId: stageName } map
export async function fetchPipelineStages() {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!apiKey || !locationId) return {};

  try {
    const response = await fetch(
      `${GHL_API_BASE}/opportunities/pipelines?locationId=${locationId}`,
      { headers: ghlHeaders() }
    );

    if (!response.ok) return {};
    const data = await response.json();

    const stageMap = {};
    for (const pipeline of (data.pipelines || [])) {
      for (const stage of (pipeline.stages || [])) {
        stageMap[stage.id] = stage.name;
      }
    }
    return stageMap;
  } catch (err) {
    console.error('GHL pipelines fetch error:', err);
    return {};
  }
}

// Update opportunity fields
export async function updateOpportunity(opportunityId, fields) {
  const response = await fetch(`${GHL_API_BASE}/opportunities/${opportunityId}`, {
    method: 'PUT',
    headers: ghlHeaders(),
    body: JSON.stringify(fields),
  });
  return response.ok;
}

// Fetch messages for a date (from messages export API)
export async function fetchMessagesForDate(date) {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!apiKey || !locationId) return [];

  const allMessages = [];
  let cursor = null;

  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({ locationId, limit: '100' });
    if (cursor) params.set('cursor', cursor);

    try {
      const response = await fetch(
        `${GHL_API_BASE}/conversations/messages/export?${params}`,
        { headers: ghlHeaders() }
      );

      if (!response.ok) break;
      const data = await response.json();
      const messages = data.messages || [];
      if (messages.length === 0) break;

      let foundOlder = false;
      for (const msg of messages) {
        const msgDate = toHawaiiDate(msg.dateAdded);
        if (!msgDate) continue;

        if (msgDate === date) {
          allMessages.push({
            type: msg.type,
            direction: (msg.direction || '').toLowerCase(),
            userId: msg.userId || null,
            dateAdded: msg.dateAdded,
            conversationId: msg.conversationId,
            contactId: msg.contactId,
            status: msg.meta?.call?.status || msg.status || '',
            duration: msg.meta?.call?.duration || 0,
          });
        } else if (msgDate && msgDate < date) {
          foundOlder = true;
          break;
        }
      }

      if (foundOlder) break;
      cursor = data.nextCursor;
      if (!cursor || messages.length < 100) break;
    } catch (err) {
      console.error('GHL messages export error:', err);
      break;
    }
  }

  return allMessages;
}

// Detect stale leads (>48h in actionable stages without update)
export function detectStaleLeads(opportunities, stageMap) {
  const ACTIONABLE_STAGES = [
    'new lead', 'new', 'contacted', 'needs follow-up', 'follow up',
    'estimate scheduled', 'estimate completed', 'quote given', 'quote sent',
    'agreement sent', 'rental agreement', 'conversation active', 'nurture',
  ];

  const now = Date.now();
  const STALE_HOURS = 48;
  const stale = [];

  for (const opp of opportunities) {
    const stageName = stageMap[opp.pipelineStageId] || opp.pipelineStageName || '';
    const stageL = stageName.toLowerCase();
    const isActionable = ACTIONABLE_STAGES.some(s => stageL.includes(s));
    if (!isActionable) continue;

    const lastUpdate = new Date(opp.lastStageChangeAt || opp.updatedAt || opp.createdAt);
    const hoursStale = (now - lastUpdate.getTime()) / (1000 * 60 * 60);

    if (hoursStale >= STALE_HOURS) {
      stale.push({
        id: opp.id,
        name: opp.contact?.name || opp.name || 'Unknown',
        stage: stageName,
        daysStale: Math.round(hoursStale / 24 * 10) / 10,
        contactId: opp.contact?.id || opp.contactId,
        assignedTo: opp.assignedTo,
      });
    }
  }

  return stale;
}

// Detect leads moved to Lost with <3 contacts and no reason
export function detectPrematureLost(opportunities, stageMap, contactAttempts, date) {
  const warnings = [];
  for (const opp of opportunities) {
    const stageName = stageMap[opp.pipelineStageId] || opp.pipelineStageName || '';
    const stageL = stageName.toLowerCase();
    const lastChange = toHawaiiDate(opp.lastStageChangeAt || opp.updatedAt);
    if (lastChange !== date) continue;
    if (!stageL.includes('lost') && !stageL.includes('declined')) continue;

    const contactId = opp.contact?.id || opp.contactId || '';
    const attempts = contactAttempts[contactId]?.attempts || 0;
    const lostReason = getCustomField(opp, CF.LOST_REASON);

    if (attempts >= 3) continue;
    if (lostReason) continue;

    warnings.push({
      id: opp.id,
      name: opp.contact?.name || opp.name || 'Unknown',
      stage: stageName,
      attempts,
      contactId,
      assignedTo: opp.assignedTo,
    });
  }
  return warnings;
}

// Count outbound contact attempts per contact (distinct days)
export async function countContactAttempts(contactIds) {
  if (!contactIds || contactIds.length === 0) return {};

  const results = {};
  const batchSize = 5;

  for (let i = 0; i < contactIds.length; i += batchSize) {
    const batch = contactIds.slice(i, i + batchSize);
    await Promise.all(batch.map(async (contactId) => {
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
        let lastOutbound = null;
        for (const msg of messages) {
          if ((msg.direction || '').toLowerCase() === 'outbound') {
            const day = (msg.dateAdded || '').split('T')[0];
            if (day) outboundDays.add(day);
            if (!lastOutbound || msg.dateAdded > lastOutbound) lastOutbound = msg.dateAdded;
          }
        }

        results[contactId] = {
          attempts: outboundDays.size,
          lastContactDate: lastOutbound,
        };
      } catch (err) {
        console.error(`Error counting attempts for contact ${contactId}:`, err);
      }
    }));
  }

  return results;
}

// Get CSR mappings from Supabase
export async function getCsrMappings(supabaseAdmin) {
  const { data: mappings } = await supabaseAdmin
    .from('ghl_user_mapping')
    .select('employee_id, ghl_user_id, ghl_user_name');
  return mappings || [];
}

// Fetch recent messages (last N minutes) for real-time alerting
export async function fetchRecentMessages(minutes = 10) {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!apiKey || !locationId) return [];

  const cutoff = new Date(Date.now() - minutes * 60 * 1000);
  const messages = [];
  let cursor = null;

  for (let page = 0; page < 5; page++) {
    const params = new URLSearchParams({ locationId, limit: '100' });
    if (cursor) params.set('cursor', cursor);

    try {
      const response = await fetch(
        `${GHL_API_BASE}/conversations/messages/export?${params}`,
        { headers: ghlHeaders() }
      );
      if (!response.ok) break;
      const data = await response.json();
      const msgs = data.messages || [];
      if (msgs.length === 0) break;

      let foundOlder = false;
      for (const msg of msgs) {
        const msgTime = new Date(msg.dateAdded);
        if (msgTime < cutoff) { foundOlder = true; break; }
        messages.push(msg);
      }

      if (foundOlder) break;
      cursor = data.nextCursor;
      if (!cursor || msgs.length < 100) break;
    } catch (err) {
      console.error('GHL recent messages error:', err);
      break;
    }
  }

  return messages;
}
