-- AP-EIN Teil 1 Kunde (aus AP-K1 F2, Planungschat 02.11.2026): Datenvertrag customers nach BAUPLAN spec 21d0347a3319
-- formulare.kunde.daten + A-87 (Land als Schluessel) + K5 (Zahlungsbedingung vorkasse|bar|rechnung, Ziel getrennt)
-- + auto_info/vorrang (standard_fuer_auftraege) + Lieferant + Adressverzeichnis (leer, Import AP-K2). Absprachen: eigener Teil AP-ABS.
-- Ersetzt Fassung 1 (nie auf Dev oder main). Keine Spalte geloescht. Einzige nicht-additive Aenderung: die zwei
-- CHECK-Regeln customers_payment_preference_s1_chk und customers_invoice_terms_s1_chk werden durch K1-Regeln ersetzt.
-- Codex legt diese Datei bytegleich als supabase/migrations/<zeitstempel>_b2_kunde_k1.sql an.

-- 1. Neue Spalten
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS salutation text,
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS contact_role text,
  ADD COLUMN IF NOT EXISTS house_number text,
  ADD COLUMN IF NOT EXISTS billing_email text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS handover_preference text,
  ADD COLUMN IF NOT EXISTS iban text,
  ADD COLUMN IF NOT EXISTS zahlungsziel_tage integer,
  ADD COLUMN IF NOT EXISTS address_status text,
  ADD COLUMN IF NOT EXISTS address_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_info boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS vorrang boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.customers.contact_person IS 'Stillgelegt (AP-K1): nur lesend, App schreibt und zeigt sie nicht; Werte in salutation, first_name, last_name, contact_role.';
COMMENT ON COLUMN public.customers.shipping_preference IS 'Stillgelegt (AP-K1): ersetzt durch handover_preference (pickup|shipping|NULL); App liest und schreibt sie nicht.';
COMMENT ON COLUMN public.customers.country IS 'Schluessel DE | AT | CH | andere (A-87); bei andere steht der Laendername im Ort.';
COMMENT ON COLUMN public.customers.payment_preference IS 'Zahlungsbedingung vorkasse | bar | rechnung | NULL (K5); rechnung nur bei ziel_freigeschaltet; Lieferant immer NULL.';

-- 2. Eine Regel je Teilung (Migration UND Server-Normalisierung alter Eingaben)
CREATE OR REPLACE FUNCTION private.kunde_split_name(p_text text)
RETURNS TABLE (salutation text, first_name text, last_name text, sicher boolean)
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v text := btrim(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g'));
  v_sal text := NULL;
  v_words text[];
BEGIN
  IF v = '' THEN
    RETURN QUERY SELECT NULL::text, NULL::text, NULL::text, true; RETURN;
  END IF;
  IF v ~* '^(frau|fr\.)\s' THEN v_sal := 'frau'; v := btrim(regexp_replace(v, '^\S+\s', ''));
  ELSIF v ~* '^(herr|hr\.)\s' THEN v_sal := 'herr'; v := btrim(regexp_replace(v, '^\S+\s', ''));
  END IF;
  IF v ~ '[0-9,&/]' OR v ~* '\s(und|u\.)\s' OR array_length(regexp_split_to_array(v, ' '), 1) > 4 THEN
    RETURN QUERY SELECT v_sal, NULL::text, left(v, 160), false; RETURN;
  END IF;
  v_words := regexp_split_to_array(v, ' ');
  IF array_length(v_words, 1) = 1 THEN
    RETURN QUERY SELECT v_sal, NULL::text, v_words[1], true; RETURN;
  END IF;
  RETURN QUERY SELECT v_sal,
    left(array_to_string(v_words[1:array_length(v_words, 1) - 1], ' '), 60),
    left(v_words[array_length(v_words, 1)], 160),
    true;
END;
$$;

CREATE OR REPLACE FUNCTION private.kunde_split_street(p_text text)
RETURNS TABLE (street text, house_number text)
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v text := btrim(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g'));
  v_m text[];
BEGIN
  IF v = '' THEN RETURN QUERY SELECT NULL::text, NULL::text; RETURN; END IF;
  v_m := regexp_match(v, '^(.*\S)\s+([0-9][0-9A-Za-z/-]{0,9})$');
  IF v_m IS NULL THEN RETURN QUERY SELECT v, NULL::text; RETURN; END IF;
  RETURN QUERY SELECT v_m[1], v_m[2];
END;
$$;

-- Land: Klartext oder Schluessel -> Schluessel (A-87). NULL/leer bleibt NULL ("Anschrift unvollstaendig", kein Ausland).
CREATE OR REPLACE FUNCTION private.kunde_land_schluessel(p_text text)
RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_text IS NULL OR btrim(p_text) = '' THEN NULL
    WHEN lower(btrim(p_text)) IN ('de', 'deutschland', 'germany') THEN 'DE'
    WHEN lower(btrim(p_text)) IN ('at', 'österreich', 'oesterreich', 'austria') THEN 'AT'
    WHEN lower(btrim(p_text)) IN ('ch', 'schweiz', 'switzerland', 'suisse', 'svizzera') THEN 'CH'
    ELSE 'andere'
  END
$$;

REVOKE ALL ON FUNCTION private.kunde_split_name(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.kunde_split_street(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.kunde_land_schluessel(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.kunde_split_name(text) TO service_role;
GRANT EXECUTE ON FUNCTION private.kunde_split_street(text) TO service_role;
GRANT EXECUTE ON FUNCTION private.kunde_land_schluessel(text) TO service_role;

-- 3. Altdaten
UPDATE public.customers SET type = 'business' WHERE type = 'institution';

UPDATE public.customers
SET city = CASE
      WHEN private.kunde_land_schluessel(country) = 'andere' AND city IS NOT NULL AND btrim(city) <> ''
        THEN left(btrim(city) || ', ' || btrim(country), 100)
      WHEN private.kunde_land_schluessel(country) = 'andere' THEN left(btrim(country), 100)
      ELSE city END,
    country = private.kunde_land_schluessel(country)
WHERE country IS DISTINCT FROM private.kunde_land_schluessel(country);

ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_invoice_terms_s1_chk;
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_payment_preference_s1_chk;
UPDATE public.customers SET payment_preference = 'rechnung' WHERE payment_preference ~ '^rechnung_[0-9]+$';

WITH quelle AS (
  SELECT c.id, c.tenant_id,
         CASE WHEN c.type = 'privat' THEN c.name ELSE c.contact_person END AS person
  FROM public.customers c
  WHERE c.first_name IS NULL AND c.last_name IS NULL
), geteilt AS (
  SELECT q.id, q.tenant_id, s.salutation, s.first_name, s.last_name, s.sicher
  FROM quelle q CROSS JOIN LATERAL private.kunde_split_name(q.person) s
  WHERE q.person IS NOT NULL AND btrim(q.person) <> ''
)
UPDATE public.customers c
SET salutation = g.salutation,
    first_name = g.first_name,
    last_name = g.last_name,
    tags = CASE WHEN g.sicher OR c.tags ? 'name_pruefen' THEN c.tags ELSE c.tags || '["name_pruefen"]'::jsonb END
FROM geteilt g
WHERE c.id = g.id AND c.tenant_id = g.tenant_id;

WITH geteilt AS (
  SELECT c.id, c.tenant_id, s.street, s.house_number
  FROM public.customers c CROSS JOIN LATERAL private.kunde_split_street(c.street) s
  WHERE c.house_number IS NULL AND c.street IS NOT NULL AND s.house_number IS NOT NULL
)
UPDATE public.customers c
SET street = g.street, house_number = g.house_number
FROM geteilt g
WHERE c.id = g.id AND c.tenant_id = g.tenant_id;

-- 4. Regeln (DB-Sicherheitsnetz; die Feldgrenzen des Bauplans prueft die eine Validierung in Client und Server)
ALTER TABLE public.customers
  ADD CONSTRAINT customers_type_k1_chk CHECK (type IN ('business', 'privat', 'lieferant')),
  ADD CONSTRAINT customers_country_k1_chk CHECK (country IS NULL OR country IN ('DE', 'AT', 'CH', 'andere')),
  ADD CONSTRAINT customers_payment_preference_k1_chk CHECK (payment_preference IS NULL OR payment_preference IN ('vorkasse', 'bar', 'rechnung')),
  ADD CONSTRAINT customers_invoice_terms_k1_chk CHECK (
    (NOT ziel_freigeschaltet AND ziel_tage IS NULL AND skonto_prozent IS NULL AND skonto_tage IS NULL
       AND payment_preference IS DISTINCT FROM 'rechnung')
    OR (ziel_freigeschaltet AND ziel_tage BETWEEN 1 AND 90 AND skonto_prozent BETWEEN 0 AND 100
       AND skonto_tage BETWEEN 0 AND ziel_tage)),
  ADD CONSTRAINT customers_salutation_chk CHECK (salutation IS NULL OR salutation IN ('frau', 'herr', 'ohne')),
  ADD CONSTRAINT customers_handover_preference_chk CHECK (handover_preference IS NULL OR handover_preference IN ('pickup', 'shipping')),
  ADD CONSTRAINT customers_address_status_chk CHECK (address_status IS NULL OR address_status IN ('gefunden', 'uebernommen', 'bestaetigt', 'nicht_pruefbar')),
  ADD CONSTRAINT customers_first_name_len_chk CHECK (first_name IS NULL OR char_length(first_name) BETWEEN 1 AND 60),
  ADD CONSTRAINT customers_last_name_len_chk CHECK (last_name IS NULL OR char_length(last_name) BETWEEN 1 AND 160),
  ADD CONSTRAINT customers_contact_role_len_chk CHECK (contact_role IS NULL OR char_length(contact_role) <= 60),
  ADD CONSTRAINT customers_house_number_len_chk CHECK (house_number IS NULL OR char_length(house_number) BETWEEN 1 AND 10),
  ADD CONSTRAINT customers_billing_email_len_chk CHECK (billing_email IS NULL OR char_length(billing_email) <= 254),
  ADD CONSTRAINT customers_website_len_chk CHECK (website IS NULL OR char_length(website) <= 120),
  ADD CONSTRAINT customers_iban_format_chk CHECK (iban IS NULL OR iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$'),
  ADD CONSTRAINT customers_zahlungsziel_tage_chk CHECK (zahlungsziel_tage IS NULL OR zahlungsziel_tage BETWEEN 0 AND 120),
  ADD CONSTRAINT customers_lieferant_felder_chk CHECK (
    (type = 'lieferant' AND payment_preference IS NULL AND vat_id IS NULL AND billing_email IS NULL AND handover_preference IS NULL)
    OR (type <> 'lieferant' AND iban IS NULL AND zahlungsziel_tage IS NULL));

-- 5. Adressverzeichnis (E15): mandantenfreie Referenzdaten, nur lesend fuer die App. Import folgt in AP-K2.
CREATE TABLE IF NOT EXISTS public.address_directory (
  id bigserial PRIMARY KEY,
  country text NOT NULL CHECK (country IN ('DE', 'AT', 'CH')),
  zip_code text NOT NULL CHECK (char_length(zip_code) BETWEEN 4 AND 5),
  city text NOT NULL CHECK (char_length(city) BETWEEN 1 AND 100),
  district text CHECK (district IS NULL OR char_length(district) <= 100),
  street text CHECK (street IS NULL OR char_length(street) <= 160)
);
CREATE INDEX IF NOT EXISTS address_directory_country_zip_idx ON public.address_directory (country, zip_code);
CREATE INDEX IF NOT EXISTS address_directory_country_zip_street_idx ON public.address_directory (country, zip_code, street);
ALTER TABLE public.address_directory ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.address_directory FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.address_directory TO service_role;
CREATE POLICY address_directory_read ON public.address_directory FOR SELECT USING (true);
