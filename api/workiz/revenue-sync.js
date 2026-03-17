import { supabaseAdmin } from '../_lib/supabase-admin.js';
import { getJobByNumber } from '../_lib/workiz-client.js';

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

    let updated = 0;
    const errors = [];

    for (const job of jobs) {
      try {
        // Try Workiz first
        const workizJob = await getJobByNumber(job.job_number);

        if (workizJob && workizJob.revenue > 0) {
          const { error: updateError } = await supabaseAdmin
            .from('csr_eod_jobs_booked')
            .update({ estimated_revenue: workizJob.revenue })
            .eq('id', job.id);

          if (!updateError) updated++;
          else errors.push({ job_number: job.job_number, error: updateError.message });
        } else {
          // Fallback: check junk_removal_jobs table
          const { data: jrJob } = await supabaseAdmin
            .from('junk_removal_jobs')
            .select('revenue')
            .eq('job_number', job.job_number)
            .single();

          if (jrJob && parseFloat(jrJob.revenue) > 0) {
            const { error: updateError } = await supabaseAdmin
              .from('csr_eod_jobs_booked')
              .update({ estimated_revenue: parseFloat(jrJob.revenue) })
              .eq('id', job.id);

            if (!updateError) updated++;
            else errors.push({ job_number: job.job_number, error: updateError.message });
          }
        }

        // Rate limit: 200ms between Workiz calls
        await delay(200);
      } catch (err) {
        errors.push({ job_number: job.job_number, error: err.message });
      }
    }

    return res.status(200).json({
      total_checked: jobs.length,
      updated,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Revenue sync error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
