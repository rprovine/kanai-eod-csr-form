-- GHL (GoHighLevel) Integration Tables
-- Tables prefixed with ghl_ to avoid conflicts

-- Raw webhook events staging table
CREATE TABLE ghl_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  ghl_id TEXT,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  event_date DATE,
  user_id TEXT,
  user_name TEXT
);
CREATE INDEX idx_ghl_events_date_user ON ghl_webhook_events(event_date, user_id, processed);
CREATE INDEX idx_ghl_events_ghl_id ON ghl_webhook_events(ghl_id);

-- GHL user → CSR employee mapping
CREATE TABLE ghl_user_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ghl_user_id TEXT UNIQUE NOT NULL,
  ghl_user_name TEXT,
  employee_id UUID REFERENCES csr_employees(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Aggregated daily call metrics
CREATE TABLE ghl_daily_call_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES csr_employees(id),
  summary_date DATE NOT NULL,
  inbound_calls INTEGER DEFAULT 0,
  outbound_calls INTEGER DEFAULT 0,
  missed_calls INTEGER DEFAULT 0,
  total_talk_time_seconds INTEGER DEFAULT 0,
  avg_speed_to_lead_seconds INTEGER,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, summary_date)
);

-- Daily pipeline snapshot
CREATE TABLE ghl_daily_pipeline_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES csr_employees(id),
  summary_date DATE NOT NULL,
  new_leads_count INTEGER DEFAULT 0,
  stale_leads_count INTEGER DEFAULT 0,
  booked_today INTEGER DEFAULT 0,
  lost_today INTEGER DEFAULT 0,
  quoted_pending INTEGER DEFAULT 0,
  opportunities JSONB DEFAULT '[]',
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, summary_date)
);

-- Enable RLS (service_role bypasses, no policies needed for server-only access)
ALTER TABLE ghl_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghl_user_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghl_daily_call_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghl_daily_pipeline_summary ENABLE ROW LEVEL SECURITY;
