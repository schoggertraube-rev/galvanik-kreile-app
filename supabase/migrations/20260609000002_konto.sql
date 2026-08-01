CREATE TABLE konto (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       TEXT NOT NULL,
  nummer          TEXT NOT NULL,         -- SKR03/SKR04-kompatibel
  bezeichnung     TEXT NOT NULL,
  kategorie       TEXT NOT NULL,         -- 'erloes' | 'erloesminderung' | 'wareneinsatz' | 'personal' | 'sachkosten' | 'energie' | 'abschreibung' | 'steuer' | 'forderung' | 'verbindlichkeit' | 'bank' | 'kasse' | 'eigenkapital'
  ist_erfolgskonto BOOLEAN NOT NULL,
  steuerprofil_id UUID REFERENCES steuerprofil(id),
  externes_konto_lexware TEXT,
  externes_konto_datev   TEXT,
  ist_aktiv       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, nummer)
)

CREATE INDEX idx_konto_tenant ON konto(tenant_id)
