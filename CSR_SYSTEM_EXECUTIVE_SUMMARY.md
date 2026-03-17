# Kanai CSR Performance Tracking System
## Executive Summary

**Prepared:** March 16, 2026
**System URL:** https://kanai-eod-csr-form.vercel.app

---

## What It Does

This system tracks daily performance for every Customer Service Representative (CSR) at Kanai. Each CSR submits a daily end-of-day report that captures their calls, bookings, follow-ups, and pipeline activity. The system automatically pulls data from GoHighLevel (GHL) so CSRs spend less time on data entry and more time closing leads.

---

## Key Capabilities

### 1. Automated Data Collection from GHL

The system connects directly to GHL and auto-fills:
- Outbound call counts
- SMS, Facebook, and Instagram message activity
- Speed-to-lead response times (how fast CSRs respond to new inquiries)
- Disposition counts (booked, quoted, follow-up, lost) from pipeline stage changes

**CSRs only need to manually enter:** inbound call counts, missed calls, job details, and follow-up notes.

### 2. Booking Rate Tracking — Individual & Company-Wide

The core KPI is **Booking Rate**:

```
Booking Rate = Booked / (Booked + Quoted + Follow-Up + Lost)
```

- Tracked per CSR per day, aggregated across any date range
- "All CSRs" view shows company-wide performance with side-by-side comparison
- Non-qualified leads (spam, wrong numbers) are excluded so they don't skew the rate

**Current Pipeline Stage Mapping:**

| What the CSR Did | Counts As |
|---|---|
| Scheduled an onsite estimate | Booked |
| Booked a junk removal or dumpster job | Booked |
| Gave a quote, customer hasn't decided | Quoted |
| First contact made, moved to Needs Follow-Up | Follow-Up |
| Customer contacted, awaiting response | Follow-Up |
| Customer declined or went elsewhere | Lost |
| Not a real lead (spam, wrong number) | Not Qualified (excluded from rate) |

### Lead Lifecycle

```
New Lead → Contacted → Needs Follow-Up → Booked or Lost
```

After first contact, leads move to **Needs Follow-Up** where they stay until the CSR either books the job or marks it lost. The system enforces a minimum of 3 contact attempts before a lead can be moved to Lost without a documented reason.

### 3. Follow-Up Enforcement

**3-Contact Minimum Rule:** Every lead must be contacted at least 3 times before it can be marked as Lost — **unless there's a valid lost reason.** If a customer explicitly declines (price too high, went with a competitor, already got it done, etc.), the CSR can mark the lead as Lost immediately with the reason documented. The system:
- Counts outbound contact attempts per lead from GHL conversation history
- Shows the attempt count on every stale lead (e.g., "1/3 contacts")
- Flags leads moved to Lost with <3 contacts **and no lost reason** in a red warning
- Allows early Lost if a documented reason exists (tracked via GHL custom fields)

### 4. Stale Lead Detection

Leads sitting in the pipeline for more than 48 hours without movement are automatically flagged. The CSR sees:
- The customer's name and current pipeline stage
- How many days since last activity
- How many contact attempts have been made vs. the 3 required

This ensures no lead falls through the cracks.

### 5. Speed-to-Lead Measurement

Measures how fast CSRs respond to new inbound inquiries:
- Uses the **median** response time (resistant to outliers)
- Breaks down by channel (calls, SMS, Facebook, Instagram)
- Only counts leads that arrive during the CSR's shift hours
- Target: under 5 minutes

### 6. Compensation & Bonus Tracking

Full bonus calculation built into the system:

| Component | How It Works |
|---|---|
| **Performance Tiers** | 70%+ booking rate = Elite ($5/booking + $200/period), 60-69% = Standard ($3/booking + $75/period) |
| **Bonus Accelerators** | Upsells ($5 each), 5-star review assists ($10 each), win-back bookings ($10 each) |
| **Quality Guardrails** | >20% cancellation rate = 50% bonus reduction; >15% no-show rate = 25% reduction |
| **Revenue Milestones** | $50K/period = $150 bonus; $75K/period = $300 bonus |
| **New Hire Ramp** | Weeks 1-2: guaranteed $100 bonus; Weeks 3-4: reduced 40% booking threshold |

### 7. Revenue Attribution

Revenue is tied directly to the CSR who booked the lead:

1. When a CSR moves a lead to "Booked" in GHL, the Jobs Booked section auto-populates with the customer name
2. The CSR enters the **Workiz job number** — the only manual step
3. Once the field team completes the job and reports revenue in their EOD, the CSR's reports automatically show the actual revenue

This closes the loop between "CSR booked a lead" and "how much money did that lead generate." Junk removal revenue is tracked now; dumpster rental revenue will follow once Docket integration is added.

### 8. Management Reporting

The Reports tab provides:
- Date range filtering (this week, last week, pay period, custom)
- Individual CSR or company-wide aggregate view
- Per-CSR performance comparison with visual bar charts
- Revenue per CSR (pulled from completed Workiz jobs via field supervisor data)
- CSV export for all data
- Pay period bonus breakdown with guardrail warnings

---

## Current CSR Roster

| CSR | Status | GHL Connected | Notes |
|---|---|---|---|
| Jessica | Active | Yes | Currently the only CSR with submitted reports |
| David | Active | Yes | GHL mapped, ready to submit |
| Lynch | Active | Yes | GHL mapped, ready to submit |
| Tina | Active (starts 3/17) | Pending | New hire — needs GHL account, then mapping. 30-day ramp period active. |

---

## How It Integrates with Existing Systems

```
GoHighLevel (GHL)           Workiz                    Docket
├── Phone calls             ├── Junk removal jobs     ├── Dumpster rentals
├── SMS / FB / IG           ├── Scheduling            ├── Agreements
├── Lead pipeline           ├── Invoicing             ├── Asset tracking
└── Contact management      └── Payments              └── Dispatch
         │
         ▼
    CSR EOD Form
    ├── Auto-fills from GHL
    ├── CSR enters job details, follow-ups, notes
    ├── Calculates KPIs and bonus
    └── Stores in Supabase
         │
         ▼
    Reports Dashboard
    ├── Individual CSR performance
    ├── Company-wide booking rate
    ├── Pay period bonus calculations
    └── CSV export
```

---

## What This Means for the Business

1. **Accountability** — Every CSR's booking rate, response time, and follow-up activity is tracked daily. No lead should go uncontacted or be prematurely abandoned.

2. **Visibility** — Management can see company-wide booking performance at any time, compare CSRs against each other, and identify who needs coaching.

3. **Incentive Alignment** — The bonus structure rewards high booking rates and penalizes cancellations/no-shows, directly tying CSR compensation to revenue outcomes.

4. **Lead Protection** — The 3-contact minimum and stale lead detection ensure the company gets maximum value from every advertising dollar spent generating leads.

5. **Data-Driven Decisions** — All metrics flow from GHL automatically, reducing human error and giving leadership reliable numbers for weekly reporting.

---

## Weekly Reporting

The system provides data to answer key weekly executive questions including:
- Total inbound calls (from GHL, location-wide)
- Calls over 10 seconds
- Jobs booked by phone vs. online
- Completed jobs and commercial breakdown
- Cancellations and lost estimates
- Truck team hours, fuel costs, disposal costs, and labor costs (from the companion Field Supervisor EOD Form)

A sample weekly executive report for the week of 3/8–3/14 is available at `WEEKLY_EXECUTIVE_REPORT_3-8_to_3-14.md`.
