import { supabaseAdmin } from '../_lib/supabase-admin.js';
import {
  fetchOpportunities,
  fetchPipelineStages,
  getCustomField,
  CF,
} from '../_lib/ghl-client.js';

function verifyAuth(req) {
  const secret = process.env.DOCKET_WEBHOOK_SECRET;
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

  // Log full payload for debugging
  console.log('Docket webhook payload:', JSON.stringify(body));

  // Extract fields — Docket payload format may vary, try common shapes
  const taskNumber = body.taskNumber || body.task_number || body.TaskNumber
    || body.taskId || body.task_id || body.id || '';
  const status = body.status || body.Status || '';
  const customerName = body.customerName || body.customer_name || body.CustomerName
    || body.clientName || body.client_name || '';
  const price = parseFloat(body.price || body.Price || body.total || body.Total || 0);
  const jobAddress = body.address || body.Address || body.jobAddress || body.job_address || '';
  const assetType = body.assetType || body.asset_type || body.AssetType
    || body.dumpsterSize || body.dumpster_size || body.size || '';
  const stopType = body.stopType || body.stop_type || body.StopType
    || body.type || body.Type || '';
  const driverName = body.driverName || body.driver_name || body.DriverName
    || body.assignedTo || body.assigned_to || '';
  const scheduledDate = body.scheduledDate || body.scheduled_date || body.ScheduledDate
    || body.date || body.Date || body.jobDate || body.job_date || '';

  if (!supabaseAdmin) {
    console.warn('Supabase not configured, cannot process Docket webhook');
    return res.status(200).json({ received: true, matched: false, reason: 'Database not configured' });
  }

  try {
    // Log webhook to audit table
    await supabaseAdmin
      .from('webhook_log')
      .insert({ source: 'docket', payload: body })
      .then(() => {})
      .catch(err => console.error('Webhook log error:', err));

    if (!taskNumber && !customerName) {
      console.log('Docket webhook: no task identifier or customer name, skipping');
      return res.status(200).json({ received: true, matched: false, reason: 'No task identifier' });
    }

    // Store scheduled stop for nightly ops schedule preview
    if (taskNumber && scheduledDate) {
      await upsertScheduledStop({
        taskNumber: String(taskNumber), customerName, jobAddress, assetType,
        stopType, driverName, scheduledDate, price, status, payload: body,
      });
    }

    const result = await processDocketWebhook({ taskNumber: String(taskNumber), status, customerName, price });
    return res.status(200).json({ received: true, ...result });
  } catch (err) {
    console.error('Docket webhook processing error:', err);
    return res.status(200).json({ received: true, matched: false, error: 'Processing error' });
  }
}

async function processDocketWebhook({ taskNumber, status, customerName, price }) {
  let ghlMatched = false;
  let jobsMatched = false;

  // 1. Try to match to a GHL opportunity by customer name and store the mapping
  if (taskNumber && customerName) {
    ghlMatched = await matchAndMapToGhl(taskNumber, customerName);
  }

  // 2. Update csr_eod_jobs_booked if we can find a match
  jobsMatched = await updateJobsBooked({ taskNumber, customerName, price });

  return { matched: ghlMatched || jobsMatched, ghlMatched, jobsMatched };
}

/**
 * Find a GHL opportunity by customer name (DR/dumpster stage) and store
 * the docket_task_number → ghl_opportunity_id mapping so prefill can
 * auto-fill the job number for DR booked jobs.
 */
async function matchAndMapToGhl(taskNumber, customerName) {
  // Check if we already have this mapping
  const { data: existing } = await supabaseAdmin
    .from('docket_ghl_mapping')
    .select('docket_task_number')
    .eq('docket_task_number', taskNumber)
    .limit(1);

  if (existing && existing.length > 0) {
    console.log(`Docket task ${taskNumber} already mapped to GHL`);
    return true;
  }

  // Search GHL opportunities for a customer name match in DR stages
  try {
    const opps = await fetchOpportunities({ limit: 10 });
    const stageMap = await fetchPipelineStages();
    const nameLower = customerName.toLowerCase().trim();

    // Find DR opportunities matching this customer name
    const match = opps.find(opp => {
      const oppName = (opp.contact?.name || opp.name || '').toLowerCase().trim();
      if (!oppName || !nameLower) return false;

      const stageName = (stageMap[opp.pipelineStageId] || opp.pipelineStageName || '').toLowerCase();
      const isDR = stageName.includes('dr ') || stageName.includes('dumpster');

      // Match by exact name or partial (first+last in either direction)
      const nameMatch = oppName === nameLower
        || oppName.includes(nameLower)
        || nameLower.includes(oppName);

      return isDR && nameMatch;
    });

    if (match) {
      await supabaseAdmin
        .from('docket_ghl_mapping')
        .upsert({
          docket_task_number: taskNumber,
          ghl_opportunity_id: match.id,
          customer_name: customerName,
          updated_at: new Date().toISOString(),
        })
        .then(() => {})
        .catch(err => console.error('Docket mapping upsert error:', err));

      console.log(`Docket: mapped task ${taskNumber} → GHL opportunity ${match.id} (${match.contact?.name || match.name})`);
      return true;
    } else {
      // No DR stage match — try any opportunity with the same customer name
      const anyMatch = opps.find(opp => {
        const oppName = (opp.contact?.name || opp.name || '').toLowerCase().trim();
        return oppName && (oppName === nameLower || oppName.includes(nameLower) || nameLower.includes(oppName));
      });

      if (anyMatch) {
        await supabaseAdmin
          .from('docket_ghl_mapping')
          .upsert({
            docket_task_number: taskNumber,
            ghl_opportunity_id: anyMatch.id,
            customer_name: customerName,
            updated_at: new Date().toISOString(),
          })
          .then(() => {})
          .catch(err => console.error('Docket mapping upsert error:', err));

        console.log(`Docket: mapped task ${taskNumber} → GHL opportunity ${anyMatch.id} (fallback name match)`);
        return true;
      } else {
        console.log(`Docket: no GHL opportunity found for "${customerName}" (task ${taskNumber})`);
      }
    }
  } catch (err) {
    console.error('Docket GHL match error:', err);
  }
  return false;
}

/**
 * Update csr_eod_jobs_booked entries — fill in job_number and/or revenue.
 */
async function updateJobsBooked({ taskNumber, customerName, price }) {
  let matched = false;

  // Try to find matching csr_eod_jobs_booked entry by task number first
  if (taskNumber) {
    const { data: byJobNumber } = await supabaseAdmin
      .from('csr_eod_jobs_booked')
      .select('id, job_number, customer_name, estimated_revenue')
      .eq('system', 'Docket')
      .eq('job_number', taskNumber)
      .limit(5);

    if (byJobNumber && byJobNumber.length > 0) {
      matched = true;
      const row = byJobNumber[0];
      const updates = {};
      if (price > 0) updates.estimated_revenue = price;
      if (Object.keys(updates).length > 0) {
        await supabaseAdmin
          .from('csr_eod_jobs_booked')
          .update(updates)
          .eq('id', row.id);
        console.log(`Docket: updated job ${taskNumber} revenue: $${price}`);
      }
    }
  }

  // Fallback: match by customer name — fill in task number and/or revenue
  if (!matched && customerName) {
    const { data: byCustomer } = await supabaseAdmin
      .from('csr_eod_jobs_booked')
      .select('id, job_number, customer_name, estimated_revenue')
      .eq('system', 'Docket')
      .ilike('customer_name', `%${customerName}%`)
      .limit(5);

    if (byCustomer && byCustomer.length > 0) {
      matched = true;
      const row = byCustomer[0];
      const updates = {};
      if (taskNumber && !row.job_number) updates.job_number = taskNumber;
      if (price > 0) updates.estimated_revenue = price;
      if (Object.keys(updates).length > 0) {
        await supabaseAdmin
          .from('csr_eod_jobs_booked')
          .update(updates)
          .eq('id', row.id);
        console.log(`Docket: matched customer "${customerName}", updated job_number=${taskNumber || 'n/a'}, revenue=$${price || 'n/a'}`);
      }
    }
  }

  return matched;
}

/**
 * Upsert a scheduled stop into docket_scheduled_stops for nightly ops schedule preview.
 */
async function upsertScheduledStop({ taskNumber, customerName, jobAddress, assetType, stopType, driverName, scheduledDate, price, status, payload }) {
  try {
    // Parse the date — accept various formats
    let dateStr = scheduledDate;
    if (dateStr.includes('T') || dateStr.includes(' ')) {
      dateStr = dateStr.split('T')[0].split(' ')[0];
    }

    await supabaseAdmin
      .from('docket_scheduled_stops')
      .upsert({
        docket_id: taskNumber,
        customer_name: customerName,
        job_address: jobAddress,
        asset_type: assetType,
        stop_type: stopType,
        driver_name: driverName,
        scheduled_date: dateStr,
        price: price > 0 ? price : null,
        status: status,
        raw_payload: payload,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'docket_id,scheduled_date' })
      .then(() => {})
      .catch(err => console.error('Docket scheduled stop upsert error:', err));

    console.log(`Docket: stored scheduled stop ${taskNumber} for ${dateStr}`);
  } catch (err) {
    console.error('Docket scheduled stop error:', err);
  }
}
