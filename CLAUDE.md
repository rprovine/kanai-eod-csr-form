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

## Unified AI Orchestration (added 2026-04-08)

**Customer Profile API** (`api/customer/profile.js`) — Unified aggregator that fetches from 7 sources (GHL contacts/opps/conversations, Workiz jobs, Docket events, voice calls, SMS conversations, CSR interactions). Merges duplicate GHL contacts. Cached 60s. Used by Kai voice, SMS AI, re-engage cron, and auto-close.

**AI Orchestration Events** (`ai_orchestration_events` table) — Every AI system logs decisions here. Viewable in the **AI Ops** dashboard tab in the CSR EOD app.

**AI Ops Dashboard** (`src/components/reports/AIOpsView.jsx`) — Real-time observability across all AI systems. Filters by system, time range. Shows event stream, context injection stats, errors.

**Centralized Pricing** (`pricing` Supabase table + `api/pricing/`) — 59 pricing rows, public read API. Source of truth for all AI systems.

**Auto-Close Protection** — Existing Workiz customers and active dumpster rentals are protected from auto-close. SMS alert sent to management when triggered.

**Review Request** — Workiz job completion webhook triggers auto-SMS asking customer for Google review.

**GHL User Sync** (`api/ghl/sync-users.js`) — Syncs GHL users to `ghl_user_mapping` table.

**KPI Validation** (`api/csr/validate-kpis.js`) — Server-side validation of CSR self-reported numbers against GHL data.

**Booking Slots** (`ai_booking_slots` table) — Tracks AI-booked time slots (2-hour windows Mon-Sat, 2 slots weekday, 1 Saturday).

## Env Var Gotchas

- **WORKIZ_API_TOKEN** may have trailing literal `\n` (2 chars, not newline). Code uses `.replace(/\\n$/, '').trim()`.
- **GHL_PIPELINE_ID** may have trailing newline. Code trims it.
- Workiz API is **read-only** — `/job/create/` returns 401. Job creation is manual via dispatcher.
- Workiz `/job/all/` does NOT accept `?phone=` — returns 400. Must paginate and filter client-side.

## Related Projects

- **kanai-csr-coaching** — AI call scoring system, shares the same Supabase project and `csr_employees` table. Extended to score Kai voice + SMS AI conversations.
- **kanai-field-supervisor-eodform** — Field supervisor EOD form + SMS AI router + re-engage cron
- **kanai-ai-voice-chatbot** — Kai voice agent (Retell) + website chatbot (LangChain) + Customer Profile tools
- **kanai-website** — Next.js public website with Kai chatbot widget
