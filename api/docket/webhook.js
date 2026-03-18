import { supabaseAdmin } from '../_lib/supabase-admin.js';

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

  // Log full payload for debugging (unknown format)
  console.log('Docket webhook payload:', JSON.stringify(body));

  // Extract fields we can reasonably guess at
  const taskNumber = body.taskNumber || body.task_number || body.TaskNumber || body.id || '';
  const status = body.status || body.Status || '';
  const customerName = body.customerName || body.customer_name || body.CustomerName || '';
  const price = parseFloat(body.price || body.Price || body.total || body.Total || 0);

  if (!taskNumber && !customerName) {
    return res.status(200).json({ received: true, matched: false, reason: 'No task identifier' });
  }

  if (!supabaseAdmin) {
    console.warn('Supabase not configured, cannot process Docket webhook');
    return res.status(200).json({ received: true, matched: false, reason: 'Database not configured' });
  }

  try {
    let matched = false;

    // Try to find matching csr_eod_jobs_booked entry
    let query = supabaseAdmin
      .from('csr_eod_jobs_booked')
      .select('id, job_number, customer_name, estimated_revenue')
      .eq('system', 'Docket')
      .limit(5);

    // Prefer matching by job_number if available, otherwise by customer_name
    if (taskNumber) {
      const { data: byJobNumber } = await query.eq('job_number', String(taskNumber));
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
        if (taskNumber && !row.job_number) updates.job_number = String(taskNumber);
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

    return res.status(200).json({ received: true, matched });
  } catch (err) {
    console.error('Docket webhook error:', err);
    return res.status(200).json({ received: true, matched: false, error: 'Processing error' });
  }
}
