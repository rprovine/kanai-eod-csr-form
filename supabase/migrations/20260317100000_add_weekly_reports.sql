CREATE TABLE weekly_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  report_content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_weekly_reports_week ON weekly_reports(week_start);
ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read weekly_reports" ON weekly_reports FOR SELECT TO anon USING (true);

ALTER TABLE csr_employees ADD COLUMN IF NOT EXISTS phone TEXT;
