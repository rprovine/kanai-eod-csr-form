const GHL_API_BASE = 'https://services.leadconnectorhq.com';

export function ghlHeaders() {
  return {
    'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
    'Version': '2021-07-28',
    'Content-Type': 'application/json',
  };
}

export async function findContact({ email, phone }) {
  const locationId = process.env.GHL_LOCATION_ID;
  const query = phone || email;
  if (!query) return null;

  const params = new URLSearchParams({ locationId, query });
  const response = await fetch(`${GHL_API_BASE}/contacts/search?${params}`, {
    headers: ghlHeaders(),
  });

  if (!response.ok) {
    console.error('GHL findContact error:', response.status, await response.text());
    return null;
  }

  const data = await response.json();
  const contacts = data.contacts || [];
  return contacts.length > 0 ? contacts[0] : null;
}

export async function createContact({ email, phone, firstName, lastName, tags }) {
  const locationId = process.env.GHL_LOCATION_ID;

  const response = await fetch(`${GHL_API_BASE}/contacts/`, {
    method: 'POST',
    headers: ghlHeaders(),
    body: JSON.stringify({
      locationId,
      email: email || undefined,
      phone: phone || undefined,
      firstName: firstName || '',
      lastName: lastName || '',
      tags: tags || ['kanai-internal'],
    }),
  });

  if (!response.ok) {
    console.error('GHL createContact error:', response.status, await response.text());
    return null;
  }

  const data = await response.json();
  return data.contact || data;
}

export async function sendSMS(contactId, message) {
  const response = await fetch(`${GHL_API_BASE}/conversations/messages`, {
    method: 'POST',
    headers: ghlHeaders(),
    body: JSON.stringify({
      type: 'SMS',
      contactId,
      message,
    }),
  });

  if (!response.ok) {
    console.error('GHL sendSMS error:', response.status, await response.text());
    return false;
  }

  return true;
}

export async function sendNotification(phone, internalEmail, message) {
  if (!process.env.GHL_API_KEY || !process.env.GHL_LOCATION_ID) {
    console.warn('GHL not configured, skipping SMS notification');
    return false;
  }

  try {
    // Try to find existing contact
    let contact = await findContact({ phone, email: internalEmail });

    // Create contact if not found
    if (!contact) {
      contact = await createContact({
        phone,
        email: internalEmail,
        firstName: 'Kanai',
        lastName: 'Staff',
        tags: ['kanai-internal', 'eod-notifications'],
      });
    }

    if (!contact?.id) {
      console.error('Could not find or create GHL contact for', phone);
      return false;
    }

    return await sendSMS(contact.id, message);
  } catch (err) {
    console.error('sendNotification error:', err);
    return false;
  }
}
