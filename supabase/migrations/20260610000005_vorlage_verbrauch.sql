CREATE TABLE vorlage_verbrauch (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                text NOT NULL,
  schluessel               text NOT NULL,
  teilekategorie           text,
  oberflaeche              text,
  station_kuerzel          text NOT NULL,
  inventory_item_id        text NOT NULL REFERENCES inventory_items(id),
  einheit_normiert         text NOT NULL,
  median_menge             numeric(10,4) NOT NULL,
  p25_menge                numeric(10,4),
  p75_menge                numeric(10,4),
  n_referenzauftraege      integer NOT NULL,
  haeufigkeit_prozent      numeric(5,2),            -- in wieviel % der Aufträge dieser Klasse benutzt
  letzte_aktualisierung    timestamptz DEFAULT now(),
  UNIQUE (tenant_id, schluessel, station_kuerzel, inventory_item_id)
)

ALTER TABLE stock_movements ADD CONSTRAINT fk_stock_movements_vorlage_id FOREIGN KEY (vorlage_id) REFERENCES vorlage_verbrauch(id)
