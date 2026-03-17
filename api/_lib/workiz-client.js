const WORKIZ_API_BASE = 'https://api.workiz.com/api/v1';

export async function getJobByNumber(jobNumber) {
  const token = process.env.WORKIZ_API_TOKEN;
  if (!token) throw new Error('WORKIZ_API_TOKEN not configured');
  const url = `${WORKIZ_API_BASE}/${token}/job/get/${jobNumber}/`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'KanaiCSRForm/1.0', 'Accept': 'application/json' },
  });
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Workiz API error ${response.status}`);
  }
  const result = await response.json();
  const job = result.data || result;
  return {
    jobNumber: String(job.SerialId || ''),
    status: job.Status || '',
    revenue: parseFloat(job.SubTotal || job.JobTotalPrice || 0),
    customerName: [job.FirstName, job.LastName].filter(Boolean).join(' '),
  };
}
