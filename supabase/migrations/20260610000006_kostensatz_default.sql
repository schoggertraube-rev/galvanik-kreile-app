CREATE TABLE kostensatz_default (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          text NOT NULL,
  station_kuerzel    text NOT NULL,
  eur_pro_stunde     numeric(8,2) NOT NULL,
  gilt_ab            date NOT NULL,
  bemerkung          text,
  UNIQUE (tenant_id, station_kuerzel, gilt_ab)
)
