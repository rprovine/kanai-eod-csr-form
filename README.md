# Kanai CSR End-of-Day Report Form

Internal tool for Kanai Junk Removal CSRs to submit daily performance reports. Auto-fills call metrics, messaging activity, speed-to-lead, and disposition counts from GoHighLevel (GHL) to minimize manual entry and ensure data accuracy.

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

| Category | Fields Auto-Filled | GHL API Source |
|---|---|---|
| Calls | Inbound, outbound, missed, missed call rate | Messages Export API (types 1, 24) |
| Messaging | SMS sent/received, Facebook sent/received, Instagram sent/received | Messages Export API (types 2, 11, 18) |
| Speed to Lead | Average response time in minutes | Calculated from inbound-to-outbound response gaps per conversation |
| Dispositions | Booked, quoted, follow-up, not qualified, lost | Opportunities API (pipeline stage changes) |
| Pipeline Context | New leads, stale leads, booked/lost counts | Opportunities API |

### How Inbound Calls Work

GHL IVR calls (type 24) don't include `userId`, so individual CSR attribution isn't possible. The system uses the **location-wide inbound total** as the CSR's inbound count.

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

1. Groups all messages by conversation ID
2. Finds conversations where the first message today was inbound (new lead)
3. Measures the gap to the first outbound response by the CSR
4. Averages all gaps (capped at 480 min per conversation)
5. Maps to an enum bucket: under 5 min, 5-10 min, 10-15 min, over 15 min

### Field Source Badges

Each auto-filled field shows a source badge in the UI (`GHL`, `GHL Pipeline`, etc.). CSRs can override any value, and the badge changes to `Edited`. Overrides that deviate more than 20% from the GHL value trigger a discrepancy warning.

## Form Sections

The EOD report has 13 sections:

| # | Section | Description |
|---|---|---|
| 1 | Shift Info | CSR name, date, shift start/end times |
| 2 | Communications | Checklist confirming all channels were covered |
| 3 | Call & Messaging Metrics | Inbound/outbound calls, SMS/FB/IG counts (auto-filled from GHL) |
| 4 | Dispositions | Call outcome categorization (auto-filled from GHL pipeline) |
| 5 | Jobs Booked | Individual job entries with customer, type, revenue, source |
| 6 | Emails & Forms | Web form and email submission tracking |
| 7 | Yelp Leads | Yelp-specific lead tracking |
| 8 | Follow-Ups | Follow-up attempts with timing, channel, and result |
| 9 | Docket Activity | Dumpster rental system activity |
| 10 | Workiz Activity | Junk removal system activity |
| 11 | GHL Pipeline Check | Checklist with contextual counts from GHL pipeline data |
| 12 | Notes | Issues, management attention items, suggestions, carryover |
| 13 | KPI Dashboard | Auto-calculated performance metrics and bonus eligibility |

## KPI & Bonus System

### Auto-Calculated KPIs

- **Booking Rate** -- Booked / (Booked + Quoted + Follow-Up + Lost). Non-qualified excluded.
- **Missed Call Rate** -- Missed / Total Inbound (target: under 10%)
- **Disposition Logging Rate** -- Total dispositions / Qualified calls (target: 95%+)
- **Speed-to-Lead** -- Auto-calculated from GHL conversation response times (target: under 5 min)
- **Follow-Up Completion** -- Completed / Total follow-ups (target: 100%)
- **Bonus Eligibility** -- All 5 activity minimums must be met

### Performance Tiers (based on booking rate)

| Tier | Booking Rate | Per-Booking Bonus | Tier Bonus |
|---|---|---|---|
| Elite | 70%+ | $5 | $200/pay period |
| Standard | 60-69% | $3 | $75/pay period |
| Developing | 50-59% | $0 | $0 |
| Below Target | <50% | $0 | $0 |

### Bonus Eligibility Requirements (all must be met)

- Qualified calls >= 20
- Disposition logging rate >= 95%
- Speed-to-lead < 5 minutes
- Follow-up completion = 100%
- Missed call rate < 10%

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
│   │   ├── eod-form/             # 13 form section components
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
│   │   │   └── KPIDashboardSection.jsx
│   │   └── reports/
│   │       └── CSRReportsView.jsx  # Historical reports with filters and CSV export
│   ├── hooks/
│   │   ├── useEodForm.js         # Form state management
│   │   ├── useAutoSave.js        # LocalStorage draft auto-save
│   │   └── useGhlPrefill.js      # GHL data fetching and field source tracking
│   └── lib/
│       ├── constants.js          # Disposition types, form sections, options
│       ├── form-defaults.js      # Default form state for all 13 sections
│       ├── kpi-calculations.js   # Booking rate, missed call rate, bonus logic
│       ├── supabase.js           # Supabase client (anon key)
│       ├── supabase-data.js      # DB read/write operations
│       ├── ghlApi.js             # Client-side GHL API calls
│       ├── dateHelpers.js        # Date formatting utilities
│       └── utils.js              # Tailwind merge helpers
└── supabase/
    └── migrations/
        ├── 20260126000000_initial_schema.sql        # Base schema
        └── 20260312000000_ghl_messaging_metrics.sql # Messaging + STL columns
```

## Database Schema

Uses the shared Kanai Supabase instance with `csr_` prefixed tables to avoid conflicts with the Field Supervisor EOD form.

### Tables

| Table | Description |
|---|---|
| `csr_employees` | CSR roster with name, email, role, active status |
| `csr_eod_reports` | One row per CSR per day with all metrics and checklist data |
| `csr_eod_jobs_booked` | Child table for individual job entries |
| `csr_eod_email_submissions` | Child table for email/form submissions |
| `csr_eod_yelp_leads` | Child table for Yelp lead entries |
| `csr_eod_followups` | Child table for follow-up attempt entries |
| `csr_pay_period_summaries` | Aggregated pay period data |
| `ghl_user_mapping` | Maps `employee_id` to `ghl_user_id` for API lookups |

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

**Query params:** `employee_id`, `date` (YYYY-MM-DD)

**Response:**
```json
{
  "fields": {
    "total_inbound_calls": 31,
    "total_outbound_calls": 12,
    "missed_calls": 1,
    "missed_call_rate": 3.2,
    "total_sms_sent": 8,
    "total_sms_received": 10,
    "total_fb_messages_sent": 5,
    "total_fb_messages_received": 13,
    "total_ig_messages_sent": 0,
    "total_ig_messages_received": 3,
    "total_messages_sent": 13,
    "total_messages_received": 26,
    "speed_to_lead": "5_to_10",
    "speed_to_lead_minutes": 7.3,
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
    "avg_minutes": 7.3,
    "min_minutes": 2.1,
    "max_minutes": 15.8,
    "conversations_counted": 4,
    "bucket": "5_to_10"
  },
  "_sources": {
    "total_inbound_calls": "ghl_location",
    "total_outbound_calls": "ghl_calls",
    "disp_booked": "ghl_pipeline",
    "total_sms_sent": "ghl_messages"
  },
  "_counts": {
    "user_calls": 12,
    "total_location_inbound": 31,
    "all_messages_today": 87,
    "opportunities": 24
  }
}
```

### `GET /api/ghl/pipeline`

Returns pipeline stage data for a CSR.

**Query params:** `employee_id`, `date` (YYYY-MM-DD)

### `GET /api/ghl/test`

Health check for GHL API connectivity.
