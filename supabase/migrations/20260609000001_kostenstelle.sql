-- FK auf capacity_center wird in separater Folge-Migration
-- ergänzt, sobald die referenzierte Tabelle aus paralleler Arbeit
-- final benannt und vorhanden ist. NICHT eigenmächtig hinzufügen.

CREATE TABLE kostenstelle (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       TEXT NOT NULL,
  kuerzel         TEXT NOT NULL,         -- z.B. SCH, GAL, POL, QS, VER, BUERO, ENERGIE
  name            TEXT NOT NULL,
  typ             TEXT NOT NULL,         -- 'produktion' | 'verwaltung' | 'vertrieb' | 'energie' | 'gebaeude'
  capacity_center_id UUID,               -- NO REFERENCES YET
  ist_aktiv       BOOLEAN DEFAULT TRUE,
  geplante_personalkosten_monatlich NUMERIC(12,2),
  geplante_sachkosten_monatlich     NUMERIC(12,2),
  verfuegbare_stunden_monatlich     NUMERIC(8,2),
  notiz           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, kuerzel)
)

CREATE INDEX idx_kostenstelle_tenant ON kostenstelle(tenant_id)
