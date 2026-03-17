-- Lead activity log: tracks every CSR interaction with a lead
-- Replaces GHL assigned_to for attribution — supports multi-CSR leads
CREATE TABLE lead_activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id TEXT NOT NULL,
  contact_id TEXT,
  contact_name TEXT,
  csr_employee_id UUID REFERENCES csr_employees(id),
  csr_name TEXT NOT NULL,
  action TEXT NOT NULL, -- first_contact, follow_up, quoted, booked, lost, not_qualified
  action_date DATE NOT NULL,
  stage_name TEXT, -- GHL pipeline stage at time of action
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lead_activity_opp ON lead_activity_log(opportunity_id);
CREATE INDEX idx_lead_activity_csr ON lead_activity_log(csr_employee_id);
CREATE INDEX idx_lead_activity_date ON lead_activity_log(action_date);
CREATE INDEX idx_lead_activity_action ON lead_activity_log(action);
-- Prevent duplicate entries for same opp + csr + action + date
CREATE UNIQUE INDEX idx_lead_activity_unique ON lead_activity_log(opportunity_id, csr_employee_id, action, action_date);

ALTER TABLE lead_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read lead_activity_log" ON lead_activity_log FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert lead_activity_log" ON lead_activity_log FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update lead_activity_log" ON lead_activity_log FOR UPDATE TO anon USING (true) WITH CHECK (true);
