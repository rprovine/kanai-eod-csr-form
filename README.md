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
| Pipeline context | Yes (new leads, stale, booked/lost counts) | GHL Opportunities API |

### Why Inbound/Missed Calls Are Manual

GHL IVR calls (type 24) don't include a `userId` field, so there's no way to attribute which CSR answered or missed a specific inbound call. The API only knows location-wide totals. To keep per-CSR metrics accurate, inbound and missed calls are entered manually.

### How Dispositions Work

Dispositions are derived from GHL pipeline stage changes that occurred on the report date:

- **Booked:** Stages containing "book", "schedul", "won", "approved", "submitted"
- **Quoted:** Stages containing "quot", "estimate", "proposal", "agreement sent"
- **Follow-up:** Stages containing "contacted", "conversation", "nurture", "follow"
- **Not Qualified:** Stages containing "non-qualified", "not qualified", "unqualified"
- **Lost:** Stages containing "lost", "declined", "cancel"

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

### Field Source Badges

Each auto-filled field shows a source badge in the UI (`GHL`, `GHL Pipeline`, etc.). CSRs can override any value, and the badge changes to `Edited`. Overrides that deviate more than 20% from the GHL value trigger a discrepancy warning.

## Form Sections

The EOD report has 14 sections:

| # | Section | Description |
|---|---|---|
| 1 | Shift Info | CSR name, date, shift start/end times |
| 2 | Communications | Checklist confirming all channels were covered |
| 3 | Call & Messaging Metrics | Calls (manual) + SMS/FB/IG counts (auto-filled from GHL) |
| 4 | Dispositions | Call outcome categorization (auto-filled from GHL pipeline) |
| 5 | Jobs Booked | Individual job entries with customer, type, revenue, source |
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
│   │       └── CSRReportsView.jsx  # Historical reports with filters, pay period summary, CSV export
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

Returns pipeline stage data for a CSR.

**Query params:** `employee_id`, `date` (YYYY-MM-DD)

### `GET /api/ghl/test`

Health check for GHL API connectivity.
