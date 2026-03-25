/**
 * CSR Revenue Attribution — matches completed job revenue back to the CSR who booked it.
 *
 * Flow:
 *   1. Fetch all booked opportunities from GHL assigned to CSRs
 *   2. For each, get the Workiz job number (from custom field or enrichment)
 *   3. Look up actual revenue from junk_removal_jobs (field supervisor completed data)
 *   4. Upsert into csr_revenue_attribution table with CSR, job number, revenue, dates
 *
 * This runs daily and retroactively catches any completed jobs.
 *
 * GET /api/csr/revenue-attribution
 * Cron: daily at 11 PM HST (09:00 UTC next day)
 */

import { supabaseAdmin } from '../_lib/supabase-admin.js';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';

function ghlHeaders() {
  return {
    'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
    'Version': '2021-07-28',
    'Content-Type': 'application/json',
  };
}

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
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const config = { maxDuration: 120 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!authorize(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (!supabaseAdmin) return res.status(500).json({ error: 'Database not configured' });

  const locationId = process.env.GHL_LOCATION_ID;
  const workizToken = process.env.WORKIZ_API_TOKEN;
  if (!locationId) return res.status(500).json({ error: 'GHL_LOCATION_ID not configured' });

  try {
    // 1. Get CSR user mappings
    const { data: mappings } = await supabaseAdmin
      .from('ghl_user_mapping')
      .select('employee_id, ghl_user_id, ghl_user_name');

    if (!mappings?.length) {
      return res.json({ message: 'No CSR mappings', attributed: 0 });
    }

    const csrByUserId = {};
    for (const m of mappings) {
      csrByUserId[m.ghl_user_id] = { employeeId: m.employee_id, name: m.ghl_user_name };
    }

    // 2. Get pipeline stage names for lookup
    const stageMap = {};
    const pipelinesRes = await fetch(
      `${GHL_API_BASE}/opportunities/pipelines?locationId=${locationId}`,
      { headers: ghlHeaders() }
    );
    if (pipelinesRes.ok) {
      const pData = await pipelinesRes.json();
      for (const p of (pData.pipelines || [])) {
        for (const s of (p.stages || [])) {
          stageMap[s.id] = s.name;
        }
      }
    }

    // 3. Fetch ALL opportunities from GHL (open and won)
    const bookedOpps = [];

    for (const status of ['open', 'won']) {
      let page = 1;
      while (page <= 10) {
        const params = new URLSearchParams({
          location_id: locationId,
          status,
          limit: '100',
          page: String(page),
        });

        const r = await fetch(`${GHL_API_BASE}/opportunities/search?${params}`, { headers: ghlHeaders() });
        if (!r.ok) break;
        const data = await r.json();
        const opps = data.opportunities || [];

        for (const opp of opps) {
          // Resolve stage name from ID if not populated
          const stageName = opp.pipelineStageName || stageMap[opp.pipelineStageId] || '';
          opp.pipelineStageName = stageName;
          const stageL = stageName.toLowerCase();

          const isBooked = stageL.includes('book') || stageL.includes('won') || stageL.includes('approved')
            || stageL.includes('completed') || stageL.includes('estimate scheduled');

          if (isBooked && opp.assignedTo && csrByUserId[opp.assignedTo]) {
            bookedOpps.push(opp);
          }
        }

        if (opps.length < 100) break;
        page++;
        await delay(200);
      }
    }

    if (bookedOpps.length === 0) {
      return res.json({ message: 'No booked opportunities with CSR assignments', attributed: 0 });
    }

    // 4. Extract Workiz job numbers from opportunities
    // These are GHL custom field IDs — must match exactly
    const CF_WORKIZ_JOB_ID = 'EILH2dteMrekSHTjbzOR';
    const CF_WORKIZ_LEAD_ID = 'YcLhZO3aQtXAANTY0P9f';

    function getCustomField(opp, fieldId) {
      const fields = opp.customFields || [];
      for (const f of fields) {
        const fId = f.id || f.key || f.fieldKey || '';
        if (fId === fieldId) {
          // GHL returns values in different formats depending on the API
          return f.value || f.fieldValueString || f.fieldValue || '';
        }
      }
      return '';
    }

    // Debug: log first opp's custom fields to see format
    if (bookedOpps.length > 0 && req.query?.debug) {
      const sample = bookedOpps[0];
      return res.json({
        debug: true,
        sampleOpp: {
          name: sample.contact?.name || sample.name,
          stage: sample.pipelineStageName,
          assignedTo: sample.assignedTo,
          customFields: sample.customFields,
        },
        totalBooked: bookedOpps.length,
      });
    }

    // Resolve Workiz serial numbers for each opp
    // GHL search API doesn't return custom fields — need to fetch each opp individually
    const oppJobMap = [];

    for (const opp of bookedOpps) {
      const csr = csrByUserId[opp.assignedTo];
      const contactName = opp.contact?.name || opp.name || '';

      // Fetch full opportunity to get custom fields
      let fullOpp = opp;
      try {
        const oppRes = await fetch(`${GHL_API_BASE}/opportunities/${opp.id}`, { headers: ghlHeaders() });
        if (oppRes.ok) {
          const oppData = await oppRes.json();
          fullOpp = oppData.opportunity || oppData || opp;
        }
        await delay(200);
      } catch {}

      const workizJobUUID = getCustomField(fullOpp, CF_WORKIZ_JOB_ID);
      const workizLeadUUID = getCustomField(fullOpp, CF_WORKIZ_LEAD_ID);
      const uuid = workizJobUUID || workizLeadUUID;

      let jobNumber = '';

      if (uuid && workizToken) {
        try {
          // Try job endpoint first
          if (workizJobUUID) {
            const r = await fetch(`https://api.workiz.com/api/v1/${workizToken}/job/get/${workizJobUUID}/`);
            if (r.ok) {
              const text = await r.text();
              if (text) {
                const d = JSON.parse(text);
                const item = Array.isArray(d.data) ? d.data[0] : d.data;
                if (item?.SerialId) jobNumber = String(item.SerialId);
              }
            }
            await delay(150);
          }

          // If no job number yet, try lead endpoint — a lead may have a linked job
          if (!jobNumber && workizLeadUUID) {
            const r = await fetch(`https://api.workiz.com/api/v1/${workizToken}/lead/get/${workizLeadUUID}/`);
            if (r.ok) {
              const text = await r.text();
              if (text) {
                const d = JSON.parse(text);
                const item = Array.isArray(d.data) ? d.data[0] : d.data;
                // Check if lead has a linked job (converted lead → job)
                const linkedJobId = item?.JobUUID || item?.JobId || item?.LinkedJobUUID || '';
                if (linkedJobId) {
                  // Fetch the linked job to get its serial number
                  const jr = await fetch(`https://api.workiz.com/api/v1/${workizToken}/job/get/${linkedJobId}/`);
                  if (jr.ok) {
                    const jText = await jr.text();
                    if (jText) {
                      const jd = JSON.parse(jText);
                      const jItem = Array.isArray(jd.data) ? jd.data[0] : jd.data;
                      if (jItem?.SerialId) jobNumber = String(jItem.SerialId);
                    }
                  }
                  await delay(150);
                }
                // Fall back to lead serial if no linked job
                if (!jobNumber && item?.SerialId) {
                  jobNumber = String(item.SerialId);
                }
              }
            }
            await delay(150);
          }
        } catch {}
      }

      if (jobNumber || contactName) {
        oppJobMap.push({
          ghlOppId: opp.id,
          contactId: opp.contact?.id || opp.contactId || '',
          csrName: csr.name,
          csrEmployeeId: csr.employeeId,
          jobNumber,
          contactName,
          bookedAt: opp.lastStageChangeAt || opp.updatedAt || opp.createdAt,
        });
      }
    }

    // 4. Match job numbers against completed junk_removal_jobs for actual revenue
    const jobNumbers = oppJobMap.map(o => o.jobNumber).filter(Boolean);
    let revenueMap = {};

    if (jobNumbers.length > 0) {
      const { data: completedJobs } = await supabaseAdmin
        .from('junk_removal_jobs')
        .select('job_number, revenue')
        .in('job_number', jobNumbers)
        .gt('revenue', 0);

      if (completedJobs) {
        for (const j of completedJobs) {
          revenueMap[j.job_number] = parseFloat(j.revenue);
        }
      }
    }

    // 5. For items without revenue yet, try matching by contact phone → Workiz job
    // The GHL opp has the contact, the field supervisor has the completed job serial
    // They don't share IDs but share the customer phone number
    const needsPhoneMatch = oppJobMap.filter(o => !revenueMap[o.jobNumber]);
    if (needsPhoneMatch.length > 0) {
      for (const item of needsPhoneMatch) {
        try {
          // Get the GHL contact's phone
          const contactRes = await fetch(`${GHL_API_BASE}/contacts/${item.contactId}`, { headers: ghlHeaders() });
          if (!contactRes.ok) continue;
          const contactData = await contactRes.json();
          const phone = (contactData.contact?.phone || '').replace(/\D/g, '');
          if (phone.length < 10) continue;
          const phone10 = phone.length === 11 && phone.startsWith('1') ? phone.slice(1) : phone;

          // Search Workiz for jobs with this phone number
          if (workizToken) {
            const wr = await fetch(`https://api.workiz.com/api/v1/${workizToken}/job/all/?phone=${phone10}&records=10`);
            if (wr.ok) {
              const wText = await wr.text();
              if (wText) {
                const wData = JSON.parse(wText);
                const jobs = Array.isArray(wData) ? wData : (wData.data || []);
                for (const wJob of jobs) {
                  const jNum = String(wJob.SerialId || '');
                  const rev = parseFloat(wJob.SubTotal || wJob.JobTotalPrice || 0);
                  if (jNum && rev > 0) {
                    revenueMap[jNum] = rev;
                    // Update the item's job number to the actual Workiz job serial
                    if (!item.jobNumber || item.jobNumber.length <= 4) {
                      item.jobNumber = jNum;
                    }
                  }
                }
              }
            }
          }

          // Also check field supervisor data by searching for this phone's jobs
          // (junk_removal_jobs doesn't have phone, but we can check if any of the
          // Workiz job serials found above are in the field supervisor data)

          await delay(200);
        } catch {}
      }
    }

    // 6. Upsert into csr_eod_jobs_booked for each report
    let attributed = 0;
    let updated = 0;

    for (const item of oppJobMap) {
      const revenue = revenueMap[item.jobNumber] || 0;

      // Find the CSR's EOD report for the booking date
      const bookDate = item.bookedAt ? item.bookedAt.split('T')[0] : null;
      if (!bookDate) continue;

      // Find or get the closest report for this CSR
      const { data: reports } = await supabaseAdmin
        .from('csr_eod_reports')
        .select('id, report_date')
        .eq('employee_id', item.csrEmployeeId)
        .lte('report_date', bookDate)
        .order('report_date', { ascending: false })
        .limit(1);

      if (!reports?.length) continue;
      const reportId = reports[0].id;

      // Check if this job is already in csr_eod_jobs_booked
      const { data: existing } = await supabaseAdmin
        .from('csr_eod_jobs_booked')
        .select('id, estimated_revenue')
        .eq('eod_report_id', reportId)
        .eq('job_number', item.jobNumber || item.contactName)
        .limit(1);

      if (existing?.length > 0) {
        // Update revenue if it changed and is > 0
        if (revenue > 0 && parseFloat(existing[0].estimated_revenue || 0) !== revenue) {
          await supabaseAdmin
            .from('csr_eod_jobs_booked')
            .update({ estimated_revenue: revenue })
            .eq('id', existing[0].id);
          updated++;
        }
      } else {
        // Insert new booked job entry
        const stageL = (item.contactName || '').toLowerCase();
        const isDumpster = stageL.includes('dr ') || stageL.includes('dumpster');
        await supabaseAdmin
          .from('csr_eod_jobs_booked')
          .insert({
            eod_report_id: reportId,
            job_number: item.jobNumber || '',
            customer_name: item.contactName,
            job_type: isDumpster ? 'dumpster_rental' : 'junk_removal',
            system: 'Workiz',
            estimated_revenue: revenue > 0 ? revenue : null,
            ghl_pipeline_updated: true,
            notes: `Auto-attributed from GHL opp ${item.ghlOppId}`,
          });
        attributed++;
      }

      await delay(100);
    }

    return res.json({
      totalBookedOpps: bookedOpps.length,
      resolvedJobNumbers: jobNumbers.length,
      jobsWithRevenue: Object.keys(revenueMap).length,
      totalRevenue: Object.values(revenueMap).reduce((s, v) => s + v, 0),
      newJobsAttributed: attributed,
      revenueUpdated: updated,
    });
  } catch (err) {
    console.error('Revenue attribution error:', err);
    return res.status(500).json({ error: err.message });
  }
}
