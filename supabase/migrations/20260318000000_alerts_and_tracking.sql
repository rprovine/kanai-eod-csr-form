-- CSR shift schedules for on-shift detection
CREATE TABLE IF NOT EXISTS csr_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES csr_employees(id),
  day_of_week INT NOT NULL, -- 0=Sun, 6=Sat
  shift_start TIME NOT NULL DEFAULT '08:00',
  shift_end TIME NOT NULL DEFAULT '16:30',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, day_of_week)
);

-- Track unanswered lead alerts to avoid duplicates
CREATE TABLE IF NOT EXISTS unanswered_lead_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT NOT NULL,
  contact_name TEXT,
  alert_date DATE NOT NULL DEFAULT CURRENT_DATE,
  alerted_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ,
  UNIQUE(conversation_id, alert_date)
);

-- Track premature lost alerts to avoid duplicates
CREATE TABLE IF NOT EXISTS premature_lost_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id TEXT NOT NULL,
  contact_name TEXT,
  attempts INT DEFAULT 0,
  alert_date DATE NOT NULL DEFAULT CURRENT_DATE,
  alerted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(opportunity_id, alert_date)
);

-- Workiz-to-GHL opportunity mapping for reverse lookups
CREATE TABLE IF NOT EXISTS workiz_ghl_mapping (
  workiz_job_id TEXT PRIMARY KEY,
  ghl_opportunity_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- GHL follow-up task tracking
CREATE TABLE IF NOT EXISTS ghl_followup_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id TEXT,
  contact_id TEXT NOT NULL,
  contact_name TEXT,
  due_date DATE NOT NULL,
  task_type TEXT,
  synced_at TIMESTAMPTZ DEFAULT now(),
  is_overdue BOOLEAN DEFAULT false,
  csr_employee_id UUID REFERENCES csr_employees(id)
);

-- Add lead_source to activity log for ROI tracking
ALTER TABLE lead_activity_log ADD COLUMN IF NOT EXISTS lead_source TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_unanswered_alerts_conv ON unanswered_lead_alerts(conversation_id);
CREATE INDEX IF NOT EXISTS idx_premature_lost_opp ON premature_lost_alerts(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_followup_tasks_due ON ghl_followup_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_followup_tasks_overdue ON ghl_followup_tasks(is_overdue) WHERE is_overdue = true;
CREATE INDEX IF NOT EXISTS idx_activity_log_source ON lead_activity_log(lead_source) WHERE lead_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workiz_ghl_opp ON workiz_ghl_mapping(ghl_opportunity_id);

-- RLS
ALTER TABLE csr_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE unanswered_lead_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE premature_lost_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workiz_ghl_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghl_followup_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_schedules" ON csr_schedules FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_alerts" ON unanswered_lead_alerts FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_premature_lost" ON premature_lost_alerts FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_followups" ON ghl_followup_tasks FOR SELECT TO anon USING (true);
CREATE POLICY "anon_read_workiz_mapping" ON workiz_ghl_mapping FOR SELECT TO anon USING (true);
