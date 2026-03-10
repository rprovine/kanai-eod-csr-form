-- Kanai's Roll Off - CSR EOD Reporting System
-- All tables prefixed with csr_ to avoid conflicts with field supervisor EOD tables

-- CSR Employees
CREATE TABLE csr_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'csr',
  base_salary NUMERIC,
  probation_end_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- CSR EOD Reports (one per CSR per day)
CREATE TABLE csr_eod_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES csr_employees(id),
  report_date DATE NOT NULL,
  shift_start TIME,
  shift_end TIME,
  total_hours NUMERIC,

  comms_ghl_calls_chats BOOLEAN DEFAULT false,
  comms_ghl_emails BOOLEAN DEFAULT false,
  comms_workiz_messages BOOLEAN DEFAULT false,
  comms_yelp BOOLEAN DEFAULT false,
  comms_facebook_instagram BOOLEAN DEFAULT false,
  comms_sms_text BOOLEAN DEFAULT false,
  comms_web_forms BOOLEAN DEFAULT false,
  comms_docket BOOLEAN DEFAULT false,

  total_inbound_calls INT DEFAULT 0,
  total_outbound_calls INT DEFAULT 0,
  total_qualified_calls INT DEFAULT 0,
  missed_calls INT DEFAULT 0,
  missed_call_rate NUMERIC,
  speed_to_lead TEXT,
  disposition_logging_rate NUMERIC,

  disp_booked INT DEFAULT 0,
  disp_quoted INT DEFAULT 0,
  disp_followup_required INT DEFAULT 0,
  disp_not_qualified INT DEFAULT 0,
  disp_lost INT DEFAULT 0,
  disp_voicemail INT DEFAULT 0,

  daily_booking_rate NUMERIC,
  bonus_eligible BOOLEAN DEFAULT false,

  docket_clients_created INT DEFAULT 0,
  docket_agreements_sent INT DEFAULT 0,
  docket_agreements_signed INT DEFAULT 0,
  docket_tasks_created INT DEFAULT 0,
  docket_dumpsters_com_orders INT DEFAULT 0,
  docket_followups INT DEFAULT 0,
  docket_asset_availability_verified BOOLEAN DEFAULT false,
  docket_notes TEXT,

  workiz_jobs_created INT DEFAULT 0,
  workiz_jobs_completed INT DEFAULT 0,
  workiz_payments_count INT DEFAULT 0,
  workiz_payments_total NUMERIC DEFAULT 0,
  workiz_tomorrow_verified BOOLEAN DEFAULT false,
  workiz_followup_needed BOOLEAN DEFAULT false,
  workiz_notes TEXT,

  pipeline_new_leads_contacted BOOLEAN DEFAULT false,
  pipeline_no_stale_leads BOOLEAN DEFAULT false,
  pipeline_booked_updated BOOLEAN DEFAULT false,
  pipeline_lost_updated BOOLEAN DEFAULT false,
  pipeline_quoted_followup_scheduled BOOLEAN DEFAULT false,
  pipeline_stages_match BOOLEAN DEFAULT false,

  issues TEXT,
  management_attention TEXT,
  suggestions TEXT,
  carried_over TEXT,

  submitted_at TIMESTAMPTZ,
  status TEXT DEFAULT 'draft',
  reviewed_by UUID REFERENCES csr_employees(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(employee_id, report_date)
);

-- CSR Jobs booked (child of csr_eod_reports)
CREATE TABLE csr_eod_jobs_booked (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eod_report_id UUID REFERENCES csr_eod_reports(id) ON DELETE CASCADE,
  job_number TEXT,
  customer_name TEXT NOT NULL,
  job_type TEXT NOT NULL,
  system TEXT NOT NULL,
  estimated_revenue NUMERIC,
  scheduled_date DATE,
  lead_source TEXT,
  ghl_pipeline_updated BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- CSR Email/web form submissions (child of csr_eod_reports)
CREATE TABLE csr_eod_email_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eod_report_id UUID REFERENCES csr_eod_reports(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  source TEXT,
  status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- CSR Yelp leads (child of csr_eod_reports)
CREATE TABLE csr_eod_yelp_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eod_report_id UUID REFERENCES csr_eod_reports(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  status TEXT,
  followup_needed BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- CSR Estimate follow-ups (child of csr_eod_reports)
CREATE TABLE csr_eod_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eod_report_id UUID REFERENCES csr_eod_reports(id) ON DELETE CASCADE,
  job_number TEXT,
  customer_name TEXT NOT NULL,
  attempt_number INT,
  followup_timing TEXT,
  channel TEXT,
  result TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- CSR Pay period summaries
CREATE TABLE csr_pay_period_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES csr_employees(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_qualified_calls INT DEFAULT 0,
  total_bookings INT DEFAULT 0,
  booking_rate NUMERIC,
  performance_tier TEXT,
  per_booking_bonus NUMERIC DEFAULT 0,
  tier_bonus NUMERIC DEFAULT 0,
  total_bonus NUMERIC DEFAULT 0,
  activity_minimums_met BOOLEAN DEFAULT false,
  days_reported INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, period_start)
);

-- Indexes
CREATE INDEX idx_csr_eod_reports_employee ON csr_eod_reports(employee_id);
CREATE INDEX idx_csr_eod_reports_date ON csr_eod_reports(report_date);
CREATE INDEX idx_csr_eod_reports_status ON csr_eod_reports(status);
CREATE INDEX idx_csr_eod_jobs_report ON csr_eod_jobs_booked(eod_report_id);
CREATE INDEX idx_csr_eod_emails_report ON csr_eod_email_submissions(eod_report_id);
CREATE INDEX idx_csr_eod_yelp_report ON csr_eod_yelp_leads(eod_report_id);
CREATE INDEX idx_csr_eod_followups_report ON csr_eod_followups(eod_report_id);
CREATE INDEX idx_csr_pay_period_employee ON csr_pay_period_summaries(employee_id);

-- Insert default CSR employees
INSERT INTO csr_employees (name, email, role) VALUES
  ('CSR 1', 'csr1@kanaisrolloff.com', 'csr'),
  ('CSR 2', 'csr2@kanaisrolloff.com', 'csr'),
  ('CSR 3', 'csr3@kanaisrolloff.com', 'csr');
