# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev

```bash
npm run dev          # Vite dev server on http://localhost:5173
npm run build        # Production build
npm run lint         # ESLint
npx vercel --prod    # Deploy to Vercel
```

This is a Vite + React 19 SPA (NOT Next.js). Backend is Vercel serverless functions in `/api/`.

## Architecture

**Frontend:** `src/` — Single-page form with 14 sections, auto-filled from GHL API on CSR/date selection.

**Backend:** `api/` — Vercel serverless functions. Each file is an endpoint.

**Key directories:**
- `src/components/eod-form/` — 14 form section components
- `src/components/reports/` — CSR Reports view (leaderboard, trends, pipeline dashboard, quality scorecard)
- `src/components/shared/` — Reusable form components (FormCard, FormField, etc.)
- `src/lib/` — Constants, Supabase client, GHL API helpers, KPI calculations, date helpers
- `src/hooks/` — Form state management (useEodForm, useAutoSave, useGhlPrefill)
- `api/_lib/` — Shared backend utilities (ghl-client.js, supabase-admin.js, workiz-client.js)
- `api/ghl/` — GHL integration endpoints (prefill, pipeline, auto-assign, auto-close, webhooks)
- `api/csr/` — CSR notification endpoints (morning briefing, submission reminder, shift handoff)

## Key Patterns

**GHL data is the source of truth.** EOD form dispositions, call counts, and speed-to-lead are pulled from GHL API, not self-reported. CSRs can override values but discrepancies are flagged.

**CSR attribution is conversation-based.** The system attributes leads to CSRs by analyzing who had outbound messages in the conversation, NOT by GHL's `assignedTo` field. Multi-CSR leads are supported via `lead_activity_log`.

**Booking rate excludes non-qualified.** `Booked / (Booked + Quoted + Follow-up + Lost)`. Not Qualified and Voicemail are tracked separately. All report views use this same formula.

**GHL webhook vars return "null".** The webhook-opportunity endpoint fetches the full opportunity from the GHL API because GHL's custom webhook template variables for opportunity fields don't resolve.

## GHL Integration Gotchas

- **IVR calls (type 24)** don't have `userId` — per-CSR inbound/missed attribution impossible, uses location totals
- **Pipeline stage names** must be resolved from `pipelineStageId` via the pipelines API — the search endpoint doesn't return names
- **GHL_PIPELINE_ID** env var may have a trailing newline — code trims it
- **Pagination cycling** — GHL opportunities search can return the same results. Deduplicate by opportunity ID.
- **Auto-assign** runs every 30 min because GHL doesn't auto-assign opportunities to the CSR who responds

## Cron Jobs

14 scheduled jobs via cron-job.org (external, not Vercel cron). Key ones:
- Auto-assign (every 30 min during business hours)
- Auto-close stale leads (daily 3 AM)
- Morning briefing SMS (daily 7:45 AM Mon-Fri)
- Submission reminder (daily 4:30 PM)
- Revenue sync from Workiz (daily 11 PM)
- Weekly executive report (Monday 7 AM)

## Related Projects

- **kanai-csr-coaching** — AI call scoring system, shares the same Supabase project and `csr_employees` table
- **kanai-field-supervisor-eodform** — Field supervisor EOD form (separate Supabase tables)
