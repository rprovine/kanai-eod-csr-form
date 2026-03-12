-- Add bonus accelerator and guardrail columns to csr_eod_reports
ALTER TABLE csr_eod_reports ADD COLUMN IF NOT EXISTS upsell_count INT DEFAULT 0;
ALTER TABLE csr_eod_reports ADD COLUMN IF NOT EXISTS review_assists INT DEFAULT 0;
ALTER TABLE csr_eod_reports ADD COLUMN IF NOT EXISTS winback_bookings INT DEFAULT 0;
ALTER TABLE csr_eod_reports ADD COLUMN IF NOT EXISTS cancellation_count INT DEFAULT 0;
ALTER TABLE csr_eod_reports ADD COLUMN IF NOT EXISTS noshow_count INT DEFAULT 0;

-- Add hire_date to csr_employees for new hire ramp period calculation
ALTER TABLE csr_employees ADD COLUMN IF NOT EXISTS hire_date DATE;
