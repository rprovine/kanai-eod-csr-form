import { lookupContactByPhone, extractSource } from '../_lib/ghl-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  if (!process.env.GHL_API_KEY || !process.env.GHL_LOCATION_ID) {
    return res.status(500).json({ error: 'GHL API not configured' });
  }

  const { phones } = req.body || {};
  if (!Array.isArray(phones) || phones.length === 0) {
    return res.status(400).json({ error: 'phones array is required' });
  }

  // Cap at 50 lookups per request to avoid timeouts
  const phonesToLookup = phones.slice(0, 50);

  try {
    const results = {};

    // Look up each phone sequentially to respect GHL rate limits
    for (const phone of phonesToLookup) {
      if (!phone) {
        results[phone] = null;
        continue;
      }
      const contact = await lookupContactByPhone(phone);
      results[phone] = extractSource(contact);
    }

    return res.status(200).json({
      attributions: results,
      _fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('GHL attribution error:', error);
    return res.status(500).json({ error: 'Failed to look up attributions' });
  }
}
