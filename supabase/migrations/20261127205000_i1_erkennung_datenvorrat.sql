ALTER TABLE public.intake_suggestion
  ADD COLUMN sicherheit_wert numeric CHECK (sicherheit_wert BETWEEN 0 AND 1),
  ADD COLUMN modell text CHECK (modell ~ '^[a-z0-9-]{3,64}$');

ALTER TABLE public.intake_file
  ADD COLUMN erkennung_roh_pfad text,
  ADD COLUMN seiten integer CHECK (seiten > 0);

CREATE OR REPLACE FUNCTION private.protect_intake_original()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $fn$
BEGIN
  IF ROW(NEW.id, NEW.tenant_id, NEW.item_id, NEW.client_key, NEW.art, NEW.abgeleitet_von, NEW.dateiname,
         NEW.mime, NEW.bytes, NEW.sha256, NEW.speicherpfad, NEW.aufgenommen_am, NEW.aufgenommen_von,
         NEW.aufgenommen_auf, NEW.reihenfolge, NEW.aufnahme_herkunft)
    IS DISTINCT FROM
     ROW(OLD.id, OLD.tenant_id, OLD.item_id, OLD.client_key, OLD.art, OLD.abgeleitet_von, OLD.dateiname,
         OLD.mime, OLD.bytes, OLD.sha256, OLD.speicherpfad, OLD.aufgenommen_am, OLD.aufgenommen_von,
         OLD.aufgenommen_auf, OLD.reihenfolge, OLD.aufnahme_herkunft)
    OR (OLD.foto_art IS NOT NULL AND NEW.foto_art IS DISTINCT FROM OLD.foto_art)
  THEN
    RAISE EXCEPTION 'INTAKE_ORIGINAL_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION private.s16d_spur_d_standardwerte() RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog
AS $$
  SELECT '{
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
  ADD COLUMN erkennung_modelle jsonb NOT NULL DEFAULT (private.s16d_spur_d_standardwerte()->'erkennung_modelle'),
  ADD CONSTRAINT company_settings_i1_erkennung_modelle_chk CHECK (
    CASE WHEN jsonb_typeof(erkennung_modelle) = 'object' THEN
      erkennung_modelle ?& ARRAY['dokument','rechnung','bon']
      AND erkennung_modelle - ARRAY['dokument','rechnung','bon'] = '{}'::jsonb
      AND (erkennung_modelle->'dokument' = 'null'::jsonb
        OR (jsonb_typeof(erkennung_modelle->'dokument') = 'string' AND erkennung_modelle->>'dokument' ~ '^[a-z0-9-]{3,64}$'))
      AND (erkennung_modelle->'rechnung' = 'null'::jsonb
        OR (jsonb_typeof(erkennung_modelle->'rechnung') = 'string' AND erkennung_modelle->>'rechnung' ~ '^[a-z0-9-]{3,64}$'))
      AND (erkennung_modelle->'bon' = 'null'::jsonb
        OR (jsonb_typeof(erkennung_modelle->'bon') = 'string' AND erkennung_modelle->>'bon' ~ '^[a-z0-9-]{3,64}$'))
    ELSE false END
  );
