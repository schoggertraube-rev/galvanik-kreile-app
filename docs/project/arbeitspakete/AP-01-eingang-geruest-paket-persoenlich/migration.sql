-- AP-01 Eingang-Datenfundament (Kanal Paket/persoenlich, getippt).
-- Additiv. Keine Seed-/Produktionsdaten. Konvention wie 20261025182920_s1_p1_datenfundament.sql.
-- Kern des Eingang-Datenmodells; weitere Tabellen (intake_file/_suggestion, device_request,
-- goods_receipt) folgen in den Kanal-Paketen Scan/Foto/Ware/Mail.

CREATE TABLE public.intake_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  client_key text NOT NULL,
  kanal text NOT NULL,
  richtung text NOT NULL DEFAULT 'rein',
  quelle text NOT NULL,
  erstellt_am timestamptz NOT NULL DEFAULT statement_timestamp(),
  erstellt_von uuid NOT NULL,
  erstellt_auf text,
  empfangen_am timestamptz,
  absender_name text,
  absender_adresse text,
  betreff text,
  text text,
  text_sprache text,
  kunde_id uuid REFERENCES public.customers(id) ON DELETE RESTRICT,
  vorgang_art text,
  vorgang_id text,
  zuordnung text NOT NULL DEFAULT 'offen',
  zuordnung_grund text,
  einsatz text NOT NULL DEFAULT 'offen',
  geaendert_von uuid,
  geaendert_am timestamptz,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT intake_item_client_key_uidx UNIQUE (tenant_id, client_key),
  CONSTRAINT intake_item_kanal_chk CHECK (kanal IN ('mail','notiz','foto','datei','scan','weitergeleitet','system')),
  CONSTRAINT intake_item_richtung_chk CHECK (richtung IN ('rein','raus','intern')),
  CONSTRAINT intake_item_quelle_chk CHECK (quelle IN ('app','outlook','geraet','mailabruf')),
  CONSTRAINT intake_item_vorgang_art_chk CHECK (vorgang_art IS NULL OR vorgang_art IN ('kv','auftrag','rechnung')),
  CONSTRAINT intake_item_zuordnung_chk CHECK (zuordnung IN ('offen','automatisch','bestaetigt','hand')),
  CONSTRAINT intake_item_einsatz_chk CHECK (einsatz IN ('offen','erledigt','info')),
  CONSTRAINT intake_item_text_chk CHECK (text IS NULL OR length(text) <= 20000),
  CONSTRAINT intake_item_vorgang_pair_chk CHECK ((vorgang_art IS NULL) = (vorgang_id IS NULL))
);

ALTER TABLE public.intake_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY intake_item_tenant_isolation ON public.intake_item
  USING (tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), ''))
  WITH CHECK (tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), ''));
REVOKE ALL ON TABLE public.intake_item FROM PUBLIC, anon, authenticated;
-- Kein DELETE (Spec daten.intake_item.regeln: Stufe 1 ohne Loeschung).
GRANT SELECT, INSERT, UPDATE ON TABLE public.intake_item TO service_role;

CREATE INDEX intake_item_tenant_kunde_idx ON public.intake_item (tenant_id, kunde_id);
CREATE INDEX intake_item_tenant_vorgang_idx ON public.intake_item (tenant_id, vorgang_art, vorgang_id);

CREATE TABLE public.intake_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  item_id uuid NOT NULL REFERENCES public.intake_item(id) ON DELETE RESTRICT,
  zeit timestamptz NOT NULL DEFAULT statement_timestamp(),
  art text NOT NULL,
  befehl_id uuid NOT NULL,
  von text NOT NULL,
  vorher jsonb,
  nachher jsonb,
  geraet_id text,
  CONSTRAINT intake_event_art_chk CHECK (art IN (
    'angelegt','original_gespeichert','erkannt','zugeordnet','umgehaengt','anliegen',
    'einsatz','gesendet','sendefehler','ware','wieder_geoeffnet','zurueckgenommen',
    'datei_zu_gross','fotos_nachgereicht'))
);

ALTER TABLE public.intake_event ENABLE ROW LEVEL SECURITY;
CREATE POLICY intake_event_tenant_isolation ON public.intake_event
  USING (tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), ''))
  WITH CHECK (tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), ''));
REVOKE ALL ON TABLE public.intake_event FROM PUBLIC, anon, authenticated;
-- Nur anhaengen: kein UPDATE, kein DELETE.
GRANT SELECT, INSERT ON TABLE public.intake_event TO service_role;

CREATE INDEX intake_event_item_idx ON public.intake_event (tenant_id, item_id, zeit);
