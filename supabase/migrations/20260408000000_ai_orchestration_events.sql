-- AI Orchestration Events
-- Unified observability log for all AI-touching systems.
-- Each system writes a row whenever it makes a decision about a customer.
-- Pure additive — no system reads from this in Phase 1.
-- Used to debug cross-system interactions before changing any behavior.

CREATE TABLE IF NOT EXISTS ai_orchestration_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT now(),

  -- Which system made the decision
  -- Allowed values: 'kai_voice', 'sms_router', 'reengage_cron', 'auto_close', 'auto_assign',
  --                 'lost_reason_check', 'unanswered_alert', 'customer_profile_api'
  system TEXT NOT NULL,

  -- Customer this is about (one or both should be set)
  contact_id TEXT,
  contact_phone TEXT,

  -- What did the system decide
  -- Examples: 'sent_message', 'deferred_to_csr', 'no_action', 'auto_closed',
  --           'auto_assigned', 'shadow_would_have_X', 'killed_by_killswitch',
  --           'profile_lookup', 'extracted_lead_data'
  decision TEXT NOT NULL,

  -- Human-readable reason
  reason TEXT,

  -- Free-form context (lead source, conversation_id, opportunity_id, etc.)
  context JSONB DEFAULT '{}',

  -- True if this was a shadow-mode decision (logged but not acted on)
  -- Phase 1 starts everything as shadow_mode=false (no shadow logic exists yet)
  -- Phase 2 will use shadow_mode=true while testing new behaviors
  shadow_mode BOOLEAN DEFAULT false
);

-- Fast lookup by phone (most common query: what has happened to this customer)
CREATE INDEX IF NOT EXISTS idx_orch_events_phone
  ON ai_orchestration_events(contact_phone, timestamp DESC)
  WHERE contact_phone IS NOT NULL;

-- Fast lookup by system (per-system dashboards)
CREATE INDEX IF NOT EXISTS idx_orch_events_system
  ON ai_orchestration_events(system, timestamp DESC);

-- Fast lookup by contact_id (when we have it)
CREATE INDEX IF NOT EXISTS idx_orch_events_contact
  ON ai_orchestration_events(contact_id, timestamp DESC)
  WHERE contact_id IS NOT NULL;

-- Recent activity index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_orch_events_recent
  ON ai_orchestration_events(timestamp DESC);

-- RLS: service role only (no anon/authenticated access)
ALTER TABLE ai_orchestration_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_orch_events"
  ON ai_orchestration_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comment for future maintainers
COMMENT ON TABLE ai_orchestration_events IS
  'Unified observability log for AI orchestration. Every system that touches a customer logs its decision here. Read-only for analytics. See kanai-unified-ai-plan.md for the full spec.';
