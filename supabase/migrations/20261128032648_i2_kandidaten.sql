-- I2: settings reuse the same defaults and existing intake records.
CREATE OR REPLACE FUNCTION private.s16d_spur_d_standardwerte() RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog
AS $$
  SELECT '{
    "eingang_vorschlaege_max": 3,
    "eingang_liegefrist_arbeitsstunden": 24,
    "eingang_kandidat_stufen": {"ustid":1.0,"adresse":1.0,"domain":0.8,"telefon":0.8,"name":0.6,"mailfaden":1.0,"teil":0.8,"ware_erwartet":0.6},
    "eingang_verdacht_muster": ["link","qr"],
    "offline_max_stunden": 24,
    "geraetefreigabe_aktiv": true,
    "automatische_inventur_aktiv": false,
    "material_aufschlag_prozent": null,
    "lager_regelversion": null,
    "entnahme_regel_je_rubrik": {},
    "bezugskosten_einbeziehen": false,
    "bilanzbewertung_methode": "hoechster_ek",
    "ausschuss_berechnen": false,
    "anhang_max_mb": 25,
    "mime_original_max_mb": 35,
    "sicherung_hoechstalter_stunden": 36,
    "wiederherstellungstest_hoechstalter_tage": 30,
    "sicherung_min_prozent_vortag": 60,
    "sicherungsort": null,
    "betrieb_messgrenzen": [],
    "dienst_ausfall_toleranz_stunden": 2,
    "mahnstufen_tage_nach_faelligkeit": [3,10,21],
    "mahnung_letzte_zahlfrist_tage": 10,
    "zahlungsmuster_beobachtungsmonate": 12,
    "zahlungsmuster_min_rechnungen": 3,
    "vorkasse_startgrenzen_cent": {"privat":50000,"gewerbe":200000,"oldtimer_kunst":150000},
    "zahlungsanbieter": null,
    "vorkasse_spaet_min_rechnungen": 2,
    "vorkasse_spaet_tage": 30,
    "vorkasse_eskalation_mahnstufe": 2,
    "vorkasse_aufhebung_puenktliche_zahlungen": 6,
    "skonto_fehlzug_min": 2,
    "metal_price_source": "metals_dev",
    "metal_price_fallback_source": null,
    "kursabruf_uhrzeit": "06:30",
    "kursabweichung_prozent": 3,
    "kursabrufe_max_pro_monat": 100,
    "kursstichtag": "leistungsdatum",
    "kurs_metalle": ["gold", "silber", "palladium", "rhodium"],
    "metallzuschlag_prozent": null,
    "verlustzuschlag_prozent": null,
    "metall_mengendifferenz_warnung_prozent": null,
    "kursklausel_freigabe": null,
    "akzentfarbe": "#13714f",
    "abweichungskategorien": [{"id":"menge","name":"Menge"},{"id":"zusatzarbeit","name":"Zusatzarbeit"},{"id":"schaden","name":"Schaden"},{"id":"material_weg","name":"Material/Weg"},{"id":"kunde_preis_termin","name":"Kunde/Preis/Termin"},{"id":"ort","name":"Ort"},{"id":"rueckgabe","name":"Rückgabe"}],
    "nachfassfrist_gegenvorschlag_arbeitstage": 2,
    "termintreue_ziel_prozent": null,
    "werkstatt_wochenziel_auftraege": 25,
    "liquiditaet_mindest_tage": 30,
    "max_aktive_ziele": 3,
    "sicherheitsreserve_cent": null,
    "app_start_datum": null,
    "steuerberater_email": null,
    "berater_stundensatz_cent": 12000,
    "berater_minuten_pro_beleg": 4,
    "bank_email": null,
    "unzugeordnete_nachrichten_loeschfrist_monate": 24,
    "kanal_zielgeraete": ["firmengeraete"],
    "kanal_aufbewahrung": "GoBD",
    "ki_sicherheitsschwelle": null,
    "erkennung_modelle": {"dokument":"prebuilt-layout","rechnung":"prebuilt-invoice","bon":"prebuilt-receipt"},
    "annahme_zustaende": [
      {"id":"transportschaden","name":"Transportschaden"},
      {"id":"rost","name":"Rost"},
      {"id":"delle","name":"Delle"},
      {"id":"kratzer","name":"Kratzer"},
      {"id":"teil_fehlt","name":"Teil fehlt"}
    ],
    "suchalias_gruppen": [],
    "energie_pauschale_cent_je_verfahren": {},
    "betriebsruhe": [],
    "versandpuffer_arbeitstage": 2,
    "werkstatt_zeitwahl": {"rasterMinuten": 15, "maximalMinuten": 600, "schnellwahlMinuten": [30, 60, 120, 240, 480]},
    "werkstatt_zeit_kostenstellen": {},
    "nacharbeit_ursachen": [
      {"ursacheId": "material-vorbehandlung", "name": "Material/Vorbehandlung", "aktiv": true},
      {"ursacheId": "bad-prozess", "name": "Bad/Prozess", "aktiv": true},
      {"ursacheId": "handling-transport", "name": "Handling/Transport", "aktiv": true},
      {"ursacheId": "kundenvorgabe", "name": "Kundenvorgabe", "aktiv": true},
      {"ursacheId": "sonstiges", "name": "Sonstiges", "aktiv": true}
    ]
  }'::jsonb
$$;

ALTER TABLE public.company_settings
  ADD COLUMN eingang_vorschlaege_max integer NOT NULL
    DEFAULT (private.s16d_spur_d_standardwerte()->>'eingang_vorschlaege_max')::integer,
  ADD COLUMN eingang_liegefrist_arbeitsstunden integer NOT NULL
    DEFAULT (private.s16d_spur_d_standardwerte()->>'eingang_liegefrist_arbeitsstunden')::integer,
  ADD COLUMN eingang_kandidat_stufen jsonb NOT NULL
    DEFAULT (private.s16d_spur_d_standardwerte()->'eingang_kandidat_stufen'),
  ADD COLUMN eingang_verdacht_muster jsonb NOT NULL
    DEFAULT (private.s16d_spur_d_standardwerte()->'eingang_verdacht_muster'),
  ADD CONSTRAINT company_settings_i2_vorschlaege_max_chk CHECK (eingang_vorschlaege_max BETWEEN 1 AND 3),
  ADD CONSTRAINT company_settings_i2_liegefrist_chk CHECK (eingang_liegefrist_arbeitsstunden BETWEEN 1 AND 720),
  ADD CONSTRAINT company_settings_i2_kandidat_stufen_chk CHECK (
    CASE WHEN jsonb_typeof(eingang_kandidat_stufen)='object' THEN
      eingang_kandidat_stufen ?& ARRAY['ustid','adresse','domain','telefon','name','mailfaden','teil','ware_erwartet']
      AND eingang_kandidat_stufen - ARRAY['ustid','adresse','domain','telefon','name','mailfaden','teil','ware_erwartet'] = '{}'::jsonb
      AND jsonb_path_match(eingang_kandidat_stufen, '$.ustid.type() == "number" && $.ustid >= 0 && $.ustid <= 1')
      AND jsonb_path_match(eingang_kandidat_stufen, '$.adresse.type() == "number" && $.adresse >= 0 && $.adresse <= 1')
      AND jsonb_path_match(eingang_kandidat_stufen, '$.domain.type() == "number" && $.domain >= 0 && $.domain <= 1')
      AND jsonb_path_match(eingang_kandidat_stufen, '$.telefon.type() == "number" && $.telefon >= 0 && $.telefon <= 1')
      AND jsonb_path_match(eingang_kandidat_stufen, '$.name.type() == "number" && $.name >= 0 && $.name <= 1')
      AND jsonb_path_match(eingang_kandidat_stufen, '$.mailfaden.type() == "number" && $.mailfaden >= 0 && $.mailfaden <= 1')
      AND jsonb_path_match(eingang_kandidat_stufen, '$.teil.type() == "number" && $.teil >= 0 && $.teil <= 1')
      AND jsonb_path_match(eingang_kandidat_stufen, '$.ware_erwartet.type() == "number" && $.ware_erwartet >= 0 && $.ware_erwartet <= 1')
    ELSE false END),
  ADD CONSTRAINT company_settings_i2_verdacht_muster_chk CHECK (
    jsonb_typeof(eingang_verdacht_muster)='array'
    AND NOT jsonb_path_exists(eingang_verdacht_muster, '$[*] ? (@.type() != "string" || @ == "")'));

ALTER TABLE public.intake_event
  DROP CONSTRAINT intake_event_art_chk,
  ADD CONSTRAINT intake_event_art_chk CHECK (art IN (
    'angelegt','original_gespeichert','erkannt','zugeordnet','umgehaengt','anliegen',
    'einsatz','gesendet','sendefehler','ware','wieder_geoeffnet','zurueckgenommen',
    'datei_zu_gross','fotos_nachgereicht','korrigiert'));

ALTER TABLE public.intake_file
  ADD COLUMN phase text CHECK (phase IN ('eingang','arbeit','fertig','mehrarbeit','reklamation')),
  ADD COLUMN werbefreigabe boolean NOT NULL DEFAULT false;

CREATE VIEW public.v_eingang_vorgaenge_v1 WITH (security_invoker = true) AS
SELECT 'auftrag'::text AS art, o.id::text AS id, o.order_number::text AS nummer,
  o.customer_id::text, o.task::text AS titel,
  ARRAY(SELECT item.name FROM public.items item
    WHERE item.tenant_id=o.tenant_id AND item.order_id=o.id ORDER BY item.created_at,item.id) AS teile,
  o.intake_term_status AS term_status, o.created_at AT TIME ZONE 'UTC' AS erstellt_am
FROM public.orders o
WHERE o.tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),'')
  AND o.is_quote IS NOT TRUE AND o.status IN ('angenommen','galvanik','fertig')
UNION ALL
SELECT 'kv', q.quote_id::text, q.quote_number::text, q.customer_id::text,
  q.positions->0->>'name',
  ARRAY(SELECT zeile->>'name' FROM jsonb_array_elements(q.positions) zeile
    WHERE jsonb_typeof(zeile->'name')='string'),
  q.intake_term_status, q.created_at
FROM private.v_open_quotes_v1 q
WHERE q.tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),'');

REVOKE ALL ON public.v_eingang_vorgaenge_v1 FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.v_eingang_vorgaenge_v1 TO service_role;
