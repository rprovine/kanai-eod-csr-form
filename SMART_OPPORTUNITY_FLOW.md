# Smart Opportunity Creation Flow

## Overview

Kanai's inbound call system uses a GHL workflow combined with a custom API endpoint to intelligently manage lead opportunities. This prevents duplicate opportunities from being created when existing customers or repeat callers phone in.

**Endpoint:** `POST https://kanai-eod-csr-form.vercel.app/api/ghl/smart-opportunity`
**Runs:** 24/7 on Vercel serverless (no dependency on any local machine)
**Source:** `api/ghl/smart-opportunity.js` in the `kanai-eod-csr-form` project

---

## How It Works

### 1. Inbound Call Arrives

A customer calls the Kanai main line. GHL's IVR workflow triggers on the call.

### 2. First-Time Caller Check (GHL Workflow)

The workflow checks if the contact has the "existing caller" tag:

- **Has tag** → Skip to IVR routing (no opportunity action needed)
- **No tag (first-time caller)** → Continue to Smart Opportunity webhook

### 3. Smart Opportunity Webhook

Instead of GHL's built-in "Create Or Update Opportunity" action, the workflow calls our custom endpoint via a **Custom Webhook** action.

**Payload sent by GHL:**
```json
{
  "contact": {
    "id": "{{contact.id}}",
    "name": "{{contact.name}}",
    "phone": "{{contact.phone}}"
  }
}
```

### 4. Duplicate Check

The endpoint performs these checks:

1. **Searches** for all existing opportunities for this contact in the LEADS pipeline
2. **Classifies** each opportunity by stage:
   - **Active stages** (still being worked): New Lead, Contacted, Needs Follow-Up, Estimate Scheduled, Estimate Completed, Quote Given, Agreement Sent, Conversation Active, Nurture, Discovery
   - **Resolved stages** (completed): Booked, Won, Lost, Declined, Non-Qualified, Closed
3. **Decides** what to do:

| Scenario | Action | Result |
|----------|--------|--------|
| Contact has **active** opportunity | **Skip** | No new opportunity created. Returns existing opportunity details. |
| Contact has only **resolved** opportunities (all Booked/Lost/Closed) | **Create** | New opportunity in "New Lead" stage. Could be a repeat customer. |
| Contact has **no** opportunities | **Create** | New opportunity in "New Lead" stage. Brand new lead. |

### 5. IVR Routing Continues

Regardless of whether an opportunity was created or skipped, the workflow continues to route the call through the IVR:

**Jessica (#21)** → if no answer → **David (#22)** → if no answer → **Lynch (#23)** → if no answer → **Voicemail**

---

## GHL Workflow Configuration

**Workflow:** "5. Main Line 2"

**Custom Webhook Settings:**
- **Method:** POST
- **URL:** `https://kanai-eod-csr-form.vercel.app/api/ghl/smart-opportunity`
- **Content-Type:** Raw Body (JSON)
- **Body:**
```json
{
  "contact": {
    "id": "{{contact.id}}",
    "name": "{{contact.name}}",
    "phone": "{{contact.phone}}"
  }
}
```

---

## API Response Examples

### Opportunity Skipped (duplicate prevented)
```json
{
  "action": "skipped",
  "reason": "Contact already has active opportunity",
  "existingOpportunity": {
    "id": "B4UZhW8c72q0TI6ZrJBF",
    "name": "Amanda Sueoka",
    "stage": "Contacted",
    "pipelineId": "xnzxa3kyr0YSj8XbyAqY"
  },
  "contactName": "Amanda Sueoka",
  "contactId": "StdPhYTkXm420tW7BNot"
}
```

### Opportunity Created (new lead)
```json
{
  "action": "created",
  "opportunity": {
    "id": "newOppId123",
    "name": "John Smith",
    "pipelineId": "xnzxa3kyr0YSj8XbyAqY",
    "pipelineStageId": "385c8669-3b27-4dd2-8014-d45ec3e0efca"
  },
  "contactName": "John Smith",
  "contactId": "abc123"
}
```

### No Contact ID
```json
{
  "action": "skipped",
  "reason": "No contact ID provided"
}
```

---

## Authentication

The endpoint accepts requests authenticated via:
- Query param: `?secret=YOUR_GHL_WEBHOOK_SECRET`
- Header: `X-Webhook-Secret: YOUR_GHL_WEBHOOK_SECRET`
- Header: `Authorization: Bearer YOUR_GHL_WEBHOOK_SECRET`
- If `GHL_WEBHOOK_SECRET` env var is not set, all requests are accepted (current setup)

---

## Environment Variables

| Variable | Location | Purpose |
|----------|----------|---------|
| `GHL_API_KEY` | Vercel (kanai-eod-csr-form) | Authenticates with GHL API |
| `GHL_LOCATION_ID` | Vercel | Kanai's GHL location |
| `GHL_PIPELINE_ID` | Vercel | LEADS pipeline ID (`xnzxa3kyr0YSj8XbyAqY`) |
| `GHL_WEBHOOK_SECRET` | Vercel (optional) | Webhook authentication |

---

## Monitoring

- **Vercel Logs:** Check `vercel logs` for `[smart-opp]` prefixed messages
- **GHL Execution Logs:** Workflow → Execution Logs → look for "Custom Webhook — Executed"
- **Test manually:** `curl -X POST https://kanai-eod-csr-form.vercel.app/api/ghl/smart-opportunity -H "Content-Type: application/json" -d '{"contact":{"id":"CONTACT_ID","name":"Test"}}'`

---

## Before vs After

| Before | After |
|--------|-------|
| Every inbound call from a "first-time caller" created a new opportunity | Only creates if no active opportunity exists |
| Repeat callers got duplicate opportunities | Repeat callers' existing opportunities are preserved |
| Manual cleanup needed to delete duplicates | No duplicates created |
| Built-in GHL "Create Or Update Opportunity" action | Custom smart endpoint with duplicate detection |
