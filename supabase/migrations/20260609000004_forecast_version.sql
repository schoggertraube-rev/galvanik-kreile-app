-- FK auf employee wird in separater Folge-Migration
-- ergänzt, sobald die referenzierte Tabelle aus paralleler Arbeit
-- final benannt und vorhanden ist. NICHT eigenmächtig hinzufügen.

CREATE TABLE forecast_version (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       TEXT NOT NULL,
  jahr            INT NOT NULL,
  monat           INT,                  -- NULL = Jahresforecast
  version_typ     TEXT NOT NULL,        -- 'plan' | 'rolling' | 'eingereicht' | 'genehmigt' | 'ist'
  erstellt_am     TIMESTAMPTZ DEFAULT NOW(),
  erstellt_von    UUID,                 -- NO REFERENCES YET
  basis_data      JSONB NOT NULL,       -- Snapshot der Eingangsgrößen
  werte           JSONB NOT NULL,       -- Forecast-KPIs als Struktur
  bemerkung       TEXT,
  ist_aktiv       BOOLEAN DEFAULT FALSE -- nur eine pro (jahr,monat,version_typ)
);

CREATE INDEX idx_forecast_version_tenant ON forecast_version(tenant_id);
