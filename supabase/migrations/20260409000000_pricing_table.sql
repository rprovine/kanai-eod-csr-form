-- Centralized pricing table — single source of truth for all AI systems.
-- Replaces the static pricing.json files mirrored across repos.
-- Read by: Kai voice (knowledge_base.py), SMS AI (ai-client.js), estimator tool

CREATE TABLE IF NOT EXISTS pricing (
  id TEXT PRIMARY KEY,              -- e.g. 'jr_minimum', 'dr_15yd_short', 'env_freon'
  category TEXT NOT NULL,           -- 'junk_removal', 'dumpster_rental', 'environmental', 'specialty', 'labor'
  label TEXT NOT NULL,              -- human-readable label
  amount NUMERIC,                   -- dollar amount (null if not a price)
  amount_max NUMERIC,               -- upper range (null if single price)
  unit TEXT,                        -- 'each', 'per_lb', 'per_ton', 'per_hour', etc.
  notes TEXT,                       -- restrictions, descriptions
  sort_order INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: service role full access, anon read-only
ALTER TABLE pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_pricing" ON pricing FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "anon_read_pricing" ON pricing FOR SELECT TO anon USING (active = true);

COMMENT ON TABLE pricing IS 'Centralized pricing for all Kanai AI systems. Edit here, all systems pick up changes without redeploy.';
