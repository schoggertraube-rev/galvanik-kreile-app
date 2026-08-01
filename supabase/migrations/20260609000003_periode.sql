-- FK auf employee wird in separater Folge-Migration
-- ergänzt, sobald die referenzierte Tabelle aus paralleler Arbeit
-- final benannt und vorhanden ist. NICHT eigenmächtig hinzufügen.

CREATE TABLE periode (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       TEXT NOT NULL,
  jahr            INT NOT NULL,
  monat           INT NOT NULL,         -- 1..12
  status          TEXT NOT NULL,        -- 'offen' | 'in_arbeit' | 'vorlaeufig_geschlossen' | 'final_geschlossen'
  geschlossen_am  TIMESTAMPTZ,
  geschlossen_von UUID,                 -- NO REFERENCES YET
  bemerkung       TEXT,
  UNIQUE (tenant_id, jahr, monat)
);

CREATE INDEX idx_periode_tenant ON periode(tenant_id);
