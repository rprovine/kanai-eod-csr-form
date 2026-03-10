# Kanai CSR End-of-Day Reporting Form

Structured web application replacing manual WhatsApp-based EOD reporting for Kanai's Roll Off customer service representatives. Tracks all daily CSR activities, calculates KPIs in real-time, and feeds into the pay-for-performance compensation plan.

**Live:** https://kanai-eod-csr-form.vercel.app

## Features

### 13-Section Multi-Step Form
1. **Shift Info** — CSR selection, date, shift times, auto-calculated hours
2. **Communications** — Confirmation checkboxes for all channels (GHL, Workiz, Yelp, Docket, SMS, email, web forms)
3. **Call Metrics** — Inbound/outbound/qualified/missed calls, speed-to-lead, auto-calculated missed call rate. Auto-filled from GHL with source badges.
4. **Dispositions** — Booked, quoted, follow-up, not qualified, lost, voicemail counts with anti-gaming warnings
5. **Jobs Booked** — Repeatable entries with job type (auto-sets Workiz/Docket), revenue, lead source. GHL pipeline suggestions for booked opportunities.
6. **Emails & Web Forms** — Repeatable entries for email/web form submissions
7. **Yelp Leads** — Repeatable entries with status tracking
8. **Follow-Ups** — Repeatable entries with attempt tracking and follow-up schedule reminder
9. **Docket Activity** — Dumpster rental metrics (clients, agreements, tasks, Dumpsters.com orders)
10. **Workiz Activity** — Junk removal metrics (jobs, payments, schedule verification)
11. **GHL Pipeline** — End-of-day pipeline hygiene with live pipeline context cards (booked/lost/total/stale counts from GHL API)
12. **Notes** — Issues, management attention, suggestions, carryover items
13. **KPI Dashboard** — Auto-calculated summary with color-coded status, Recharts visualization, bonus eligibility

### GHL Integration (Live)

The app pulls data directly from the GoHighLevel API v2 to auto-populate form fields when a CSR opens the form. No webhooks or workflow automations are required — the system queries GHL on each form load.

**Auto-filled fields:**
- `total_inbound_calls` — Phone conversations with inbound direction for the date
- `total_outbound_calls` — Phone conversations with outbound direction for the date
- `missed_calls` — Inbound calls with no outbound response
- `missed_call_rate` — Auto-calculated from missed/inbound

**Pipeline context (read-only cards):**
- Booked today, Lost today, Total pipeline, Stale leads count
- Stale lead warnings (opportunities in early stages >48 hours without update)

**Job suggestions:**
- Opportunities moved to "Booked" stage in GHL that day are suggested as job entries
- One-click add with customer name and revenue pre-filled

**Source badges:**
- **GHL** (green) — Field was auto-filled from GHL, untouched by CSR
- **Edited** (amber) — Field was auto-filled but the CSR changed the value
- Discrepancy warning shown if CSR edits differ >20% from GHL values

### Auto-Calculated KPIs
- **Booking Rate** — Booked / (Booked + Quoted + Follow-Up + Lost)
- **Missed Call Rate** — Missed / Total Inbound (target: under 10%)
- **Disposition Logging Rate** — Total dispositions / Qualified calls (target: 95%+)
- **Speed-to-Lead** — Dropdown selection (target: under 5 min)
- **Follow-Up Completion** — Completed / Total follow-ups
- **Bonus Eligibility** — All 5 activity minimums must be met

### Performance Tiers
| Tier | Booking Rate | Per-Booking Bonus | Tier Bonus |
|------|-------------|-------------------|------------|
| Developing | 50-59.9% | $0 | $0 |
| Standard | 60-69.9% | $3/booking | $75/pay period |
| Elite | 70%+ | $5/booking | $200/pay period |

## Tech Stack

- **Frontend:** React 19 + Vite 7 + Tailwind CSS 4
- **Backend:** Vercel serverless functions (`api/` directory)
- **UI:** Custom dark-themed components (Kanai brand colors)
- **Icons:** Lucide React
- **Charts:** Recharts
- **Database:** Supabase (PostgreSQL)
- **External APIs:** GoHighLevel API v2 (Private Integration Token)
- **Hosting:** Vercel

## API Endpoints

All endpoints are Vercel serverless functions in the `api/` directory.

### `GET /api/ghl/test`
Health check. Verifies Supabase connection, GHL env vars, webhook table status, and user mapping count.

### `GET /api/ghl/prefill?employee_id=X&date=YYYY-MM-DD`
Main data endpoint. Pulls live data from GHL API:
1. Looks up GHL user ID from `ghl_user_mapping` table
2. Fetches all phone conversations for the location on that date
3. Fetches all opportunities assigned to the GHL user
4. Fetches pipeline stage names for mapping
5. Returns aggregated call metrics + pipeline data

Response:
```json
{
  "fields": {
    "total_inbound_calls": 8,
    "total_outbound_calls": 19,
    "missed_calls": 0,
    "missed_call_rate": 0
  },
  "pipeline": {
    "new_leads_count": 18,
    "booked_today": 0,
    "lost_today": 0,
    "total": 33,
    "opportunities": []
  },
  "_sources": { "total_inbound_calls": "ghl_calls", ... },
  "_counts": { "conversations": 27, "opportunities": 33 },
  "_computed_at": "2026-03-06T..."
}
```

### `GET /api/ghl/pipeline?employee_id=X&date=YYYY-MM-DD`
Pipeline-specific endpoint. Fetches opportunity data from GHL, detects stale leads (>48 hours in early stages), caches snapshots in `ghl_daily_pipeline_summary`.

### `POST /api/ghl/webhook`
Webhook receiver for future GHL workflow automations. Stores raw events in `ghl_webhook_events` with dedup by `ghl_id`. Currently available but not actively used (the system uses direct API pull instead).

## Database

Uses the shared Kanai Supabase instance (`bkhshyxyuepkpymxjfel`) with prefixed tables to avoid conflicts with the Field Supervisor EOD form.

### CSR Tables (`csr_` prefix)
- `csr_employees` — CSR roster
- `csr_eod_reports` — Main EOD report (one per CSR per day)
- `csr_eod_jobs_booked` — Jobs booked child records
- `csr_eod_email_submissions` — Email/web form child records
- `csr_eod_yelp_leads` — Yelp lead child records
- `csr_eod_followups` — Follow-up child records
- `csr_pay_period_summaries` — Aggregated pay period data

### GHL Tables (`ghl_` prefix)
- `ghl_webhook_events` — Raw webhook event staging (for future use)
- `ghl_user_mapping` — Maps GHL user IDs to `csr_employees` records
- `ghl_daily_call_summary` — Aggregated daily call metrics per CSR
- `ghl_daily_pipeline_summary` — Pipeline snapshot cache per CSR per day

### Migrations
- `supabase/migrations/20260303000000_initial_schema.sql` — CSR tables
- `supabase/migrations/20260305150000_ghl_integration.sql` — GHL tables

## Architecture

```
CSR opens form → selects employee + date
                      ↓
              useGhlPrefill hook
                      ↓
          GET /api/ghl/prefill
                      ↓
    ┌─────────────────┼─────────────────┐
    ↓                 ↓                 ↓
GHL Conversations  GHL Opportunities  GHL Pipelines
API (phone calls)  API (by user)      API (stages)
    ↓                 ↓                 ↓
    └─────────────────┼─────────────────┘
                      ↓
            Aggregate + analyze
                      ↓
         Return prefill fields + pipeline data
                      ↓
         Form auto-populates with source badges
```

## Business Context

Kanai's operates a dual-system architecture:
- **GoHighLevel (GHL)** — Primary phone system, all customer communication, lead management, pipeline tracking
- **Workiz** — Junk removal job scheduling, dispatch, invoicing
- **Docket** — Dumpster rental bookings, dispatch, asset tracking

Rule: If it's a dumpster can, it goes in Docket. Everything else goes in Workiz.

## Development

```bash
npm install
npm run dev     # starts on port 3000
```

## Environment Variables

### Frontend (Vite — exposed to browser)
```
VITE_SUPABASE_URL=<supabase-project-url>
VITE_SUPABASE_ANON_KEY=<supabase-anon-key>
```

### Backend (Vercel serverless — server-side only)
```
SUPABASE_URL=<supabase-project-url>
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>
GHL_API_KEY=<ghl-private-integration-token>
GHL_LOCATION_ID=<ghl-location-id>
GHL_WEBHOOK_SECRET=<webhook-secret>           # optional, for webhook auth
```

All backend env vars are configured in Vercel project settings.

## Deployment

```bash
npx vercel --prod --yes
```

## Adding a New CSR

1. Add the CSR to `csr_employees` table in Supabase
2. Find their GHL user ID via the GHL Users API or admin panel
3. Insert a row in `ghl_user_mapping`:
   ```sql
   INSERT INTO ghl_user_mapping (ghl_user_id, ghl_user_name, employee_id)
   VALUES ('<ghl-user-id>', '<name>', '<csr_employees.id>');
   ```
4. The CSR will see auto-filled GHL data next time they open the form

## Key Files

```
api/
  _lib/supabase-admin.js       # Server-side Supabase client (service role)
  ghl/
    prefill.js                  # Main GHL data endpoint (API pull)
    pipeline.js                 # Pipeline data + stale lead detection
    webhook.js                  # Webhook receiver (future use)
    test.js                     # Health check endpoint

src/
  hooks/
    useEodForm.js               # Form state reducer
    useGhlPrefill.js            # GHL data loading + source tracking
  lib/
    ghlApi.js                   # Client-side API wrapper
    constants.js                # Form options, pipeline checks
    form-defaults.js            # Default form values
    supabase-data.js            # Supabase read/write helpers
  components/
    eod-form/
      CallMetricsSection.jsx    # GHL auto-fill + discrepancy warnings
      PipelineCheckSection.jsx  # Pipeline context cards + stale alerts
      JobsBookedSection.jsx     # GHL opportunity suggestions
      ...
    shared/
      FormField.jsx             # SourceBadge component (GHL/Edited)
      ...

supabase/migrations/
  20260303000000_initial_schema.sql
  20260305150000_ghl_integration.sql

vercel.json                     # Build config, CORS headers, caching
```

## Future Phases

- **Phase 2:** Supabase Auth, role-based access (CSR/Supervisor/Admin)
- **Phase 3:** Supervisor review workflow, team dashboards
- **Phase 4:** Reporting dashboards (daily flash, weekly, pay period, monthly)
- **Phase 5:** Workiz/Docket API integrations for auto-populating job and rental data
