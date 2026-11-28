-- G-M1: gemeinsame Quellen und unveränderliche Geldbelege für I04 und I04a.
CREATE TABLE public.quellen_register (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  art text NOT NULL CHECK (art IN (
    'eingang','ausgang','bank','kasse','karte','zahlungsdienst','auslagen','lohn','kanzlei','kontrolle','sonstige'
  )),
  bezeichnung text NOT NULL,
  konto_kennung text,
  waehrung char(3) NOT NULL DEFAULT 'EUR' CHECK (waehrung ~ '^[A-Z]{3}$'),
  kassenart text CHECK (kassenart IN ('extern_tse','ohne_tse')),
  import_profil jsonb,
  nutzung text NOT NULL DEFAULT 'unbekannt' CHECK (nutzung IN ('unbekannt','bestaetigt_genutzt','bestaetigt_ungenutzt')),
  nutzung_herkunft text,
  nutzung_bestaetigt_von uuid,
  nutzung_bestaetigt_am date,
  aktiv_ab date,
  aktiv_bis date,
  verantwortung text,
  empfaengerkreis text NOT NULL DEFAULT 'buchhaltung' CHECK (empfaengerkreis IN ('buchhaltung','lohn','inhaber')),
  soll_beschreibung text,
  system_schluessel text,
  is_test boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  angelegt_am timestamptz NOT NULL DEFAULT clock_timestamp(),
  angelegt_von uuid,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, system_schluessel),
  FOREIGN KEY (tenant_id, nutzung_bestaetigt_von) REFERENCES public.app_users (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, angelegt_von) REFERENCES public.app_users (tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE public.geld_auszug (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  quelle_id uuid NOT NULL,
  intake_item_id uuid,
  original_file_id uuid,
  original_sha256 text NOT NULL CHECK (original_sha256 ~ '^[0-9a-f]{64}$'),
  format text NOT NULL CHECK (format IN ('camt053','csv_profil','psp_csv','kassen_zaehlung','beleg_manuell')),
  format_version text,
  externe_auszug_id text,
  zeitraum_von date,
  zeitraum_bis date,
  anfang_cents bigint,
  ende_cents bigint,
  waehrung char(3) CHECK (waehrung ~ '^[A-Z]{3}$'),
  import_status text NOT NULL CHECK (import_status IN ('gelesen','teilweise','format_unbekannt')),
  zeilen_gesamt integer CHECK (zeilen_gesamt >= 0),
  zeilen_neu integer CHECK (zeilen_neu >= 0),
  zeilen_wiederholt integer CHECK (zeilen_wiederholt >= 0),
  zeilen_konflikt integer CHECK (zeilen_konflikt >= 0),
  erfasst_am timestamptz NOT NULL DEFAULT clock_timestamp(),
  erfasst_von uuid,
  client_event_id uuid NOT NULL,
  is_test boolean NOT NULL DEFAULT false,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, quelle_id, id),
  UNIQUE (tenant_id, quelle_id, original_sha256),
  UNIQUE (tenant_id, client_event_id),
  FOREIGN KEY (tenant_id, quelle_id) REFERENCES public.quellen_register (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, intake_item_id) REFERENCES public.intake_item (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, original_file_id) REFERENCES public.intake_file (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, erfasst_von) REFERENCES public.app_users (tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE public.geld_bewegung (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  quelle_id uuid NOT NULL,
  auszug_id uuid,
  eintrag_ref text,
  quell_schluessel text NOT NULL,
  inhalt_sha256 text NOT NULL CHECK (inhalt_sha256 ~ '^[0-9a-f]{64}$'),
  art text NOT NULL CHECK (art IN (
    'umsatz','kartenverkauf','anbietergebuehr','anbieterauszahlung','anbietereinbehalt',
    'bareinnahme','barausgabe','ruecklastschrift','erstattung','sonstiges'
  )),
  buchungstag date NOT NULL,
  valuta date,
  betrag_cents bigint NOT NULL CHECK (betrag_cents <> 0),
  waehrung char(3) NOT NULL CHECK (waehrung ~ '^[A-Z]{3}$'),
  original_waehrung char(3) CHECK (original_waehrung ~ '^[A-Z]{3}$'),
  original_betrag_cents bigint,
  kurs numeric(18,8),
  kurs_quelle text,
  kurs_datum date,
  gegenpartei_name text,
  gegenpartei_iban_kurz text,
  gegenpartei_iban_sha256 text,
  verwendungszweck text,
  transaktions_ref text,
  beleg_original_id uuid,
  erfasst_am timestamptz NOT NULL DEFAULT clock_timestamp(),
  erfasst_von uuid,
  vorgaenger_id uuid,
  korrektur_grund text,
  is_test boolean NOT NULL DEFAULT false,
  CHECK (num_nonnulls(original_waehrung, original_betrag_cents, kurs, kurs_quelle, kurs_datum) IN (0, 5)),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, quelle_id, quell_schluessel),
  FOREIGN KEY (tenant_id, quelle_id) REFERENCES public.quellen_register (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, quelle_id, auszug_id) REFERENCES public.geld_auszug (tenant_id, quelle_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, erfasst_von) REFERENCES public.app_users (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, vorgaenger_id) REFERENCES public.geld_bewegung (tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE public.geld_bewegung_konflikt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  bewegung_id uuid NOT NULL,
  auszug_id uuid NOT NULL,
  abweichung jsonb NOT NULL,
  erfasst_am timestamptz NOT NULL DEFAULT clock_timestamp(),
  geklaert_durch uuid,
  FOREIGN KEY (tenant_id, bewegung_id) REFERENCES public.geld_bewegung (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, auszug_id) REFERENCES public.geld_auszug (tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE public.geld_zuordnung (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  vorgang_id uuid NOT NULL,
  client_event_id uuid NOT NULL,
  position smallint NOT NULL,
  von_typ text NOT NULL CHECK (von_typ IN ('bewegung','auslage','beleg')),
  von_id text NOT NULL,
  ziel_typ text NOT NULL CHECK (ziel_typ IN (
    'kundenrechnung','lieferantenrechnung','auslage','gebuehr','transfer','guthaben',
    'lohn','steuer','inhaber','darlehen','verpflichtung','sonstiges'
  )),
  ziel_id text NOT NULL,
  art text NOT NULL CHECK (art IN (
    'zahlung','teilzahlung','deckung','gebuehr','umbuchung','drittzahlung','erstattung',
    'ruecklastschrift','aufrechnung','sonstiges'
  )),
  betrag_cents bigint NOT NULL CHECK (betrag_cents > 0),
  waehrung char(3) NOT NULL CHECK (waehrung ~ '^[A-Z]{3}$'),
  wirksam_am date NOT NULL,
  payment_event_id text,
  storno_von uuid,
  grund text,
  nachweis_original_id uuid,
  einordnung_offen boolean NOT NULL DEFAULT false,
  erfasst_am timestamptz NOT NULL DEFAULT clock_timestamp(),
  erfasst_von uuid,
  is_test boolean NOT NULL DEFAULT false,
  CHECK (art <> 'deckung' OR payment_event_id IS NOT NULL),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, client_event_id, position),
  FOREIGN KEY (tenant_id, storno_von) REFERENCES public.geld_zuordnung (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, erfasst_von) REFERENCES public.app_users (tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE public.geld_auslage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  person_user_id uuid,
  person_name_stand text NOT NULL,
  beleg_typ text NOT NULL CHECK (beleg_typ IN ('lieferantenrechnung','beleg_unbestimmt')),
  beleg_id text NOT NULL,
  quittung_original_id uuid NOT NULL,
  bestaetigung_original_id uuid,
  vorgestreckt_am date NOT NULL,
  betrag_cents bigint NOT NULL CHECK (betrag_cents > 0),
  waehrung char(3) NOT NULL CHECK (waehrung ~ '^[A-Z]{3}$'),
  zweck text NOT NULL,
  freigegeben_von uuid,
  freigegeben_am timestamptz,
  client_event_id uuid NOT NULL,
  erfasst_am timestamptz NOT NULL DEFAULT clock_timestamp(),
  is_test boolean NOT NULL DEFAULT false,
  UNIQUE (tenant_id, client_event_id),
  FOREIGN KEY (tenant_id, person_user_id) REFERENCES public.app_users (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, freigegeben_von) REFERENCES public.app_users (tenant_id, id) ON DELETE RESTRICT
);

ALTER TABLE public.quellen_register ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geld_auszug ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geld_bewegung ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geld_bewegung_konflikt ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geld_zuordnung ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geld_auslage ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.quellen_register, public.geld_auszug, public.geld_bewegung, public.geld_bewegung_konflikt,
  public.geld_zuordnung, public.geld_auslage FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.quellen_register, public.geld_auszug, public.geld_bewegung, public.geld_bewegung_konflikt,
  public.geld_zuordnung, public.geld_auslage TO service_role;
GRANT UPDATE ON public.quellen_register TO service_role;

CREATE TRIGGER geld_auszug_unveraenderlich BEFORE UPDATE OR DELETE OR TRUNCATE ON public.geld_auszug
  FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE TRIGGER geld_bewegung_unveraenderlich BEFORE UPDATE OR DELETE OR TRUNCATE ON public.geld_bewegung
  FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE TRIGGER geld_bewegung_konflikt_unveraenderlich BEFORE UPDATE OR DELETE OR TRUNCATE ON public.geld_bewegung_konflikt
  FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE TRIGGER geld_zuordnung_unveraenderlich BEFORE UPDATE OR DELETE OR TRUNCATE ON public.geld_zuordnung
  FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE TRIGGER geld_auslage_unveraenderlich BEFORE UPDATE OR DELETE OR TRUNCATE ON public.geld_auslage
  FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_audit_mutation();
