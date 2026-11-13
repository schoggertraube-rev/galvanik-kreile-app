-- S05K A6, PL 12.11 18:21/19:45: salted IP counters only in the existing PIN writer.
CREATE TABLE private.pin_ip_rate_limits (
  tenant_id text NOT NULL,
  ip_hash text NOT NULL CHECK (ip_hash ~ '^[a-f0-9]{64}$'),
  window_start timestamptz NOT NULL,
  failed_attempts integer NOT NULL CHECK (failed_attempts BETWEEN 1 AND 50),
  PRIMARY KEY (tenant_id,ip_hash,window_start),
  CHECK (extract(epoch FROM window_start)::bigint % 3600 = 0)
);
ALTER TABLE private.pin_ip_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.pin_ip_rate_limits FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON private.pin_ip_rate_limits TO service_role;
