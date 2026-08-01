CREATE TABLE vorlage_zeit (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                text NOT NULL,
  schluessel               text NOT NULL,           -- siehe Ähnlichkeitslogik 4.1
  teilekategorie           text,
  oberflaeche              text,
  station_kuerzel          text NOT NULL,
  median_minuten           numeric(8,2) NOT NULL,
  p25_minuten              numeric(8,2),
  p75_minuten              numeric(8,2),
  n_referenzauftraege      integer NOT NULL,
  letzte_aktualisierung    timestamptz DEFAULT now(),
  UNIQUE (tenant_id, schluessel, station_kuerzel)
)

ALTER TABLE arbeitszeit_buchung ADD CONSTRAINT fk_arbeitszeit_vorlage_id FOREIGN KEY (vorlage_id) REFERENCES vorlage_zeit(id)
