-- P1: Erweitert die vorhandene Artikelidentität. Mengenbuchung und Altbestand folgen in P2.
ALTER TABLE public.inventory_items
  ADD COLUMN variante text,
  ADD COLUMN groesse text,
  ADD COLUMN kurznummer integer CHECK (kurznummer > 0),
  ADD COLUMN basiseinheit text CHECK (basiseinheit IN ('stk','paar','ml','l','g','kg','mm','cm','m')),
  ADD COLUMN rubrik_id uuid,
  ADD COLUMN metall text CHECK (metall IS NULL OR metall = btrim(metall) AND metall <> ''),
  ADD COLUMN feingehalt_pct numeric CHECK (feingehalt_pct BETWEEN 0 AND 100),
  ADD COLUMN kurs_metall boolean,
  ADD COLUMN paragraph_13b_metall boolean,
  ADD CONSTRAINT inventory_items_metall_vollstaendig CHECK (
    metall IS NOT NULL OR (feingehalt_pct IS NULL AND kurs_metall IS NULL AND paragraph_13b_metall IS NULL)
  ),
  ADD CONSTRAINT inventory_items_tenant_item_key UNIQUE (tenant_id, id),
  ADD CONSTRAINT inventory_items_tenant_kurznummer_key UNIQUE (tenant_id, kurznummer),
  ADD CONSTRAINT inventory_items_kurznummer_mandant CHECK (kurznummer IS NULL OR tenant_id IS NOT NULL);

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  name text NOT NULL CHECK (btrim(name) <> ''),
  UNIQUE (tenant_id, id)
);

ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_rubrik_fk
  FOREIGN KEY (tenant_id, rubrik_id) REFERENCES public.categories (tenant_id, id) ON DELETE RESTRICT;
ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_rubrik_mandant
  CHECK (rubrik_id IS NULL OR tenant_id IS NOT NULL);

CREATE TABLE public.material_short_no_counter (
  tenant_id text PRIMARY KEY,
  next_no integer NOT NULL CHECK (next_no > 0)
);

CREATE FUNCTION private.lager_naechste_kurznummer() RETURNS integer
LANGUAGE plpgsql SET search_path = '' AS $fn$
DECLARE
  mandant text := nullif(btrim(current_setting('app.tenant_id', true)), '');
  nummer integer;
BEGIN
  IF mandant IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'LAGER_MANDANT_FEHLT';
  END IF;
  INSERT INTO public.material_short_no_counter AS zaehler (tenant_id, next_no)
  VALUES (mandant, 2)
  ON CONFLICT (tenant_id) DO UPDATE SET next_no = zaehler.next_no + 1
  RETURNING next_no - 1 INTO nummer;
  RETURN nummer;
END;
$fn$;
REVOKE ALL ON FUNCTION private.lager_naechste_kurznummer() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.lager_naechste_kurznummer() TO service_role;

CREATE TABLE public.stock_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  stockwerk text NOT NULL CHECK (btrim(stockwerk) <> ''),
  bereich text NOT NULL CHECK (btrim(bereich) <> ''),
  aktiv boolean NOT NULL DEFAULT true,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, stockwerk, bereich)
);

CREATE TABLE public.packaging_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  artikel_id text NOT NULL,
  gebinde_schluessel text NOT NULL CHECK (btrim(gebinde_schluessel) <> ''),
  version integer NOT NULL CHECK (version > 0),
  art text NOT NULL CHECK (btrim(art) <> ''),
  name text NOT NULL CHECK (btrim(name) <> ''),
  inhalt_menge numeric NOT NULL CHECK (inhalt_menge > 0 AND inhalt_menge < 100000000000 AND scale(inhalt_menge) <= 3),
  inhalt_einheit text NOT NULL CHECK (inhalt_einheit IN ('stk','paar','ml','l','g','kg','mm','cm','m')),
  gueltig_ab timestamptz NOT NULL,
  umrechnung_basismenge numeric CHECK (
    umrechnung_basismenge > 0 AND umrechnung_basismenge < 100000000000 AND scale(umrechnung_basismenge) <= 3
  ),
  umrechnung_basiseinheit text CHECK (umrechnung_basiseinheit IN ('stk','paar','ml','l','g','kg','mm','cm','m')),
  umrechnung_beleg_id uuid,
  CHECK (inhalt_einheit NOT IN ('stk','paar') OR inhalt_menge = trunc(inhalt_menge)),
  CHECK (umrechnung_basiseinheit NOT IN ('stk','paar') OR umrechnung_basismenge = trunc(umrechnung_basismenge)),
  CHECK (num_nonnulls(umrechnung_basismenge, umrechnung_basiseinheit, umrechnung_beleg_id) IN (0, 3)),
  UNIQUE (tenant_id, artikel_id, id),
  UNIQUE (tenant_id, artikel_id, gebinde_schluessel, version),
  UNIQUE (tenant_id, artikel_id, gebinde_schluessel, gueltig_ab),
  FOREIGN KEY (tenant_id, artikel_id) REFERENCES public.inventory_items (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, umrechnung_beleg_id) REFERENCES public.intake_file (tenant_id, id) ON DELETE RESTRICT
);

CREATE FUNCTION private.lager_gebindeversion_schuetzen() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $fn$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'LAGER_GEBINDEVERSION_UNVERAENDERLICH';
END;
$fn$;
REVOKE ALL ON FUNCTION private.lager_gebindeversion_schuetzen() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.lager_gebindeversion_schuetzen() TO service_role;

CREATE TRIGGER lager_gebindeversion_unveraenderlich
  BEFORE UPDATE OR DELETE ON public.packaging_definitions
  FOR EACH ROW EXECUTE FUNCTION private.lager_gebindeversion_schuetzen();

-- Ein Fundort ist eine Beobachtung. Laufender Ort und Restmenge werden in P2 aus dem Journal gelesen.
CREATE TABLE public.handling_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  artikel_id text NOT NULL,
  gebinde_version_id uuid NOT NULL,
  fundort_id uuid,
  fund_datei_id uuid,
  kennung text CHECK (btrim(kennung) <> ''),
  charge text CHECK (btrim(charge) <> ''),
  haltbar_bis date,
  geoeffnet_am timestamptz,
  UNIQUE (tenant_id, artikel_id, id),
  UNIQUE (tenant_id, kennung),
  FOREIGN KEY (tenant_id, artikel_id, gebinde_version_id)
    REFERENCES public.packaging_definitions (tenant_id, artikel_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, fundort_id) REFERENCES public.stock_locations (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, fund_datei_id) REFERENCES public.intake_file (tenant_id, id) ON DELETE RESTRICT
);

-- L6: Lieferantenartikelnummer steht nur an der bestätigten Kennung.
-- Eine Lieferantennummer gehört zum Namensraum ihres Lieferanten, QR/Synonym zum Betrieb.
CREATE TABLE public.lager_artikel_kennungen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  artikel_id text NOT NULL,
  art text NOT NULL CHECK (art IN ('lieferant','synonym','qr')),
  wert text NOT NULL CHECK (wert = btrim(wert) AND wert <> ''),
  lieferant_id text,
  bestaetigt_von uuid NOT NULL,
  bestaetigt_am timestamptz NOT NULL,
  CHECK ((art = 'lieferant') = (lieferant_id IS NOT NULL)),
  FOREIGN KEY (tenant_id, artikel_id) REFERENCES public.inventory_items (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, lieferant_id) REFERENCES public.customers (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, bestaetigt_von) REFERENCES public.app_users (tenant_id, id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX lager_artikel_kennungen_lieferant_key
  ON public.lager_artikel_kennungen (tenant_id, lieferant_id, wert) WHERE art = 'lieferant';
CREATE UNIQUE INDEX lager_artikel_kennungen_intern_key
  ON public.lager_artikel_kennungen (tenant_id, art, wert) WHERE art <> 'lieferant';

CREATE TABLE public.lager_artikel_dateien (
  tenant_id text NOT NULL,
  artikel_id text NOT NULL,
  datei_id uuid NOT NULL,
  zweck text NOT NULL CHECK (zweck IN ('foto','sicherheitsdatenblatt')),
  PRIMARY KEY (tenant_id, artikel_id, datei_id, zweck),
  FOREIGN KEY (tenant_id, artikel_id) REFERENCES public.inventory_items (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, datei_id) REFERENCES public.intake_file (tenant_id, id) ON DELETE RESTRICT
);

CREATE TABLE public.material_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  artikel_id text NOT NULL,
  -- Historischer Stück-EK hat vier Nachkommastellen. Auf Cent wird erst der Geldbetrag gerundet.
  einzelpreis numeric NOT NULL CHECK (einzelpreis >= 0 AND einzelpreis < 1000000000000 AND scale(einzelpreis) <= 4),
  waehrung text NOT NULL CHECK (waehrung ~ '^[A-Z]{3}$'),
  quelle text NOT NULL CHECK (quelle IN ('angebot','bestellung','gepruefte_rechnung','import','manuell')),
  beleg_id uuid,
  gueltig_ab timestamptz,
  erfasst_am timestamptz NOT NULL DEFAULT statement_timestamp(),
  bestaetigt_am timestamptz,
  storniert_am timestamptz,
  fehlpreis_am timestamptz,
  CHECK (quelle NOT IN ('angebot','bestellung','gepruefte_rechnung') OR beleg_id IS NOT NULL),
  CHECK (bestaetigt_am IS NULL OR gueltig_ab IS NOT NULL),
  FOREIGN KEY (tenant_id, artikel_id) REFERENCES public.inventory_items (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, beleg_id) REFERENCES public.intake_item (tenant_id, id) ON DELETE RESTRICT
);

CREATE INDEX material_prices_artikel_stichtag_idx
  ON public.material_prices (tenant_id, artikel_id, gueltig_ab DESC)
  WHERE bestaetigt_am IS NOT NULL AND storniert_am IS NULL AND fehlpreis_am IS NULL;

-- Ohne bestätigten Mandanten wird kein Betrieb zugewiesen. Der Alt-EK bleibt am Ursprung.
INSERT INTO public.material_prices (tenant_id, artikel_id, einzelpreis, waehrung, quelle, gueltig_ab)
SELECT tenant_id, id, einkaufspreis_eur, 'EUR', 'import', letzter_preis_aktualisiert_am
FROM public.inventory_items
WHERE nullif(btrim(tenant_id), '') IS NOT NULL
  AND einkaufspreis_eur BETWEEN 0 AND 999999.9999;

CREATE TABLE public.metallkurse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  metall text NOT NULL CHECK (metall = btrim(metall) AND metall <> ''),
  kursdatum date NOT NULL,
  eur_pro_gramm numeric NOT NULL CHECK (eur_pro_gramm > 0 AND eur_pro_gramm < 1000000000000),
  quelle text NOT NULL CHECK (quelle = btrim(quelle) AND quelle <> ''),
  manuell boolean NOT NULL,
  erfasst_am timestamptz NOT NULL DEFAULT statement_timestamp(),
  UNIQUE (tenant_id, metall, kursdatum, quelle, manuell)
);

-- Wie beim Eingang: kein Direktzugriff für Browserrollen. Der Server muss zusätzlich
-- jede Abfrage nach dem authentifizierten Mandanten filtern (service_role umgeht RLS).
DO $rls$
DECLARE
  tabelle text;
BEGIN
  FOREACH tabelle IN ARRAY ARRAY[
    'categories', 'material_short_no_counter', 'stock_locations', 'packaging_definitions',
    'handling_units', 'lager_artikel_kennungen', 'lager_artikel_dateien', 'material_prices', 'metallkurse'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tabelle);
    EXECUTE format(
      'CREATE POLICY lager_mandant ON public.%I USING (tenant_id = nullif(btrim(current_setting(''app.tenant_id'', true)), '''')) WITH CHECK (tenant_id = nullif(btrim(current_setting(''app.tenant_id'', true)), ''''))',
      tabelle
    );
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated, service_role', tabelle);
    EXECUTE format('GRANT SELECT, INSERT ON TABLE public.%I TO service_role', tabelle);
  END LOOP;
END;
$rls$;

GRANT UPDATE ON TABLE public.categories, public.material_short_no_counter, public.stock_locations,
  public.handling_units, public.material_prices TO service_role;

INSERT INTO public.feature_flags (id, name, enabled, roles_allowed) VALUES
  ('p3_lager_inventur', 'p3_lager_inventur', false, ARRAY[]::text[]),
  ('p4_lager', 'p4_lager', false, ARRAY[]::text[])
ON CONFLICT (id) DO NOTHING;
