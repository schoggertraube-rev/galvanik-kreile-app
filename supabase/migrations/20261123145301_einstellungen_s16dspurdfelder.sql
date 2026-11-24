-- D12b: Felder am bestehenden mandantengebundenen Firmendatensatz.
-- Dieselben Standardwerte gelten für Altzeilen, neue Zeilen und Mandanten ohne Firmendatensatz.
CREATE FUNCTION private.s16d_spur_d_standardwerte() RETURNS jsonb
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
  ADD COLUMN offline_max_stunden integer NOT NULL DEFAULT ((private.s16d_spur_d_standardwerte()->>'offline_max_stunden')::integer),
  ADD COLUMN geraetefreigabe_aktiv boolean NOT NULL DEFAULT ((private.s16d_spur_d_standardwerte()->>'geraetefreigabe_aktiv')::boolean),
  ADD COLUMN automatische_inventur_aktiv boolean NOT NULL DEFAULT ((private.s16d_spur_d_standardwerte()->>'automatische_inventur_aktiv')::boolean),
  ADD COLUMN material_aufschlag_prozent numeric,
  ADD COLUMN lager_regelversion text,
  ADD COLUMN entnahme_regel_je_rubrik jsonb NOT NULL DEFAULT (private.s16d_spur_d_standardwerte()->'entnahme_regel_je_rubrik'),
  ADD COLUMN bezugskosten_einbeziehen boolean NOT NULL DEFAULT ((private.s16d_spur_d_standardwerte()->>'bezugskosten_einbeziehen')::boolean),
  ADD COLUMN bilanzbewertung_methode text NOT NULL DEFAULT (private.s16d_spur_d_standardwerte()->>'bilanzbewertung_methode'),
  ADD COLUMN ausschuss_berechnen boolean NOT NULL DEFAULT ((private.s16d_spur_d_standardwerte()->>'ausschuss_berechnen')::boolean),
  ADD COLUMN anhang_max_mb integer NOT NULL DEFAULT ((private.s16d_spur_d_standardwerte()->>'anhang_max_mb')::integer),
  ADD COLUMN mime_original_max_mb integer NOT NULL DEFAULT ((private.s16d_spur_d_standardwerte()->>'mime_original_max_mb')::integer),
  ADD COLUMN betriebsruhe jsonb NOT NULL DEFAULT (private.s16d_spur_d_standardwerte()->'betriebsruhe'),
  ADD COLUMN versandpuffer_arbeitstage integer NOT NULL DEFAULT ((private.s16d_spur_d_standardwerte()->>'versandpuffer_arbeitstage')::integer),
  ADD COLUMN werkstatt_zeitwahl jsonb NOT NULL DEFAULT (private.s16d_spur_d_standardwerte()->'werkstatt_zeitwahl'),
  ADD COLUMN werkstatt_zeit_kostenstellen jsonb NOT NULL DEFAULT (private.s16d_spur_d_standardwerte()->'werkstatt_zeit_kostenstellen'),
  ADD COLUMN nacharbeit_ursachen jsonb NOT NULL DEFAULT (private.s16d_spur_d_standardwerte()->'nacharbeit_ursachen'),
  ADD COLUMN sicherung_hoechstalter_stunden integer NOT NULL DEFAULT ((private.s16d_spur_d_standardwerte()->>'sicherung_hoechstalter_stunden')::integer),
  ADD COLUMN wiederherstellungstest_hoechstalter_tage integer NOT NULL DEFAULT ((private.s16d_spur_d_standardwerte()->>'wiederherstellungstest_hoechstalter_tage')::integer),
  ADD COLUMN sicherung_min_prozent_vortag integer NOT NULL DEFAULT ((private.s16d_spur_d_standardwerte()->>'sicherung_min_prozent_vortag')::integer),
  ADD COLUMN sicherungsort text DEFAULT (private.s16d_spur_d_standardwerte()->>'sicherungsort'),
  ADD COLUMN betrieb_messgrenzen jsonb NOT NULL DEFAULT (private.s16d_spur_d_standardwerte()->'betrieb_messgrenzen'),
  ADD COLUMN dienst_ausfall_toleranz_stunden integer NOT NULL DEFAULT ((private.s16d_spur_d_standardwerte()->>'dienst_ausfall_toleranz_stunden')::integer),
  ADD COLUMN mahnstufen_tage_nach_faelligkeit jsonb NOT NULL DEFAULT (private.s16d_spur_d_standardwerte()->'mahnstufen_tage_nach_faelligkeit'),
  ADD COLUMN mahnung_letzte_zahlfrist_tage integer NOT NULL DEFAULT ((private.s16d_spur_d_standardwerte()->>'mahnung_letzte_zahlfrist_tage')::integer),
  ADD COLUMN zahlungsmuster_beobachtungsmonate integer NOT NULL DEFAULT ((private.s16d_spur_d_standardwerte()->>'zahlungsmuster_beobachtungsmonate')::integer),
  ADD COLUMN zahlungsmuster_min_rechnungen integer NOT NULL DEFAULT ((private.s16d_spur_d_standardwerte()->>'zahlungsmuster_min_rechnungen')::integer),
  ADD COLUMN vorkasse_startgrenzen_cent jsonb NOT NULL DEFAULT (private.s16d_spur_d_standardwerte()->'vorkasse_startgrenzen_cent'),
  ADD COLUMN zahlungsanbieter text DEFAULT (private.s16d_spur_d_standardwerte()->>'zahlungsanbieter'),
  ADD COLUMN vorkasse_spaet_min_rechnungen integer NOT NULL DEFAULT ((private.s16d_spur_d_standardwerte()->>'vorkasse_spaet_min_rechnungen')::integer),
  ADD COLUMN vorkasse_spaet_tage integer NOT NULL DEFAULT ((private.s16d_spur_d_standardwerte()->>'vorkasse_spaet_tage')::integer),
  ADD COLUMN vorkasse_eskalation_mahnstufe integer NOT NULL DEFAULT ((private.s16d_spur_d_standardwerte()->>'vorkasse_eskalation_mahnstufe')::integer),
  ADD COLUMN vorkasse_aufhebung_puenktliche_zahlungen integer NOT NULL DEFAULT ((private.s16d_spur_d_standardwerte()->>'vorkasse_aufhebung_puenktliche_zahlungen')::integer),
  ADD COLUMN skonto_fehlzug_min integer NOT NULL DEFAULT ((private.s16d_spur_d_standardwerte()->>'skonto_fehlzug_min')::integer),
  ADD COLUMN metal_price_source text NOT NULL DEFAULT (private.s16d_spur_d_standardwerte()->>'metal_price_source'),
  ADD COLUMN metal_price_fallback_source text DEFAULT (private.s16d_spur_d_standardwerte()->>'metal_price_fallback_source'),
  ADD COLUMN kursabruf_uhrzeit text NOT NULL DEFAULT (private.s16d_spur_d_standardwerte()->>'kursabruf_uhrzeit'),
  ADD COLUMN kursabweichung_prozent numeric NOT NULL DEFAULT ((private.s16d_spur_d_standardwerte()->>'kursabweichung_prozent')::numeric),
  ADD COLUMN kursabrufe_max_pro_monat integer NOT NULL DEFAULT ((private.s16d_spur_d_standardwerte()->>'kursabrufe_max_pro_monat')::integer),
  ADD COLUMN kursstichtag text NOT NULL DEFAULT (private.s16d_spur_d_standardwerte()->>'kursstichtag'),
  ADD COLUMN kurs_metalle jsonb NOT NULL DEFAULT (private.s16d_spur_d_standardwerte()->'kurs_metalle'),
  ADD COLUMN metallzuschlag_prozent numeric DEFAULT ((private.s16d_spur_d_standardwerte()->>'metallzuschlag_prozent')::numeric),
  ADD COLUMN verlustzuschlag_prozent numeric DEFAULT ((private.s16d_spur_d_standardwerte()->>'verlustzuschlag_prozent')::numeric),
  ADD COLUMN metall_mengendifferenz_warnung_prozent numeric DEFAULT ((private.s16d_spur_d_standardwerte()->>'metall_mengendifferenz_warnung_prozent')::numeric),
  ADD COLUMN kursklausel_freigabe text DEFAULT (private.s16d_spur_d_standardwerte()->>'kursklausel_freigabe'),
  ADD COLUMN akzentfarbe text NOT NULL DEFAULT (private.s16d_spur_d_standardwerte()->>'akzentfarbe'),
  ADD COLUMN abweichungskategorien jsonb NOT NULL DEFAULT (private.s16d_spur_d_standardwerte()->'abweichungskategorien'),
  ADD COLUMN nachfassfrist_gegenvorschlag_arbeitstage integer NOT NULL DEFAULT ((private.s16d_spur_d_standardwerte()->>'nachfassfrist_gegenvorschlag_arbeitstage')::integer),
  ADD COLUMN termintreue_ziel_prozent numeric DEFAULT ((private.s16d_spur_d_standardwerte()->>'termintreue_ziel_prozent')::numeric),
  ADD COLUMN werkstatt_wochenziel_auftraege integer
    DEFAULT ((private.s16d_spur_d_standardwerte()->>'werkstatt_wochenziel_auftraege')::integer),
  ADD COLUMN liquiditaet_mindest_tage integer NOT NULL DEFAULT ((private.s16d_spur_d_standardwerte()->>'liquiditaet_mindest_tage')::integer),
  ADD COLUMN max_aktive_ziele integer NOT NULL DEFAULT ((private.s16d_spur_d_standardwerte()->>'max_aktive_ziele')::integer),
  ADD COLUMN sicherheitsreserve_cent bigint DEFAULT ((private.s16d_spur_d_standardwerte()->>'sicherheitsreserve_cent')::bigint),
  ADD COLUMN app_start_datum date DEFAULT ((private.s16d_spur_d_standardwerte()->>'app_start_datum')::date),
  ADD COLUMN steuerberater_email text DEFAULT (private.s16d_spur_d_standardwerte()->>'steuerberater_email'),
  ADD COLUMN berater_stundensatz_cent integer NOT NULL DEFAULT ((private.s16d_spur_d_standardwerte()->>'berater_stundensatz_cent')::integer),
  ADD COLUMN berater_minuten_pro_beleg integer NOT NULL DEFAULT ((private.s16d_spur_d_standardwerte()->>'berater_minuten_pro_beleg')::integer),
  ADD COLUMN bank_email text DEFAULT (private.s16d_spur_d_standardwerte()->>'bank_email'),
  ADD COLUMN unzugeordnete_nachrichten_loeschfrist_monate integer NOT NULL DEFAULT ((private.s16d_spur_d_standardwerte()->>'unzugeordnete_nachrichten_loeschfrist_monate')::integer),
  ADD COLUMN kanal_zielgeraete jsonb NOT NULL DEFAULT (private.s16d_spur_d_standardwerte()->'kanal_zielgeraete'),
  ADD COLUMN kanal_aufbewahrung text NOT NULL DEFAULT (private.s16d_spur_d_standardwerte()->>'kanal_aufbewahrung'),
  ADD COLUMN ki_sicherheitsschwelle numeric DEFAULT ((private.s16d_spur_d_standardwerte()->>'ki_sicherheitsschwelle')::numeric),
  ADD COLUMN annahme_zustaende jsonb NOT NULL DEFAULT (private.s16d_spur_d_standardwerte()->'annahme_zustaende'),
  ADD COLUMN suchalias_gruppen jsonb NOT NULL DEFAULT (private.s16d_spur_d_standardwerte()->'suchalias_gruppen'),
  ADD COLUMN energie_pauschale_cent_je_verfahren jsonb NOT NULL DEFAULT
    (private.s16d_spur_d_standardwerte()->'energie_pauschale_cent_je_verfahren'),
  ADD CONSTRAINT s16d_spur_d_stand_gueltig CHECK (
    offline_max_stunden > 0
    AND (material_aufschlag_prozent IS NULL OR (material_aufschlag_prozent >= 0 AND material_aufschlag_prozent < 10000))
    AND (lager_regelversion IS NULL OR char_length(btrim(lager_regelversion)) BETWEEN 1 AND 120)
    AND jsonb_typeof(entnahme_regel_je_rubrik) = 'object'
    AND NOT jsonb_path_exists(entnahme_regel_je_rubrik,
      'strict $.* ? (@.type() != "string" || (@ != "umlagerung" && @ != "verbrauch"))')
    AND bilanzbewertung_methode IN ('letzter_ek','gleitender_durchschnitt','hoechster_ek')
    AND anhang_max_mb > 0 AND mime_original_max_mb >= anhang_max_mb
    AND sicherung_hoechstalter_stunden > 0
    AND wiederherstellungstest_hoechstalter_tage > 0
    AND sicherung_min_prozent_vortag BETWEEN 1 AND 100
    AND (sicherungsort IS NULL OR btrim(sicherungsort) <> '')
    AND dienst_ausfall_toleranz_stunden > 0
    AND jsonb_typeof(betrieb_messgrenzen) = 'array'
    AND jsonb_typeof(mahnstufen_tage_nach_faelligkeit) = 'array'
    AND mahnung_letzte_zahlfrist_tage > 0
    AND zahlungsmuster_beobachtungsmonate > 0
    AND zahlungsmuster_min_rechnungen > 0
    AND jsonb_typeof(vorkasse_startgrenzen_cent) = 'object'
    AND (zahlungsanbieter IS NULL OR btrim(zahlungsanbieter) <> '')
    AND vorkasse_spaet_min_rechnungen > 0 AND vorkasse_spaet_tage > 0
    AND vorkasse_eskalation_mahnstufe BETWEEN 1 AND 3
    AND vorkasse_aufhebung_puenktliche_zahlungen > 0 AND skonto_fehlzug_min > 0
    AND btrim(metal_price_source) <> '' AND (metal_price_fallback_source IS NULL OR btrim(metal_price_fallback_source) <> '')
    AND kursabruf_uhrzeit ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    AND kursabweichung_prozent >= 0 AND kursabweichung_prozent < 'Infinity'::numeric
    AND kursabrufe_max_pro_monat > 0
    AND kursstichtag IN ('leistungsdatum','lieferdatum','rechnungsdatum','auftragsdatum')
    AND jsonb_typeof(kurs_metalle) = 'array'
    AND NOT jsonb_path_exists(kurs_metalle,
      '$[*] ? (@.type() != "string" || !(@ like_regex "^(gold|silber|palladium|rhodium|nickel|kupfer|zinn|zink)$"))')
    AND (metallzuschlag_prozent IS NULL OR (metallzuschlag_prozent >= 0 AND metallzuschlag_prozent < 'Infinity'::numeric))
    AND (verlustzuschlag_prozent IS NULL OR (verlustzuschlag_prozent >= 0 AND verlustzuschlag_prozent < 'Infinity'::numeric))
    AND (metall_mengendifferenz_warnung_prozent IS NULL OR (metall_mengendifferenz_warnung_prozent >= 0
      AND metall_mengendifferenz_warnung_prozent < 'Infinity'::numeric))
    AND (kursklausel_freigabe IS NULL OR char_length(btrim(kursklausel_freigabe)) > 0)
    AND akzentfarbe ~ '^#[a-fA-F0-9]{6}$'
    AND jsonb_typeof(abweichungskategorien) = 'array'
    AND nachfassfrist_gegenvorschlag_arbeitstage >= 0
    AND (termintreue_ziel_prozent IS NULL OR termintreue_ziel_prozent BETWEEN 0 AND 100)
    AND (werkstatt_wochenziel_auftraege IS NULL OR werkstatt_wochenziel_auftraege > 0)
    AND liquiditaet_mindest_tage >= 30
    AND max_aktive_ziele BETWEEN 1 AND 3
    AND (sicherheitsreserve_cent IS NULL OR sicherheitsreserve_cent BETWEEN 0 AND 9007199254740991)
    AND (steuerberater_email IS NULL OR btrim(steuerberater_email) <> '')
    AND berater_stundensatz_cent >= 0 AND berater_minuten_pro_beleg >= 0
    AND (bank_email IS NULL OR btrim(bank_email) <> '')
    AND unzugeordnete_nachrichten_loeschfrist_monate > 0
    AND jsonb_typeof(kanal_zielgeraete) = 'array'
    AND NOT jsonb_path_exists(kanal_zielgeraete, '$[*] ? (@.type() != "string" || !(@ like_regex "[^[:space:]]"))')
    AND btrim(kanal_aufbewahrung) <> ''
    AND (ki_sicherheitsschwelle IS NULL OR ki_sicherheitsschwelle BETWEEN 0 AND 1)
    AND jsonb_typeof(annahme_zustaende) = 'array'
    AND jsonb_typeof(suchalias_gruppen) = 'array'
    AND jsonb_typeof(energie_pauschale_cent_je_verfahren) = 'object'
    AND NOT jsonb_path_exists(energie_pauschale_cent_je_verfahren,
      'strict $.* ? (@.type() != "number" || @ < 0 || @ > 9007199254740991 || @ != @.floor())')
    AND jsonb_typeof(betriebsruhe) = 'array'
    AND versandpuffer_arbeitstage >= 0
    AND jsonb_typeof(werkstatt_zeitwahl) = 'object'
    AND jsonb_typeof(werkstatt_zeit_kostenstellen) = 'object'
    AND NOT jsonb_path_exists(werkstatt_zeit_kostenstellen, 'strict $.* ? (@.type() != "string")')
    AND jsonb_typeof(nacharbeit_ursachen) = 'array'
  );

-- M5: leer erbt den Firmenstichtag, auch bei bestehenden Kundendatensätzen.
ALTER TABLE public.customers
  ADD COLUMN kursstichtag text
    CONSTRAINT s16d_kunden_kursstichtag_gueltig
    CHECK (kursstichtag IN ('leistungsdatum','lieferdatum','rechnungsdatum','auftragsdatum'));
