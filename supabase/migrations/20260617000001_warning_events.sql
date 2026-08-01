CREATE TABLE IF NOT EXISTS warning_event (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text NOT NULL,
  typ             text NOT NULL,
  titel           text NOT NULL,
  beschreibung    text NOT NULL,
  schwere         text NOT NULL,      -- 'info' | 'warnung' | 'kritisch'
  payload         jsonb,
  link            text,               -- z.B. '/buchhaltung/belege?filter=aging_60'
  erzeugt_am      timestamptz DEFAULT NOW(),
  dismissed_am    timestamptz,
  dismissed_von   uuid,
  begruendung     text,               -- Pflichtfeld beim Dismiss
  suppress_bis    timestamptz         -- nach Dismiss: 7 Tage Ruhe
)

CREATE INDEX IF NOT EXISTS idx_warning_tenant_aktiv
  ON warning_event(tenant_id, dismissed_am)
  WHERE dismissed_am IS NULL
