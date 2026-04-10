-- AI booking slot tracking.
-- Kai offers 2-hour windows (8-10, 10-12, 12-2, 2-4, 4-6) Mon-Sat.
-- 2 slots per window Mon-Fri, 1 slot per window Saturday.
-- This table tracks AI-booked slots to prevent double-booking.

CREATE TABLE IF NOT EXISTS ai_booking_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_date DATE NOT NULL,
  time_window TEXT NOT NULL, -- '8-10', '10-12', '12-2', '2-4', '4-6'
  service_type TEXT NOT NULL, -- 'junk_removal', 'dumpster_rental', etc.
  customer_name TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  description TEXT,
  ghl_contact_id TEXT,
  ghl_opportunity_id TEXT,
  source TEXT DEFAULT 'kai_voice', -- 'kai_voice', 'kai_chat', 'sms'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_slots_date ON ai_booking_slots(booking_date, time_window);

ALTER TABLE ai_booking_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_booking_slots" ON ai_booking_slots FOR ALL TO service_role USING (true) WITH CHECK (true);
