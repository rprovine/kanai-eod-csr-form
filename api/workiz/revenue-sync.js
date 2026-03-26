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
    // Get jobs with missing revenue
    const { data: jobs, error: jobsError } = await supabaseAdmin
      .from('csr_eod_jobs_booked')
      .select('id, job_number, estimated_revenue')
      .neq('job_number', '')
      .not('job_number', 'is', null)
      .or('estimated_revenue.eq.0,estimated_revenue.is.null');

    if (jobsError) throw jobsError;
    if (!jobs || jobs.length === 0) {
      return res.status(200).json({ message: 'No jobs need revenue update', updated: 0 });
    }

    // Batch lookup all job numbers from Workiz
    const jobNumbers = [...new Set(jobs.map(j => j.job_number).filter(Boolean))];
    let workizMap = {};

    try {
      workizMap = await getJobsByUUID(jobNumbers);
      console.log(`[revenue-sync] Workiz returned ${Object.keys(workizMap).length} matches for ${jobNumbers.length} job numbers`);
    } catch (err) {
      console.error('[revenue-sync] Workiz batch lookup error:', err.message);
    }

    // Also check junk_removal_jobs table for field supervisor revenue
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
    const errors = [];

    for (const job of jobs) {
      try {
        // Try Workiz match first
        const workizMatch = workizMap[job.job_number];
        const workizRev = workizMatch?.revenue || 0;

        // Fallback to field supervisor data
        const jrRev = jrRevMap[job.job_number] || 0;

        const revenue = workizRev > 0 ? workizRev : jrRev;

        if (revenue > 0) {
          const { error: updateError } = await supabaseAdmin
            .from('csr_eod_jobs_booked')
            .update({ estimated_revenue: revenue })
            .eq('id', job.id);

          if (!updateError) {
            updated++;
            console.log(`[revenue-sync] Updated #${job.job_number}: $${revenue}`);
          } else {
            errors.push({ job_number: job.job_number, error: updateError.message });
          }
        }
      } catch (err) {
        errors.push({ job_number: job.job_number, error: err.message });
      }
    }

    return res.status(200).json({
      total_checked: jobs.length,
      workizMatched: Object.keys(workizMap).length,
      jrMatched: Object.keys(jrRevMap).length,
      updated,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Revenue sync error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
