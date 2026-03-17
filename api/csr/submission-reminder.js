import { supabaseAdmin } from '../_lib/supabase-admin.js';
import { sendNotification, ghlHeaders } from '../_lib/ghl-notify.js';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';

function authorize(req) {
  const auth = req.headers['authorization'];
  if (auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  const referer = req.headers['referer'] || '';
  if (referer.includes('kanai-eod-csr-form.vercel.app')) return true;
  return false;
}

async function getGhlUsers() {
  const locationId = process.env.GHL_LOCATION_ID;
  if (!locationId || !process.env.GHL_API_KEY) return [];

  const response = await fetch(`${GHL_API_BASE}/users/?locationId=${locationId}`, {
    headers: ghlHeaders(),
  });

  if (!response.ok) {
    console.error('GHL users fetch error:', response.status);
    return [];
  }

  const data = await response.json();
  return data.users || [];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!authorize(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  try {
    // Get today's date in Hawaii time
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });

    // Get active CSRs
    const { data: csrs, error: csrError } = await supabaseAdmin
      .from('csr_employees')
      .select('id, name, email, phone')
      .eq('is_active', true)
      .eq('role', 'csr');

    if (csrError) throw csrError;
    if (!csrs || csrs.length === 0) {
      return res.status(200).json({ message: 'No active CSRs found', date: today });
    }

    // Get today's submitted reports
    const { data: reports, error: reportError } = await supabaseAdmin
      .from('csr_eod_reports')
      .select('employee_id')
      .eq('report_date', today)
      .eq('status', 'submitted');

    if (reportError) throw reportError;

    const submittedIds = new Set((reports || []).map((r) => r.employee_id));

    // Find CSRs who haven't submitted
    const missing = csrs.filter((csr) => !submittedIds.has(csr.id));

    if (missing.length === 0) {
      return res.status(200).json({
        message: 'All CSRs have submitted',
        date: today,
        submitted: csrs.length,
        total: csrs.length,
      });
    }

    // Fetch GHL users to look up phone numbers
    const ghlUsers = await getGhlUsers();
    const emailToPhone = {};
    for (const user of ghlUsers) {
      if (user.email && user.phone) {
        emailToPhone[user.email.toLowerCase()] = user.phone;
      }
    }

    // Send reminder to each missing CSR
    let sentCount = 0;
    const missingNames = [];
    for (const csr of missing) {
      missingNames.push(csr.name);
      const phone = csr.phone || emailToPhone[(csr.email || '').toLowerCase()];
      if (phone) {
        const sent = await sendNotification(
          phone,
          csr.email,
          `Reminder: Your EOD report for ${today} hasn't been submitted yet. Please complete it before end of day.`
        );
        if (sent) sentCount++;
      }
    }

    // Send manager summary
    const managerPhone = process.env.MANAGER_PHONE_NUMBER;
    if (managerPhone) {
      const summary = `EOD Status: ${submittedIds.size}/${csrs.length} CSRs submitted. Missing: ${missingNames.join(', ')}`;
      await sendNotification(managerPhone, null, summary);
    }

    return res.status(200).json({
      date: today,
      total: csrs.length,
      submitted: submittedIds.size,
      missing: missingNames,
      reminders_sent: sentCount,
    });
  } catch (error) {
    console.error('Submission reminder error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
