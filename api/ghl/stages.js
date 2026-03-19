import { fetchPipelineStages, fetchOpportunities } from '../_lib/ghl-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=300'); // cache 5 min

  if (req.method === 'OPTIONS') return res.status(200).end();

  const [stageMap, opportunities] = await Promise.all([
    fetchPipelineStages(),
    fetchOpportunities({ limit: 20 }), // up to 2000 opps
  ]);

  // Count opportunities by stage
  const stageCounts = {};
  for (const opp of opportunities) {
    const stageName = stageMap[opp.pipelineStageId] || 'Other';
    stageCounts[stageName] = (stageCounts[stageName] || 0) + 1;
  }

  return res.status(200).json({
    stages: stageMap,
    stageCounts,
    totalOpportunities: opportunities.length,
  });
}
