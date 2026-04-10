# Kanai Field Tech Training: All Tools & Automations
**Date:** Friday, April 3, 2026 | **Duration:** 4 Hours

---

## Agenda

| Time | Block | Topic | Duration |
|------|-------|-------|----------|
| 0:00 | 1 | **The Big Picture** — How All Our Systems Connect | 30 min |
| 0:30 | 2 | **Lead Automations** — What Happens Before a Job Reaches You | 45 min |
| 1:15 | — | Break | 10 min |
| 1:25 | 3 | **Quality Control Tools** — How We Catch Problems Automatically | 35 min |
| 2:00 | 4 | **Notifications & Alerts** — The SMS System That Keeps Everyone Informed | 30 min |
| 2:30 | — | Break | 15 min |
| 2:45 | 5 | **Revenue Tracking & Reports** — How Your Work Shows Up in the Numbers | 40 min |
| 3:25 | 6 | **Live Demo & Q&A** — See It All in Action | 35 min |

---

## Block 1: The Big Picture (30 min)

### The Three Systems

We've built integrations that connect three main platforms:

| System | What It Handles | Field Tech Touchpoint |
|--------|----------------|----------------------|
| **GoHighLevel (GHL)** | All customer communication — calls, SMS, Facebook, Instagram, email, web forms, Yelp | Where leads start. Every call, text, and message is logged here |
| **Workiz** | Junk removal jobs — scheduling, dispatch, payments | Where you see your jobs and enter completed revenue |
| **Docket** | Dumpster rentals — agreements, deliveries, pickups, swaps | Where dumpster stops are scheduled and tracked |

### How They're Connected

We built custom tools that sync data between all three systems automatically:

```
Customer contacts us (any channel)
        ↓
   GHL captures it → Our tools auto-create a lead
        ↓
   CSR works the lead → Our tools track every touchpoint
        ↓
   Lead gets booked → Job created in Workiz or Docket
        ↓
   Field tech completes job → Revenue entered
        ↓
   Our tools pull revenue back → Matched to CSR who booked it
        ↓
   Reports generated automatically
```

**Key point:** None of this existed before we built it. GHL, Workiz, and Docket don't talk to each other natively. Every connection is a custom tool we created.

---

## Block 2: Lead Automations (45 min)

### Tool 1: Smart Opportunity Creator

**What it does:** When a customer calls in, this tool checks if they've called before. If they're a repeat caller with an active lead, it doesn't create a duplicate — it routes back to the existing opportunity.

**How it works:**
- Triggered by every inbound call through the IVR
- Checks if the contact has an active opportunity (not yet booked, lost, or closed)
- If they have a recent resolved opportunity (within 30 days), it skips — they're probably calling about an existing job
- Only creates a new lead if the customer is genuinely new

**Why it matters to field techs:** Without this, CSRs would be juggling duplicate leads and might accidentally double-book or lose track of a customer.

### Tool 2: Opportunity Sync (Catch-All Lead Creator)

**What it does:** Catches leads from ALL channels — not just phone calls. Web forms, Facebook messages, Yelp inquiries, email — any new contact that enters GHL automatically gets a pipeline opportunity created.

**How it works:**
- Runs every 5 minutes during extended hours
- Also triggered by webhook when GHL creates a new contact
- Skips internal contacts (tagged as kanai-internal or do-not-contact)
- Same deduplication as Smart Opportunity — won't create duplicates

**Why it matters:** Every lead from every channel gets tracked. Nothing falls through the cracks.

### Tool 3: Auto-Assign

**What it does:** Automatically assigns leads to the CSR who actually responded to the customer.

**How it works:**
- Runs every 30 minutes during business hours
- During the 4:00-4:30 PM EOD window, runs every 5 minutes
- Looks at the conversation thread and finds which CSR sent the first outbound message
- Assigns the opportunity to that CSR in GHL

**Why it matters:** GHL doesn't do this natively. Without auto-assign, opportunities would sit unassigned and CSRs wouldn't get credit for leads they worked. This directly affects CSR bonus calculations.

### Tool 4: Auto-Close Stale Leads

**What it does:** Automatically closes leads that go unresponsive, keeping the pipeline clean.

**Three rules:**
| Rule | Trigger | Action |
|------|---------|--------|
| New Lead Timeout | 48+ hours in "New Lead" + 3+ contact attempts + zero customer response | → Non-Qualified |
| Follow-Up Timeout | 7+ days in "Contacted"/"Follow-Up" + zero customer response | → Non-Qualified |
| Quote Expired | 14+ days in "Quoted"/"Estimate" stage | → Lost (with auto-close reason) |

**How it checks for response:** Scans ALL channels — calls, SMS, Facebook, Instagram, chat. Only closes if the customer never responded on any channel.

**Schedule:** Runs daily at 3:00 AM

**Why it matters:** Clean pipeline = accurate reporting. If stale leads sit in the pipeline, it skews booking rates and makes it harder to see what's actually active.

### Tool 5: Unqualified Lost Redirect

**What it does:** When a CSR moves a lead to "Lost" without providing a valid reason and without making at least 3 contact attempts, the system automatically redirects it to "Non-Qualified" instead.

**Valid lost reasons include:** Price too high, chose competitor, bad timing, DIY, moving, no-show, changed mind, etc.

**Why:** Keeps the "Lost" stage meaningful. A lead that was never truly qualified shouldn't count as a real lost deal — it distorts the booking rate.

### Tool 6: AI Conversation Auto-Close

**What it does:** When an opportunity moves to a terminal stage (booked, lost, non-qualified), the system automatically closes any active GHL AI conversation for that contact.

**Why:** Prevents the AI follow-up bot from continuing to message customers who've already booked or been closed out.

---

## Block 3: Quality Control Tools (35 min)

### Tool 7: Premature Lost Detection

**What it does:** Monitors the pipeline and flags any lead moved to "Lost" that doesn't meet minimum quality standards.

**Flags if:**
- Fewer than 3 contact attempts made AND
- No valid lost reason documented

**How it alerts:**
- Runs every 10 minutes during business hours
- Sends SMS to management with: lead name, current stage, number of attempts
- Stores alert in database (won't re-alert on same lead same day)

**Why it matters:** Ensures CSRs are giving every lead a fair shot. A lead shouldn't be marked lost after one unanswered call — the follow-up protocol requires 3 attempts minimum.

### Tool 8: Unanswered Lead Detection

**What it does:** Real-time monitoring that detects when a customer message goes unanswered for more than 5 minutes.

**How it works:**
- Runs every 5 minutes during business hours
- Scans the last 15 minutes of messages across all channels
- If the most recent message in a conversation is INBOUND and older than 5 minutes with no outbound response → alert

**Alert:** SMS to management with customer name, phone number, and how long the message has been unanswered.

**Why it matters:** Speed-to-lead is one of the most important metrics. Responding within 5 minutes dramatically increases booking rates. This tool catches any leads that might be slipping through.

### Tool 9: Pipeline Health Check (Stale Lead Detection)

**What it does:** Identifies leads that have been sitting in an active stage for more than 48 hours without any movement.

**Shown in:**
- The CSR's daily EOD form (Pipeline Status section)
- Morning briefing SMS
- Management reports

**Tracked data per stale lead:**
- Lead name and current stage
- Days since last update
- Number of contact attempts made
- Color-coded urgency (gold = needs more follow-up, green = 3+ attempts made)

### Tool 10: Follow-Up Task Sync

**What it does:** Syncs all follow-up tasks from GHL and tracks which ones are overdue.

**Schedule:** Runs every 2 hours

**Data tracked:**
- Contact name, due date, task type
- Overdue flag (due date < today)
- Assigned CSR

**Shows up in:** The Reports dashboard "Follow-Up Backlog" section, color-coded by how overdue (red = 7+ days, amber = 3-6 days, yellow = 1-2 days)

---

## Block 4: Notifications & Alerts (30 min)

All notifications are sent via SMS through GHL's messaging system. Here's every automated message we've built:

### CSR-Facing Notifications

| Notification | When | What It Says |
|-------------|------|-------------|
| **Morning Briefing** | 7:45 AM Mon-Fri | "Good morning [Name]! Today's briefing: X stale leads, Y new leads, Z total in pipeline. Stale leads: [names]" |
| **EOD Submission Reminder** | Next morning if not submitted | "Reminder: Your EOD report for [date] hasn't been submitted yet." |

### Management Alerts

| Alert | Frequency | Trigger |
|-------|-----------|---------|
| **Unanswered Lead** | Every 5 min | Customer message unanswered >5 min |
| **Premature Lost** | Every 10 min | Lead moved to Lost without 3 attempts + reason |
| **Shift Handoff** | End of shift (weekdays) | New leads that no CSR worked today |
| **EOD Status Summary** | After submission deadline | "X/Y CSRs submitted. Missing: [names]" |
| **Open Estimates Digest** | Daily 5:30 PM | "Open estimates by CSR: John (5 total: 2 Quoted, 3 Agreement Sent)..." |
| **Weekly Executive Report** | Sunday 5:00 PM | Full week summary with link to detailed report |

### How the SMS System Works

- Uses GHL's conversation/messaging API
- Creates an internal contact for each recipient if one doesn't exist
- Messages are trackable in GHL's conversation view
- All alerts are deduplicated — same alert won't fire twice for the same lead on the same day

---

## Block 5: Revenue Tracking & Reports (40 min)

### Tool 11: Revenue Attribution

**What it does:** Matches completed jobs back to the CSR who booked them and captures the actual revenue.

**The matching chain:**
1. Find booked opportunities in GHL assigned to known CSRs
2. Check if GHL opportunity has a Workiz job UUID stored
3. If yes → fetch the Workiz job to get the serial number and actual revenue
4. If no UUID → try matching by customer phone number in Workiz
5. Also check field supervisor completed job records for actual revenue
6. Update the CSR's job tracking with matched revenue

**Schedule:** Daily at 9:00 AM

**Why it matters to field techs:** When you complete a job and enter the revenue in Workiz, this tool pulls that number back and credits it to the CSR who booked it. **Accurate revenue entry in Workiz directly impacts reporting accuracy.**

### Tool 12: Revenue Sync (Backfill)

**What it does:** Catches any jobs where revenue attribution missed a match. Looks at all booked jobs with missing or zero revenue and tries again.

**Sources checked:**
1. Workiz API (by job number)
2. Field supervisor completed job records (junk_removal_jobs table)

**Schedule:** Daily at 9:00 AM

### Tool 13: Workiz Webhook (Real-Time Status Sync)

**What it does:** When a Workiz job status changes, this tool syncs it back to GHL.

**Status mapping:**
- Job **Cancelled** in Workiz → Opportunity moved to "Lost" in GHL
- Job **No-Show** in Workiz → Opportunity moved to "Lost" in GHL
- Revenue/price update in Workiz → CSR tracking table updated

**Why it matters:** If a customer cancels, the GHL pipeline reflects it immediately without CSR manual intervention.

### Tool 14: Docket Webhook (Dumpster Rental Sync)

**What it does:** When a Docket task is created or updated, this tool:
1. Matches the Docket customer to a GHL opportunity
2. Updates CSR job tracking with revenue
3. **Stores the scheduled stop** — delivery, pickup, or swap with date, driver, address, and asset type

**The scheduled stops table powers the nightly ops schedule preview** — so the field team can see tomorrow's dumpster stops.

**Data stored per stop:**
- Docket task number
- Customer name
- Job address
- Asset type (15yd, 20yd, 25yd, etc.)
- Stop type (delivery, pickup, swap)
- Assigned driver
- Scheduled date
- Price
- Status

### Tool 15: Weekly Executive Report

**What it does:** Generates a comprehensive weekly summary every Sunday at 5:00 PM.

**Report sections (13 total):**
1. Inbound calls received
2. Total CSR calls handled
3. Messaging conversations
4. Jobs completed
5. Total revenue
6. Operating costs (fuel, dump fees, payroll)
7. Net margin
8. Hours worked
9. Cancellations
10. Lost estimates
11. Junk removal performance
12. Commercial vs. residential split
13. CSR shift coverage

**Data sources:** Pulls from CSR EOD reports, field supervisor EOD reports, truck data, team member hours, junk removal jobs, and GHL call data.

**Delivery:** Stored in database + SMS with link to formatted HTML view.

### The Reports Dashboard

The portal has a full analytics dashboard with these views:

| Report | What It Shows |
|--------|--------------|
| **CSR Leaderboard** | Rankings by booking rate, revenue, speed-to-lead |
| **Performance Trends** | Weekly charts of booking rate and response time |
| **Lead-to-Revenue Pipeline** | Funnel: Qualified Leads → Booked → Revenue |
| **Live Pipeline Distribution** | Bar chart of opportunities in each stage right now |
| **Lead Source Breakdown** | Which channels (Yelp, Google, Phone, etc.) bring the most jobs and revenue |
| **CSR Workload Distribution** | How leads are split across the team |
| **Lead Conversion by CSR** | Booking rate per CSR with multi-CSR attribution |
| **Follow-Up Backlog** | Overdue follow-ups sorted by urgency |
| **Quality Scorecard** | Premature lost and unanswered lead alerts |
| **Conversion Funnel Timing** | How long it takes from first contact to booking (avg, median, fastest, slowest) |

---

## Block 6: Live Demo & Q&A (35 min)

### Demo Walkthrough (20 min)

Show each tool in action:

1. **GHL Pipeline** — Open GHL and show a lead moving through stages. Explain how each stage change triggers our webhook and fires downstream automations.

2. **EOD Form** — Open the CSR form, select a CSR and today's date. Watch auto-fill populate:
   - Call counts pulled from GHL
   - Messaging activity across all channels
   - Speed-to-lead with per-channel breakdown
   - Dispositions auto-counted from pipeline stage changes
   - Jobs booked with customer names and revenue

3. **Pipeline Health** — Show the stale leads section, premature lost warnings, and pipeline hygiene checklist.

4. **Reports Dashboard** — Switch to Reports view:
   - Show the leaderboard with current team rankings
   - Pull up lead source breakdown (which marketing channels drive the most work)
   - Show the conversion funnel timing (how fast leads convert)
   - Show the quality scorecard with any recent alerts

5. **Docket Scheduled Stops** — Show how dumpster webhook data populates tomorrow's stop schedule.

6. **Trace a Job End-to-End** — Pick a recent completed job and follow it:
   - Original lead in GHL (when customer first contacted)
   - CSR conversation thread (how many touches to book)
   - Booking entry in CSR's EOD form
   - Completed job in Workiz with actual revenue
   - Revenue attribution showing the match
   - How it appears in the weekly executive report

### Open Q&A (15 min)

**Common questions to prepare for:**

- "How does the system know which CSR booked my job?"
  → It tracks who had outbound messages in the GHL conversation, not just who's "assigned."

- "What happens if I enter the wrong revenue in Workiz?"
  → The revenue sync pulls whatever number is in Workiz. If it's wrong, it'll be wrong in reports. Fix it in Workiz and the next sync will pick up the correction.

- "Can I see my schedule through this system?"
  → Junk removal schedule is in Workiz. Dumpster stops are tracked in the scheduled stops table from Docket webhooks.

- "What if a customer says they already talked to someone?"
  → Full conversation history is in GHL — every call, text, and message across all channels.

- "How does the auto-close work? Will it close a lead I'm still working?"
  → It only closes leads with ZERO customer response across ALL channels. If the customer responded even once on any channel, it stays open. Also requires 3+ contact attempts for new leads.

- "What's the difference between Lost and Non-Qualified?"
  → Lost = real lead that chose not to book (with documented reason). Non-Qualified = spam, wrong number, never responded, or out of service area. The system auto-redirects leads to Non-Qualified if they're marked Lost without a valid reason.

---

## Summary: Complete Tool Inventory

### Lead Lifecycle (6 tools)
1. Smart Opportunity Creator — prevents duplicate leads
2. Opportunity Sync — catches leads from all channels
3. Auto-Assign — credits the right CSR
4. Auto-Close Stale — cleans inactive leads
5. Unqualified Lost Redirect — maintains data integrity
6. AI Conversation Auto-Close — stops bot follow-ups on closed leads

### Quality Control (4 tools)
7. Premature Lost Detection — flags insufficient follow-up
8. Unanswered Lead Detection — catches slow response times
9. Pipeline Health Check — identifies stale leads
10. Follow-Up Task Sync — tracks overdue tasks

### Notifications (6 alert types)
11. Morning Briefing SMS — daily CSR briefing
12. EOD Submission Reminder — catches missed reports
13. Unanswered Lead Alert — real-time to management
14. Premature Lost Alert — real-time to management
15. Shift Handoff Alert — unworked lead summary
16. Open Estimates Digest — daily estimate summary

### Revenue & Reporting (5 tools)
17. Revenue Attribution — matches jobs to CSRs
18. Revenue Sync — backfills missing revenue
19. Workiz Webhook Sync — real-time status/revenue updates
20. Docket Webhook Sync — dumpster stop tracking + revenue
21. Weekly Executive Report — comprehensive weekly summary

### Analytics Dashboard (10 report views)
22. CSR Leaderboard
23. Performance Trends
24. Lead-to-Revenue Pipeline
25. Live Pipeline Distribution
26. Lead Source Breakdown
27. CSR Workload Distribution
28. Lead Conversion by CSR
29. Follow-Up Backlog
30. Quality Scorecard
31. Conversion Funnel Timing

**Total: 31 distinct tools and views**

---

## Materials Needed

- [ ] Laptop/projector for live demo
- [ ] Portal access logged in with this week's data
- [ ] GHL open in a separate tab to show pipeline
- [ ] Workiz open to show a completed job
- [ ] Example job to trace end-to-end through all systems
- [ ] This document printed for reference
