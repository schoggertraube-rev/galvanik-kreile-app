-- PREPARED, NOT REMOTELY APPLIED.
-- Replaces placeholder and multiplicative analytics with source-backed,
-- tenant-coupled rollups. Missing economic evidence remains NULL and is never
-- silently converted into profit or pipeline revenue.

BEGIN;

CREATE OR REPLACE VIEW public.v_analyse_kunden_kpi
WITH (security_invoker = true, security_barrier = true) AS
WITH order_economics AS (
  SELECT
    order_fact.tenant_id,
    order_fact.customer_id,
    CASE
      WHEN coalesce(sum(order_fact.anz_rechnungen_ohne_netto), 0) > 0 THEN NULL
      ELSE coalesce(sum(order_fact.erloes_netto)
        FILTER (WHERE order_fact.anz_rechnungen > 0), 0)
    END AS umsatz_ltv,
    CASE
      WHEN count(*) FILTER (
        WHERE order_fact.anz_rechnungen > 0
          AND NOT order_fact.db_berechenbar
      ) > 0 THEN NULL
      ELSE coalesce(sum(order_fact.deckungsbeitrag)
        FILTER (WHERE order_fact.anz_rechnungen > 0), 0)
    END AS gewinn_ltv
  FROM public.v_auftrag_db order_fact
  GROUP BY order_fact.tenant_id, order_fact.customer_id
), invoice_customer AS (
  SELECT
    invoice.tenant_id,
    coalesce(invoice.kunde_id, target_order.customer_id) AS customer_id,
    invoice.brutto,
    invoice.bezahlt_am,
    invoice.status
  FROM public.ausgangsrechnung invoice
  LEFT JOIN public.orders target_order
    ON target_order.tenant_id = invoice.tenant_id
   AND target_order.id = invoice.order_id
  WHERE invoice.is_demo IS NOT TRUE
), invoice_rollup AS (
  SELECT
    tenant_id,
    customer_id,
    coalesce(sum(brutto) FILTER (
      WHERE bezahlt_am IS NULL
        AND status NOT IN ('storniert', 'bezahlt')
    ), 0) AS offene_posten
  FROM invoice_customer
  WHERE customer_id IS NOT NULL
  GROUP BY tenant_id, customer_id
), order_status AS (
  SELECT
    tenant_id,
    customer_id,
    count(*) FILTER (
      WHERE status NOT IN ('completed', 'abgeschlossen', 'cancelled', 'storniert')
    ) AS aktive_auftraege,
    count(*) FILTER (
      WHERE completed_date IS NOT NULL
        AND promised_due_date IS NOT NULL
    ) AS zusagen_mit_abschluss,
    count(*) FILTER (
      WHERE completed_date IS NOT NULL
        AND promised_due_date IS NOT NULL
        AND completed_date <= promised_due_date
    ) AS puenktliche_abschluesse
  FROM public.orders
  GROUP BY tenant_id, customer_id
), complaint_rollup AS (
  SELECT tenant_id, customer_id, count(*) AS reklamationen
  FROM public.complaints
  GROUP BY tenant_id, customer_id
)
SELECT
  customer.id AS customer_id,
  coalesce(customer.company_name, customer.name) AS kunde,
  customer.classification,
  customer.created_at AS kunde_seit,
  CASE
    WHEN economics.customer_id IS NULL THEN 0::numeric
    ELSE economics.umsatz_ltv
  END AS umsatz_ltv,
  CASE
    WHEN economics.customer_id IS NULL THEN 0::numeric
    ELSE economics.gewinn_ltv
  END AS gewinn_ltv,
  coalesce(invoices.offene_posten, 0::numeric) AS offene_posten,
  coalesce(order_state.aktive_auftraege, 0::bigint) AS aktive_auftraege,
  CASE
    WHEN coalesce(order_state.zusagen_mit_abschluss, 0) = 0 THEN NULL
    ELSE round(
      order_state.puenktliche_abschluesse::numeric
      * 100
      / order_state.zusagen_mit_abschluss,
      1
    )
  END AS puenktlichkeit_pct,
  coalesce(complaints.reklamationen, 0::bigint) AS reklamationen
FROM public.customers customer
LEFT JOIN order_economics economics
  ON economics.tenant_id = customer.tenant_id
 AND economics.customer_id = customer.id
LEFT JOIN invoice_rollup invoices
  ON invoices.tenant_id = customer.tenant_id
 AND invoices.customer_id = customer.id
LEFT JOIN order_status order_state
  ON order_state.tenant_id = customer.tenant_id
 AND order_state.customer_id = customer.id
LEFT JOIN complaint_rollup complaints
  ON complaints.tenant_id = customer.tenant_id
 AND complaints.customer_id = customer.id;

CREATE OR REPLACE VIEW public.v_kunde_clv
WITH (security_invoker = true, security_barrier = true) AS
WITH order_rollup AS (
  SELECT
    target_order.tenant_id,
    target_order.customer_id,
    count(*) AS auftraege_gesamt,
    count(*) FILTER (
      WHERE target_order.intake_date > now() - interval '12 months'
    ) AS auftraege_12m,
    CASE
      WHEN coalesce(sum(order_fact.anz_rechnungen_ohne_netto), 0) > 0 THEN NULL
      ELSE coalesce(sum(order_fact.erloes_netto)
        FILTER (WHERE order_fact.anz_rechnungen > 0), 0)
    END AS umsatz_gesamt,
    CASE
      WHEN count(*) FILTER (
        WHERE order_fact.anz_rechnungen > 0
          AND NOT order_fact.db_berechenbar
      ) > 0 THEN NULL
      ELSE coalesce(sum(order_fact.deckungsbeitrag)
        FILTER (WHERE order_fact.anz_rechnungen > 0), 0)
    END AS db_gesamt,
    max(target_order.intake_date) AS letzter_auftrag,
    avg(
      extract(epoch FROM (target_order.completed_date - target_order.intake_date))
      / 86400.0
    ) FILTER (
      WHERE target_order.completed_date IS NOT NULL
        AND target_order.intake_date IS NOT NULL
        AND target_order.completed_date >= target_order.intake_date
    ) AS avg_durchlauf_tage
  FROM public.orders target_order
  LEFT JOIN public.v_auftrag_db order_fact
    ON order_fact.tenant_id = target_order.tenant_id
   AND order_fact.order_id = target_order.id
  GROUP BY target_order.tenant_id, target_order.customer_id
), complaint_rollup AS (
  SELECT tenant_id, customer_id, count(*) AS reklamationen
  FROM public.complaints
  GROUP BY tenant_id, customer_id
), payment_rollup AS (
  SELECT
    invoice.tenant_id,
    coalesce(invoice.kunde_id, target_order.customer_id) AS customer_id,
    avg(invoice.bezahlt_am - invoice.faellig_am) AS avg_zahlungsverzug_tage
  FROM public.ausgangsrechnung invoice
  LEFT JOIN public.orders target_order
    ON target_order.tenant_id = invoice.tenant_id
   AND target_order.id = invoice.order_id
  WHERE invoice.is_demo IS NOT TRUE
    AND invoice.bezahlt_am IS NOT NULL
    AND invoice.faellig_am IS NOT NULL
  GROUP BY invoice.tenant_id, coalesce(invoice.kunde_id, target_order.customer_id)
)
SELECT
  customer.id AS customer_id,
  customer.name,
  customer.company_name,
  customer.type AS kundentyp,
  customer.created_at AS erstkontakt,
  coalesce(order_facts.auftraege_gesamt, 0::bigint) AS auftraege_gesamt,
  coalesce(order_facts.auftraege_12m, 0::bigint) AS auftraege_12m,
  CASE
    WHEN order_facts.customer_id IS NULL THEN 0::numeric
    ELSE order_facts.umsatz_gesamt
  END AS umsatz_gesamt,
  CASE
    WHEN order_facts.customer_id IS NULL THEN 0::numeric
    ELSE order_facts.db_gesamt
  END AS db_gesamt,
  CASE
    WHEN order_facts.umsatz_gesamt > 0
      AND order_facts.db_gesamt IS NOT NULL
    THEN order_facts.db_gesamt / order_facts.umsatz_gesamt
    ELSE NULL
  END AS db_marge,
  order_facts.letzter_auftrag,
  coalesce(complaints.reklamationen, 0::bigint) AS reklamationen,
  order_facts.avg_durchlauf_tage::numeric(8,1) AS avg_durchlauf_tage,
  payments.avg_zahlungsverzug_tage::numeric(8,1) AS avg_zahlungsverzug_tage
FROM public.customers customer
LEFT JOIN order_rollup order_facts
  ON order_facts.tenant_id = customer.tenant_id
 AND order_facts.customer_id = customer.id
LEFT JOIN complaint_rollup complaints
  ON complaints.tenant_id = customer.tenant_id
 AND complaints.customer_id = customer.id
LEFT JOIN payment_rollup payments
  ON payments.tenant_id = customer.tenant_id
 AND payments.customer_id = customer.id;

CREATE OR REPLACE VIEW public.v_pipeline_forecast
WITH (security_invoker = true, security_barrier = true) AS
WITH invoice_rollup AS (
  SELECT
    tenant_id,
    order_id,
    count(*) AS invoice_count,
    count(*) FILTER (
      WHERE netto IS NULL
        OR netto::text IN ('NaN', 'Infinity', '-Infinity')
    ) AS missing_net_count,
    CASE
      WHEN count(*) FILTER (
        WHERE netto IS NULL
          OR netto::text IN ('NaN', 'Infinity', '-Infinity')
      ) > 0 THEN NULL
      ELSE sum(netto)
    END AS revenue_net
  FROM public.ausgangsrechnung
  WHERE is_demo IS NOT TRUE
    AND status <> 'storniert'
    AND order_id IS NOT NULL
  GROUP BY tenant_id, order_id
)
SELECT
  date_trunc('month', target_order.due_date)::date AS erwarteter_monat,
  count(*) AS anz_auftraege,
  sum(
    CASE
      WHEN invoice.invoice_count IS NULL OR invoice.missing_net_count > 0 THEN NULL
      WHEN target_order.intake_date > now() - interval '7 days'
        THEN invoice.revenue_net * 0.80::numeric
      WHEN target_order.intake_date > now() - interval '21 days'
        THEN invoice.revenue_net * 0.60::numeric
      WHEN target_order.intake_date > now() - interval '45 days'
        THEN invoice.revenue_net * 0.30::numeric
      ELSE invoice.revenue_net * 0.10::numeric
    END
  ) AS pipeline_wert_gewichtet,
  sum(invoice.revenue_net) FILTER (
    WHERE invoice.invoice_count > 0
      AND invoice.missing_net_count = 0
  ) AS pipeline_wert_ungewichtet,
  count(*) FILTER (
    WHERE invoice.invoice_count IS NULL
       OR invoice.missing_net_count > 0
  ) AS auftraege_ohne_erloes_evidenz
FROM public.orders target_order
LEFT JOIN invoice_rollup invoice
  ON invoice.tenant_id = target_order.tenant_id
 AND invoice.order_id = target_order.id
WHERE target_order.status NOT IN ('completed', 'abgeschlossen', 'cancelled', 'storniert')
  AND target_order.due_date IS NOT NULL
GROUP BY date_trunc('month', target_order.due_date)::date
ORDER BY erwarteter_monat;

CREATE OR REPLACE VIEW public.v_periodenabschluss_status
WITH (security_invoker = true, security_barrier = true) AS
SELECT
  period.id,
  period.jahr,
  period.monat,
  period.status,
  period.geschlossen_am,
  (
    SELECT count(*)
    FROM public.beleg receipt
    WHERE receipt.periode_id = period.id
      AND receipt.konto_id IS NULL
  ) AS belege_ohne_konto,
  (
    SELECT count(*)
    FROM public.beleg receipt
    WHERE receipt.periode_id = period.id
      AND receipt.kostenstelle_id IS NULL
  ) AS belege_ohne_kostenstelle,
  (
    SELECT count(*)
    FROM public.ausgangsrechnung invoice
    WHERE invoice.periode_id = period.id
      AND invoice.tenant_id = period.tenant_id
      AND invoice.order_id IS NULL
  ) AS rechnungen_ohne_auftrag,
  (
    SELECT count(*)
    FROM public.ausgangsrechnung invoice
    WHERE invoice.periode_id = period.id
      AND invoice.tenant_id = period.tenant_id
      AND invoice.bezahlt_am IS NULL
  ) AS rechnungen_offen,
  (
    SELECT count(*)
    FROM public.orders target_order
    WHERE target_order.tenant_id = period.tenant_id
      AND target_order.status IN ('completed', 'abgeschlossen')
      AND target_order.completed_date IS NOT NULL
      AND date_trunc(
        'month',
        target_order.completed_date AT TIME ZONE 'Europe/Berlin'
      )::date = make_date(period.jahr, period.monat, 1)
      AND target_order.db_ist IS NULL
  ) AS auftraege_ohne_db
FROM public.periode period;

REVOKE ALL PRIVILEGES ON TABLE
  public.v_analyse_kunden_kpi,
  public.v_kunde_clv,
  public.v_pipeline_forecast,
  public.v_periodenabschluss_status
FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON TABLE
  public.v_analyse_kunden_kpi,
  public.v_kunde_clv,
  public.v_pipeline_forecast,
  public.v_periodenabschluss_status
TO service_role;

COMMIT;
