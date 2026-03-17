import { supabaseAdmin } from '../_lib/supabase-admin.js';
import { sendNotification, ghlHeaders } from '../_lib/ghl-notify.js';

const GHL_API_BASE = 'https://services.leadconnectorhq.com';

function authorize(req) {
  // No CRON_SECRET configured = allow all (testing mode)
  if (!process.env.CRON_SECRET) return true;
  const auth = req.headers['authorization'];
  if (auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  const referer = req.headers['referer'] || '';
  if (referer.includes('kanai-eod-csr-form')) return true;
  // Allow manual browser testing via query param
  if (req.query?.token === process.env.CRON_SECRET) return true;
  return false;
}

function getLastWeekRange() {
  // Get current date in Hawaii time
  const now = new Date();
  const hawaiiDate = new Date(now.toLocaleString('en-US', { timeZone: 'Pacific/Honolulu' }));
  const day = hawaiiDate.getDay(); // 0=Sun, 1=Mon

  // Last week Monday: go back to this Monday, then subtract 7
  const thisMon = new Date(hawaiiDate);
  thisMon.setDate(hawaiiDate.getDate() - (day === 0 ? 6 : day - 1));
  const lastMon = new Date(thisMon);
  lastMon.setDate(thisMon.getDate() - 7);
  const lastSun = new Date(lastMon);
  lastSun.setDate(lastMon.getDate() + 6);

  const fmt = (d) => d.toISOString().split('T')[0];
  return { weekStart: fmt(lastMon), weekEnd: fmt(lastSun) };
}

function sum(arr, key) {
  return arr.reduce((s, r) => s + (parseFloat(r[key]) || 0), 0);
}

async function fetchGhlInboundCalls(weekStart, weekEnd) {
  const locationId = process.env.GHL_LOCATION_ID;
  if (!locationId || !process.env.GHL_API_KEY) return { total: 0, perDay: {} };

  try {
    // Search conversations with messages in the date range
    const params = new URLSearchParams({
      locationId,
      limit: '100',
    });
    const response = await fetch(`${GHL_API_BASE}/conversations/search?${params}`, {
      headers: ghlHeaders(),
    });

    if (!response.ok) return { total: 0, perDay: {} };

    const data = await response.json();
    const conversations = data.conversations || [];

    let totalInbound = 0;
    const perDay = {};

    // Check messages in each conversation for inbound calls
    for (const conv of conversations.slice(0, 50)) {
      if (!conv.id) continue;
      try {
        const msgResponse = await fetch(`${GHL_API_BASE}/conversations/${conv.id}/messages`, {
          headers: ghlHeaders(),
        });
        if (!msgResponse.ok) continue;
        const msgData = await msgResponse.json();
        const messages = msgData.messages?.messages || msgData.messages || [];

        for (const msg of messages) {
          const msgDate = (msg.dateAdded || '').split('T')[0];
          if (msgDate < weekStart || msgDate > weekEnd) continue;
          // Type 1 = inbound call, Type 24 = inbound voicemail
          if (msg.type === 1 || msg.type === 24 || msg.type === 'TYPE_CALL') {
            const direction = (msg.direction || '').toLowerCase();
            if (direction === 'inbound') {
              totalInbound++;
              perDay[msgDate] = (perDay[msgDate] || 0) + 1;
            }
          }
        }
      } catch {
        // Skip individual conversation errors
      }
    }

    return { total: totalInbound, perDay };
  } catch (err) {
    console.error('GHL inbound calls fetch error:', err);
    return { total: 0, perDay: {} };
  }
}

function buildReport({
  weekStart,
  weekEnd,
  csrReports,
  fieldReports,
  trucks,
  teamMembers,
  jrJobs,
  inboundCalls,
}) {
  const totalCSRReports = csrReports.length;
  const totalFieldReports = fieldReports.length;

  // CSR metrics
  const totalCalls = sum(csrReports, 'total_calls');
  const totalMessaging = sum(csrReports, 'messaging_conversations');

  // Field supervisor metrics
  const totalJobsCompleted = sum(fieldReports, 'jobs_completed');
  const totalSales = sum(fieldReports, 'total_sales');
  const totalFuel = sum(fieldReports, 'fuel_cost');
  const totalDump = sum(fieldReports, 'dump_fees');
  const totalPayroll = sum(fieldReports, 'total_payroll');
  const commercialJobs = fieldReports.filter((r) => r.job_type === 'commercial').length;
  const residentialJobs = fieldReports.filter((r) => r.job_type === 'residential').length;

  // Truck/team metrics
  const totalHoursWorked = sum(trucks, 'hours_worked');
  const truckPayroll = sum(trucks, 'payroll');

  // Cancellations and lost estimates
  const totalCancellations = sum(teamMembers, 'cancellations');
  const totalLostEstimates = sum(teamMembers, 'lost_estimates');

  // Junk removal
  const jrJobCount = jrJobs.length;
  const jrRevenue = sum(jrJobs, 'revenue');

  // Inbound calls
  const inboundTotal = inboundCalls.total;

  const md = `# Weekly Executive Report
## ${weekStart} to ${weekEnd}

---

### 1. How many inbound calls did we receive?
**${inboundTotal}** inbound calls this week

### 2. How many total calls did CSRs handle?
**${totalCalls}** total calls across **${totalCSRReports}** CSR shifts

### 3. How many messaging conversations were handled?
**${totalMessaging}** messaging conversations

### 4. How many jobs were completed?
**${totalJobsCompleted}** jobs completed (${commercialJobs} commercial, ${residentialJobs} residential)

### 5. What was total revenue?
**$${totalSales.toLocaleString('en-US', { minimumFractionDigits: 2 })}** in total sales

### 6. What were operating costs?
- Fuel: **$${totalFuel.toFixed(2)}**
- Dump fees: **$${totalDump.toFixed(2)}**
- Payroll: **$${totalPayroll.toFixed(2)}**
- Truck payroll: **$${truckPayroll.toFixed(2)}**
- **Total costs: $${(totalFuel + totalDump + totalPayroll + truckPayroll).toFixed(2)}**

### 7. What is the net margin?
$${(totalSales - totalFuel - totalDump - totalPayroll - truckPayroll).toFixed(2)} net

### 8. How many hours were worked?
**${totalHoursWorked.toFixed(1)}** truck hours logged

### 9. How many cancellations occurred?
**${totalCancellations}** cancellations

### 10. How many estimates were lost?
**${totalLostEstimates}** lost estimates

### 11. Junk removal performance
**${jrJobCount}** junk removal jobs totaling **$${jrRevenue.toFixed(2)}**

### 12. Commercial vs Residential split
- Commercial: **${commercialJobs}** jobs
- Residential: **${residentialJobs}** jobs

### 13. CSR shift coverage
**${totalCSRReports}** EOD reports submitted across the week
`;

  return md;
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
    const { weekStart, weekEnd } = getLastWeekRange();

    // Fetch all data in parallel
    const [
      csrResult,
      fieldResult,
      trucksResult,
      teamResult,
      jrResult,
      inboundCalls,
    ] = await Promise.all([
      supabaseAdmin
        .from('csr_eod_reports')
        .select('*')
        .gte('report_date', weekStart)
        .lte('report_date', weekEnd),
      supabaseAdmin
        .from('eod_reports')
        .select('*')
        .gte('report_date', weekStart)
        .lte('report_date', weekEnd),
      supabaseAdmin
        .from('eod_trucks')
        .select('*')
        .gte('created_at', `${weekStart}T00:00:00`)
        .lte('created_at', `${weekEnd}T23:59:59`),
      supabaseAdmin
        .from('eod_team_members')
        .select('*')
        .gte('created_at', `${weekStart}T00:00:00`)
        .lte('created_at', `${weekEnd}T23:59:59`),
      supabaseAdmin
        .from('junk_removal_jobs')
        .select('*')
        .gte('job_date', weekStart)
        .lte('job_date', weekEnd),
      fetchGhlInboundCalls(weekStart, weekEnd),
    ]);

    const csrReports = csrResult.data || [];
    const fieldReports = fieldResult.data || [];
    const trucks = trucksResult.data || [];
    const teamMembers = teamResult.data || [];
    const jrJobs = jrResult.data || [];

    // Build markdown report
    const reportContent = buildReport({
      weekStart,
      weekEnd,
      csrReports,
      fieldReports,
      trucks,
      teamMembers,
      jrJobs,
      inboundCalls,
    });

    // Store in weekly_reports
    const { error: insertError } = await supabaseAdmin
      .from('weekly_reports')
      .upsert({
        week_start: weekStart,
        week_end: weekEnd,
        report_content: reportContent,
      }, { onConflict: 'week_start' });

    if (insertError) {
      console.error('Failed to store weekly report:', insertError);
    }

    // Send SMS to owner
    const managerPhone = process.env.MANAGER_PHONE_NUMBER;
    const link = `https://kanai-eod-csr-form.vercel.app/api/reports/view?week=${weekStart}`;
    if (managerPhone) {
      await sendNotification(
        managerPhone,
        null,
        `Weekly Executive Report ready for ${weekStart} - ${weekEnd}: ${link}`
      );
    }

    return res.status(200).json({
      week_start: weekStart,
      week_end: weekEnd,
      link,
      stored: !insertError,
    });
  } catch (error) {
    console.error('Weekly executive report error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
