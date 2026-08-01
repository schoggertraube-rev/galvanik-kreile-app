CREATE TABLE teile_klassifikator (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text NOT NULL,
  klasse          text NOT NULL,
  keywords        text[] NOT NULL,
  beispiel_oberflaechen text[],
  UNIQUE (tenant_id, klasse)
)

CREATE INDEX idx_teile_klassifikator_tenant ON teile_klassifikator(tenant_id)
