CREATE TABLE IF NOT EXISTS webhook_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source text NOT NULL,
  payload jsonb,
  received_at timestamptz DEFAULT now()
);

ALTER TABLE webhook_log ENABLE ROW LEVEL SECURITY;
