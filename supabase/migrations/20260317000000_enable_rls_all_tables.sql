-- Enable RLS on all CSR tables that were missing it
-- Adds permissive policies for anon role (internal tool, no auth)
-- Service role automatically bypasses RLS

-- csr_employees
ALTER TABLE csr_employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read csr_employees" ON csr_employees FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert csr_employees" ON csr_employees FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update csr_employees" ON csr_employees FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- csr_eod_reports
ALTER TABLE csr_eod_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read csr_eod_reports" ON csr_eod_reports FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert csr_eod_reports" ON csr_eod_reports FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update csr_eod_reports" ON csr_eod_reports FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- csr_eod_jobs_booked
ALTER TABLE csr_eod_jobs_booked ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon all csr_eod_jobs_booked" ON csr_eod_jobs_booked FOR ALL TO anon USING (true) WITH CHECK (true);

-- csr_eod_email_submissions
ALTER TABLE csr_eod_email_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon all csr_eod_email_submissions" ON csr_eod_email_submissions FOR ALL TO anon USING (true) WITH CHECK (true);

-- csr_eod_yelp_leads
ALTER TABLE csr_eod_yelp_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon all csr_eod_yelp_leads" ON csr_eod_yelp_leads FOR ALL TO anon USING (true) WITH CHECK (true);

-- csr_eod_followups
ALTER TABLE csr_eod_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon all csr_eod_followups" ON csr_eod_followups FOR ALL TO anon USING (true) WITH CHECK (true);

-- csr_pay_period_summaries
ALTER TABLE csr_pay_period_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon all csr_pay_period_summaries" ON csr_pay_period_summaries FOR ALL TO anon USING (true) WITH CHECK (true);

-- ghl_user_mapping
ALTER TABLE ghl_user_mapping ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read ghl_user_mapping" ON ghl_user_mapping FOR SELECT TO anon USING (true);

-- ghl_daily_pipeline_summary
ALTER TABLE ghl_daily_pipeline_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read ghl_daily_pipeline_summary" ON ghl_daily_pipeline_summary FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert ghl_daily_pipeline_summary" ON ghl_daily_pipeline_summary FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update ghl_daily_pipeline_summary" ON ghl_daily_pipeline_summary FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- estimate_tracker (if exists on this project)
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'estimate_tracker' AND schemaname = 'public') THEN
    EXECUTE 'ALTER TABLE estimate_tracker ENABLE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'estimate_tracker') THEN
      EXECUTE 'CREATE POLICY "Allow anon all estimate_tracker" ON estimate_tracker FOR ALL TO anon USING (true) WITH CHECK (true)';
    END IF;
  END IF;
END $$;
