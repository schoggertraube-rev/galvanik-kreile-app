CREATE TABLE arbeitszeit_buchung (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   text NOT NULL,
  auftrag_id                  text NOT NULL REFERENCES orders(id),
  employee_id                 uuid NOT NULL REFERENCES app_users(id),
  kostenstelle_kuerzel        text NOT NULL,
  station_kuerzel             text NOT NULL,
  start_zeit                  timestamptz NOT NULL,
  end_zeit                    timestamptz,                -- NULL = läuft noch
  dauer_minuten               integer NOT NULL,           -- berechnet bei Stop
  kostensatz_eur_pro_stunde   numeric(8,2) NOT NULL,      -- Snapshot
  erfasst_modus               text NOT NULL,              -- 'live_timer' | 'rueckwirkend' | 'aus_vorlage' | 'manuell'
  war_aus_vorlage             boolean DEFAULT false,
  vorlage_id                  uuid,                       -- FK vorlage_zeit(id), nullable
  bemerkung                   text,
  erstellt_am                 timestamptz DEFAULT now(),
  aktualisiert_am             timestamptz DEFAULT now()
);

CREATE INDEX idx_arbeitszeit_auftrag ON arbeitszeit_buchung(auftrag_id);

CREATE INDEX idx_arbeitszeit_employee_monat ON arbeitszeit_buchung(employee_id, start_zeit);

CREATE INDEX idx_arbeitszeit_kostenstelle_monat ON arbeitszeit_buchung(kostenstelle_kuerzel, start_zeit);
