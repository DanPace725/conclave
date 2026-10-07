CREATE SCHEMA IF NOT EXISTS app;
CREATE TABLE app.handoff_events (
  owner_id text NOT NULL,
  seq bigint NOT NULL,
  data jsonb NOT NULL,
  PRIMARY KEY (owner_id, seq)
);
CREATE TABLE app.mcp_locks (key text PRIMARY KEY);
CREATE TABLE app.mcp_records (
  key text PRIMARY KEY,
  owner_id text,
  data jsonb NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX mcp_records_owner ON app.mcp_records (owner_id);
CREATE INDEX mcp_records_expiry ON app.mcp_records (expires_at);
CREATE FUNCTION app.handoff_events_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'handoff events are append-only';
END;
$$;
CREATE TRIGGER handoff_events_immutable BEFORE UPDATE OR DELETE ON app.handoff_events
FOR EACH ROW EXECUTE FUNCTION app.handoff_events_immutable();
