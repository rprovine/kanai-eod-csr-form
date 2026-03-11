import { getJobsByDate } from '../_lib/workiz-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' });
  }

  const { date } = req.query;
  if (!date) {
    return res.status(400).json({ error: 'date parameter is required (YYYY-MM-DD)' });
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }

  if (!process.env.WORKIZ_API_TOKEN) {
    return res.status(500).json({ error: 'Workiz API not configured' });
  }

  try {
    const jobs = await getJobsByDate(date);
    return res.status(200).json({
      jobs,
      count: jobs.length,
      date,
      _fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Workiz jobs fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch Workiz jobs' });
  }
}
