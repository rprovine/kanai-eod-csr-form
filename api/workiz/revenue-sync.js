import { supabaseAdmin } from '../_lib/supabase-admin.js';
import { getJobsByUUID } from '../_lib/workiz-client.js';

function authorize(req) {
  if (!process.env.CRON_SECRET) return true;
  const auth = req.headers['authorization'];
  if (auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  const referer = req.headers['referer'] || '';
  if (referer.includes('kanai-eod-csr-form')) return true;
  if (req.query?.token === process.env.CRON_SECRET) return true;
  return false;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!authorize(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  try {
    // Get ALL jobs with missing revenue (with or without job_number)
    const { data: jobs, error: jobsError } = await supabaseAdmin
      .from('csr_eod_jobs_booked')
      .select('id, job_number, customer_name, estimated_revenue')
      .or('estimated_revenue.eq.0,estimated_revenue.is.null');

    if (jobsError) throw jobsError;
    if (!jobs || jobs.length === 0) {
      return res.status(200).json({ message: 'No jobs need revenue update', updated: 0 });
    }

    // Fetch ALL Workiz jobs (with revenue) to match by serial # or customer name
    let allWorkizJobs = [];
    try {
      const token = process.env.WORKIZ_API_TOKEN;
      if (token) {
        for (let offset = 0; offset < 2000; offset += 100) {
          const r = await fetch(`https://api.workiz.com/api/v1/${token}/job/all/?offset=${offset}&records=100`, {
            headers: { 'Accept': 'application/json' },
          });
          if (!r.ok) break;
          const d = await r.json();
          allWorkizJobs.push(...(d.data || []));
          if (!d.has_more) break;
        }
      }
    } catch (err) {
      console.error('[revenue-sync] Workiz fetch error:', err.message);
    }

    // Build lookup maps: by SerialId and by normalized customer name
    const workizBySerial = {};
    const workizByName = {};
    for (const wj of allWorkizJobs) {
      const serial = String(wj.SerialId || '');
      const rev = parseFloat(wj.SubTotal) || parseFloat(wj.JobTotalPrice) || parseFloat(wj.JobAmountDue) || 0;
      const name = [wj.FirstName, wj.LastName].filter(Boolean).join(' ').toLowerCase().trim();
      if (serial) workizBySerial[serial] = { revenue: rev, status: wj.Status, name };
      if (name && rev > 0) {
        if (!workizByName[name]) workizByName[name] = { serial, revenue: rev, status: wj.Status };
      }
    }

    console.log(`[revenue-sync] Fetched ${allWorkizJobs.length} Workiz jobs, ${Object.keys(workizBySerial).length} by serial, ${Object.keys(workizByName).length} by name with revenue`);

    // Also check junk_removal_jobs table for field supervisor revenue
    const jobNumbers = jobs.map(j => j.job_number).filter(Boolean);
    let jrRevMap = {};
    if (jobNumbers.length > 0) {
      const { data: jrJobs } = await supabaseAdmin
        .from('junk_removal_jobs')
        .select('job_number, revenue')
        .in('job_number', jobNumbers);
      if (jrJobs) {
        for (const j of jrJobs) {
          if (j.job_number && parseFloat(j.revenue) > 0) {
            jrRevMap[j.job_number] = parseFloat(j.revenue);
          }
        }
      }
    }

    let updated = 0;
    let nameMatched = 0;
    const errors = [];

    for (const job of jobs) {
      try {
        let revenue = 0;
        let resolvedJobNumber = job.job_number || '';

        // 1. Try by job number (serial) if we have one
        if (job.job_number) {
          const wMatch = workizBySerial[job.job_number];
          if (wMatch?.revenue > 0) revenue = wMatch.revenue;
          if (!revenue) revenue = jrRevMap[job.job_number] || 0;
        }

        // 2. Fallback: match by customer name
        if (!revenue && job.customer_name) {
          const normName = job.customer_name.toLowerCase().trim();
          const nameMatch = workizByName[normName];
          if (nameMatch) {
            revenue = nameMatch.revenue;
            if (!resolvedJobNumber && nameMatch.serial) {
              resolvedJobNumber = nameMatch.serial;
            }
            nameMatched++;
          }
        }

        if (revenue > 0) {
          const updates = { estimated_revenue: revenue };
          if (resolvedJobNumber && resolvedJobNumber !== job.job_number) {
            updates.job_number = resolvedJobNumber;
          }

          const { error: updateError } = await supabaseAdmin
            .from('csr_eod_jobs_booked')
            .update(updates)
            .eq('id', job.id);

          if (!updateError) {
            updated++;
            console.log(`[revenue-sync] Updated "${job.customer_name}" #${resolvedJobNumber}: $${revenue}`);
          } else {
            errors.push({ customer_name: job.customer_name, error: updateError.message });
          }
        }
      } catch (err) {
        errors.push({ customer_name: job.customer_name, error: err.message });
      }
    }

    return res.status(200).json({
      total_checked: jobs.length,
      workiz_jobs_fetched: allWorkizJobs.length,
      serial_matched: Object.keys(workizBySerial).length,
      name_matched: nameMatched,
      jrMatched: Object.keys(jrRevMap).length,
      updated,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Revenue sync error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
