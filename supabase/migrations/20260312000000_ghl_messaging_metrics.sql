-- Add messaging metrics and speed-to-lead columns for GHL automation expansion
ALTER TABLE csr_eod_reports ADD COLUMN IF NOT EXISTS total_sms_sent INT DEFAULT 0;
ALTER TABLE csr_eod_reports ADD COLUMN IF NOT EXISTS total_sms_received INT DEFAULT 0;
ALTER TABLE csr_eod_reports ADD COLUMN IF NOT EXISTS total_fb_messages_sent INT DEFAULT 0;
ALTER TABLE csr_eod_reports ADD COLUMN IF NOT EXISTS total_fb_messages_received INT DEFAULT 0;
ALTER TABLE csr_eod_reports ADD COLUMN IF NOT EXISTS total_ig_messages_sent INT DEFAULT 0;
ALTER TABLE csr_eod_reports ADD COLUMN IF NOT EXISTS total_ig_messages_received INT DEFAULT 0;
ALTER TABLE csr_eod_reports ADD COLUMN IF NOT EXISTS total_messages_sent INT DEFAULT 0;
ALTER TABLE csr_eod_reports ADD COLUMN IF NOT EXISTS total_messages_received INT DEFAULT 0;
ALTER TABLE csr_eod_reports ADD COLUMN IF NOT EXISTS speed_to_lead_minutes NUMERIC;
ALTER TABLE csr_eod_reports ADD COLUMN IF NOT EXISTS speed_to_lead_conversations INT DEFAULT 0;
ALTER TABLE csr_eod_reports ADD COLUMN IF NOT EXISTS ghl_suggested_disp_booked INT;
ALTER TABLE csr_eod_reports ADD COLUMN IF NOT EXISTS ghl_suggested_disp_lost INT;
