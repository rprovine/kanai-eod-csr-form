const WORKIZ_API_BASE = 'https://api.workiz.com/api/v1';

/**
 * Fetch completed Workiz jobs for a given date.
 * Workiz API auth: token is embedded in the URL path.
 * URL pattern: /api/v1/{token}/job/all/
 *
 * The API doesn't support date/status filtering natively,
 * so we fetch recent jobs and filter client-side.
 */
export async function getJobsByDate(date) {
  const token = process.env.WORKIZ_API_TOKEN;
  if (!token) throw new Error('WORKIZ_API_TOKEN not configured');

  const allJobs = [];
  let offset = 0;
  const pageSize = 100;

  for (let page = 0; page < 10; page++) {
    const params = new URLSearchParams({
      offset: String(offset),
      records: String(pageSize),
    });

    const url = `${WORKIZ_API_BASE}/${token}/job/all/?${params}`;
    const response = await fetch(url);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Workiz API error ${response.status}: ${text}`);
    }

    const result = await response.json();
    const jobs = result.data || [];
    const hasMore = result.has_more;

    if (jobs.length === 0) break;

    for (const job of jobs) {
      // Filter by date: check scheduled date matches
      const jobDate = extractDate(job.DateTime || job.CreatedDate || job.ScheduleDate || '');
      // Filter by status: only completed/done jobs
      const status = (job.Status || job.SubStatus || '').toLowerCase();
      const isDone = status === 'done' || status === 'completed' || status === 'complete';

      if (jobDate === date && isDone) {
        allJobs.push({
          jobNumber: job.UUID || job.SerialNo || '',
          revenue: parseFloat(job.TotalPrice || job.SubTotal || job.AmountCollected || 0),
          customerPhone: job.Phone || job.ClientPhone || '',
          customerName: job.ClientFirstName
            ? `${job.ClientFirstName} ${job.ClientLastName || ''}`.trim()
            : (job.ClientName || ''),
          address: job.JobAddress || job.Address || '',
          technician: job.TeamMember || job.AssignedTo || '',
          jobType: job.JobType || job.ServiceType || '',
          scheduledDate: jobDate || date,
        });
      }
    }

    if (!hasMore) break;
    offset += pageSize;
  }

  return allJobs;
}

/**
 * Extract YYYY-MM-DD from various date formats Workiz may return.
 */
function extractDate(dateStr) {
  if (!dateStr) return '';
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  // ISO string or other parseable format
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  } catch {
    return '';
  }
}
