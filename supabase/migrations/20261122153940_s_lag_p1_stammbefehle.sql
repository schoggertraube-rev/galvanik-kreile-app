-- PL 20.11. 09:05: Status am vorhandenen Artikelstamm und das bestehende Loginrecht.
ALTER TABLE public.inventory_items
  ADD COLUMN stamm_status text NOT NULL DEFAULT 'aktiv' CHECK (stamm_status IN ('aktiv', 'entwurf')),
  ADD COLUMN stamm_version integer NOT NULL DEFAULT 1 CHECK (stamm_version > 0);
ALTER TABLE public.categories ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version > 0);

ALTER TABLE public.app_user_rights
  DROP CONSTRAINT app_user_rights_bereich_chk,
  ADD CONSTRAINT app_user_rights_bereich_chk CHECK (bereich IN (
    'auftraege', 'eingang', 'kunden', 'preise', 'zahlungen', 'buchhaltung', 'kassieren', 'mails',
    'entscheiden', 'einstellungen', 'logins', 'wartung', 'statistik_alle', 'protokoll', 'lager.stamm'
  ));
INSERT INTO public.app_user_rights (tenant_id, user_id, bereich)
SELECT tenant_id, id, 'lager.stamm' FROM public.app_users
WHERE role IN ('admin', 'buero')
ON CONFLICT (tenant_id, user_id, bereich) DO NOTHING;


ALTER TABLE public.tasks
  DROP CONSTRAINT tasks_fuer_bereich_check,
  ADD CONSTRAINT tasks_fuer_bereich_check CHECK (fuer_bereich IN (
    'auftraege','eingang','kunden','preise','zahlungen','buchhaltung','kassieren','mails',
    'entscheiden','einstellungen','logins','wartung','lager.stamm'
  )),
  DROP CONSTRAINT tasks_bezug_typ_check,
  ADD CONSTRAINT tasks_bezug_typ_check CHECK (
    bezug_typ IN ('kunde','auftrag','kv','eingang','eingangsrechnung','reklamation','allgemein','lagerartikel')
  );

-- Vorhandener mandantengebundener Kontext für den bestehenden TaskWriter.
CREATE OR REPLACE VIEW private.v_task_contexts_v1 WITH (security_invoker = true) AS
  SELECT customer.tenant_id::text AS tenant_id, 'kunde'::text AS kind,
    customer.id, customer.name AS label, customer.id AS customer_id,
    customer.type AS customer_type, NULL::text AS order_id, NULL::text AS channel,
    customer.phone, NULL::integer AS source_version
  FROM public.customers customer
  WHERE customer.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
  UNION ALL
  SELECT orders.tenant_id, 'auftrag', orders.id, orders.order_number,
    orders.customer_id, customer.type, orders.id, NULL, customer.phone, NULL
  FROM public.orders orders
  JOIN public.customers customer ON customer.tenant_id = orders.tenant_id
    AND customer.id = orders.customer_id
  WHERE orders.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
  UNION ALL
  SELECT quote.tenant_id, 'kv', quote.id::text, quote.quote_number,
    quote.customer_id, customer.type, NULL, NULL, customer.phone, NULL
  FROM private.quotes quote
  JOIN public.customers customer ON customer.tenant_id = quote.tenant_id
    AND customer.id = quote.customer_id
  WHERE quote.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
  UNION ALL
  SELECT source.tenant_id, 'eingang', source.id::text,
    CASE WHEN source.kanal = 'notiz' THEN left(source.text, 120) ELSE source.betreff END,
    source.kunde_id, customer.type,
    CASE WHEN source.vorgang_art = 'auftrag' THEN source.vorgang_id END,
    source.kanal, customer.phone, source.version
  FROM public.intake_item source
  LEFT JOIN public.customers customer ON customer.tenant_id = source.tenant_id
    AND customer.id = source.kunde_id
  WHERE source.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
  UNION ALL
  SELECT invoice.tenant_id, 'eingangsrechnung', invoice.id::text,
    invoice.nummer_intern, invoice.lieferant_id, customer.type, NULL,
    source.kanal, customer.phone, invoice.version
  FROM public.supplier_invoice invoice
  JOIN public.intake_item source ON source.tenant_id = invoice.tenant_id
    AND source.id = invoice.item_id
  LEFT JOIN public.customers customer ON customer.tenant_id = invoice.tenant_id
    AND customer.id = invoice.lieferant_id
  WHERE invoice.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
  UNION ALL
  SELECT artikel.tenant_id, 'lagerartikel', artikel.id, artikel.name,
    NULL::text AS customer_id, NULL::varchar(50) AS customer_type,
    NULL::text AS order_id, NULL::text AS channel, NULL::text AS phone,
    artikel.stamm_version
  FROM public.inventory_items artikel
  WHERE artikel.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

CREATE VIEW public.v_lager_eingangsoriginale_v1 WITH (security_invoker = true) AS
  SELECT datei.tenant_id, datei.id, datei.item_id, datei.art, datei.aufgenommen_von,
    EXISTS (
      SELECT 1 FROM public.intake_event ereignis
      WHERE ereignis.tenant_id = datei.tenant_id AND ereignis.item_id = datei.item_id
        AND ereignis.art = 'original_gespeichert' AND ereignis.nachher->>'fileId' = datei.id::text
    ) AS gespeichert
  FROM public.intake_file datei
  WHERE datei.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

CREATE VIEW public.v_lager_stammereignisse_v1 WITH (security_invoker = true) AS
  SELECT id, tenant_id, user_id, client_event_id, payload
  FROM public.events
  WHERE tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
    AND event_type = 'LAGER_STAMMBEFEHL_V1' AND status = 'success';

CREATE VIEW public.v_lager_artikel_status_v1 WITH (security_invoker = true) AS
  SELECT id, tenant_id, name, stamm_status, stamm_version
  FROM public.inventory_items
  WHERE tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

CREATE VIEW public.v_lager_entwurf_aufgaben_v1 WITH (security_invoker = true) AS
  SELECT tenant_id, id AS task_id, bezug_id AS artikel_id, titel, faellig_am
  FROM public.tasks
  WHERE tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
    AND bezug_typ = 'lagerartikel' AND fuer_bereich = 'lager.stamm' AND status = 'offen';

REVOKE ALL ON public.v_lager_eingangsoriginale_v1, public.v_lager_stammereignisse_v1,
  public.v_lager_artikel_status_v1, public.v_lager_entwurf_aufgaben_v1 FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.v_lager_eingangsoriginale_v1, public.v_lager_stammereignisse_v1,
  public.v_lager_artikel_status_v1, public.v_lager_entwurf_aufgaben_v1 TO service_role;

-- Enger Schreibanschluss an die vorhandenen Geschäftsereignisse; keine Befehlsablage daneben.
CREATE FUNCTION private.lager_stammereignis_anlegen(
  p_mandant text, p_akteur uuid, p_befehl uuid, p_art text, p_version integer, p_payload jsonb
) RETURNS text
LANGUAGE plpgsql SET search_path = '' AS $fn$
DECLARE
  ereignis_id text;
BEGIN
  IF p_mandant IS NULL OR p_mandant IS DISTINCT FROM nullif(btrim(current_setting('app.tenant_id', true)), '')
    OR p_befehl IS NULL OR p_version IS NULL OR p_version < 1
    OR p_art IS NULL OR p_art NOT IN ('LAGER_STAMMBEFEHL_V1', 'LAGER_ARTIKEL_AUFGABE_V1')
    OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
    OR NOT EXISTS (
      SELECT 1 FROM public.app_users
      WHERE tenant_id = p_mandant AND id = p_akteur AND active IS TRUE
    ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'LAGER_EREIGNIS_UNGUELTIG';
  END IF;

  INSERT INTO public.events (
    id, tenant_id, event_type, description, payload, status, user_id,
    client_event_id, event_schema_version, aggregate_version, correlation_id
  ) VALUES (
    gen_random_uuid()::text, p_mandant, p_art,
    CASE p_art WHEN 'LAGER_STAMMBEFEHL_V1' THEN 'Lagerstammbefehl' ELSE 'Lagerartikel-Aufgabe' END,
    p_payload, 'success', p_akteur, p_befehl, 1, p_version, gen_random_uuid()
  ) RETURNING id INTO ereignis_id;
  RETURN ereignis_id;
END;
$fn$;
REVOKE ALL ON FUNCTION private.lager_stammereignis_anlegen(text, uuid, uuid, text, integer, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.lager_stammereignis_anlegen(text, uuid, uuid, text, integer, jsonb)
  TO service_role;

CREATE VIEW public.v_lager_lieferanten_v1 WITH (security_invoker = true) AS
  SELECT tenant_id, id
  FROM public.customers
  WHERE tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
    AND type = 'lieferant';
REVOKE ALL ON public.v_lager_lieferanten_v1 FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.v_lager_lieferanten_v1 TO service_role;
