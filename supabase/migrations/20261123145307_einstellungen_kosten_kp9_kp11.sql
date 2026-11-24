-- KP9/KP11: vorhandene Kosten- und Kategorietabellen mit bestätigtem Mandantenbezug.
ALTER TABLE public.kategorie
  ADD COLUMN tenant_id text,
  ADD COLUMN aus_eingangsrechnung_id uuid,
  ADD CONSTRAINT kategorie_mandant_id UNIQUE(tenant_id,id),
  ADD CONSTRAINT kategorie_eingangsrechnung_mandant_fk
    FOREIGN KEY (tenant_id,aus_eingangsrechnung_id) REFERENCES public.supplier_invoice(tenant_id,id) ON DELETE RESTRICT,
  ADD CONSTRAINT kategorie_eingangsrechnung_mandant_check CHECK (tenant_id IS NOT NULL OR aus_eingangsrechnung_id IS NULL);
CREATE UNIQUE INDEX kategorie_mandant_name
  ON public.kategorie(tenant_id,typ,(lower(btrim(name)))) WHERE tenant_id IS NOT NULL;
CREATE UNIQUE INDEX kategorie_mandant_ursprungsbeleg
  ON public.kategorie(tenant_id,aus_eingangsrechnung_id) WHERE aus_eingangsrechnung_id IS NOT NULL;

ALTER TABLE public.kostenposten
  ADD COLUMN tenant_id text,
  ADD COLUMN laufende_art text,
  ADD COLUMN naechste_faelligkeit date,
  ADD COLUMN kategorie_id uuid,
  ADD COLUMN fahrzeug_id uuid,
  ADD COLUMN lieferant_id text,
  ADD CONSTRAINT kostenposten_laufend_gueltig CHECK (
    (tenant_id IS NULL AND laufende_art IS NULL AND kategorie_id IS NULL AND fahrzeug_id IS NULL
      AND lieferant_id IS NULL AND naechste_faelligkeit IS NULL)
    OR (tenant_id IS NOT NULL AND laufende_art IS NOT NULL AND laufende_art IN ('sachkosten','personal')
      AND art='fix' AND betrag>0 AND gilt_ab IS NOT NULL AND naechste_faelligkeit IS NOT NULL
      AND naechste_faelligkeit >= gilt_ab AND (gilt_bis IS NULL OR gilt_bis>=gilt_ab)
      AND kategorie_id IS NOT NULL
      AND intervall IN ('monatlich','vierteljaehrlich','jaehrlich')
      AND (fahrzeug_id IS NULL OR lieferant_id IS NULL)
      AND (laufende_art<>'personal' OR (intervall='monatlich' AND fahrzeug_id IS NULL AND lieferant_id IS NULL)))
  ),
  ADD CONSTRAINT kostenposten_kategorie_mandant_fk
    FOREIGN KEY (tenant_id,kategorie_id) REFERENCES public.kategorie(tenant_id,id) ON DELETE RESTRICT,
  ADD CONSTRAINT kostenposten_fahrzeug_mandant_fk
    FOREIGN KEY (tenant_id,fahrzeug_id) REFERENCES public.vehicles(tenant_id,id) ON DELETE RESTRICT,
  ADD CONSTRAINT kostenposten_lieferant_mandant_fk
    FOREIGN KEY (tenant_id,lieferant_id) REFERENCES public.customers(tenant_id,id) ON DELETE RESTRICT;

CREATE INDEX kostenposten_laufend_mandant ON public.kostenposten(tenant_id,naechste_faelligkeit,id)
  WHERE tenant_id IS NOT NULL;
ALTER TABLE public.kategorie ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kostenposten ENABLE ROW LEVEL SECURITY;
-- Die alten Browserpfade dürfen nur ihre bisherige unzugeordnete Altmenge sehen.
CREATE POLICY kategorie_kp11_nur_server ON public.kategorie AS RESTRICTIVE TO anon, authenticated
  USING (tenant_id IS NULL) WITH CHECK (tenant_id IS NULL);
CREATE POLICY kostenposten_kp9_nur_server ON public.kostenposten AS RESTRICTIVE TO anon, authenticated
  USING (tenant_id IS NULL) WITH CHECK (tenant_id IS NULL);
CREATE POLICY kategorie_kp11_mandant ON public.kategorie TO service_role
  USING (tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),''))
  WITH CHECK (tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),''));
CREATE POLICY kostenposten_kp9_mandant ON public.kostenposten TO service_role
  USING (tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),''))
  WITH CHECK (tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),''));

CREATE FUNCTION private.kp11_startkategorien(mandant text) RETURNS void
LANGUAGE sql SET search_path=pg_catalog AS $$
  INSERT INTO public.kategorie(tenant_id,name,typ,sortierung)
  SELECT mandant,name,'ausgabe',sortierung
  FROM (VALUES ('Chemie & Bäder',1),('Schleif-/Poliermittel',2),('Arbeitsschutz (PSA)',3),
    ('Kraftstoff & Fahrzeug',4),('Energie',5),('Büro & Verwaltung',6),('Sonstiges',7)) AS start(name,sortierung)
  WHERE btrim(mandant)<>''
  ON CONFLICT (tenant_id,typ,(lower(btrim(name)))) WHERE tenant_id IS NOT NULL DO NOTHING
$$;
REVOKE ALL ON FUNCTION private.kp11_startkategorien(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.kp11_startkategorien(text) TO service_role;

CREATE FUNCTION private.kp11_nach_firmendaten() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  PERFORM private.kp11_startkategorien(NEW.tenant_id);
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION private.kp11_nach_firmendaten() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.kp11_nach_firmendaten() TO service_role;
CREATE TRIGGER kp11_nach_firmendaten AFTER INSERT ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION private.kp11_nach_firmendaten();

SELECT private.kp11_startkategorien(firma.tenant_id)
FROM (SELECT DISTINCT tenant_id FROM public.company_settings WHERE tenant_id IS NOT NULL) AS firma;
