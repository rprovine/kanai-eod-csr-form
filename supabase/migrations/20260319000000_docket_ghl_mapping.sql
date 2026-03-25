-- Docket task number to GHL opportunity mapping (mirrors workiz_ghl_mapping)
-- Populated by the Docket webhook; read by prefill to auto-fill DR job numbers
CREATE TABLE IF NOT EXISTS docket_ghl_mapping (
  docket_task_number TEXT PRIMARY KEY,
  ghl_opportunity_id TEXT NOT NULL,
  customer_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_docket_ghl_opp ON docket_ghl_mapping(ghl_opportunity_id);

ALTER TABLE docket_ghl_mapping ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_docket_mapping" ON docket_ghl_mapping FOR SELECT TO anon USING (true);
