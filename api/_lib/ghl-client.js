const GHL_API_BASE = 'https://services.leadconnectorhq.com';

/**
 * Normalize phone to 10-digit US format.
 * Mirrors ghl_bpm_campaign/ghl_client.py normalize_phone_digits().
 */
function normalizePhone(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  // Remove leading 1 for US numbers (11 digits → 10)
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits;
}

/**
 * Look up a GHL contact by phone number.
 * Returns the contact object with source/attribution, or null.
 */
export async function lookupContactByPhone(phone) {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!apiKey || !locationId) return null;

  const normalized = normalizePhone(phone);
  if (!normalized || normalized.length < 10) return null;

  try {
    const params = new URLSearchParams({
      query: normalized,
      locationId,
      limit: '1',
    });

    const response = await fetch(`${GHL_API_BASE}/contacts/?${params}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Version': '2021-07-28',
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    const contacts = data.contacts || [];
    if (contacts.length === 0) return null;

    // Verify the phone actually matches (GHL search is fuzzy)
    const contact = contacts[0];
    const contactPhone = normalizePhone(contact.phone);
    if (contactPhone !== normalized) return null;

    return contact;
  } catch (err) {
    console.error('GHL contact lookup error:', err);
    return null;
  }
}

/**
 * Extract attribution source from a GHL contact.
 * GHL stores the first-touch attribution in the "source" field.
 */
export function extractSource(contact) {
  if (!contact) return null;
  return contact.source || contact.attributionSource || null;
}
