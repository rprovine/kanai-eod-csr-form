const WORKIZ_API_BASE = 'https://api.workiz.com/api/v1';

/**
 * Fetch all Workiz jobs and build a map of UUID → job details.
 * Used to resolve GHL Workiz Lead/Job IDs to serial numbers and revenue.
 */
export async function getJobsByUUID(uuids) {
  const token = process.env.WORKIZ_API_TOKEN;
  if (!token) return {};

  const targetSet = new Set(uuids.map(String));
  const found = {};
  let offset = 0;

  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({ offset: String(offset), records: '100' });
    const url = `${WORKIZ_API_BASE}/${token}/job/all/?${params}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'KanaiCSRForm/1.0', 'Accept': 'application/json' },
    });

    if (!response.ok) break;
    const result = await response.json();
    const jobs = result.data || [];
    if (jobs.length === 0) break;

    // Log sample and matching jobs revenue fields
    if (page === 0) {
      console.log('[workiz-uuid] Sample job keys:', Object.keys(jobs[0] || {}));
    }

    for (const job of jobs) {
      const uuid = job.UUID || '';
      const serialId = String(job.SerialId || '');
      // Match by UUID or SerialId
      if (targetSet.has(uuid) || targetSet.has(serialId)) {
        const key = targetSet.has(uuid) ? uuid : serialId;
        const subtotal = parseFloat(job.SubTotal) || 0;
        const totalPrice = parseFloat(job.JobTotalPrice) || 0;
        const amountDue = parseFloat(job.JobAmountDue) || 0;
        const revenue = subtotal || totalPrice || amountDue;
        console.log(`[workiz-uuid] Match #${serialId}: SubTotal=${job.SubTotal} JobTotalPrice=${job.JobTotalPrice} AmountDue=${job.JobAmountDue} → revenue=${revenue}`);
        found[key] = {
          jobNumber: serialId,
          uuid,
          revenue,
          status: job.Status || '',
          customerName: [job.FirstName, job.LastName].filter(Boolean).join(' '),
          jobType: job.JobType || '',
        };
      }
    }

    if (Object.keys(found).length >= targetSet.size) break;
    if (!result.has_more) break;
    offset += 100;
  }

  return found;
}

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
