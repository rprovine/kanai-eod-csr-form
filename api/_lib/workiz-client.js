const WORKIZ_API_BASE = 'https://api.workiz.com/api/v1';

// Workiz JobSource → LEAD_SOURCES value mapping
const SOURCE_MAP = {
  'google': 'google',
  'google ads': 'google',
  'google_ads': 'google',
  'google my business': 'google',
  'google organic': 'google',
  'seo': 'google',
  'yelp': 'yelp',
  'facebook': 'facebook',
  'facebook ads': 'facebook',
  'instagram': 'instagram',
  'referral': 'referral',
  'repeat': 'repeat',
  'repeat customer': 'repeat',
  'online submission': 'web_form',
  'online booking': 'web_form',
  'web form': 'web_form',
  'dumpsters.com': 'dumpsters_com',
  'direct': 'direct',
  'phone': 'phone',
};

function mapJobSource(source) {
  if (!source) return '';
  const key = source.toLowerCase().trim();
  return SOURCE_MAP[key] || 'other';
}

/**
 * Fetch Workiz jobs for a given date.
 * Workiz API auth: token is embedded in the URL path.
 * URL pattern: /api/v1/{token}/job/all/
 *
 * The API returns all active jobs; we filter by scheduled date client-side.
 * Cloudflare requires a User-Agent header.
 */
export async function getJobsByDate(date, teamMember = null) {
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
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'KanaiEODForm/1.0',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Workiz API error ${response.status}: ${text}`);
    }

    const result = await response.json();
    const jobs = result.data || [];
    const hasMore = result.has_more;

    if (jobs.length === 0) break;

    for (const job of jobs) {
      // Filter by scheduled date
      const jobDate = extractDate(job.JobDateTime || job.CreatedDate || '');

      if (jobDate !== date) continue;

      // Filter by team member if specified
      if (teamMember) {
        const teamNames = (job.Team || []).map((t) => (t.Name || '').toLowerCase());
        if (!teamNames.some((name) => name.includes(teamMember.toLowerCase()))) continue;
      }

      const customerName = [job.FirstName, job.LastName]
        .filter(Boolean).join(' ').trim() || job.Company || '';

      allJobs.push({
        jobNumber: job.UUID || '',
        revenue: parseFloat(job.JobTotalPrice || job.SubTotal || 0),
        customerPhone: job.Phone || '',
        customerName,
        address: [job.Address, job.City, job.State].filter(Boolean).join(', '),
        technician: job.Team?.[0]?.Name || '',
        jobType: job.JobType || '',
        scheduledDate: jobDate || date,
        status: job.Status || '',
        leadSource: mapJobSource(job.JobSource || job.how_did_you_hear_about_us || ''),
        rawJobSource: (job.JobSource || '').trim(),
      });
    }

    if (!hasMore) break;
    offset += pageSize;
  }

  return allJobs;
}

/**
 * Extract YYYY-MM-DD from Workiz datetime strings (e.g. "2026-03-10 11:00:00").
 */
function extractDate(dateStr) {
  if (!dateStr) return '';
  // "YYYY-MM-DD HH:MM:SS" → take first 10 chars
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.substring(0, 10);
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  } catch {
    return '';
  }
}
