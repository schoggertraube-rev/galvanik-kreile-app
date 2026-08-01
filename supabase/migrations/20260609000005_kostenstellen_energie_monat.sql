CREATE TABLE kostenstellen_energie_monat (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               TEXT NOT NULL,
  kostenstelle_id         UUID REFERENCES kostenstelle(id),
  monat                   DATE NOT NULL,
  energie_eur_pro_stunde  NUMERIC(8,2) NOT NULL,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, kostenstelle_id, monat)
)

CREATE INDEX idx_kostenstellen_energie_monat_tenant ON kostenstellen_energie_monat(tenant_id)
