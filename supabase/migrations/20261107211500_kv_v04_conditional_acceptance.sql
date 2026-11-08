-- U-245: a conditional response is evidence of a requested revision, never acceptance.
-- Previous locally applied migration remains immutable. Existing rows are not rewritten.
ALTER TABLE private.quotes
 ADD COLUMN vorbehalt_fassung integer CHECK (vorbehalt_fassung BETWEEN 1 AND fassung),
 ADD COLUMN vorbehalt_am timestamptz,
 ADD COLUMN vorbehalt_grund text CHECK (vorbehalt_grund IS NULL OR length(btrim(vorbehalt_grund)) BETWEEN 3 AND 4000),
 ADD CONSTRAINT quotes_v04_conditional_proof CHECK (
  (vorbehalt_fassung IS NULL AND vorbehalt_am IS NULL AND vorbehalt_grund IS NULL) OR
  (vorbehalt_fassung IS NOT NULL AND vorbehalt_am IS NOT NULL AND vorbehalt_grund IS NOT NULL)
 ),
 ADD CONSTRAINT quotes_v04_no_conditional_acceptance CHECK (vorbehalt_fassung IS NULL OR zugesagt_fassung IS NULL OR vorbehalt_fassung<>zugesagt_fassung);

CREATE OR REPLACE VIEW private.v_quotes_v1 WITH (security_invoker=true) AS
 SELECT quote.id AS quote_id,
    quote.tenant_id,
    quote.quote_number,
    quote.customer_id,
    customer.customer_number,
    COALESCE(NULLIF(customer.company_name, ''::text), customer.name) AS customer_display_name,
    quote.status,
    quote.version,
    quote.currency,
    quote.due_date,
    quote.note,
    quote.total_net_cents,
    quote.linked_order_id,
    quote.created_by,
    creator.full_name AS actor_display_name,
    quote.created_at,
    quote.updated_at,
    quote.converted_at,
    positions.positions,
    ((customer.id IS NOT NULL) AND (creator.id IS NOT NULL) AND (positions.position_count >= 1) AND (positions.position_count <= 20) AND (positions.calculated_total = quote.total_net_cents) AND (((quote.valid_until IS NULL) AND (quote.intake_term_status IS NULL) AND (quote.intake_source IS NULL)) OR ((quote.valid_until IS NOT NULL) AND (quote.intake_term_status = ANY (ARRAY['wunsch'::text, 'bestaetigt'::text, 'verschoben'::text, 'gegenvorschlag'::text])) AND (quote.intake_source = ANY (ARRAY['persoenlich'::text, 'versand'::text, 'abholung_firma'::text, 'anfrage_mail'::text, 'anfrage_telefon'::text])))) AND (((quote.status = 'draft'::text) AND (quote.version >= 1) AND (quote.linked_order_id IS NULL)) OR ((quote.status = 'converted'::text) AND (quote.version >= 2) AND (quote.linked_order_id IS NOT NULL) AND (EXISTS ( SELECT 1
           FROM private.quote_conversion_receipts receipt
          WHERE ((receipt.tenant_id = quote.tenant_id) AND (receipt.quote_id = quote.id) AND (receipt.order_id = quote.linked_order_id) AND (receipt.quote_version = quote.version))))))) AS integrity_ok,
    quote.valid_until,
    quote.intake_term_status,
    quote.intake_source,
    quote.fassung,
    quote.kalk_stunden,
    quote.stundensatz_cents,
    quote.ruest_cents,
    quote.material_cents,
    quote.lieferzeit_wochen,
    quote.gesendet_fassung,
    quote.gesendet_am,
    quote.gesendet_kanal,
    quote.zugesagt_fassung,
    quote.zugesagt_am,
    quote.zusage_nachweis,
    quote.abgesagt_am,
    quote.absage_grund,
    quote.nachfass_am,
    quote.quelle_intake_item_id,
    quote.quelle_nachricht_id,
    quote.sonderwuensche,
    CASE WHEN quote.linked_order_id IS NOT NULL THEN 'umgewandelt'
     WHEN quote.abgesagt_am IS NOT NULL THEN 'abgesagt'
     WHEN quote.zugesagt_fassung=quote.fassung AND quote.zugesagt_am IS NOT NULL AND nullif(btrim(quote.zusage_nachweis),'') IS NOT NULL THEN 'zugesagt'
     WHEN quote.valid_until < (statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date THEN 'abgelaufen'
     WHEN quote.gesendet_fassung < quote.fassung THEN 'geaendert_seit_versand'
     WHEN quote.gesendet_fassung=quote.fassung THEN 'versendet' ELSE 'entwurf' END AS derived_status,
    quote.vorbehalt_fassung,quote.vorbehalt_am,quote.vorbehalt_grund
   FROM (((private.quotes quote
     LEFT JOIN customers customer ON ((((customer.tenant_id)::text = quote.tenant_id) AND (customer.id = quote.customer_id))))
     LEFT JOIN app_users creator ON (((creator.tenant_id = quote.tenant_id) AND (creator.id = quote.created_by))))
     LEFT JOIN LATERAL ( SELECT (count(*))::integer AS position_count,
            (COALESCE(sum(coalesce("position".zeilen_gesamt_cents,"position".line_total_cents)), (0)::numeric))::bigint AS calculated_total,
            jsonb_agg(jsonb_build_object('id', ("position".id)::text, 'position', "position"."position", 'name', "position".name, 'quantity', "position".quantity, 'material', "position".material, 'surfaceRequested', "position".surface_requested, 'unitPriceCents', coalesce("position".zeilen_gesamt_cents::numeric/"position".quantity,"position".unit_price_cents), 'lineTotalCents', coalesce("position".zeilen_gesamt_cents,"position".line_total_cents), 'explicitLineTotal', "position".zeilen_gesamt_cents IS NOT NULL) ORDER BY "position"."position") AS positions
           FROM private.quote_positions "position"
          WHERE (("position".tenant_id = quote.tenant_id) AND ("position".quote_id = quote.id) AND ("position".revision = quote.version))) positions ON (true))
  WHERE ((NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text) IS NOT NULL) AND (quote.tenant_id = NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text)));

CREATE OR REPLACE VIEW private.v_open_quotes_v1 WITH (security_invoker=true) AS SELECT * FROM private.v_quotes_v1 WHERE status='draft';
