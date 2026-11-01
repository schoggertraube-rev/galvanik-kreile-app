-- AP-K1 Kunde (Runde 21): Datenvertrag customers additiv + Adressverzeichnis + Teilungsfunktionen + Altdaten.
-- Planungschat 01.11.2026, BAUPLAN.next spec c82bf2d6d880 formulare.kunde.daten. Nur additiv, keine Spalte geloescht.
-- Codex legt diese Datei bytegleich als supabase/migrations/<zeitstempel>_b2_kunde_k1.sql an.

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS salutation text,
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS contact_role text,
  ADD COLUMN IF NOT EXISTS house_number text,
  ADD COLUMN IF NOT EXISTS billing_email text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS address_status text,
  ADD COLUMN IF NOT EXISTS address_checked_at timestamptz;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_salutation_chk CHECK (salutation IS NULL OR salutation IN ('frau', 'herr', 'ohne')),
  ADD CONSTRAINT customers_address_status_chk CHECK (address_status IS NULL OR address_status IN ('gefunden', 'uebernommen', 'bestaetigt', 'nicht_pruefbar')),
  ADD CONSTRAINT customers_first_name_len_chk CHECK (first_name IS NULL OR char_length(first_name) BETWEEN 1 AND 60),
  ADD CONSTRAINT customers_last_name_len_chk CHECK (last_name IS NULL OR char_length(last_name) BETWEEN 1 AND 160),
  ADD CONSTRAINT customers_contact_role_len_chk CHECK (contact_role IS NULL OR char_length(contact_role) <= 60),
  ADD CONSTRAINT customers_house_number_len_chk CHECK (house_number IS NULL OR char_length(house_number) BETWEEN 1 AND 10),
  ADD CONSTRAINT customers_billing_email_len_chk CHECK (billing_email IS NULL OR char_length(billing_email) <= 254),
  ADD CONSTRAINT customers_website_len_chk CHECK (website IS NULL OR char_length(website) <= 120);

COMMENT ON COLUMN public.customers.contact_person IS 'Stillgelegt (AP-K1, 01.11.2026): nur lesend, App schreibt und zeigt sie nicht mehr; Werte in salutation, first_name, last_name, contact_role.';

-- Eine Teilungsregel fuer Migration UND Server-Normalisierung alter Eingaben (eine Wahrheit).
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

REVOKE ALL ON FUNCTION private.kunde_split_name(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.kunde_split_street(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.kunde_split_name(text) TO service_role;
GRANT EXECUTE ON FUNCTION private.kunde_split_street(text) TO service_role;

-- Altdaten: Firma aus contact_person, Privat aus name; Strasse in Strasse + Nr.; unsicher -> Hinweis-Tag.
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

-- Adressverzeichnis (E15): mandantenfreie Referenzdaten, nur lesend fuer die App. Import folgt in AP-K2.
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
