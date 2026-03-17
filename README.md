# Kanai CSR End-of-Day Report Form

Internal tool for Kanai Junk Removal CSRs to submit daily performance reports. Auto-fills outbound calls, messaging activity, speed-to-lead, and disposition counts from GoHighLevel (GHL) to minimize manual entry and ensure data accuracy. Includes full compensation tracking with bonus accelerators, quality guardrails, and pay period summary.

**Live:** https://kanai-eod-csr-form.vercel.app

## Tech Stack

- **Frontend:** React 19 + Vite 7 + Tailwind CSS 4
- **Backend:** Vercel Serverless Functions (Node.js)
- **Database:** Supabase (PostgreSQL)
- **Integrations:** GoHighLevel (GHL) API for CRM data
- **UI:** Custom dark-themed components (Kanai brand colors)
- **Icons:** Lucide React
- **Charts:** Recharts

## GHL Automation

When a CSR selects their name and report date, the system automatically pulls data from GHL:

| Category | Auto-Filled? | Source |
|---|---|---|
| Outbound calls | Yes | GHL Messages Export API |
| Inbound calls | **No** -- manual entry (GHL IVR calls lack per-CSR attribution) |
| Missed calls | **No** -- manual entry (same IVR attribution issue) |
| Missed call rate | Auto-calculated from manual inbound + missed entries |
| SMS sent/received | Yes | GHL Messages Export API (type 2) |
| Facebook sent/received | Yes | GHL Messages Export API (type 11) |
| Instagram sent/received | Yes | GHL Messages Export API (type 18) |
| Speed-to-lead | Yes (median, per-channel breakdown) | Calculated from conversation response gaps |
| Dispositions | Yes (booked, quoted, follow-up, not qualified, lost) | GHL Opportunities API (pipeline stage changes) |
| Jobs Booked | Yes (customer name, job type, system) | GHL Opportunities API (booked opps). CSR adds Workiz job # manually. |
| Pipeline context | Yes (new leads, stale, booked/lost counts) | GHL Opportunities API |

### Why Inbound/Missed Calls Are Manual

GHL IVR calls (type 24) don't include a `userId` field, so there's no way to attribute which CSR answered or missed a specific inbound call. The API only knows location-wide totals. To keep per-CSR metrics accurate, inbound and missed calls are entered manually.

### How Dispositions Work

Dispositions are derived from GHL pipeline stage changes that occurred on the report date. The mapping is evaluated in order (first match wins):

1. **Estimate Scheduled** → **Booked** (CSR got the lead on the schedule)
2. **Booked:** Stages containing "book", "won", "approved"
3. **Lost:** Stages containing "lost", "declined", "cancel"
4. **Not Qualified:** Stages containing "non-qualified", "not qualified", "unqualified"
5. **Estimate Completed** → **Follow-Up** (needs final disposition: Booked or Lost)
6. **Quoted:** Stages containing "quot", "estimate", "proposal", "agreement sent", "rental agreement"
7. **Follow-up:** Stages containing "contacted", "conversation", "nurture", "follow"
8. **Catch-all:** Any other stage change (except "new lead") → Follow-Up

### Current Pipeline Stage Mapping (1 - LEADS)

| GHL Stage | Disposition | In Booking Rate? |
|---|---|---|
| New Lead | (skipped) | No |
| Contacted | Follow-Up | Denominator |
| Needs Follow-Up | Follow-Up | Denominator |
| JR - Onsite Estimate Scheduled | Booked | Numerator + Denominator |
| JR - Onsite Estimate Completed | Follow-Up | Denominator |
| DR - Dumpster Quote Given | Quoted | Denominator |
| DR - Rental Agreement Sent | Quoted | Denominator |
| JR Booked | Booked | Numerator + Denominator |
| JR Lost | Lost | Denominator |
| DR Booked | Booked | Numerator + Denominator |
| DR Lost | Lost | Denominator |
| Non-Qualified Lead | Not Qualified | Excluded |

### Lead Lifecycle

```
New Lead → Contacted → Needs Follow-Up → Booked / Lost
                                       ↘ Estimate Scheduled → Booked / Lost
                                       ↘ Dumpster Quote Given → DR Booked / DR Lost
```

Leads move to "Needs Follow-Up" after first contact and stay there until booked, lost (with valid reason), or 3 contact attempts have been made. After 3 attempts the CSR must move the lead to Booked or Lost.

### Booking Rate Formula

```
Booking Rate = Booked / (Booked + Quoted + Follow-up + Lost)
```

**Non-qualified leads are excluded from the denominator** so they don't drag down the booking rate. They are tracked separately.

### Speed-to-Lead Calculation

1. Groups all messages by conversation ID (calls, SMS, Facebook, Instagram)
2. Finds conversations where the first message today was inbound (during shift hours only)
3. Measures the gap to the first outbound response by the CSR
4. Caps at 60 minutes -- longer gaps are likely existing conversations, not fresh leads
5. Uses **median** (not average) to resist outlier skew
6. Returns overall median plus **per-channel breakdown** (Calls, SMS, Facebook, Instagram)
7. Maps to an enum bucket: under 5 min, 5-10 min, 10-15 min, over 15 min

**Shift hours filter:** Defaults to 8:00-16:30 HST. Only inbound messages that arrive during shift hours are counted. The Refresh button passes the CSR's entered shift times for accuracy.

### Follow-Up Policy & Stale Lead Detection

**3-Contact Minimum:** Each lead must be contacted at least 3 times before being moved to Lost. Exceptions:
- **Booked/won on first contact** — no follow-up needed
- **Explicit lost reason provided** — a lead can be marked Lost before 3 contacts if a valid reason is documented (e.g., "Price Too High", "Went With Competitor"). Lost reasons are tracked via GHL opportunity custom fields (see `kanai-ghl-lost-reason` project).
- **No reason + <3 contacts = flagged** — the system warns when a lead is moved to Lost without enough follow-up AND without a documented reason.

Contact attempts are counted as distinct days with at least one outbound message to the contact.

**Stale Lead Detection:** Leads sitting in actionable stages (New Lead, Contacted, Estimate Scheduled/Completed, Quote Given, Agreement Sent, Conversation Active, Nurture) for more than 48 hours without a stage change are flagged in the Pipeline Check section.

The Pipeline Check section shows:
- Stale lead names, current stage, days since last update, and contact attempt count
- Gold indicator for leads needing more follow-up (< 3 contacts), green when 3+ reached
- Red warning for leads moved to Lost with <3 contacts and no lost reason

### Field Source Badges

Each auto-filled field shows a source badge in the UI (`GHL`, `GHL Pipeline`, etc.). CSRs can override any value, and the badge changes to `Edited`. Overrides that deviate more than 20% from the GHL value trigger a discrepancy warning.

### Revenue Tracking

Revenue is tied back to CSRs through Workiz job numbers:

1. **GHL auto-populates** the Jobs Booked section with customer name and job type from booked opportunities
2. **CSR enters the Workiz job number** — the only manual step required
3. **Reports view** cross-references job numbers against `junk_removal_jobs` (field supervisor EOD data) for actual completed revenue
4. **Fallback:** If the field team hasn't reported yet, uses CSR-entered estimated revenue

This connects the CSR who booked the lead to the actual job revenue once the field team completes and reports it. Dumpster rental revenue is not tracked yet (no Docket integration).

## Form Sections

The EOD report has 14 sections:

| # | Section | Description |
|---|---|---|
| 1 | Shift Info | CSR name, date, shift start/end times |
| 2 | Communications | Checklist confirming all channels were covered |
| 3 | Call & Messaging Metrics | Calls (manual) + SMS/FB/IG counts (auto-filled from GHL) |
| 4 | Dispositions | Call outcome categorization (auto-filled from GHL pipeline) |
| 5 | Jobs Booked | Auto-populated from GHL booked opps. CSR adds Workiz job # for revenue tracking. |
| 6 | Emails & Forms | Web form and email submission tracking |
| 7 | Yelp Leads | Yelp-specific lead tracking |
| 8 | Follow-Ups | Follow-up attempts with timing, channel, and result |
| 9 | Docket Activity | Dumpster rental system activity |
| 10 | Workiz Activity | Junk removal system activity |
| 11 | GHL Pipeline Check | Checklist with contextual counts from GHL pipeline data |
| 12 | Notes | Issues, management attention items, suggestions, carryover |
| 13 | Bonus Tracking | Accelerators (upsells, reviews, win-backs) and guardrails (cancellations, no-shows) |
| 14 | KPI Dashboard | Auto-calculated performance metrics, full bonus calculation |

## KPI & Bonus System

### Auto-Calculated KPIs

- **Booking Rate** -- Booked / (Booked + Quoted + Follow-Up + Lost). Non-qualified excluded.
- **Missed Call Rate** -- Missed / Total Inbound (target: under 10%). Calculated from manual entries.
- **Speed-to-Lead** -- Median response time from GHL conversations (target: under 5 min)
- **Follow-Up Completion** -- Completed / Total follow-ups (target: 100%)
- **Bonus Eligibility** -- All 3 activity minimums must be met

### Performance Tiers (based on booking rate)

| Tier | Booking Rate | Per-Booking Bonus | Tier Bonus |
|---|---|---|---|
| Elite | 70%+ | $5 | $200/pay period |
| Standard | 60-69% | $3 | $75/pay period |
| Developing | 50-59% | $0 | $0 |
| Below Target | <50% | $0 | $0 |

### Bonus Eligibility Requirements (all must be met)

- Speed-to-lead < 5 minutes
- Follow-up completion = 100%
- Missed call rate < 10%

### Bonus Accelerators

CSRs can earn additional bonuses tracked daily in the Bonus Tracking section:

| Accelerator | Bonus | Description |
|---|---|---|
| Upsell Champion | $5 per upsell | Added services to an existing job (e.g., mattress pickup added to junk removal) |
| 5-Star Review Assist | $10 per review | CSR sent the review request that resulted in a 5-star review |
| Win-Back Booking | $10 per booking | Successfully re-booked a previously lost lead |

### Quality Guardrails

Guardrails protect bonus integrity by penalizing high cancellation/no-show rates:

| Guardrail | Threshold | Penalty |
|---|---|---|
| Cancellation Rate | >20% of bookings | Bonus reduced 50% |
| No-Show Rate | >15% of bookings | Bonus reduced 25% |

Both guardrails can apply simultaneously (e.g., 50% x 75% = 37.5% of original bonus).

### Revenue Milestones (per pay period)

| Milestone | Revenue Threshold | Bonus |
|---|---|---|
| Standard | $50,000 | $150 |
| Premium | $75,000 | $300 |

### New Hire Ramp Period (30 days)

New CSRs get adjusted targets for their first 30 days:

| Period | Duration | Adjustment |
|---|---|---|
| Weeks 1-2 | Days 1-14 | Guaranteed $100 bonus regardless of metrics |
| Weeks 3-4 | Days 15-30 | 40% booking rate threshold (instead of 50%) |

Ramp status is calculated from the `hire_date` field on the employee record.

### Daily Bonus Estimate

The KPI Dashboard (Section 14) shows a full daily bonus breakdown:

```
Per-Booking Bonus     = Bookings x Tier Rate
- Guardrail Deductions (if cancellation/no-show rates exceed thresholds)
+ Accelerator Bonuses  (upsells x $5 + reviews x $10 + win-backs x $10)
= Total Daily Bonus
```

### Pay Period Summary

The Reports view includes a Pay Period Summary when viewing pay period date ranges:

- Per-booking bonus total with tier rate
- Tier bonus (per pay period)
- Accelerator totals (upsells, reviews, win-backs)
- Revenue milestone bonus
- Guardrail deductions
- Total estimated bonus for the pay period

## Business Context

Kanai operates a dual-system architecture:

- **GoHighLevel (GHL)** -- Primary phone system, all customer communication, lead management, pipeline tracking
- **Workiz** -- Junk removal job scheduling, dispatch, invoicing
- **Docket** -- Dumpster rental bookings, dispatch, asset tracking

Rule: If it's a dumpster can, it goes in Docket. Everything else goes in Workiz.

## Project Structure

```
kanai-eod-csr-form/
├── api/                          # Vercel serverless functions
│   ├── _lib/
│   │   └── supabase-admin.js     # Supabase admin client (service role)
│   └── ghl/
│       ├── prefill.js            # GHL data prefill endpoint
│       ├── pipeline.js           # GHL pipeline status endpoint
│       └── test.js               # GHL API test endpoint
├── src/
│   ├── App.jsx                   # Main app with section navigation and submission
│   ├── components/
│   │   ├── layout/
│   │   │   └── FormLayout.jsx    # App shell with nav tabs (Form / Reports)
│   │   ├── shared/
│   │   │   ├── FormCard.jsx      # Section card wrapper
│   │   │   ├── FormField.jsx     # Input components (Label, NumberInput, etc.)
│   │   │   ├── ProgressIndicator.jsx  # Section navigation dots
│   │   │   └── RepeatableEntry.jsx    # Add/remove array item UI
│   │   ├── eod-form/             # 14 form section components
│   │   │   ├── HeaderSection.jsx
│   │   │   ├── CommunicationsSection.jsx
│   │   │   ├── CallMetricsSection.jsx
│   │   │   ├── DispositionsSection.jsx
│   │   │   ├── JobsBookedSection.jsx
│   │   │   ├── EmailSubmissionsSection.jsx
│   │   │   ├── YelpLeadsSection.jsx
│   │   │   ├── FollowUpsSection.jsx
│   │   │   ├── DocketActivitySection.jsx
│   │   │   ├── WorkizActivitySection.jsx
│   │   │   ├── PipelineCheckSection.jsx
│   │   │   ├── NotesSection.jsx
│   │   │   ├── BonusTrackingSection.jsx
│   │   │   └── KPIDashboardSection.jsx
│   │   └── reports/
│   │       ├── CSRReportsView.jsx  # Historical reports with filters, pay period summary, CSV export
│   │       ├── CSRLeaderboard.jsx  # Ranked CSR performance comparison
│   │       ├── LeadSourceBreakdown.jsx  # Revenue by lead source
│   │       └── PipelineDashboard.jsx    # Inbound-to-revenue funnel visualization
│   ├── hooks/
│   │   ├── useEodForm.js         # Form state management
│   │   ├── useAutoSave.js        # LocalStorage draft auto-save
│   │   └── useGhlPrefill.js      # GHL data fetching and field source tracking
│   └── lib/
│       ├── constants.js          # Disposition types, form sections, options
│       ├── form-defaults.js      # Default form state for all 14 sections
│       ├── kpi-calculations.js   # Booking rate, bonus calc, guardrails, accelerators, ramp
│       ├── supabase.js           # Supabase client (anon key)
│       ├── supabase-data.js      # DB read/write operations
│       ├── ghlApi.js             # Client-side GHL API calls
│       ├── dateHelpers.js        # Date formatting, pay period calculation
│       └── utils.js              # Tailwind merge helpers
└── supabase/
    └── migrations/
        ├── 20260126000000_initial_schema.sql        # Base schema
        ├── 20260312000000_ghl_messaging_metrics.sql # Messaging + STL columns
        └── 20260313000000_bonus_tracking.sql        # Accelerators, guardrails, hire_date
```

## Database Schema

Uses the shared Kanai Supabase instance with `csr_` prefixed tables to avoid conflicts with the Field Supervisor EOD form.

**Row Level Security (RLS)** is enabled on all tables. Policies allow `anon` role read/write access for the client-side app. `ghl_user_mapping` and `ghl_daily_pipeline_summary` are read-only for `anon` (writes use service role from API). The `service_role` key bypasses RLS automatically.

### Tables

| Table | Description |
|---|---|
| `csr_employees` | CSR roster with name, email, role, active status, hire_date |
| `csr_eod_reports` | One row per CSR per day with all metrics, bonus tracking, and checklist data |
| `csr_eod_jobs_booked` | Child table for individual job entries |
| `csr_eod_email_submissions` | Child table for email/form submissions |
| `csr_eod_yelp_leads` | Child table for Yelp lead entries |
| `csr_eod_followups` | Child table for follow-up attempt entries |
| `csr_pay_period_summaries` | Aggregated pay period data |
| `ghl_user_mapping` | Maps `employee_id` to `ghl_user_id` for API lookups |
| `ghl_daily_pipeline_summary` | Cached daily pipeline snapshots per CSR |
| `weekly_reports` | Stored weekly executive reports (auto-generated Monday mornings) |

### Bonus Tracking Columns (on `csr_eod_reports`)

| Column | Type | Description |
|---|---|---|
| `upsell_count` | INT | Number of upsells logged |
| `review_assists` | INT | Number of 5-star review requests sent |
| `winback_bookings` | INT | Bookings from previously lost leads |
| `cancellation_count` | INT | Jobs cancelled today |
| `noshow_count` | INT | Customer no-shows today |

### Key Constraints

- `UNIQUE(employee_id, report_date)` on `csr_eod_reports` -- one report per CSR per day
- All child tables reference `csr_eod_reports.id` with `ON DELETE CASCADE`

## Environment Variables

### Vercel (serverless functions)

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `GHL_API_KEY` | GoHighLevel API key (pit-* format) |
| `GHL_LOCATION_ID` | GoHighLevel location ID |
| `MANAGER_PHONE_NUMBER` | Manager phone for SMS alerts |
| `OWNER_PHONE_NUMBER` | Owner phone for weekly report SMS |
| `CRON_SECRET` | Vercel cron authentication |
| `WORKIZ_API_TOKEN` | Workiz API token for revenue sync |

### Client-side (Vite)

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key |

## Development

```bash
npm install
npm run dev        # Start dev server on port 3000
npm run build      # Production build
npm run lint       # ESLint
```

## Deployment

Deployed on Vercel. Push to `main` triggers auto-deploy, or deploy manually:

```bash
npx vercel --prod --yes
```

Environment variables are configured in the Vercel project settings.

## Cron Jobs

| Schedule (HST) | Endpoint | Purpose |
|---|---|---|
| Daily 7:30 AM | `/api/csr/estimates-digest` | SMS open estimate count per tech to manager |
| Daily 4:30 PM | `/api/csr/submission-reminder` | SMS each CSR who hasn't submitted + manager summary |
| Daily 11 PM | `/api/workiz/revenue-sync` | Backfill $0 revenue on jobs booked from Workiz |
| Monday 7 AM | `/api/reports/weekly-executive` | Auto-generate weekly executive report, SMS owner with link |

## API Endpoints

### `GET /api/ghl/prefill`

Auto-fills form fields from GHL data for a given CSR and date.

**Query params:**
- `employee_id` (required) -- Supabase employee UUID
- `date` (required) -- YYYY-MM-DD
- `shift_start` (optional) -- HH:MM, defaults to 08:00
- `shift_end` (optional) -- HH:MM, defaults to 16:30

**Response:**
```json
{
  "fields": {
    "total_outbound_calls": 12,
    "total_sms_sent": 8,
    "total_sms_received": 10,
    "total_fb_messages_sent": 5,
    "total_fb_messages_received": 13,
    "total_ig_messages_sent": 0,
    "total_ig_messages_received": 3,
    "total_messages_sent": 13,
    "total_messages_received": 26,
    "speed_to_lead": "under_5",
    "speed_to_lead_minutes": 4.9,
    "disp_booked": 3,
    "disp_quoted": 1,
    "disp_followup_required": 2,
    "disp_not_qualified": 1,
    "disp_lost": 0
  },
  "pipeline": {
    "booked_today": 3,
    "lost_today": 0,
    "new_leads_count": 5,
    "total": 24
  },
  "speed_to_lead_detail": {
    "median_minutes": 4.9,
    "avg_minutes": 7.3,
    "min_minutes": 0.8,
    "max_minutes": 15.8,
    "conversations_counted": 7,
    "bucket": "under_5",
    "by_channel": {
      "calls": { "median_minutes": 3.2, "avg_minutes": 5.1, "count": 4 },
      "sms": { "median_minutes": 6.8, "avg_minutes": 8.2, "count": 2 },
      "facebook": { "median_minutes": 5.7, "avg_minutes": 5.7, "count": 1 }
    }
  },
  "_sources": {
    "total_outbound_calls": "ghl_calls",
    "disp_booked": "ghl_pipeline",
    "total_sms_sent": "ghl_messages",
    "speed_to_lead_minutes": "ghl_calculated"
  },
  "_counts": {
    "user_calls": 12,
    "total_location_inbound": 31,
    "all_messages_today": 87,
    "opportunities": 24
  }
}
```

**Note:** `total_inbound_calls`, `missed_calls`, and `missed_call_rate` are NOT included in the response. Inbound and missed calls are manual entry due to GHL IVR attribution limitations. Missed call rate is calculated client-side.

### `GET /api/ghl/pipeline`

Returns pipeline stage data, stale lead detection with contact attempt counts, and premature-lost warnings.

**Query params:** `employee_id` (required), `date` (YYYY-MM-DD)

**Response includes:**
- `stages` — Opportunities grouped by stage name
- `stale_count` / `stale_leads` — Leads in actionable stages >48 hours with contact attempt counts
- `premature_lost` — Leads moved to Lost today with <3 contact attempts
- `min_contact_attempts` — Required minimum (currently 3)
- `booked_today` / `lost_today` — Today's stage movement counts

### `GET /api/ghl/test`

Health check for GHL API connectivity.

### `GET /api/csr/submission-reminder`

Daily CSR submission check and SMS reminders. Texts each CSR who hasn't submitted their EOD report, plus sends a manager summary.

### `GET /api/csr/estimates-digest`

Morning open estimates digest via SMS. Sends the manager a per-tech count of open estimates.

### `GET /api/workiz/revenue-sync`

Nightly revenue backfill from Workiz. Updates $0-revenue booked jobs with actual revenue from Workiz.

### `GET /api/reports/weekly-executive`

Weekly executive report generator. Auto-generates the weekly report on Monday mornings and sends the owner an SMS with a link.

### `GET /api/reports/view`

Weekly report HTML viewer. Renders a stored weekly executive report.

**Query params:**
- `week` (required) — YYYY-MM-DD (Monday of the report week)
