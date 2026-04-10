-- Stores Docket webhook events with scheduled dates for DR schedule preview.
-- Queried by the nightly ops agent to show tomorrow's dumpster stops.
CREATE TABLE IF NOT EXISTS docket_scheduled_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  docket_id TEXT NOT NULL,
  customer_name TEXT,
  job_address TEXT,
  asset_type TEXT,       -- e.g. "15yd", "20yd", "25yd"
  stop_type TEXT,        -- e.g. "delivery", "pickup", "swap"
  driver_name TEXT,
  scheduled_date DATE,
  price NUMERIC(10,2),
  status TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(docket_id, scheduled_date)
);

CREATE INDEX idx_docket_stops_date ON docket_scheduled_stops(scheduled_date);

ALTER TABLE docket_scheduled_stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_docket_stops" ON docket_scheduled_stops FOR SELECT TO anon USING (true);
