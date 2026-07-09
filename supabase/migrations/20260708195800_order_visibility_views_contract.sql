-- Reconstructed migration 20260708195800_order_visibility_views_contract.sql
-- Source: Remote pg_get_viewdef / pg_get_functiondef from active Supabase database.
-- Purpose: Bring remote-applied database views contract into local repository alignment.
-- This file is for local version tracking only. No remote db push or modifications are executed during this reconstruction.

-- 1. v_production_orders
CREATE OR REPLACE VIEW public.v_production_orders AS
 SELECT id,
    tenant_id,
    order_number,
    customer_id,
    title,
    task,
    station,
    current_station_id,
    status,
    risk,
    priority_computed,
    parts,
    status_text,
    delay_reason,
    recommended_action,
    intake_date,
    due_date,
    created_at,
    current_station,
    attachment_url,
    attachment_urls,
    inquiry_id,
    kostenstelle_primaer_id,
    db_geplant,
    db_ist,
    db_letzte_berechnung,
    priority,
    promised_due_date,
    completed_date,
    payment_status,
    delivery_method,
    source,
    source_ref,
    freetext_original,
    is_quote,
    quote_status,
    quote_converted_order_id
   FROM orders
  WHERE tenant_id::text = 'galvanik-kreile'::text AND source IS NOT NULL AND (lower(source) = ANY (ARRAY['manual'::text, 'scan'::text, 'customer'::text])) AND customer_id IS NOT NULL AND TRIM(BOTH FROM customer_id) <> ''::text AND order_number IS NOT NULL AND TRIM(BOTH FROM order_number) <> ''::text AND order_number !~* '^A-SEED-'::text AND order_number !~* 'TEST'::text AND (COALESCE(TRIM(BOTH FROM title), ''::text) <> ''::text OR COALESCE(TRIM(BOTH FROM task), ''::text) <> ''::text) AND NOT (title IS NOT NULL AND TRIM(BOTH FROM title) <> ''::text AND (length(TRIM(BOTH FROM title)) < 3 OR TRIM(BOTH FROM title) ~* '^[bcdfghjklmnpqrstvwxyz]{5,}'::text OR TRIM(BOTH FROM title) ~* 'asd|sdf|dfg|fgh|ghj|hjk|jkl|yxc|xcv|cvb|vbn|bnm'::text OR TRIM(BOTH FROM title) ~* '^([a-z])\1+'::text OR (lower(TRIM(BOTH FROM title)) = ANY (ARRAY['gjgvvh'::text, 'sfdghgjklji'::text])) OR lower(TRIM(BOTH FROM title)) ~~ '%auftrag per scan test e2e%'::text OR lower(TRIM(BOTH FROM title)) ~~ '%test order%'::text OR lower(TRIM(BOTH FROM title)) ~~ '%test stoßstange kundenakte%'::text) OR task IS NOT NULL AND TRIM(BOTH FROM task) <> ''::text AND (length(TRIM(BOTH FROM task)) < 3 OR TRIM(BOTH FROM task) ~* '^[bcdfghjklmnpqrstvwxyz]{5,}'::text OR TRIM(BOTH FROM task) ~* 'asd|sdf|dfg|fgh|ghj|hjk|jkl|yxc|xcv|cvb|vbn|bnm'::text OR TRIM(BOTH FROM task) ~* '^([a-z])\1+'::text OR (lower(TRIM(BOTH FROM task)) = ANY (ARRAY['gjgvvh'::text, 'sfdghgjklji'::text])) OR lower(TRIM(BOTH FROM task)) ~~ '%auftrag per scan test e2e%'::text OR lower(TRIM(BOTH FROM task)) ~~ '%test order%'::text OR lower(TRIM(BOTH FROM task)) ~~ '%test stoßstange kundenakte%'::text)) AND NOT (order_number ~* 'test|e2e|demo|seed|mock|fixture|sample|placeholder'::text OR title ~* 'test|e2e|demo|seed|mock|fixture|sample|placeholder'::text OR task ~* 'test|e2e|demo|seed|mock|fixture|sample|placeholder'::text);

-- 2. fn_is_production_order
CREATE OR REPLACE FUNCTION public.fn_is_production_order(p_order_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM v_production_orders WHERE id = p_order_id
  );
END;
$function$;

-- 3. v_analyse_durchlaufzeit
CREATE OR REPLACE VIEW public.v_analyse_durchlaufzeit AS
 SELECT round(avg(EXTRACT(epoch FROM completed_date - created_at::timestamp with time zone) / 86400.0), 1) AS avg_tage,
    count(*) AS n
   FROM v_production_orders
  WHERE completed_date IS NOT NULL AND completed_date >= (now() - '30 days'::interval);

-- 4. v_analyse_kunden_kpi
CREATE OR REPLACE VIEW public.v_analyse_kunden_kpi AS
 SELECT id AS customer_id,
    COALESCE(company_name, name) AS kunde,
    classification,
    created_at AS kunde_seit,
    COALESCE(( SELECT sum(ar.brutto) AS sum
           FROM ausgangsrechnung ar
             JOIN v_production_orders o ON o.id = ar.order_id
          WHERE o.customer_id = c.id AND ar.status <> 'storniert'::text AND ar.tenant_id::text = 'galvanik-kreile'::text), 0::numeric) AS umsatz_ltv,
    COALESCE(( SELECT sum(i.preis_netto) AS sum
           FROM items i
             JOIN v_production_orders o ON o.id = i.order_id
          WHERE o.customer_id = c.id AND i.tenant_id::text = 'galvanik-kreile'::text), 0::numeric) - COALESCE(( SELECT sum(cu.quantity * cu.unit_cost_eur) AS sum
           FROM consumable_uses cu
             JOIN v_production_orders o ON o.id = cu.order_id
          WHERE o.customer_id = c.id AND cu.tenant_id = 'galvanik-kreile'::text), 0::numeric) - COALESCE(( SELECT sum(az.dauer_minuten::numeric / 60.0 * az.kostensatz_eur_pro_stunde) AS sum
           FROM arbeitszeit_buchung az
             JOIN v_production_orders o ON o.id = az.auftrag_id
          WHERE o.customer_id = c.id AND az.tenant_id = 'galvanik-kreile'::text), 0::numeric) AS gewinn_ltv,
    COALESCE(( SELECT sum(ar.brutto) AS sum
           FROM ausgangsrechnung ar
             JOIN v_production_orders o ON o.id = ar.order_id
          WHERE o.customer_id = c.id AND ar.bezahlt_am IS NULL AND (ar.status <> ALL (ARRAY['storniert'::text, 'bezahlt'::text])) AND ar.tenant_id::text = 'galvanik-kreile'::text), 0::numeric) AS offene_posten,
    ( SELECT count(*) AS count
           FROM v_production_orders o
          WHERE o.customer_id = c.id AND (o.status::text <> ALL (ARRAY['abgeschlossen'::character varying, 'storniert'::character varying]::text[]))) AS aktive_auftraege,
        CASE
            WHEN (( SELECT count(*) AS count
               FROM v_production_orders o
              WHERE o.customer_id = c.id AND o.completed_date IS NOT NULL AND o.promised_due_date IS NOT NULL)) > 0 THEN round((( SELECT count(*) AS count
               FROM v_production_orders o
              WHERE o.customer_id = c.id AND o.completed_date <= o.promised_due_date AND o.completed_date IS NOT NULL AND o.promised_due_date IS NOT NULL))::numeric * 100.0 / (( SELECT count(*) AS count
               FROM v_production_orders o
              WHERE o.customer_id = c.id AND o.completed_date IS NOT NULL AND o.promised_due_date IS NOT NULL))::numeric, 1)
            ELSE NULL::numeric
        END AS puenklichkeit_pct,
    COALESCE(( SELECT count(*) AS count
           FROM complaints co
             JOIN v_production_orders o ON o.id = co.order_id
          WHERE o.customer_id = c.id AND co.tenant_id = 'galvanik-kreile'::text), 0::bigint) AS reklamationen
   FROM customers c
  WHERE tenant_id::text = 'galvanik-kreile'::text;

-- 5. v_analyse_station_durchlauf
CREATE OR REPLACE VIEW public.v_analyse_station_durchlauf AS
 WITH eingang AS (
         SELECT events.order_id,
            events.station,
            min(events.created_at) AS ts_ein
           FROM events
          WHERE events.event_type::text = 'STATION_EINGANG'::text AND events.station IS NOT NULL AND fn_is_production_order(events.order_id)
          GROUP BY events.order_id, events.station
        ), ausgang AS (
         SELECT events.order_id,
            events.station,
            max(events.created_at) AS ts_aus
           FROM events
          WHERE events.event_type::text = 'STATION_AUSGANG'::text AND events.station IS NOT NULL AND fn_is_production_order(events.order_id)
          GROUP BY events.order_id, events.station
        )
 SELECT e.station,
    round(avg(EXTRACT(epoch FROM a.ts_aus - e.ts_ein) / 86400.0), 1) AS avg_tage,
    count(*) AS n,
    ( SELECT count(*) AS count
           FROM items
          WHERE items.current_station_id::text = e.station AND fn_is_production_order(items.order_id)) AS teile_aktuell
   FROM eingang e
     JOIN ausgang a ON a.order_id = e.order_id AND a.station = e.station
  WHERE e.ts_ein >= (now() - '30 days'::interval)
  GROUP BY e.station;

-- 6. v_analyse_termintreue
CREATE OR REPLACE VIEW public.v_analyse_termintreue AS
 SELECT count(*) FILTER (WHERE completed_date IS NOT NULL AND promised_due_date IS NOT NULL AND completed_date <= promised_due_date) AS puenktlich,
    count(*) FILTER (WHERE completed_date IS NOT NULL AND promised_due_date IS NOT NULL) AS nenner,
        CASE
            WHEN count(*) FILTER (WHERE completed_date IS NOT NULL AND promised_due_date IS NOT NULL) > 0 THEN round(count(*) FILTER (WHERE completed_date <= promised_due_date AND completed_date IS NOT NULL AND promised_due_date IS NOT NULL)::numeric * 100.0 / count(*) FILTER (WHERE completed_date IS NOT NULL AND promised_due_date IS NOT NULL)::numeric, 1)
            ELSE NULL::numeric
        END AS termintreue_pct,
    count(*) FILTER (WHERE promised_due_date IS NULL AND status::text <> 'storniert'::text) AS ohne_zusagetermin
   FROM v_production_orders
  WHERE created_at >= date_trunc('week'::text, now());

-- 7. v_analyse_wochenziel
CREATE OR REPLACE VIEW public.v_analyse_wochenziel AS
 SELECT count(*) AS fertig_diese_woche
   FROM v_production_orders
  WHERE completed_date IS NOT NULL AND completed_date >= date_trunc('week'::text, now());

-- 8. v_auftrag_db
CREATE OR REPLACE VIEW public.v_auftrag_db AS
 SELECT o.id AS order_id,
    o.order_number,
    o.customer_id,
    c.name AS kunde_name,
    c.company_name,
    o.intake_date,
    o.status,
    o.current_station,
    o.due_date,
    COALESCE(( SELECT sum(ar.netto) AS sum
           FROM ausgangsrechnung ar
          WHERE ar.order_id = o.id AND (ar.is_demo IS NULL OR ar.is_demo = false) AND ar.tenant_id::text = 'galvanik-kreile'::text), 0::numeric) AS erloes_netto,
    COALESCE(( SELECT sum(abs(sm.quantity) * COALESCE(sm.snapshot_einkaufspreis_eur, 0::numeric)) AS sum
           FROM stock_movements sm
          WHERE sm.order_id = o.id AND sm.movement_type = 'verbrauch'::text AND sm.tenant_id = 'galvanik-kreile'::text), 0::numeric) AS material_kosten,
    COALESCE(( SELECT sum(zb.dauer_minuten::numeric / 60.0 * zb.kostensatz_eur_pro_stunde) AS sum
           FROM arbeitszeit_buchung zb
          WHERE zb.auftrag_id = o.id AND zb.tenant_id = 'galvanik-kreile'::text), 0::numeric) AS arbeitszeit_kosten,
    COALESCE(( SELECT sum(zb.dauer_minuten::numeric / 60.0 * COALESCE(kem.energie_eur_pro_stunde, 0::numeric)) AS sum
           FROM arbeitszeit_buchung zb
             LEFT JOIN kostenstelle ks_bridge ON ks_bridge.kuerzel = zb.kostenstelle_kuerzel AND ks_bridge.tenant_id = zb.tenant_id
             LEFT JOIN kostenstellen_energie_monat kem ON kem.kostenstelle_id = ks_bridge.id AND kem.monat = date_trunc('month'::text, zb.start_zeit)::date AND kem.tenant_id = 'galvanik-kreile'::text
          WHERE zb.auftrag_id = o.id AND zb.tenant_id = 'galvanik-kreile'::text), 0::numeric) AS energie_anteil_kosten,
    COALESCE(( SELECT sum(ar.netto) AS sum
           FROM ausgangsrechnung ar
          WHERE ar.order_id = o.id AND (ar.is_demo IS NULL OR ar.is_demo = false) AND ar.tenant_id::text = 'galvanik-kreile'::text), 0::numeric) - COALESCE(( SELECT sum(abs(sm.quantity) * COALESCE(sm.snapshot_einkaufspreis_eur, 0::numeric)) AS sum
           FROM stock_movements sm
          WHERE sm.order_id = o.id AND sm.movement_type = 'verbrauch'::text AND sm.tenant_id = 'galvanik-kreile'::text), 0::numeric) - COALESCE(( SELECT sum(zb.dauer_minuten::numeric / 60.0 * zb.kostensatz_eur_pro_stunde) AS sum
           FROM arbeitszeit_buchung zb
          WHERE zb.auftrag_id = o.id AND zb.tenant_id = 'galvanik-kreile'::text), 0::numeric) - COALESCE(( SELECT sum(zb.dauer_minuten::numeric / 60.0 * COALESCE(kem.energie_eur_pro_stunde, 0::numeric)) AS sum
           FROM arbeitszeit_buchung zb
             LEFT JOIN kostenstelle ks_bridge ON ks_bridge.kuerzel = zb.kostenstelle_kuerzel AND ks_bridge.tenant_id = zb.tenant_id
             LEFT JOIN kostenstellen_energie_monat kem ON kem.kostenstelle_id = ks_bridge.id AND kem.monat = date_trunc('month'::text, zb.start_zeit)::date AND kem.tenant_id = 'galvanik-kreile'::text
          WHERE zb.auftrag_id = o.id AND zb.tenant_id = 'galvanik-kreile'::text), 0::numeric) AS deckungsbeitrag,
        CASE
            WHEN COALESCE(( SELECT sum(ar.netto) AS sum
               FROM ausgangsrechnung ar
              WHERE ar.order_id = o.id AND (ar.is_demo IS NULL OR ar.is_demo = false) AND ar.tenant_id::text = 'galvanik-kreile'::text), 0::numeric) > 0::numeric THEN (COALESCE(( SELECT sum(ar.netto) AS sum
               FROM ausgangsrechnung ar
              WHERE ar.order_id = o.id AND (ar.is_demo IS NULL OR ar.is_demo = false) AND ar.tenant_id::text = 'galvanik-kreile'::text), 0::numeric) - COALESCE(( SELECT sum(abs(sm.quantity) * COALESCE(sm.snapshot_einkaufspreis_eur, 0::numeric)) AS sum
               FROM stock_movements sm
              WHERE sm.order_id = o.id AND sm.movement_type = 'verbrauch'::text AND sm.tenant_id = 'galvanik-kreile'::text), 0::numeric) - COALESCE(( SELECT sum(zb.dauer_minuten::numeric / 60.0 * zb.kostensatz_eur_pro_stunde) AS sum
               FROM arbeitszeit_buchung zb
              WHERE zb.auftrag_id = o.id AND zb.tenant_id = 'galvanik-kreile'::text), 0::numeric) - COALESCE(( SELECT sum(zb.dauer_minuten::numeric / 60.0 * COALESCE(kem.energie_eur_pro_stunde, 0::numeric)) AS sum
               FROM arbeitszeit_buchung zb
                 LEFT JOIN kostenstelle ks_bridge ON ks_bridge.kuerzel = zb.kostenstelle_kuerzel AND ks_bridge.tenant_id = zb.tenant_id
                 LEFT JOIN kostenstellen_energie_monat kem ON kem.kostenstelle_id = ks_bridge.id AND kem.monat = date_trunc('month'::text, zb.start_zeit)::date AND kem.tenant_id = 'galvanik-kreile'::text
              WHERE zb.auftrag_id = o.id AND zb.tenant_id = 'galvanik-kreile'::text), 0::numeric)) / NULLIF(( SELECT sum(ar.netto) AS sum
               FROM ausgangsrechnung ar
              WHERE ar.order_id = o.id AND (ar.is_demo IS NULL OR ar.is_demo = false) AND ar.tenant_id::text = 'galvanik-kreile'::text), 0::numeric)
            ELSE NULL::numeric
        END AS db_marge,
    ( SELECT count(*) AS count
           FROM ausgangsrechnung ar
          WHERE ar.order_id = o.id AND ar.tenant_id::text = 'galvanik-kreile'::text) AS anz_rechnungen,
    ( SELECT count(*) AS count
           FROM stock_movements sm
          WHERE sm.order_id = o.id AND sm.movement_type = 'verbrauch'::text AND sm.tenant_id = 'galvanik-kreile'::text) AS anz_verbrauch,
    ( SELECT count(*) AS count
           FROM arbeitszeit_buchung zb
          WHERE zb.auftrag_id = o.id AND zb.tenant_id = 'galvanik-kreile'::text) AS anz_zeitbuchungen
   FROM v_production_orders o
     LEFT JOIN customers c ON c.id = o.customer_id;

-- 9. v_analyse_werkstatt_puls_economics
CREATE OR REPLACE VIEW public.v_analyse_werkstatt_puls_economics AS
 SELECT o.id AS order_id,
    o.order_number,
    o.customer_id,
    c.name AS customer_name,
    COALESCE(o.current_station, o.station::text) AS station_id,
    COALESCE(o.current_station, o.station::text) AS station_name,
    COALESCE(ar_sum.netto_sum, ofi.invoiced_revenue_net_eur, ofi.approved_revenue_net_eur, ofi.expected_revenue_net_eur) AS revenue_reference_eur,
        CASE
            WHEN ar_sum.netto_sum IS NOT NULL THEN 'invoice'::text
            WHEN ofi.invoiced_revenue_net_eur IS NOT NULL THEN 'invoiced'::text
            WHEN ofi.approved_revenue_net_eur IS NOT NULL THEN 'approved'::text
            WHEN ofi.expected_revenue_net_eur IS NOT NULL THEN 'expected'::text
            ELSE 'missing'::text
        END AS revenue_source,
    vdb.deckungsbeitrag AS db_ist,
    vdb.db_marge,
    vdb.erloes_netto,
    vdb.material_kosten,
    vdb.arbeitszeit_kosten,
        CASE
            WHEN o.promised_due_date IS NOT NULL AND o.completed_date IS NULL THEN GREATEST(0::numeric, EXTRACT(epoch FROM now() - o.promised_due_date) / 86400.0)
            ELSE 0::numeric
        END AS delay_days,
    COALESCE(oce_sum.actual_delay_cost_eur, 0::numeric) AS actual_delay_cost_eur,
        CASE
            WHEN kca_delay.value_numeric IS NOT NULL AND o.promised_due_date IS NOT NULL AND o.completed_date IS NULL THEN GREATEST(0::numeric, EXTRACT(epoch FROM now() - o.promised_due_date) / 86400.0) * kca_delay.value_numeric
            ELSE NULL::numeric
        END AS model_delay_risk_eur,
        CASE
            WHEN ar_sum.netto_sum IS NOT NULL OR ofi.invoiced_revenue_net_eur IS NOT NULL THEN 'high'::text
            WHEN ofi.approved_revenue_net_eur IS NOT NULL THEN 'medium'::text
            WHEN ofi.expected_revenue_net_eur IS NOT NULL THEN 'low'::text
            ELSE 'none'::text
        END AS confidence,
    array_remove(ARRAY[
        CASE
            WHEN COALESCE(ar_sum.netto_sum, ofi.invoiced_revenue_net_eur, ofi.approved_revenue_net_eur, ofi.expected_revenue_net_eur) IS NULL THEN 'Auftragswert fehlt'::text
            ELSE NULL::text
        END,
        CASE
            WHEN vdb.deckungsbeitrag IS NULL AND vdb.erloes_netto = 0::numeric THEN 'DB-Grundlage fehlt'::text
            ELSE NULL::text
        END,
        CASE
            WHEN kca_delay.value_numeric IS NULL THEN 'Terminrisiko-Modell nicht konfiguriert'::text
            ELSE NULL::text
        END,
        CASE
            WHEN o.promised_due_date IS NULL THEN 'Zusagetermin fehlt'::text
            ELSE NULL::text
        END], NULL::text) AS missing_reasons
   FROM v_production_orders o
     LEFT JOIN customers c ON c.id = o.customer_id
     LEFT JOIN order_financials ofi ON ofi.order_id = o.id
     LEFT JOIN v_auftrag_db vdb ON vdb.order_id = o.id
     LEFT JOIN ( SELECT ar.order_id,
            sum(ar.netto) AS netto_sum
           FROM ausgangsrechnung ar
          WHERE (ar.is_demo IS NULL OR ar.is_demo = false) AND ar.tenant_id::text = 'galvanik-kreile'::text
          GROUP BY ar.order_id) ar_sum ON ar_sum.order_id = o.id
     LEFT JOIN ( SELECT oce.order_id,
            sum(oce.amount_eur) AS actual_delay_cost_eur
           FROM order_cost_events oce
          WHERE (oce.caused_by = ANY (ARRAY['delay'::text, 'engpass'::text, 'terminrettung'::text])) AND oce.tenant_id = 'galvanik-kreile'::text
          GROUP BY oce.order_id) oce_sum ON oce_sum.order_id = o.id
     LEFT JOIN kpi_cost_assumptions kca_delay ON kca_delay.key = 'delay_cost_per_day_eur'::text AND kca_delay.is_active = true AND kca_delay.tenant_id = o.tenant_id::text
  WHERE COALESCE(o.status, ''::character varying)::text <> ALL (ARRAY['closed'::character varying, 'abgeschlossen'::character varying, 'cancelled'::character varying, 'storniert'::character varying]::text[]);

-- 10. v_engpass
CREATE OR REPLACE VIEW public.v_engpass AS
 SELECT id AS kostenstelle_id,
    kuerzel,
    name,
    typ,
    ( SELECT count(*) AS count
           FROM v_production_orders o
          WHERE o.current_station = ks.kuerzel AND (o.status::text <> ALL (ARRAY['completed'::character varying, 'abgeschlossen'::character varying, 'cancelled'::character varying, 'storniert'::character varying]::text[]))) AS warteschlange_aktuell,
    ( SELECT avg(zb.dauer_minuten::numeric / 60.0) AS avg
           FROM arbeitszeit_buchung zb
          WHERE zb.kostenstelle_kuerzel = ks.kuerzel AND zb.start_zeit > (now() - '30 days'::interval) AND zb.tenant_id = ks.tenant_id) AS avg_stunden_pro_auftrag_30d,
    ( SELECT COALESCE(sum(zb.dauer_minuten), 0::bigint)::numeric / 60.0
           FROM arbeitszeit_buchung zb
          WHERE zb.kostenstelle_kuerzel = ks.kuerzel AND date_trunc('month'::text, zb.start_zeit) = date_trunc('month'::text, now()) AND zb.tenant_id = ks.tenant_id) AS gebuchte_stunden_aktuell,
    verfuegbare_stunden_monatlich,
        CASE
            WHEN COALESCE(verfuegbare_stunden_monatlich, 0::numeric) > 0::numeric THEN (( SELECT COALESCE(sum(zb.dauer_minuten), 0::bigint)::numeric / 60.0
               FROM arbeitszeit_buchung zb
              WHERE zb.kostenstelle_kuerzel = ks.kuerzel AND date_trunc('month'::text, zb.start_zeit) = date_trunc('month'::text, now()) AND zb.tenant_id = ks.tenant_id)) / verfuegbare_stunden_monatlich
            ELSE NULL::numeric
        END AS auslastung_quote,
    LEAST(1.0, GREATEST(0::numeric,
        CASE
            WHEN COALESCE(verfuegbare_stunden_monatlich, 0::numeric) > 0::numeric THEN (( SELECT COALESCE(sum(zb.dauer_minuten), 0::bigint)::numeric / 60.0
               FROM arbeitszeit_buchung zb
              WHERE zb.kostenstelle_kuerzel = ks.kuerzel AND date_trunc('month'::text, zb.start_zeit) = date_trunc('month'::text, now()) AND zb.tenant_id = ks.tenant_id)) / verfuegbare_stunden_monatlich
            ELSE 0::numeric
        END)) AS engpass_score
   FROM kostenstelle ks
  WHERE typ = 'produktion'::text AND tenant_id = 'galvanik-kreile'::text;

-- 11. v_kunde_clv
CREATE OR REPLACE VIEW public.v_kunde_clv AS
 SELECT c.id AS customer_id,
    c.name,
    c.company_name,
    c.type AS kundentyp,
    c.created_at AS erstkontakt,
    count(DISTINCT o.id) AS auftraege_gesamt,
    count(DISTINCT o.id) FILTER (WHERE o.intake_date > (now() - '1 year'::interval)) AS auftraege_12m,
    COALESCE(sum(vdb.erloes_netto), 0::numeric) AS umsatz_gesamt,
    COALESCE(sum(vdb.deckungsbeitrag), 0::numeric) AS db_gesamt,
        CASE
            WHEN COALESCE(sum(vdb.erloes_netto), 0::numeric) > 0::numeric THEN sum(vdb.deckungsbeitrag) / sum(vdb.erloes_netto)
            ELSE NULL::numeric
        END AS db_marge,
    max(o.intake_date) AS letzter_auftrag,
    ( SELECT count(*) AS count
           FROM complaints cpl
          WHERE cpl.customer_id = c.id AND cpl.tenant_id = 'galvanik-kreile'::text) AS reklamationen,
    avg(EXTRACT(epoch FROM (( SELECT max(zb.start_zeit) AS max
           FROM arbeitszeit_buchung zb
          WHERE zb.auftrag_id = o.id AND zb.tenant_id = 'galvanik-kreile'::text)) - o.intake_date::timestamp with time zone) / 86400.0)::numeric(8,1) AS avg_durchlauf_tage,
    avg(ar.bezahlt_am - ar.faellig_am)::numeric(8,1) AS avg_zahlungsverzug_tage
   FROM customers c
     LEFT JOIN v_production_orders o ON o.customer_id = c.id
     LEFT JOIN v_auftrag_db vdb ON vdb.order_id = o.id
     LEFT JOIN ausgangsrechnung ar ON ar.order_id = o.id AND (ar.is_demo IS NULL OR ar.is_demo = false) AND ar.tenant_id::text = 'galvanik-kreile'::text
  WHERE c.tenant_id::text = 'galvanik-kreile'::text
  GROUP BY c.id, c.name, c.company_name, c.type, c.created_at;

-- 12. v_monatsergebnis
CREATE OR REPLACE VIEW public.v_monatsergebnis AS
 WITH erloes AS (
         SELECT date_trunc('month'::text, ar.datum::timestamp with time zone)::date AS monat,
            sum(ar.netto) AS summe
           FROM ausgangsrechnung ar
          WHERE (ar.is_demo IS NULL OR ar.is_demo = false) AND ar.tenant_id::text = 'galvanik-kreile'::text
          GROUP BY (date_trunc('month'::text, ar.datum::timestamp with time zone)::date)
        ), material AS (
         SELECT date_trunc('month'::text, b.erstellt_am)::date AS monat,
            sum(b.netto) AS summe
           FROM beleg b
             LEFT JOIN konto k ON k.id = b.konto_id
          WHERE k.kategorie = 'wareneinsatz'::text AND k.tenant_id = 'galvanik-kreile'::text
          GROUP BY (date_trunc('month'::text, b.erstellt_am)::date)
        ), personal AS (
         SELECT date_trunc('month'::text, zb.start_zeit)::date AS monat,
            sum(zb.dauer_minuten::numeric / 60.0 * zb.kostensatz_eur_pro_stunde) AS summe
           FROM arbeitszeit_buchung zb
          WHERE zb.tenant_id = 'galvanik-kreile'::text
          GROUP BY (date_trunc('month'::text, zb.start_zeit)::date)
        ), energie AS (
         SELECT date_trunc('month'::text, b.erstellt_am)::date AS monat,
            sum(b.netto) AS summe
           FROM beleg b
             LEFT JOIN konto k ON k.id = b.konto_id
          WHERE k.kategorie = 'energie'::text AND k.tenant_id = 'galvanik-kreile'::text
          GROUP BY (date_trunc('month'::text, b.erstellt_am)::date)
        ), sachkosten AS (
         SELECT date_trunc('month'::text, b.erstellt_am)::date AS monat,
            sum(b.netto) AS summe
           FROM beleg b
             LEFT JOIN konto k ON k.id = b.konto_id
          WHERE k.kategorie = 'sachkosten'::text AND k.tenant_id = 'galvanik-kreile'::text
          GROUP BY (date_trunc('month'::text, b.erstellt_am)::date)
        ), alle_monate AS (
         SELECT erloes.monat
           FROM erloes
        UNION
         SELECT material.monat
           FROM material
        UNION
         SELECT personal.monat
           FROM personal
        UNION
         SELECT energie.monat
           FROM energie
        UNION
         SELECT sachkosten.monat
           FROM sachkosten
        )
 SELECT am.monat,
    COALESCE(e.summe, 0::numeric) AS erloes_netto,
    COALESCE(m.summe, 0::numeric) AS material_kosten,
    COALESCE(p.summe, 0::numeric) AS personal_kosten,
    COALESCE(en.summe, 0::numeric) AS energie_kosten,
    COALESCE(s.summe, 0::numeric) AS sachkosten,
    COALESCE(e.summe, 0::numeric) - COALESCE(m.summe, 0::numeric) - COALESCE(p.summe, 0::numeric) - COALESCE(en.summe, 0::numeric) - COALESCE(s.summe, 0::numeric) AS ergebnis
   FROM alle_monate am
     LEFT JOIN erloes e ON e.monat = am.monat
     LEFT JOIN material m ON m.monat = am.monat
     LEFT JOIN personal p ON p.monat = am.monat
     LEFT JOIN energie en ON en.monat = am.monat
     LEFT JOIN sachkosten s ON s.monat = am.monat
  ORDER BY am.monat DESC;

-- 13. v_periodenabschluss_status
CREATE OR REPLACE VIEW public.v_periodenabschluss_status AS
 SELECT id,
    jahr,
    monat,
    status,
    geschlossen_am,
    ( SELECT count(*) AS count
           FROM beleg b
          WHERE b.periode_id = p.id AND b.konto_id IS NULL) AS belege_ohne_konto,
    ( SELECT count(*) AS count
           FROM beleg b
          WHERE b.periode_id = p.id AND b.kostenstelle_id IS NULL) AS belege_ohne_kostenstelle,
    ( SELECT count(*) AS count
           FROM ausgangsrechnung ar
          WHERE ar.periode_id = p.id AND ar.order_id IS NULL AND ar.tenant_id::text = p.tenant_id) AS rechnungen_ohne_auftrag,
    ( SELECT count(*) AS count
           FROM ausgangsrechnung ar
          WHERE ar.periode_id = p.id AND ar.bezahlt_am IS NULL AND ar.tenant_id::text = p.tenant_id) AS rechnungen_offen,
    ( SELECT count(*) AS count
           FROM v_production_orders o
          WHERE (o.status::text = ANY (ARRAY['completed'::character varying, 'abgeschlossen'::character varying]::text[])) AND date_trunc('month'::text, o.due_date) = make_date(p.jahr, p.monat, 1) AND o.db_ist IS NULL) AS auftraege_ohne_db
   FROM periode p
  WHERE tenant_id = 'galvanik-kreile'::text;

-- 14. v_aging
CREATE OR REPLACE VIEW public.v_aging AS
 SELECT ar.id,
    ar.nummer AS rechnungsnummer,
    ar.kunde_id AS customer_id,
    c.name AS kunde_name,
    c.company_name,
    ar.netto,
    ar.brutto,
    ar.faellig_am,
    ar.bezahlt_am,
    ar.mahnstufe,
        CASE
            WHEN ar.bezahlt_am IS NOT NULL THEN 'bezahlt'::text
            WHEN ar.faellig_am IS NULL THEN 'ohne_faelligkeit'::text
            WHEN now()::date <= ar.faellig_am THEN 'nicht_faellig'::text
            WHEN (now()::date - ar.faellig_am) <= 14 THEN '1-14'::text
            WHEN (now()::date - ar.faellig_am) <= 30 THEN '15-30'::text
            WHEN (now()::date - ar.faellig_am) <= 60 THEN '31-60'::text
            WHEN (now()::date - ar.faellig_am) <= 90 THEN '61-90'::text
            ELSE '>90'::text
        END AS aging_bucket,
        CASE
            WHEN ar.bezahlt_am IS NULL AND ar.faellig_am IS NOT NULL THEN GREATEST(0, now()::date - ar.faellig_am)
            ELSE NULL::integer
        END AS tage_ueberfaellig
   FROM ausgangsrechnung ar
     LEFT JOIN customers c ON c.id = ar.kunde_id
  WHERE (ar.is_demo IS NULL OR ar.is_demo = false) AND ar.tenant_id::text = 'galvanik-kreile'::text;
