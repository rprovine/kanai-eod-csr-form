# Kanai CSR End-of-Day Reporting Form

Structured web application replacing manual WhatsApp-based EOD reporting for Kanai's Roll Off customer service representatives. Tracks all daily CSR activities, calculates KPIs in real-time, and feeds into the pay-for-performance compensation plan.

**Live:** https://kanai-eod-csr-form.vercel.app

## Features

### 13-Section Multi-Step Form
1. **Shift Info** — CSR selection, date, shift times, auto-calculated hours
2. **Communications** — Confirmation checkboxes for all channels (GHL, Workiz, Yelp, Docket, SMS, email, web forms)
3. **Call Metrics** — Inbound/outbound/qualified/missed calls, speed-to-lead, auto-calculated missed call rate
4. **Dispositions** — Booked, quoted, follow-up, not qualified, lost, voicemail counts with anti-gaming warnings
5. **Jobs Booked** — Repeatable entries with job type (auto-sets Workiz/Docket), revenue, lead source
6. **Emails & Web Forms** — Repeatable entries for email/web form submissions
7. **Yelp Leads** — Repeatable entries with status tracking
8. **Follow-Ups** — Repeatable entries with attempt tracking and follow-up schedule reminder
9. **Docket Activity** — Dumpster rental metrics (clients, agreements, tasks, Dumpsters.com orders)
10. **Workiz Activity** — Junk removal metrics (jobs, payments, schedule verification)
11. **GHL Pipeline** — End-of-day pipeline hygiene verification (6 checkboxes)
12. **Notes** — Issues, management attention, suggestions, carryover items
13. **KPI Dashboard** — Auto-calculated summary with color-coded status, Recharts visualization, bonus eligibility

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
- **UI:** Custom dark-themed components (Kanai brand colors)
- **Icons:** Lucide React
- **Charts:** Recharts
- **Database:** Supabase (PostgreSQL)
- **Hosting:** Vercel

## Database

Uses the shared Kanai Supabase instance with `csr_` prefixed tables to avoid conflicts with the Field Supervisor EOD form:

- `csr_employees` — CSR roster
- `csr_eod_reports` — Main EOD report (one per CSR per day)
- `csr_eod_jobs_booked` — Jobs booked child records
- `csr_eod_email_submissions` — Email/web form child records
- `csr_eod_yelp_leads` — Yelp lead child records
- `csr_eod_followups` — Follow-up child records
- `csr_pay_period_summaries` — Aggregated pay period data

Schema migration: `supabase/migrations/001_initial_schema.sql`

## Business Context

Kanai's operates a dual-system architecture:
- **GoHighLevel (GHL)** — Primary phone system, all customer communication, lead management
- **Workiz** — Junk removal job scheduling, dispatch, invoicing
- **Docket** — Dumpster rental bookings, dispatch, asset tracking

Rule: If it's a dumpster can, it goes in Docket. Everything else goes in Workiz.

## Development

```bash
npm install
npm run dev     # starts on port 3000
```

## Environment Variables

```
VITE_SUPABASE_URL=<supabase-project-url>
VITE_SUPABASE_ANON_KEY=<supabase-anon-key>
```

## Deployment

```bash
npx vercel --prod --yes
```

Environment variables are configured in the Vercel project settings.

## Future Phases

- **Phase 2:** FastAPI backend, Supabase Auth, role-based access (CSR/Supervisor/Admin)
- **Phase 3:** Supervisor review workflow, team dashboards
- **Phase 4:** Reporting dashboards (daily flash, weekly, pay period, monthly)
- **Phase 5:** GHL/Workiz/Docket API integrations for auto-populating call metrics and job data
