-- FOUNDATION_PRODUCTION_BASELINE_001 (Inhalt gehoben auf bewiesenen Prod-Stand 2026-08-06)
-- Zusammensetzung: Schema(public+private) + Grants-Lockdown + Storage-Policies + service_role-ACL.
-- read-only aus Prod syhaigjhsbpjmtnggqka verifiziert; Replay==Prod via f0_schema_fingerprint.sql.

-- ===== PROD_BASELINE_2026-08-06.sql =====
-- Baseline preamble: non-default prod extension
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "private"."current_user_can_view_finance"("expected_tenant" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_users AS app_user
    WHERE app_user.id = (SELECT auth.uid())
      AND app_user.tenant_id = expected_tenant
      AND app_user.active IS TRUE
      AND lower(app_user.role) IN ('developer', 'admin', 'buero')
  );
$$;


ALTER FUNCTION "private"."current_user_can_view_finance"("expected_tenant" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bind_item_photo_upload"("p_job_id" "uuid", "p_tenant_id" "text", "p_user_id" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
DECLARE
  v_status text;
BEGIN
  SELECT j.status INTO v_status
  FROM public.item_photo_jobs j
  WHERE j.id = p_job_id AND j.tenant_id = p_tenant_id AND j.user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_status IN ('uploaded', 'in_flight', 'succeeded') THEN RETURN true; END IF;
  IF v_status <> 'reserved' THEN RETURN false; END IF;
  UPDATE public.item_photo_jobs
  SET status = 'uploaded', uploaded_at = now(), updated_at = now()
  WHERE id = p_job_id;
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."bind_item_photo_upload"("p_job_id" "uuid", "p_tenant_id" "text", "p_user_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_ai_usage_reservation"("p_reservation_id" "uuid", "p_tenant_id" "text", "p_user_id" "text", "p_feature" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE public.ai_usage_reservations AS r
  SET status = 'in_flight', started_at = clock_timestamp(), updated_at = clock_timestamp()
  WHERE id = p_reservation_id
    AND r.tenant_id = p_tenant_id
    AND r.user_id = p_user_id
    AND r.feature = p_feature
    AND r.status = 'reserved'
    AND r.updated_at > clock_timestamp() - interval '5 minutes';
  IF NOT FOUND THEN RETURN false; END IF;
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."claim_ai_usage_reservation"("p_reservation_id" "uuid", "p_tenant_id" "text", "p_user_id" "text", "p_feature" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_item_photo_analysis"("p_job_id" "uuid") RETURNS TABLE("claimed" boolean, "replay" boolean, "job_status" "text", "storage_path" "text", "mime_type" "text", "replay_result" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
DECLARE
  v_job public.item_photo_jobs%ROWTYPE;
BEGIN
  SELECT j.* INTO v_job FROM public.item_photo_jobs j WHERE j.id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, 'missing'::text, NULL::text, NULL::text, NULL::jsonb;
    RETURN;
  END IF;
  IF v_job.status = 'succeeded' AND v_job.analysis_result IS NOT NULL THEN
    RETURN QUERY SELECT false, true, v_job.status, v_job.storage_path, v_job.mime_type, v_job.analysis_result;
    RETURN;
  END IF;
  IF v_job.status <> 'uploaded' THEN
    RETURN QUERY SELECT false, false, v_job.status, NULL::text, NULL::text, NULL::jsonb;
    RETURN;
  END IF;
  UPDATE public.item_photo_jobs
  SET status = 'in_flight', started_at = now(), updated_at = now()
  WHERE id = v_job.id;
  RETURN QUERY SELECT true, false, 'in_flight'::text, v_job.storage_path, v_job.mime_type, NULL::jsonb;
END;
$$;


ALTER FUNCTION "public"."claim_item_photo_analysis"("p_job_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_security_rate_limit"("p_namespace" "text", "p_subject_hash" "text", "p_limit" integer, "p_window_seconds" integer) RETURNS TABLE("allowed" boolean, "remaining" integer, "retry_after_seconds" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'pg_temp'
    AS $_$
DECLARE
  v_counter public.security_rate_limit_counters%ROWTYPE;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_namespace IS NULL
     OR p_namespace !~ '^[a-z0-9._-]{1,80}$'
     OR p_subject_hash IS NULL
     OR p_subject_hash !~ '^[0-9a-f]{64}$'
     OR p_limit IS NULL
     OR p_limit < 1 OR p_limit > 100000
     OR p_window_seconds IS NULL
     OR p_window_seconds < 1 OR p_window_seconds > 2592000 THEN
    RAISE EXCEPTION 'INVALID_SECURITY_RATE_LIMIT_POLICY';
  END IF;

  INSERT INTO public.security_rate_limit_counters (
    namespace, subject_hash, window_started_at, attempt_count, updated_at
  ) VALUES (
    p_namespace, p_subject_hash, v_now, 0, v_now
  ) ON CONFLICT (namespace, subject_hash) DO NOTHING;

  SELECT * INTO STRICT v_counter
  FROM public.security_rate_limit_counters
  WHERE namespace = p_namespace AND subject_hash = p_subject_hash
  FOR UPDATE;

  IF v_counter.window_started_at <= v_now - make_interval(secs => p_window_seconds) THEN
    v_counter.window_started_at := v_now;
    v_counter.attempt_count := 0;
  END IF;

  IF v_counter.attempt_count >= p_limit THEN
    UPDATE public.security_rate_limit_counters
    SET updated_at = v_now
    WHERE namespace = p_namespace AND subject_hash = p_subject_hash;

    RETURN QUERY SELECT
      false,
      0,
      greatest(
        1,
        ceil(extract(epoch FROM (
          v_counter.window_started_at + make_interval(secs => p_window_seconds) - v_now
        )))::integer
      );
    RETURN;
  END IF;

  v_counter.attempt_count := v_counter.attempt_count + 1;
  UPDATE public.security_rate_limit_counters
  SET window_started_at = v_counter.window_started_at,
      attempt_count = v_counter.attempt_count,
      updated_at = v_now
  WHERE namespace = p_namespace AND subject_hash = p_subject_hash;

  RETURN QUERY SELECT true, greatest(0, p_limit - v_counter.attempt_count), 0;
END
$_$;


ALTER FUNCTION "public"."consume_security_rate_limit"("p_namespace" "text", "p_subject_hash" "text", "p_limit" integer, "p_window_seconds" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_operator_control_monotonic_version"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
  IF NEW.policy_version <= OLD.policy_version THEN
    RAISE EXCEPTION 'operator control policy_version must increase (% <= %)', NEW.policy_version, OLD.policy_version
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;


ALTER FUNCTION "public"."enforce_operator_control_monotonic_version"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_compute_warnings"("p_tenant" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- 1. LiquiditÃ¤tswarnung: Forderungen >30 Tage > 15% Monatsumsatz
  INSERT INTO warning_event (tenant_id, typ, titel, beschreibung, schwere, link)
  SELECT p_tenant, 'liquiditaet',
    'Offene Forderungen Ã¼ber 30 Tage',
    COUNT(*) || ' Rechnungen Ã¼ber 30 Tage Ã¼berfÃ¤llig, Volumen ' || 
      COALESCE(SUM(netto)::int::text, '0') || ' â‚¬',
    CASE WHEN COUNT(*) > 3 THEN 'kritisch' ELSE 'warnung' END,
    '/buchhaltung'
  FROM v_aging
  WHERE aging_bucket IN ('31-60','61-90','>90')
  HAVING COUNT(*) > 0
  AND NOT EXISTS (
    SELECT 1 FROM warning_event we 
    WHERE we.tenant_id = p_tenant AND we.typ = 'liquiditaet'
      AND (we.dismissed_am IS NULL OR we.suppress_bis > NOW())
  );

  -- 2. Auslastungswarnung: KS > 85%
  INSERT INTO warning_event (tenant_id, typ, titel, beschreibung, schwere, link)
  SELECT p_tenant, 'auslastung_' || kuerzel,
    'Engpass ' || name,
    name || ' ist bei ' || ROUND(auslastung_quote * 100) || '% Auslastung',
    CASE WHEN auslastung_quote > 0.95 THEN 'kritisch' ELSE 'warnung' END,
    '/cockpit'
  FROM v_engpass
  WHERE auslastung_quote > 0.85
  AND NOT EXISTS (
    SELECT 1 FROM warning_event we 
    WHERE we.tenant_id = p_tenant AND we.typ = 'auslastung_' || kuerzel
      AND (we.dismissed_am IS NULL OR we.suppress_bis > NOW())
  );

  -- 3. Kundenabwanderung: Stammkunde >9 Monate inaktiv
  INSERT INTO warning_event (tenant_id, typ, titel, beschreibung, schwere, link, payload)
  SELECT p_tenant, 'abwanderung',
    'Stammkunden-Abwanderung',
    COUNT(*) || ' Stammkunden seit >9 Monaten inaktiv (Umsatz: ' || 
      COALESCE(SUM(umsatz_gesamt)::int::text, '0') || ' â‚¬)',
    'warnung',
    '/cockpit',
    jsonb_build_object('kunden', jsonb_agg(jsonb_build_object(
      'name', name, 'umsatz', umsatz_gesamt
    )))
  FROM v_kunde_clv
  WHERE letzter_auftrag < NOW() - INTERVAL '9 months'
    AND auftraege_gesamt >= 3
  HAVING COUNT(*) > 0
  AND NOT EXISTS (
    SELECT 1 FROM warning_event we 
    WHERE we.tenant_id = p_tenant AND we.typ = 'abwanderung'
      AND (we.dismissed_am IS NULL OR we.suppress_bis > NOW())
  );

  -- 4. DB-Negativ: Auftrag mit Verlust
  INSERT INTO warning_event (tenant_id, typ, titel, beschreibung, schwere, link, payload)
  SELECT p_tenant, 'db_negativ_' || order_id,
    'Verlustauftrag ' || order_number,
    'Auftrag ' || order_number || ' hat DB von ' || ROUND(deckungsbeitrag) || ' â‚¬',
    'kritisch',
    '/orders/' || order_id,
    jsonb_build_object('order_id', order_id, 'db', deckungsbeitrag)
  FROM v_auftrag_db
  WHERE deckungsbeitrag < 0
    AND erloes_netto > 0
    AND status IN ('completed','abgeschlossen')
  AND NOT EXISTS (
    SELECT 1 FROM warning_event we 
    WHERE we.tenant_id = p_tenant AND we.typ = 'db_negativ_' || order_id
  );
END;
$$;


ALTER FUNCTION "public"."fn_compute_warnings"("p_tenant" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_is_production_order"("p_order_id" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM v_production_orders WHERE id = p_order_id
  );
END;
$$;


ALTER FUNCTION "public"."fn_is_production_order"("p_order_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_update_vorlagen"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_item RECORD;
  v_klasse text;
  v_oberflaeche text;
  v_schluessel text;
  v_station text;
  v_tenant text;
BEGIN
  -- Nur bei Statuswechsel zu 'completed' oder 'abgeschlossen'
  IF NEW.status NOT IN ('completed', 'abgeschlossen') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  v_tenant := COALESCE(NEW.tenant_id, 'galvanik-kreile');

  -- FÃ¼r jedes Item des Auftrags
  FOR v_item IN
    SELECT i.id, i.name, i.surface_requested
    FROM items i WHERE i.order_id = NEW.id
  LOOP
    -- Klassifizierung: keyword-match gegen teile_klassifikator
    SELECT tk.klasse INTO v_klasse
    FROM teile_klassifikator tk
    WHERE tk.tenant_id = v_tenant
      AND EXISTS (
        SELECT 1 FROM unnest(tk.keywords) kw
        WHERE lower(v_item.name) LIKE '%' || kw || '%'
      )
    ORDER BY tk.klasse
    LIMIT 1;

    v_klasse := COALESCE(v_klasse, 'sonstiges');
    v_oberflaeche := COALESCE(lower(trim(v_item.surface_requested)), 'unbekannt');
    v_schluessel := v_klasse || '|' || v_oberflaeche;

    -- ZEIT-Vorlagen aktualisieren: pro Station
    FOR v_station IN
      SELECT DISTINCT kostenstelle_kuerzel
      FROM arbeitszeit_buchung
      WHERE auftrag_id = NEW.id
    LOOP
      INSERT INTO vorlage_zeit (tenant_id, schluessel, teilekategorie, oberflaeche,
        station_kuerzel, median_minuten, p25_minuten, p75_minuten,
        n_referenzauftraege, letzte_aktualisierung)
      SELECT
        v_tenant,
        v_schluessel,
        v_klasse,
        v_oberflaeche,
        v_station,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY zb.dauer_minuten),
        percentile_cont(0.25) WITHIN GROUP (ORDER BY zb.dauer_minuten),
        percentile_cont(0.75) WITHIN GROUP (ORDER BY zb.dauer_minuten),
        COUNT(DISTINCT zb.auftrag_id),
        NOW()
      FROM arbeitszeit_buchung zb
      JOIN orders o ON o.id = zb.auftrag_id
      JOIN items it ON it.order_id = o.id
      WHERE zb.kostenstelle_kuerzel = v_station
        AND zb.tenant_id = v_tenant
        AND o.status IN ('completed', 'abgeschlossen')
        -- Ã„hnlichkeits-Match: gleicher SchlÃ¼ssel
        AND EXISTS (
          SELECT 1 FROM teile_klassifikator tk2
          WHERE tk2.tenant_id = v_tenant
            AND EXISTS (
              SELECT 1 FROM unnest(tk2.keywords) kw2
              WHERE lower(it.name) LIKE '%' || kw2 || '%'
            )
            AND tk2.klasse = v_klasse
        )
        AND COALESCE(lower(trim(it.surface_requested)), 'unbekannt') = v_oberflaeche
        -- AusreiÃŸer-Schutz: ignoriere Werte > 3x oder < 1/3 des bisherigen Medians
        AND zb.dauer_minuten BETWEEN 
          COALESCE((SELECT median_minuten / 3 FROM vorlage_zeit 
                    WHERE schluessel = v_schluessel AND station_kuerzel = v_station 
                    AND tenant_id = v_tenant), 0)
          AND
          COALESCE((SELECT median_minuten * 3 FROM vorlage_zeit 
                    WHERE schluessel = v_schluessel AND station_kuerzel = v_station 
                    AND tenant_id = v_tenant), 99999)
      ON CONFLICT (tenant_id, schluessel, station_kuerzel)
      DO UPDATE SET
        median_minuten = EXCLUDED.median_minuten,
        p25_minuten = EXCLUDED.p25_minuten,
        p75_minuten = EXCLUDED.p75_minuten,
        n_referenzauftraege = EXCLUDED.n_referenzauftraege,
        letzte_aktualisierung = NOW();
    END LOOP;

    -- VERBRAUCHS-Vorlagen aktualisieren: pro Station + Artikel
    INSERT INTO vorlage_verbrauch (tenant_id, schluessel, teilekategorie, oberflaeche,
      station_kuerzel, inventory_item_id, einheit_normiert, median_menge,
      p25_menge, p75_menge, n_referenzauftraege, haeufigkeit_prozent,
      letzte_aktualisierung)
    SELECT
      v_tenant,
      v_schluessel,
      v_klasse,
      v_oberflaeche,
      sm.station_kuerzel,
      sm.inventory_item_id,
      COALESCE(ii.einheit_normiert, ii.unit, 'st'),
      percentile_cont(0.5) WITHIN GROUP (ORDER BY abs(sm.quantity)),
      percentile_cont(0.25) WITHIN GROUP (ORDER BY abs(sm.quantity)),
      percentile_cont(0.75) WITHIN GROUP (ORDER BY abs(sm.quantity)),
      COUNT(DISTINCT sm.order_id),
      -- HÃ¤ufigkeit: in wieviel % der AuftrÃ¤ge dieser Klasse kommt dieser Artikel vor
      COUNT(DISTINCT sm.order_id)::numeric / GREATEST(1, (
        SELECT COUNT(DISTINCT o2.id) FROM orders o2
        JOIN items it2 ON it2.order_id = o2.id
        WHERE o2.status IN ('completed','abgeschlossen')
          AND o2.tenant_id = v_tenant
      )) * 100,
      NOW()
    FROM stock_movements sm
    JOIN orders o ON o.id = sm.order_id
    JOIN items it ON it.order_id = o.id
    LEFT JOIN inventory_items ii ON ii.id = sm.inventory_item_id
    WHERE sm.movement_type = 'verbrauch'
      AND sm.station_kuerzel IS NOT NULL
      AND sm.inventory_item_id IS NOT NULL
      AND o.status IN ('completed', 'abgeschlossen')
      AND COALESCE(sm.tenant_id, 'galvanik-kreile') = v_tenant
      AND EXISTS (
        SELECT 1 FROM teile_klassifikator tk3
        WHERE tk3.tenant_id = v_tenant
          AND EXISTS (
            SELECT 1 FROM unnest(tk3.keywords) kw3
            WHERE lower(it.name) LIKE '%' || kw3 || '%'
          )
          AND tk3.klasse = v_klasse
      )
      AND COALESCE(lower(trim(it.surface_requested)), 'unbekannt') = v_oberflaeche
    GROUP BY sm.station_kuerzel, sm.inventory_item_id, ii.einheit_normiert, ii.unit
    ON CONFLICT (tenant_id, schluessel, station_kuerzel, inventory_item_id)
    DO UPDATE SET
      median_menge = EXCLUDED.median_menge,
      p25_menge = EXCLUDED.p25_menge,
      p75_menge = EXCLUDED.p75_menge,
      n_referenzauftraege = EXCLUDED.n_referenzauftraege,
      haeufigkeit_prozent = EXCLUDED.haeufigkeit_prozent,
      letzte_aktualisierung = NOW();

  END LOOP;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_update_vorlagen"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_verteile_energiekosten"("p_jahr" integer, "p_monat" integer, "p_tenant" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_energie_summe NUMERIC(12,2) := 0;
  v_rec RECORD;
  v_ks_anteil NUMERIC(5,2);
  v_ks_energie_kosten NUMERIC(12,2);
  v_eur_pro_stunde NUMERIC(12,2);
BEGIN
  -- 1. Summe Energie im Monat berechnen
  SELECT COALESCE(SUM(b.netto), 0) INTO v_energie_summe
  FROM beleg b
  JOIN konto k ON b.konto_id = k.id
  WHERE k.kategorie = 'energie'
    AND k.tenant_id = p_tenant
    AND EXTRACT(YEAR FROM b.belegdatum) = p_jahr
    AND EXTRACT(MONTH FROM b.belegdatum) = p_monat
    AND b.status != 'storniert';

  -- 2. Bestehende Verteilung fÃ¼r diesen Monat lÃ¶schen (Idempotenz)
  DELETE FROM kostenstellen_energie_monat
  WHERE tenant_id = p_tenant 
    AND monat = make_date(p_jahr, p_monat, 1);

  -- 3. Schleife Ã¼ber alle Produktions-Kostenstellen
  FOR v_rec IN
    SELECT ks.id AS ks_id, ks.kuerzel, ks.verfuegbare_stunden_monatlich
    FROM kostenstelle ks
    WHERE ks.tenant_id = p_tenant AND ks.typ = 'produktion'
  LOOP
    -- Anteil bestimmen (laut Spec Kap. 5)
    v_ks_anteil := CASE v_rec.kuerzel
      WHEN 'GAL' THEN 0.50
      WHEN 'POL' THEN 0.20
      WHEN 'SCH' THEN 0.15
      WHEN 'QS' THEN 0.05
      WHEN 'VER' THEN 0.05
      WHEN 'WE' THEN 0.05
      ELSE 0
    END;

    v_ks_energie_kosten := v_energie_summe * v_ks_anteil;

    -- EUR pro Stunde berechnen
    IF COALESCE(v_rec.verfuegbare_stunden_monatlich, 0) > 0 THEN
      v_eur_pro_stunde := v_ks_energie_kosten / v_rec.verfuegbare_stunden_monatlich;
    ELSE
      v_eur_pro_stunde := 0;
    END IF;

    -- In kostenstellen_energie_monat einfÃ¼gen
    IF v_ks_anteil > 0 THEN
      INSERT INTO kostenstellen_energie_monat (tenant_id, kostenstelle_id, monat, energie_eur_pro_stunde)
      VALUES (p_tenant, v_rec.ks_id, make_date(p_jahr, p_monat, 1), v_eur_pro_stunde);
    END IF;

  END LOOP;
END;
$$;


ALTER FUNCTION "public"."fn_verteile_energiekosten"("p_jahr" integer, "p_monat" integer, "p_tenant" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_beleg_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  INSERT INTO bh_audit_log (benutzer, entitaet, entitaet_id, aktion, nachher)
  VALUES (NEW.erstellt_von, 'beleg', NEW.id, 'create', to_jsonb(NEW));
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_beleg_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_item_photo_uncertain"("p_job_id" "uuid", "p_tenant_id" "text", "p_user_id" "text", "p_reason" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
BEGIN
  IF p_reason IS NULL OR length(p_reason) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'INVALID_ITEM_PHOTO_REASON';
  END IF;
  UPDATE public.item_photo_jobs
  SET status = 'uncertain', provider_status = p_reason, completed_at = now(), updated_at = now()
  WHERE id = p_job_id AND tenant_id = p_tenant_id AND user_id = p_user_id
    AND status IN ('reserved', 'uploaded');
  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."mark_item_photo_uncertain"("p_job_id" "uuid", "p_tenant_id" "text", "p_user_id" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_audit_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RAISE EXCEPTION 'GoBD: Audit-Log ist append-only. Ã„nderungen/LÃ¶schungen sind nicht erlaubt.';
END;
$$;


ALTER FUNCTION "public"."prevent_audit_mutation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_beleg_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  RAISE EXCEPTION 'GoBD: Belege dÃ¼rfen nicht gelÃ¶scht werden. Nur Storno ist erlaubt.';
END;
$$;


ALTER FUNCTION "public"."prevent_beleg_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_beleg_mutation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF OLD.status = 'festgeschrieben' AND NEW.status != 'storniert' THEN
    RAISE EXCEPTION 'GoBD: Festgeschriebener Beleg darf nicht verÃ¤ndert werden. Nur Storno ist erlaubt.';
  END IF;
  IF OLD.status = 'storniert' THEN
    RAISE EXCEPTION 'GoBD: Stornierter Beleg darf nicht verÃ¤ndert werden.';
  END IF;
  -- Schutz: original_datei darf nie geÃ¤ndert werden
  IF OLD.original_datei IS DISTINCT FROM NEW.original_datei THEN
    RAISE EXCEPTION 'GoBD: original_datei darf nicht verÃ¤ndert werden.';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_beleg_mutation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reserve_ai_usage"("p_tenant_id" "text", "p_user_id" "text", "p_feature" "text", "p_request_key_hash" "text", "p_estimated_units" integer, "p_window_seconds" integer, "p_user_window_limit" integer, "p_tenant_window_limit" integer, "p_user_daily_unit_limit" bigint, "p_tenant_daily_unit_limit" bigint) RETURNS TABLE("allowed" boolean, "reservation_id" "uuid", "replay" boolean, "usage_status" "text", "replay_result" "jsonb", "retry_after_seconds" integer, "decision_reason" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'pg_temp'
    AS $_$
DECLARE
  v_existing public.ai_usage_reservations%ROWTYPE;
  v_inserted public.ai_usage_reservations%ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_day_start timestamptz;
  v_user_count bigint;
  v_tenant_count bigint;
  v_user_units bigint;
  v_tenant_units bigint;
  v_reason text;
  v_retry integer;
  v_reclaim boolean := false;
  v_reclaim_id uuid;
BEGIN
  IF p_tenant_id IS NULL OR length(p_tenant_id) NOT BETWEEN 1 AND 80
     OR p_user_id IS NULL OR length(p_user_id) NOT BETWEEN 1 AND 128
     OR p_feature IS NULL OR p_feature !~ '^[a-z][a-z0-9-]{1,63}$'
     OR p_request_key_hash IS NULL OR p_request_key_hash !~ '^[a-f0-9]{64}$'
     OR p_estimated_units IS NULL OR p_estimated_units <= 0 OR p_estimated_units > 100000
     OR p_window_seconds IS NULL OR p_window_seconds NOT BETWEEN 10 AND 3600
     OR p_user_window_limit IS NULL OR p_user_window_limit NOT BETWEEN 1 AND 1000
     OR p_tenant_window_limit IS NULL OR p_tenant_window_limit NOT BETWEEN 1 AND 10000
     OR p_user_daily_unit_limit IS NULL OR p_user_daily_unit_limit NOT BETWEEN 1 AND 100000000
     OR p_tenant_daily_unit_limit IS NULL OR p_tenant_daily_unit_limit NOT BETWEEN 1 AND 1000000000 THEN
    RAISE EXCEPTION 'INVALID_AI_USAGE_POLICY';
  END IF;

  -- Stable lock order prevents concurrent user/tenant overdraw across regions.
  PERFORM pg_advisory_xact_lock(hashtextextended('ai:tenant:' || p_tenant_id, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'ai:user:' || p_tenant_id || ':' || p_user_id || ':' || p_feature,
    0
  ));

  SELECT r.* INTO v_existing
  FROM public.ai_usage_reservations r
  WHERE r.tenant_id = p_tenant_id
    AND r.user_id = p_user_id
    AND r.feature = p_feature
    AND r.request_key_hash = p_request_key_hash
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.status = 'reserved'
       AND v_existing.updated_at <= v_now - interval '5 minutes' THEN
      -- Re-admit below against the current window/day. Excluding this row from
      -- all counters and moving its admission timestamp prevents old leases
      -- from borrowing quota from a previous day.
      v_reclaim := true;
      v_reclaim_id := v_existing.id;
    ELSE
      IF v_existing.status = 'in_flight'
         AND v_existing.updated_at <= v_now - interval '5 minutes' THEN
        UPDATE public.ai_usage_reservations
        SET status = 'uncertain',
            reason = 'stale_in_flight',
            provider_status = coalesce(provider_status, 'stale-in-flight'),
            completed_at = v_now,
            updated_at = v_now
        WHERE id = v_existing.id;
        v_existing.status := 'uncertain';
      END IF;

      IF v_existing.status = 'succeeded'
         AND v_existing.result_json IS NOT NULL
         AND v_existing.result_expires_at > v_now THEN
        RETURN QUERY SELECT
          true, v_existing.id, true, v_existing.status,
          v_existing.result_json, 0, 'replay_result'::text;
      ELSE
        RETURN QUERY SELECT
          false, v_existing.id, true, v_existing.status, NULL::jsonb,
          CASE WHEN v_existing.status IN ('reserved', 'in_flight') THEN
            greatest(1, ceil(extract(epoch FROM (
              v_existing.updated_at + interval '5 minutes' - v_now
            )))::integer)
          ELSE 0 END,
          CASE
            WHEN v_existing.status IN ('reserved', 'in_flight') THEN 'in_progress'
            WHEN v_existing.status = 'succeeded' THEN 'result_expired'
            ELSE 'prior_attempt_terminal'
          END;
      END IF;
      RETURN;
    END IF;
  END IF;

  v_window_start := v_now - make_interval(secs => p_window_seconds);
  v_day_start := date_trunc('day', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

  SELECT count(*) INTO v_user_count
  FROM public.ai_usage_reservations r
  WHERE r.tenant_id = p_tenant_id
    AND r.user_id = p_user_id
    AND r.feature = p_feature
    AND r.created_at >= v_window_start
    AND (v_reclaim_id IS NULL OR r.id <> v_reclaim_id);

  SELECT count(*) INTO v_tenant_count
  FROM public.ai_usage_reservations r
  WHERE r.tenant_id = p_tenant_id
    AND r.created_at >= v_window_start
    AND (v_reclaim_id IS NULL OR r.id <> v_reclaim_id);

  SELECT coalesce(sum(coalesce(r.actual_units, r.estimated_units)), 0)::bigint
  INTO v_user_units
  FROM public.ai_usage_reservations r
  WHERE r.tenant_id = p_tenant_id
    AND r.user_id = p_user_id
    AND r.created_at >= v_day_start
    AND (v_reclaim_id IS NULL OR r.id <> v_reclaim_id);

  SELECT coalesce(sum(coalesce(r.actual_units, r.estimated_units)), 0)::bigint
  INTO v_tenant_units
  FROM public.ai_usage_reservations r
  WHERE r.tenant_id = p_tenant_id
    AND r.created_at >= v_day_start
    AND (v_reclaim_id IS NULL OR r.id <> v_reclaim_id);

  IF v_user_count >= p_user_window_limit THEN
    v_reason := 'user_window';
    v_retry := p_window_seconds;
  ELSIF v_tenant_count >= p_tenant_window_limit THEN
    v_reason := 'tenant_window';
    v_retry := p_window_seconds;
  ELSIF v_user_units + p_estimated_units > p_user_daily_unit_limit THEN
    v_reason := 'user_daily_units';
    v_retry := greatest(1, ceil(extract(epoch FROM (v_day_start + interval '1 day' - v_now)))::integer);
  ELSIF v_tenant_units + p_estimated_units > p_tenant_daily_unit_limit THEN
    v_reason := 'tenant_daily_units';
    v_retry := greatest(1, ceil(extract(epoch FROM (v_day_start + interval '1 day' - v_now)))::integer);
  END IF;

  IF v_reason IS NOT NULL THEN
    RETURN QUERY SELECT
      false,
      CASE WHEN v_reclaim THEN v_reclaim_id ELSE NULL::uuid END,
      v_reclaim,
      CASE WHEN v_reclaim THEN 'reserved'::text ELSE 'rejected'::text END,
      NULL::jsonb, v_retry, v_reason;
    RETURN;
  END IF;

  IF v_reclaim THEN
    UPDATE public.ai_usage_reservations
    SET estimated_units = p_estimated_units,
        actual_units = NULL,
        status = 'reserved',
        reason = 'reclaimed_reserved',
        provider_status = NULL,
        result_json = NULL,
        result_expires_at = NULL,
        created_at = v_now,
        started_at = NULL,
        completed_at = NULL,
        updated_at = v_now
    WHERE id = v_reclaim_id;
    RETURN QUERY SELECT
      true, v_reclaim_id, false, 'reserved'::text,
      NULL::jsonb, 0, 'reclaimed_reserved'::text;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.ai_usage_reservations (
      tenant_id, user_id, feature, request_key_hash, estimated_units,
      status, created_at, updated_at
    ) VALUES (
      p_tenant_id, p_user_id, p_feature, p_request_key_hash, p_estimated_units,
      'reserved', v_now, v_now
    ) RETURNING * INTO v_inserted;
  EXCEPTION WHEN unique_violation THEN
    SELECT r.* INTO v_existing
    FROM public.ai_usage_reservations r
    WHERE r.tenant_id = p_tenant_id
      AND r.user_id = p_user_id
      AND r.feature = p_feature
      AND r.request_key_hash = p_request_key_hash
    FOR UPDATE;
    IF NOT FOUND THEN RAISE; END IF;
    RETURN QUERY SELECT
      false, v_existing.id, true, v_existing.status, NULL::jsonb, 2, 'in_progress'::text;
    RETURN;
  END;

  RETURN QUERY SELECT
    true, v_inserted.id, false, v_inserted.status,
    NULL::jsonb, 0, 'reserved'::text;
END;
$_$;


ALTER FUNCTION "public"."reserve_ai_usage"("p_tenant_id" "text", "p_user_id" "text", "p_feature" "text", "p_request_key_hash" "text", "p_estimated_units" integer, "p_window_seconds" integer, "p_user_window_limit" integer, "p_tenant_window_limit" integer, "p_user_daily_unit_limit" bigint, "p_tenant_daily_unit_limit" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reserve_item_photo_job"("p_job_id" "uuid", "p_tenant_id" "text", "p_user_id" "text", "p_order_id" "text", "p_item_id" "text", "p_request_key_hash" "text", "p_content_sha256" "text", "p_storage_path" "text", "p_mime_type" "text", "p_file_bytes" integer, "p_window_seconds" integer, "p_user_window_limit" integer, "p_item_limit" integer, "p_tenant_daily_bytes_limit" bigint, "p_user_daily_analysis_limit" integer, "p_tenant_daily_analysis_limit" integer, "p_user_concurrent_limit" integer, "p_tenant_concurrent_limit" integer) RETURNS TABLE("allowed" boolean, "job_id" "uuid", "replay" boolean, "upload_required" boolean, "job_status" "text", "reserved_storage_path" "text", "replay_result" "jsonb", "retry_after_seconds" integer, "decision_reason" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'pg_temp'
    AS $_$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_day_start timestamptz;
  v_window_start timestamptz;
  v_existing public.item_photo_jobs%ROWTYPE;
  v_inserted public.item_photo_jobs%ROWTYPE;
  v_item_count bigint;
  v_user_window_count bigint;
  v_tenant_bytes bigint;
  v_user_daily_count bigint;
  v_tenant_daily_count bigint;
  v_user_concurrent bigint;
  v_tenant_concurrent bigint;
  v_reason text;
  v_retry integer := 60;
BEGIN
  IF p_job_id IS NULL
     OR p_tenant_id <> 'galvanik-kreile'
     OR p_user_id IS NULL OR p_user_id !~ '^[A-Za-z0-9_-]{1,128}$'
     OR p_order_id IS NULL OR p_order_id !~ '^[A-Za-z0-9_-]{1,128}$'
     OR p_item_id IS NULL OR p_item_id !~ '^[A-Za-z0-9_-]{1,128}$'
     OR p_request_key_hash IS NULL OR p_request_key_hash !~ '^[a-f0-9]{64}$'
     OR p_content_sha256 IS NULL OR p_content_sha256 !~ '^[a-f0-9]{64}$'
     OR p_storage_path IS NULL OR length(p_storage_path) NOT BETWEEN 20 AND 600
     OR p_storage_path NOT LIKE p_tenant_id || '/' || p_order_id || '/' || p_item_id || '/%'
     OR position(p_job_id::text IN p_storage_path) = 0
     OR p_mime_type IS NULL OR p_mime_type NOT IN ('image/jpeg', 'image/png', 'image/webp')
     OR p_file_bytes IS NULL OR p_file_bytes NOT BETWEEN 1 AND 12582912
     OR p_window_seconds IS NULL OR p_window_seconds NOT BETWEEN 10 AND 3600
     OR p_user_window_limit IS NULL OR p_user_window_limit NOT BETWEEN 1 AND 1000
     OR p_item_limit IS NULL OR p_item_limit NOT BETWEEN 1 AND 100
     OR p_tenant_daily_bytes_limit IS NULL OR p_tenant_daily_bytes_limit NOT BETWEEN 1048576 AND 1099511627776
     OR p_user_daily_analysis_limit IS NULL OR p_user_daily_analysis_limit NOT BETWEEN 1 AND 100000
     OR p_tenant_daily_analysis_limit IS NULL OR p_tenant_daily_analysis_limit NOT BETWEEN 1 AND 1000000
     OR p_user_concurrent_limit IS NULL OR p_user_concurrent_limit NOT BETWEEN 1 AND 100
     OR p_tenant_concurrent_limit IS NULL OR p_tenant_concurrent_limit NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'INVALID_ITEM_PHOTO_POLICY';
  END IF;

  PERFORM 1
  FROM public.orders order_record
  JOIN public.items item_record
    ON item_record.tenant_id = order_record.tenant_id
   AND item_record.order_id = order_record.id
  JOIN public.app_users user_record
    ON user_record.tenant_id = order_record.tenant_id
   AND user_record.id::text = p_user_id
  WHERE order_record.tenant_id = p_tenant_id
    AND order_record.id = p_order_id
    AND item_record.id = p_item_id
    AND user_record.active
  FOR SHARE OF order_record, item_record, user_record;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ITEM_PHOTO_CONTEXT_NOT_FOUND';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('photo:tenant:' || p_tenant_id, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('photo:item:' || p_tenant_id || ':' || p_item_id, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('photo:user:' || p_tenant_id || ':' || p_user_id, 0));

  SELECT j.* INTO v_existing
  FROM public.item_photo_jobs j
  WHERE (j.tenant_id = p_tenant_id AND j.user_id = p_user_id AND j.request_key_hash = p_request_key_hash)
     OR (j.tenant_id = p_tenant_id AND j.item_id = p_item_id AND j.content_sha256 = p_content_sha256)
  ORDER BY CASE WHEN j.request_key_hash = p_request_key_hash AND j.user_id = p_user_id THEN 0 ELSE 1 END
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.user_id <> p_user_id THEN
      RETURN QUERY SELECT false, NULL::uuid, false, false, 'duplicate'::text,
        NULL::text, NULL::jsonb, 0, 'duplicate_content'::text;
    ELSIF v_existing.status = 'succeeded' AND v_existing.analysis_result IS NOT NULL THEN
      RETURN QUERY SELECT true, v_existing.id, true, false, v_existing.status,
        v_existing.storage_path, v_existing.analysis_result, 0, 'replay_result'::text;
    ELSIF v_existing.status = 'reserved' THEN
      RETURN QUERY SELECT true, v_existing.id, true, true, v_existing.status,
        v_existing.storage_path, NULL::jsonb, 0, 'resume_upload'::text;
    ELSIF v_existing.status = 'uploaded' THEN
      RETURN QUERY SELECT true, v_existing.id, true, false, v_existing.status,
        v_existing.storage_path, NULL::jsonb, 0, 'resume_analysis'::text;
    ELSE
      RETURN QUERY SELECT false, v_existing.id, true, false, v_existing.status,
        NULL::text, NULL::jsonb,
        CASE WHEN v_existing.status = 'in_flight' THEN 2 ELSE 0 END,
        CASE WHEN v_existing.status = 'in_flight' THEN 'in_progress' ELSE 'prior_attempt_terminal' END;
    END IF;
    RETURN;
  END IF;

  v_window_start := v_now - make_interval(secs => p_window_seconds);
  v_day_start := date_trunc('day', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

  SELECT count(*) INTO v_item_count
  FROM public.item_photo_jobs j
  WHERE j.tenant_id = p_tenant_id AND j.item_id = p_item_id
    AND (j.status <> 'reserved' OR j.created_at >= v_now - interval '15 minutes');

  SELECT count(*) INTO v_user_window_count
  FROM public.item_photo_jobs j
  WHERE j.tenant_id = p_tenant_id AND j.user_id = p_user_id AND j.created_at >= v_window_start;

  SELECT coalesce(sum(j.file_bytes), 0)::bigint INTO v_tenant_bytes
  FROM public.item_photo_jobs j
  WHERE j.tenant_id = p_tenant_id AND j.created_at >= v_day_start;

  SELECT count(*) INTO v_user_daily_count
  FROM public.item_photo_jobs j
  WHERE j.tenant_id = p_tenant_id AND j.user_id = p_user_id AND j.created_at >= v_day_start;

  SELECT count(*) INTO v_tenant_daily_count
  FROM public.item_photo_jobs j
  WHERE j.tenant_id = p_tenant_id AND j.created_at >= v_day_start;

  SELECT count(*) INTO v_user_concurrent
  FROM public.item_photo_jobs j
  WHERE j.tenant_id = p_tenant_id AND j.user_id = p_user_id
    AND (j.status IN ('uploaded', 'in_flight') OR (j.status = 'reserved' AND j.created_at >= v_now - interval '15 minutes'));

  SELECT count(*) INTO v_tenant_concurrent
  FROM public.item_photo_jobs j
  WHERE j.tenant_id = p_tenant_id
    AND (j.status IN ('uploaded', 'in_flight') OR (j.status = 'reserved' AND j.created_at >= v_now - interval '15 minutes'));

  IF v_item_count >= p_item_limit THEN
    v_reason := 'item_limit';
    v_retry := 0;
  ELSIF v_user_window_count >= p_user_window_limit THEN
    v_reason := 'user_window';
    v_retry := p_window_seconds;
  ELSIF v_tenant_bytes + p_file_bytes > p_tenant_daily_bytes_limit THEN
    v_reason := 'tenant_daily_bytes';
    v_retry := greatest(1, ceil(extract(epoch FROM (v_day_start + interval '1 day' - v_now)))::integer);
  ELSIF v_user_daily_count >= p_user_daily_analysis_limit THEN
    v_reason := 'user_daily_analyses';
    v_retry := greatest(1, ceil(extract(epoch FROM (v_day_start + interval '1 day' - v_now)))::integer);
  ELSIF v_tenant_daily_count >= p_tenant_daily_analysis_limit THEN
    v_reason := 'tenant_daily_analyses';
    v_retry := greatest(1, ceil(extract(epoch FROM (v_day_start + interval '1 day' - v_now)))::integer);
  ELSIF v_user_concurrent >= p_user_concurrent_limit THEN
    v_reason := 'user_concurrent';
    v_retry := 2;
  ELSIF v_tenant_concurrent >= p_tenant_concurrent_limit THEN
    v_reason := 'tenant_concurrent';
    v_retry := 2;
  END IF;

  IF v_reason IS NOT NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, false, false, 'rejected'::text,
      NULL::text, NULL::jsonb, v_retry, v_reason;
    RETURN;
  END IF;

  INSERT INTO public.item_photo_jobs (
    id, tenant_id, user_id, order_id, item_id, request_key_hash,
    content_sha256, storage_path, mime_type, file_bytes, status,
    created_at, updated_at
  ) VALUES (
    p_job_id, p_tenant_id, p_user_id, p_order_id, p_item_id, p_request_key_hash,
    p_content_sha256, p_storage_path, p_mime_type, p_file_bytes, 'reserved',
    v_now, v_now
  ) RETURNING * INTO v_inserted;

  RETURN QUERY SELECT true, v_inserted.id, false, true, v_inserted.status,
    v_inserted.storage_path, NULL::jsonb, 0, 'reserved'::text;
END;
$_$;


ALTER FUNCTION "public"."reserve_item_photo_job"("p_job_id" "uuid", "p_tenant_id" "text", "p_user_id" "text", "p_order_id" "text", "p_item_id" "text", "p_request_key_hash" "text", "p_content_sha256" "text", "p_storage_path" "text", "p_mime_type" "text", "p_file_bytes" integer, "p_window_seconds" integer, "p_user_window_limit" integer, "p_item_limit" integer, "p_tenant_daily_bytes_limit" bigint, "p_user_daily_analysis_limit" integer, "p_tenant_daily_analysis_limit" integer, "p_user_concurrent_limit" integer, "p_tenant_concurrent_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_security_rate_limit"("p_namespace" "text", "p_subject_hash" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'pg_temp'
    AS $_$
DECLARE
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_namespace IS NULL
     OR p_namespace !~ '^[a-z0-9._-]{1,80}$'
     OR p_subject_hash IS NULL
     OR p_subject_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'INVALID_SECURITY_RATE_LIMIT_RESET';
  END IF;

  INSERT INTO public.security_rate_limit_counters (
    namespace, subject_hash, window_started_at, attempt_count, updated_at
  ) VALUES (
    p_namespace, p_subject_hash, v_now, 0, v_now
  )
  ON CONFLICT (namespace, subject_hash) DO UPDATE
  SET window_started_at = EXCLUDED.window_started_at,
      attempt_count = 0,
      updated_at = EXCLUDED.updated_at;

  RETURN true;
END
$_$;


ALTER FUNCTION "public"."reset_security_rate_limit"("p_namespace" "text", "p_subject_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_global"("query" "text") RETURNS TABLE("typ" "text", "id" "text", "label" "text", "sublabel" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT 'auftrag' AS typ, id, order_number AS label, title AS sublabel 
  FROM orders
  WHERE order_number ILIKE '%' || query || '%' OR title ILIKE '%' || query || '%'
  
  UNION ALL
  
  SELECT 'kunde' AS typ, id, coalesce(company_name, name) AS label, email AS sublabel 
  FROM customers
  WHERE company_name ILIKE '%' || query || '%' 
     OR name ILIKE '%' || query || '%'
     OR email ILIKE '%' || query || '%'
     
  UNION ALL
  
  SELECT 'teil' AS typ, id, name AS label, material AS sublabel 
  FROM items
  WHERE name ILIKE '%' || query || '%' OR material ILIKE '%' || query || '%'
  
  LIMIT 20;
$$;


ALTER FUNCTION "public"."search_global"("query" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."settle_ai_usage_reservation"("p_reservation_id" "uuid", "p_tenant_id" "text", "p_user_id" "text", "p_feature" "text", "p_outcome" "text", "p_actual_units" integer, "p_provider_status" "text", "p_result" "jsonb") RETURNS TABLE("changed" boolean, "usage_status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
DECLARE
  v_reservation public.ai_usage_reservations%ROWTYPE;
BEGIN
  IF p_outcome IS NULL OR p_outcome NOT IN ('succeeded', 'failed', 'uncertain')
     OR (p_actual_units IS NOT NULL AND p_actual_units < 0)
     OR p_provider_status IS NULL OR length(p_provider_status) NOT BETWEEN 1 AND 80
     OR (p_result IS NOT NULL AND octet_length(p_result::text) > 262144)
     OR (p_outcome = 'succeeded' AND p_result IS NULL)
     OR (p_outcome <> 'succeeded' AND p_result IS NOT NULL) THEN
    RAISE EXCEPTION 'INVALID_AI_USAGE_SETTLEMENT';
  END IF;

  SELECT r.* INTO v_reservation
  FROM public.ai_usage_reservations r
  WHERE r.id = p_reservation_id
    AND r.tenant_id = p_tenant_id
    AND r.user_id = p_user_id
    AND r.feature = p_feature
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'AI_USAGE_RESERVATION_NOT_FOUND'; END IF;

  IF v_reservation.status IN ('succeeded', 'failed', 'uncertain') THEN
    RETURN QUERY SELECT false, v_reservation.status;
    RETURN;
  END IF;
  IF v_reservation.status <> 'in_flight' THEN
    RAISE EXCEPTION 'AI_USAGE_RESERVATION_NOT_CLAIMED';
  END IF;

  UPDATE public.ai_usage_reservations
  SET status = p_outcome,
      actual_units = p_actual_units,
      provider_status = p_provider_status,
      result_json = p_result,
      result_expires_at = CASE WHEN p_outcome = 'succeeded' THEN now() + interval '24 hours' ELSE NULL END,
      completed_at = now(),
      updated_at = now()
  WHERE id = v_reservation.id;

  RETURN QUERY SELECT true, p_outcome;
END;
$$;


ALTER FUNCTION "public"."settle_ai_usage_reservation"("p_reservation_id" "uuid", "p_tenant_id" "text", "p_user_id" "text", "p_feature" "text", "p_outcome" "text", "p_actual_units" integer, "p_provider_status" "text", "p_result" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."settle_item_photo_analysis"("p_job_id" "uuid", "p_outcome" "text", "p_actual_units" integer, "p_provider_status" "text", "p_result" "jsonb") RETURNS TABLE("changed" boolean, "job_status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public', 'pg_temp'
    AS $$
DECLARE
  v_job public.item_photo_jobs%ROWTYPE;
BEGIN
  IF p_outcome IS NULL OR p_outcome NOT IN ('succeeded', 'failed', 'uncertain')
     OR (p_actual_units IS NOT NULL AND p_actual_units < 0)
     OR p_provider_status IS NULL OR length(p_provider_status) NOT BETWEEN 1 AND 80
     OR (p_result IS NOT NULL AND octet_length(p_result::text) > 262144)
     OR (p_outcome = 'succeeded' AND p_result IS NULL)
     OR (p_outcome <> 'succeeded' AND p_result IS NOT NULL) THEN
    RAISE EXCEPTION 'INVALID_ITEM_PHOTO_SETTLEMENT';
  END IF;
  SELECT j.* INTO v_job FROM public.item_photo_jobs j WHERE j.id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ITEM_PHOTO_JOB_NOT_FOUND'; END IF;
  IF v_job.status IN ('succeeded', 'failed', 'uncertain') THEN
    RETURN QUERY SELECT false, v_job.status;
    RETURN;
  END IF;
  IF v_job.status <> 'in_flight' THEN RAISE EXCEPTION 'ITEM_PHOTO_JOB_NOT_CLAIMED'; END IF;
  UPDATE public.item_photo_jobs
  SET status = p_outcome,
      actual_units = p_actual_units,
      provider_status = p_provider_status,
      analysis_result = p_result,
      completed_at = now(),
      updated_at = now()
  WHERE id = v_job.id;
  RETURN QUERY SELECT true, p_outcome;
END;
$$;


ALTER FUNCTION "public"."settle_item_photo_analysis"("p_job_id" "uuid", "p_outcome" "text", "p_actual_units" integer, "p_provider_status" "text", "p_result" "jsonb") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."ai_usage_reservations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "user_id" "text" NOT NULL,
    "feature" "text" NOT NULL,
    "request_key_hash" "text" NOT NULL,
    "estimated_units" integer NOT NULL,
    "actual_units" integer,
    "status" "text" DEFAULT 'reserved'::"text" NOT NULL,
    "reason" "text",
    "provider_status" "text",
    "result_json" "jsonb",
    "result_expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_usage_actual_units_nonnegative" CHECK ((("actual_units" IS NULL) OR ("actual_units" >= 0))),
    CONSTRAINT "ai_usage_estimated_units_positive" CHECK (("estimated_units" > 0)),
    CONSTRAINT "ai_usage_feature_format" CHECK (("feature" ~ '^[a-z][a-z0-9-]{1,63}$'::"text")),
    CONSTRAINT "ai_usage_request_hash_format" CHECK (("request_key_hash" ~ '^[a-f0-9]{64}$'::"text")),
    CONSTRAINT "ai_usage_status_known" CHECK (("status" = ANY (ARRAY['reserved'::"text", 'in_flight'::"text", 'succeeded'::"text", 'failed'::"text", 'uncertain'::"text"])))
);

ALTER TABLE ONLY "public"."ai_usage_reservations" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_usage_reservations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."aktion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kampagne_id" "uuid",
    "typ" "text" NOT NULL,
    "kanal_id" "uuid",
    "segment_id" "uuid",
    "titel" "text" NOT NULL,
    "inhalt" "jsonb",
    "status" "text" DEFAULT 'vorschlag'::"text" NOT NULL,
    "erwarteter_output" numeric(12,2),
    "aufwand_min" integer DEFAULT 0,
    "kosten_budget" numeric(12,2) DEFAULT '0'::numeric,
    "score" numeric(6,2) DEFAULT '0'::numeric,
    "freigegeben_von" "text",
    "geplant_fuer" timestamp without time zone,
    "ausgefuehrt_am" timestamp without time zone,
    "is_demo" boolean DEFAULT false,
    "erstellt_am" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."aktion" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_kvp_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" DEFAULT 'galvanik-kreile'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "note" "text",
    "category" "text",
    "impact" "text",
    "status" "text" DEFAULT 'new'::"text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."app_kvp_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_usage_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "client_event_id" "uuid" NOT NULL,
    "actor_pseudonym" character varying(64) NOT NULL,
    "actor_role" character varying(50) NOT NULL,
    "session_id" "uuid" NOT NULL,
    "event_type" character varying(50) NOT NULL,
    "route" character varying(200) NOT NULL,
    "target" character varying(100),
    "device_class" character varying(20) NOT NULL,
    "outcome" character varying(20),
    "duration_ms" integer,
    "result_count" integer,
    "query_length" integer,
    "click_count" integer,
    "build_id" character varying(100),
    "occurred_at" timestamp with time zone NOT NULL,
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "app_usage_events_actor_pseudonym_chk" CHECK ((("actor_pseudonym")::"text" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "app_usage_events_actor_role_chk" CHECK ((("actor_role")::"text" = ANY ((ARRAY['developer'::character varying, 'admin'::character varying, 'meister'::character varying, 'buero'::character varying, 'werkstatt'::character varying, 'readonly'::character varying])::"text"[]))),
    CONSTRAINT "app_usage_events_click_count_chk" CHECK ((("click_count" IS NULL) OR (("click_count" >= 0) AND ("click_count" <= 10000)))),
    CONSTRAINT "app_usage_events_device_chk" CHECK ((("device_class")::"text" = ANY ((ARRAY['desktop'::character varying, 'tablet'::character varying, 'mobile'::character varying, 'unknown'::character varying])::"text"[]))),
    CONSTRAINT "app_usage_events_duration_chk" CHECK ((("duration_ms" IS NULL) OR (("duration_ms" >= 0) AND ("duration_ms" <= 3600000)))),
    CONSTRAINT "app_usage_events_outcome_chk" CHECK ((("outcome" IS NULL) OR (("outcome")::"text" = ANY ((ARRAY['success'::character varying, 'failure'::character varying, 'cancelled'::character varying, 'empty'::character varying, 'unknown'::character varying])::"text"[])))),
    CONSTRAINT "app_usage_events_query_length_chk" CHECK ((("query_length" IS NULL) OR (("query_length" >= 0) AND ("query_length" <= 500)))),
    CONSTRAINT "app_usage_events_result_count_chk" CHECK ((("result_count" IS NULL) OR (("result_count" >= 0) AND ("result_count" <= 100000)))),
    CONSTRAINT "app_usage_events_route_chk" CHECK ((("route")::"text" ~ '^/(?:[a-z][a-z-]{0,39}|:id)?(?:/(?:[a-z][a-z-]{0,39}|:id)){0,4}$'::"text")),
    CONSTRAINT "app_usage_events_target_chk" CHECK ((("target" IS NULL) OR (("target")::"text" ~ '^(?:[a-z][a-z0-9._:-]{0,79}|/(?:[a-z][a-z-]{0,39})(?:/[a-z][a-z-]{0,39})?)$'::"text"))),
    CONSTRAINT "app_usage_events_tenant_fixed" CHECK (("tenant_id" = 'galvanik-kreile'::"text")),
    CONSTRAINT "app_usage_events_time_window_chk" CHECK ((("occurred_at" >= ("received_at" - '7 days'::interval)) AND ("occurred_at" <= ("received_at" + '00:05:00'::interval)))),
    CONSTRAINT "app_usage_events_type_chk" CHECK ((("event_type")::"text" = ANY ((ARRAY['nav_click'::character varying, 'overlay_open'::character varying, 'overlay_close_backdrop'::character varying, 'overlay_close_esc'::character varying, 'page_view'::character varying, 'detail_open'::character varying, 'search'::character varying, 'action'::character varying, 'tool_usage'::character varying, 'workflow_started'::character varying, 'workflow_step'::character varying, 'workflow_completed'::character varying, 'workflow_abandoned'::character varying, 'error'::character varying])::"text"[])))
);

ALTER TABLE ONLY "public"."app_usage_events" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."app_usage_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "role" character varying(50) DEFAULT 'workshop'::character varying NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "location" "text",
    "language" "text" DEFAULT 'de'::"text",
    "pin_hash" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "kostensatz_eur_pro_stunde" numeric(8,2),
    "ist_produktiv" boolean DEFAULT true,
    "wochenstunden" numeric(5,2),
    "urlaubstage_pro_jahr" integer,
    "tenant_id" "text" NOT NULL
);


ALTER TABLE "public"."app_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."arbeitszeit_buchung" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" DEFAULT 'galvanik-kreile'::"text" NOT NULL,
    "auftrag_id" "text" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "kostenstelle_kuerzel" "text" NOT NULL,
    "station_kuerzel" "text" NOT NULL,
    "start_zeit" timestamp with time zone NOT NULL,
    "end_zeit" timestamp with time zone,
    "dauer_minuten" integer NOT NULL,
    "kostensatz_eur_pro_stunde" numeric(8,2) NOT NULL,
    "erfasst_modus" "text" NOT NULL,
    "war_aus_vorlage" boolean DEFAULT false,
    "vorlage_id" "uuid",
    "bemerkung" "text",
    "erstellt_am" timestamp with time zone DEFAULT "now"(),
    "aktualisiert_am" timestamp with time zone DEFAULT "now"(),
    "item_id" "text"
);


ALTER TABLE "public"."arbeitszeit_buchung" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attribution" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "touchpoint_id" "uuid",
    "lead_id" "text",
    "auftrag_id" "text",
    "umsatz" numeric(12,2) DEFAULT '0'::numeric,
    "modell" "text" DEFAULT 'last_click'::"text",
    "erstellt_am" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."attribution" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "action" "text" NOT NULL,
    "table_name" "text",
    "record_id" "text",
    "actor_id" "uuid",
    "payload" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "text",
    "client_request_id" "uuid"
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ausgangsrechnung" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nummer" "text" NOT NULL,
    "kunde_id" "text",
    "datum" "date" NOT NULL,
    "faellig_am" "date",
    "brutto" numeric(12,2) NOT NULL,
    "netto" numeric(12,2),
    "ust_satz" numeric(4,2),
    "ust_betrag" numeric(12,2),
    "bezahlt_am" "date",
    "status" "text" DEFAULT 'offen'::"text" NOT NULL,
    "mahnstufe" integer DEFAULT 0,
    "erechnung_xml" "text",
    "lead_id" "uuid",
    "is_demo" boolean DEFAULT false,
    "erstellt_am" timestamp without time zone DEFAULT "now"() NOT NULL,
    "bemerkung" "text",
    "order_id" "text",
    "periode_id" "uuid",
    "erloes_konto_id" "uuid",
    "forderung_konto_id" "uuid",
    "aging_status" "text",
    "bezahlt_methode" "text",
    "bezahlt_betrag_eur" numeric(10,2),
    "bezahlt_payment_id" "uuid",
    "tenant_id" character varying(50) DEFAULT 'galvanik-kreile'::character varying NOT NULL
);


ALTER TABLE "public"."ausgangsrechnung" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ausgangsrechnung_position" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ausgangsrechnung_id" "uuid" NOT NULL,
    "beschreibung" "text" NOT NULL,
    "menge" numeric(12,2) DEFAULT 1 NOT NULL,
    "einzelpreis_netto" numeric(12,2) NOT NULL
);


ALTER TABLE "public"."ausgangsrechnung_position" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bath_measurements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" DEFAULT 'galvanik-kreile'::"text" NOT NULL,
    "bath_id" "text",
    "measured_at" timestamp with time zone DEFAULT "now"(),
    "temperature" numeric,
    "ph_value" numeric,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."bath_measurements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."baths" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "status" character varying(50) DEFAULT 'stable'::character varying,
    "last_measured_at" timestamp without time zone,
    "temperature_max" integer,
    "temperature_min" integer,
    "ph_max" integer,
    "ph_min" integer,
    "target_values" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "process_type" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "station_id" "text"
);


ALTER TABLE "public"."baths" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."beleg" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "erfasst_am" timestamp with time zone DEFAULT "now"() NOT NULL,
    "belegdatum" "date",
    "lieferant_id" "uuid",
    "lieferant_text" "text",
    "brutto" numeric(12,2),
    "netto" numeric(12,2),
    "ust_satz" numeric(4,2),
    "ust_betrag" numeric(12,2),
    "vorsteuer_abzug" boolean DEFAULT true,
    "kategorie_id" "uuid",
    "skr_konto" "text",
    "absetzbar_prozent" numeric(5,2) DEFAULT 100,
    "absetzbar_grund" "text",
    "belegart" "text",
    "original_datei" "text" NOT NULL,
    "original_format" "text",
    "ocr_confidence" numeric(5,2),
    "status" "text" DEFAULT 'pruefen'::"text" NOT NULL,
    "storniert_von" "uuid",
    "bank_zahlung_id" "uuid",
    "erstellt_von" "uuid" NOT NULL,
    "erstellt_am" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ocr_rohtext" "text",
    "ocr_positionen" "jsonb",
    "ocr_provider" "text",
    "zahlungsart" "text",
    "rechnungsnummer_extern" "text",
    "konto_id" "uuid",
    "kostenstelle_id" "uuid",
    "periode_id" "uuid",
    "ist_auf_auftrag_zugeordnet" boolean DEFAULT false,
    "zugeordneter_order_id" "text",
    "ocr_confidence_scale" "text",
    CONSTRAINT "beleg_ocr_confidence_range_chk" CHECK ((("ocr_confidence" IS NULL) OR (("ocr_confidence" >= (0)::numeric) AND ("ocr_confidence" <= (100)::numeric) AND (("ocr_confidence")::"text" <> ALL (ARRAY['NaN'::"text", 'Infinity'::"text", '-Infinity'::"text"]))))),
    CONSTRAINT "beleg_ocr_confidence_scale_chk" CHECK ((("ocr_confidence_scale" IS NULL) OR ("ocr_confidence_scale" = ANY (ARRAY['fraction'::"text", 'percent'::"text"])))),
    CONSTRAINT "beleg_ocr_confidence_scale_value_chk" CHECK (((("ocr_confidence_scale" IS NULL) OR ("ocr_confidence" IS NOT NULL)) AND (("ocr_confidence_scale" IS DISTINCT FROM 'fraction'::"text") OR (("ocr_confidence" >= (0)::numeric) AND ("ocr_confidence" <= (1)::numeric)))))
);


ALTER TABLE "public"."beleg" OWNER TO "postgres";


COMMENT ON COLUMN "public"."beleg"."ocr_confidence" IS 'Provider confidence. Interpret only together with ocr_confidence_scale; this is not an accounting approval.';



COMMENT ON COLUMN "public"."beleg"."ocr_confidence_scale" IS 'Explicit magnitude provenance: fraction or percent. NULL means the stored non-NULL value is not safely interpretable.';



CREATE TABLE IF NOT EXISTS "public"."beleg_position" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "beleg_id" "uuid" NOT NULL,
    "beschreibung" "text",
    "netto" numeric(12,2),
    "ust_satz" numeric(4,2),
    "ust_betrag" numeric(12,2),
    "skr_konto" "text",
    "sortierung" integer DEFAULT 0
);


ALTER TABLE "public"."beleg_position" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bh_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "zeit" timestamp with time zone DEFAULT "now"() NOT NULL,
    "benutzer" "uuid" NOT NULL,
    "entitaet" "text" NOT NULL,
    "entitaet_id" "uuid" NOT NULL,
    "aktion" "text" NOT NULL,
    "vorher" "jsonb",
    "nachher" "jsonb"
);


ALTER TABLE "public"."bh_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bh_einstellungen" (
    "id" "text" DEFAULT 'default'::"text" NOT NULL,
    "ocr_confidence_schwelle" numeric(5,2) DEFAULT 85.00,
    "berater_stundensatz" numeric(8,2) DEFAULT 120.00,
    "minuten_pro_beleg" integer DEFAULT 4,
    "standard_kontenrahmen" "text" DEFAULT 'SKR03'::"text",
    "erstellt_am" timestamp with time zone DEFAULT "now"() NOT NULL,
    "aktualisiert_am" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bh_einstellungen" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."business_kvp_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" DEFAULT 'galvanik-kreile'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "note" "text",
    "category" "text",
    "benefit" "text",
    "priority" "text",
    "status" "text" DEFAULT 'new'::"text",
    "photo_url" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."business_kvp_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calendar_events" (
    "id" "text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "order_id" "text",
    "customer_id" "text",
    "title" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone,
    "time_slot" "text",
    "status" "text" DEFAULT 'planned'::"text" NOT NULL,
    "source" "text",
    "source_ref" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."calendar_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."communication_drafts" (
    "id" "text" NOT NULL,
    "tenant_id" character varying(50) DEFAULT 'galvanik-kreile'::character varying NOT NULL,
    "customer_id" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "body" "text" NOT NULL,
    "type" character varying(50) DEFAULT 'reactivation'::character varying NOT NULL,
    "status" character varying(50) DEFAULT 'draft'::character varying NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."communication_drafts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."communication_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" DEFAULT 'galvanik-kreile'::"text" NOT NULL,
    "thread_id" "uuid",
    "direction" "text",
    "channel" "text",
    "body" "text",
    "summary" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."communication_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."communication_threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" DEFAULT 'galvanik-kreile'::"text" NOT NULL,
    "customer_id" "text",
    "order_id" "text",
    "source" "text",
    "subject" "text",
    "status" "text",
    "priority" "text",
    "category" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."communication_threads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."communications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" DEFAULT 'galvanik-kreile'::"text" NOT NULL,
    "customer_id" "text",
    "order_id" "text",
    "subject" "text",
    "body" "text",
    "type" "text",
    "channel_type" "text",
    "resend_message_id" "text",
    "status" "text" DEFAULT 'queued'::"text",
    "opened_at" timestamp with time zone,
    "bounced_at" timestamp with time zone,
    "complained_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."communications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_settings" (
    "id" "text" DEFAULT 'default'::"text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "company_name" "text" DEFAULT ''::"text" NOT NULL,
    "tagline" "text" DEFAULT ''::"text",
    "street" "text" DEFAULT ''::"text",
    "zip" "text" DEFAULT ''::"text",
    "city" "text" DEFAULT ''::"text",
    "country" "text" DEFAULT 'Deutschland'::"text",
    "phone" "text" DEFAULT ''::"text",
    "email" "text" DEFAULT ''::"text",
    "website" "text" DEFAULT ''::"text",
    "iban" "text" DEFAULT ''::"text",
    "bic" "text" DEFAULT ''::"text",
    "bank_name" "text" DEFAULT ''::"text",
    "tax_id" "text" DEFAULT ''::"text",
    "logo_url" "text" DEFAULT '/logo.png'::"text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email_greeting" "text" DEFAULT 'Sehr geehrte Damen und Herren,'::"text",
    "email_pickup_info" "text" DEFAULT 'Ihr Auftrag ist fertig und kann abgeholt werden.'::"text",
    "email_payment_info" "text" DEFAULT 'Bitte ueberweisen Sie den Rechnungsbetrag unter Angabe der Auftragsnummer.'::"text",
    "email_agb_text" "text" DEFAULT ''::"text",
    "email_footer" "text" DEFAULT 'Mit freundlichen Gruessen, Ihr Team von Galvanik Kreile'::"text",
    "email_additional_notes" "text" DEFAULT ''::"text",
    "workflow_templates" "jsonb" DEFAULT '{}'::"jsonb",
    "wochenziel" integer DEFAULT 25
);


ALTER TABLE "public"."company_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."complaints" (
    "id" "text" NOT NULL,
    "order_id" "text" NOT NULL,
    "customer_id" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "status" character varying(50) DEFAULT 'open'::character varying,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "text" DEFAULT 'galvanik-kreile'::"text",
    "item_id" "text",
    "station_id" "text",
    "description" "text" DEFAULT ''::"text",
    "photo_ids" "jsonb" DEFAULT '[]'::"jsonb",
    "resolved_at" timestamp with time zone,
    "resolution" "text"
);


ALTER TABLE "public"."complaints" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."consumable_uses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" DEFAULT 'galvanik-kreile'::"text" NOT NULL,
    "order_id" "text" NOT NULL,
    "station_kuerzel" "text" NOT NULL,
    "inventory_item_id" "text",
    "item_name" "text" NOT NULL,
    "quantity" numeric(10,4) NOT NULL,
    "unit" "text" DEFAULT 'stk'::"text" NOT NULL,
    "unit_cost_eur" numeric(10,4) NOT NULL,
    "vorlage_id" "uuid",
    "erfasst_von" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."consumable_uses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cost_positions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" DEFAULT 'galvanik-kreile'::"text" NOT NULL,
    "name" "text" NOT NULL,
    "amount" numeric,
    "cost_type" "text" NOT NULL,
    "interval_or_basis" "text",
    "category" "text",
    "note" "text",
    "status" "text" DEFAULT 'active'::"text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cost_positions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "customer_number" character varying(50),
    "name" "text" NOT NULL,
    "type" character varying(50) NOT NULL,
    "city" "text",
    "address" "text",
    "phone" "text",
    "email" "text",
    "pref_comm" character varying(50),
    "risk" character varying(50) DEFAULT 'Niedrig'::character varying,
    "risk_note" "text",
    "notes" "text",
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "image_urls" "jsonb" DEFAULT '[]'::"jsonb",
    "zip_code" "text",
    "company_name" "text",
    "approval_profile" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "contact_person" "text",
    "payment_profile" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "expectation_profile" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "technical_profile" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "trust_level" "text",
    "internal_warning" "text",
    "tags" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "credit_rating" "text",
    "marketing_opt_out" boolean DEFAULT false,
    "last_reactivated_at" timestamp without time zone,
    "shipping_preference" "text" DEFAULT 'abholung'::"text",
    "payment_preference" "text" DEFAULT 'rechnung_14'::"text",
    "classification" "text" DEFAULT 'B'::"text",
    "internal_notes" "text",
    "behavior_notes" "text",
    "source" "text",
    "source_ref" "text",
    "enriched_fields" "jsonb" DEFAULT '[]'::"jsonb",
    "is_lead" boolean DEFAULT false,
    "lead_since" timestamp with time zone,
    "converted_at" timestamp with time zone,
    "street" "text",
    "country" "text",
    "tenant_id" character varying(50) DEFAULT 'galvanik-kreile'::character varying NOT NULL
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."developer_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" character varying(50) NOT NULL,
    "client_request_id" "uuid" NOT NULL,
    "actor_pseudonym" character varying(64) NOT NULL,
    "actor_role" character varying(50) NOT NULL,
    "route" character varying(200) NOT NULL,
    "message" "text" NOT NULL,
    "build_id" character varying(100),
    "status" character varying(20) DEFAULT 'new'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "developer_feedback_actor_chk" CHECK ((("actor_pseudonym")::"text" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "developer_feedback_message_chk" CHECK ((("char_length"("message") >= 3) AND ("char_length"("message") <= 2000))),
    CONSTRAINT "developer_feedback_role_chk" CHECK ((("actor_role")::"text" = ANY ((ARRAY['developer'::character varying, 'admin'::character varying, 'meister'::character varying, 'buero'::character varying, 'werkstatt'::character varying, 'readonly'::character varying])::"text"[]))),
    CONSTRAINT "developer_feedback_route_chk" CHECK ((("route")::"text" ~ '^/(?:[a-z][a-z-]{0,39}|:id)?(?:/(?:[a-z][a-z-]{0,39}|:id)){0,4}$'::"text")),
    CONSTRAINT "developer_feedback_status_chk" CHECK ((("status")::"text" = 'new'::"text")),
    CONSTRAINT "developer_feedback_tenant_fixed" CHECK ((("tenant_id")::"text" = 'galvanik-kreile'::"text"))
);

ALTER TABLE ONLY "public"."developer_feedback" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."developer_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."devices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" DEFAULT 'galvanik-kreile'::"text" NOT NULL,
    "name" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "last_seen" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."devices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."einwilligung" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kunde_id" "text" NOT NULL,
    "kanal" "text" NOT NULL,
    "status" "text" DEFAULT 'widerrufen'::"text" NOT NULL,
    "quelle" "text" NOT NULL,
    "nachweis" "text",
    "zeitpunkt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "erstellt_am" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."einwilligung" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" DEFAULT 'galvanik-kreile'::"text" NOT NULL,
    "template_key" "text" NOT NULL,
    "name" "text" NOT NULL,
    "subject_template" "text" NOT NULL,
    "body_html_template" "text" NOT NULL,
    "body_text_template" "text",
    "variables" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."email_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "text" NOT NULL,
    "tenant_id" character varying(50) DEFAULT 'galvanik-kreile'::character varying,
    "order_id" "text",
    "item_id" "text",
    "event_type" character varying(100) NOT NULL,
    "description" "text",
    "notes" "text",
    "user_id" "uuid",
    "worker_id" character varying(100),
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "payload" "jsonb",
    "status" character varying(50) DEFAULT 'success'::character varying,
    "station" "text",
    "client_event_id" "uuid"
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."export_lauf" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "typ" "text" NOT NULL,
    "zeitraum_von" "date",
    "zeitraum_bis" "date",
    "datei_pfad" "text",
    "anzahl_buchungen" integer DEFAULT 0,
    "erstellt_von" "uuid" NOT NULL,
    "erstellt_am" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."export_lauf" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feature_flags" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "enabled" boolean DEFAULT false,
    "roles_allowed" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."feature_flags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback_eingang" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "feedback_mail_id" "uuid",
    "zufriedenheit" integer,
    "google_bewertung_geklickt" boolean DEFAULT false,
    "fotos_hochgeladen" integer DEFAULT 0,
    "freitext" "text",
    "eingegangen_am" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."feedback_eingang" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback_mail" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "auftrag_id" "text",
    "kunde_id" "text",
    "segment_id" "uuid",
    "ankunft_quelle" "text",
    "ankunft_am" timestamp without time zone,
    "geplant_fuer" timestamp without time zone,
    "status" "text" DEFAULT 'geplant'::"text" NOT NULL,
    "gesendet_am" timestamp without time zone,
    "token_upload" "text",
    "token_feedback" "text",
    "einwilligung_ok" boolean DEFAULT false,
    "erstellt_am" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."feedback_mail" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" DEFAULT 'galvanik-kreile'::"text" NOT NULL,
    "page_path" "text",
    "note" "text" NOT NULL,
    "role" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."feedback_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forecast_version" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "jahr" integer NOT NULL,
    "monat" integer,
    "version_typ" "text" NOT NULL,
    "erstellt_am" timestamp with time zone DEFAULT "now"(),
    "erstellt_von" "uuid",
    "basis_data" "jsonb" NOT NULL,
    "werte" "jsonb" NOT NULL,
    "bemerkung" "text",
    "ist_aktiv" boolean DEFAULT false
);


ALTER TABLE "public"."forecast_version" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."import_job_rows" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "job_id" "text" NOT NULL,
    "row_index" integer NOT NULL,
    "data" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."import_job_rows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."import_jobs" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone
);


ALTER TABLE "public"."import_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inquiries" (
    "id" "text" NOT NULL,
    "tenant_id" character varying DEFAULT 'galvanik-kreile'::character varying,
    "customer_id" "text",
    "customer_name" "text",
    "customer_email" "text",
    "customer_phone" "text",
    "subject" "text",
    "message" "text",
    "source" "text" DEFAULT 'website'::"text",
    "status" character varying DEFAULT 'new'::character varying,
    "priority" character varying DEFAULT 'normal'::character varying,
    "image_urls" "jsonb" DEFAULT '[]'::"jsonb",
    "attachment_urls" "jsonb" DEFAULT '[]'::"jsonb",
    "extracted_data" "jsonb",
    "assigned_order_id" "text",
    "internal_notes" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rust_level" "text",
    "dirt_level" "text",
    "part_count" integer DEFAULT 1 NOT NULL,
    "material" "text" DEFAULT ''::"text" NOT NULL,
    "photo" "text",
    "pricing" "jsonb",
    "quelle_typ" "text" DEFAULT 'unbekannt'::"text" NOT NULL,
    "quelle_touchpoint_id" "uuid",
    "quelle_manuell" "text",
    "quelle_konfidenz" numeric(5,2)
);


ALTER TABLE "public"."inquiries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_items" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "category" character varying(100),
    "current_stock" integer DEFAULT 0,
    "min_stock" integer DEFAULT 0,
    "unit" character varying(20),
    "tenant_id" "text",
    "einkaufspreis_eur" numeric(10,4),
    "einheit_normiert" "text",
    "kostenstelle_default_kuerzel" "text",
    "letzter_preis_aktualisiert_am" timestamp with time zone,
    "letzter_preis_quelle_beleg_id" "uuid"
);


ALTER TABLE "public"."inventory_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" DEFAULT 'galvanik-kreile'::"text" NOT NULL,
    "customer_id" "text",
    "order_id" "text",
    "invoice_number" "text",
    "amount_total" numeric,
    "status" "text" DEFAULT 'draft'::"text",
    "due_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."item_photo_jobs" (
    "id" "uuid" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "user_id" "text" NOT NULL,
    "order_id" "text" NOT NULL,
    "item_id" "text" NOT NULL,
    "request_key_hash" "text" NOT NULL,
    "content_sha256" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "mime_type" "text" NOT NULL,
    "file_bytes" integer NOT NULL,
    "status" "text" DEFAULT 'reserved'::"text" NOT NULL,
    "provider_status" "text",
    "actual_units" integer,
    "analysis_result" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "uploaded_at" timestamp with time zone,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "item_photo_actual_units_nonnegative" CHECK ((("actual_units" IS NULL) OR ("actual_units" >= 0))),
    CONSTRAINT "item_photo_content_hash" CHECK (("content_sha256" ~ '^[a-f0-9]{64}$'::"text")),
    CONSTRAINT "item_photo_file_bytes_bounded" CHECK ((("file_bytes" >= 1) AND ("file_bytes" <= 12582912))),
    CONSTRAINT "item_photo_mime_known" CHECK (("mime_type" = ANY (ARRAY['image/jpeg'::"text", 'image/png'::"text", 'image/webp'::"text"]))),
    CONSTRAINT "item_photo_request_hash" CHECK (("request_key_hash" ~ '^[a-f0-9]{64}$'::"text")),
    CONSTRAINT "item_photo_status_known" CHECK (("status" = ANY (ARRAY['reserved'::"text", 'uploaded'::"text", 'in_flight'::"text", 'succeeded'::"text", 'failed'::"text", 'uncertain'::"text"]))),
    CONSTRAINT "item_photo_tenant_fixed" CHECK (("tenant_id" = 'galvanik-kreile'::"text"))
);

ALTER TABLE ONLY "public"."item_photo_jobs" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."item_photo_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."item_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" DEFAULT 'galvanik-kreile'::"text" NOT NULL,
    "order_id" "text",
    "item_id" "text",
    "photo_type" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "thumbnail_path" "text",
    "station" "text",
    "uploaded_by" "uuid",
    "uploaded_at" timestamp with time zone DEFAULT "now"(),
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "item_photos_photo_type_check" CHECK (("photo_type" = ANY (ARRAY['before'::"text", 'during'::"text", 'after'::"text", 'damage'::"text", 'detail'::"text"])))
);


ALTER TABLE "public"."item_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."items" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "tenant_id" character varying(50) DEFAULT 'galvanik-kreile'::character varying,
    "order_id" "text" NOT NULL,
    "customer_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "current_station_id" character varying(100) DEFAULT 'wareneingang'::character varying,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "surface_requested" "text",
    "material" "text",
    "photo_ids" "jsonb" DEFAULT '[]'::"jsonb",
    "photo" "text",
    "repair_types" "text"[] DEFAULT '{}'::"text"[],
    "station_sequence" "jsonb" DEFAULT '[]'::"jsonb",
    "current_step" integer DEFAULT 0,
    "internal_notes" "text",
    "preis_netto" numeric(10,2)
);


ALTER TABLE "public"."items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kampagne" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "ziel" "text",
    "zeitraum_von" "date",
    "zeitraum_bis" "date",
    "budget" numeric(12,2) DEFAULT '0'::numeric,
    "status" "text" DEFAULT 'geplanned'::"text" NOT NULL,
    "is_demo" boolean DEFAULT false,
    "erstellt_am" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."kampagne" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kanal" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "typ" "text" NOT NULL,
    "name" "text" NOT NULL,
    "verbunden" boolean DEFAULT false,
    "config" "jsonb",
    "access_token_encrypted" "text",
    "status" "text" DEFAULT 'nicht_verbunden'::"text",
    "erstellt_am" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."kanal" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kategorie" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "typ" "text" DEFAULT 'ausgabe'::"text" NOT NULL,
    "skr_konto" "text",
    "default_absetzbar_prozent" numeric(5,2) DEFAULT 100,
    "icon" "text",
    "sortierung" integer DEFAULT 0,
    "erstellt_am" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."kategorie" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."konto" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "nummer" "text" NOT NULL,
    "bezeichnung" "text" NOT NULL,
    "kategorie" "text" NOT NULL,
    "ist_erfolgskonto" boolean NOT NULL,
    "steuerprofil_id" "uuid",
    "externes_konto_lexware" "text",
    "externes_konto_datev" "text",
    "ist_aktiv" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."konto" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kosten_posten" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" character varying(50) DEFAULT 'galvanik-kreile'::character varying NOT NULL,
    "modul" "text" DEFAULT 'marketing'::"text" NOT NULL,
    "kanal" "text",
    "kampagne_id" "text",
    "beschreibung" "text",
    "betrag" numeric(12,2) NOT NULL,
    "gebucht_am" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."kosten_posten" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kostenposten" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bezeichnung" "text" NOT NULL,
    "art" "text" NOT NULL,
    "kategorie" "text",
    "betrag" numeric(12,2) NOT NULL,
    "intervall" "text" NOT NULL,
    "beleg_id" "uuid",
    "kampagne_id" "uuid",
    "gilt_ab" "date",
    "gilt_bis" "date",
    "is_demo" boolean DEFAULT false
);


ALTER TABLE "public"."kostenposten" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kostensatz_default" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "station_kuerzel" "text" NOT NULL,
    "eur_pro_stunde" numeric(8,2) NOT NULL,
    "gilt_ab" "date" NOT NULL,
    "bemerkung" "text"
);


ALTER TABLE "public"."kostensatz_default" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kostenstelle" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "kuerzel" "text" NOT NULL,
    "name" "text" NOT NULL,
    "typ" "text" NOT NULL,
    "capacity_center_id" "uuid",
    "ist_aktiv" boolean DEFAULT true,
    "geplante_personalkosten_monatlich" numeric(12,2),
    "geplante_sachkosten_monatlich" numeric(12,2),
    "verfuegbare_stunden_monatlich" numeric(8,2),
    "notiz" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "energie_anteil_prozent" numeric(5,2)
);


ALTER TABLE "public"."kostenstelle" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kostenstellen_energie_monat" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "kostenstelle_id" "uuid",
    "monat" "date" NOT NULL,
    "energie_eur_pro_stunde" numeric(8,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."kostenstellen_energie_monat" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kpi_cost_assumptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" DEFAULT 'galvanik-kreile'::"text" NOT NULL,
    "key" "text" NOT NULL,
    "value_numeric" numeric(12,4),
    "unit" "text",
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."kpi_cost_assumptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kpi_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" DEFAULT 'galvanik-kreile'::"text" NOT NULL,
    "kpi_key" "text" NOT NULL,
    "periode" "text" NOT NULL,
    "periode_start" "date" NOT NULL,
    "wert" numeric,
    "einheit" "text",
    "meta" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."kpi_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kraftstoff_detail" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "beleg_id" "uuid" NOT NULL,
    "sorte" "text",
    "liter" numeric(8,2),
    "preis_pro_liter" numeric(6,3),
    "tankstelle" "text",
    "ort" "text"
);


ALTER TABLE "public"."kraftstoff_detail" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kvp_items" (
    "id" "text" NOT NULL,
    "tenant_id" "text" DEFAULT 'galvanik-kreile'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "category" "text" NOT NULL,
    "benefit" "text" NOT NULL,
    "status" "text" DEFAULT 'neu'::"text" NOT NULL,
    "problem_desc" "text",
    "has_photo" boolean DEFAULT false,
    "date" "text",
    "is_demo" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."kvp_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lern_metrik" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "dimension" "text" NOT NULL,
    "wert" "text" NOT NULL,
    "aktionen" integer DEFAULT 0,
    "anfragen" integer DEFAULT 0,
    "umsatz" numeric(12,2) DEFAULT '0'::numeric,
    "konfidenz" numeric(5,2) DEFAULT '0'::numeric,
    "aktualisiert_am" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lern_metrik" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."licenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" DEFAULT 'galvanik-kreile'::"text" NOT NULL,
    "plan" "text" NOT NULL,
    "valid_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."licenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lieferant" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "name_normalisiert" "text",
    "standard_kategorie_id" "uuid",
    "standard_skr_konto" "text",
    "ust_id" "text",
    "adresse" "text",
    "erstellt_am" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lieferant" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" DEFAULT 'galvanik-kreile'::"text" NOT NULL,
    "location_code" "text" NOT NULL,
    "area" "text" NOT NULL,
    "description" "text",
    "active" boolean DEFAULT true
);


ALTER TABLE "public"."locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_asset" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quelle" "text" NOT NULL,
    "auftrag_id" "text",
    "kunde_id" "text",
    "segment_id" "uuid",
    "storage_pfad" "text" NOT NULL,
    "typ" "text" NOT NULL,
    "freigabe_marketing" boolean DEFAULT false,
    "qualitaet_score" numeric(4,2) DEFAULT '0'::numeric,
    "erstellt_am" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."marketing_asset" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketing_touchpoints" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" character varying(50) DEFAULT 'galvanik-kreile'::character varying NOT NULL,
    "aktion_id" "text",
    "kanal" "text" NOT NULL,
    "titel" "text",
    "ausgefuehrt_am" timestamp without time zone DEFAULT "now"() NOT NULL,
    "budget" numeric(12,2) DEFAULT '0'::numeric,
    "aufwand_minuten" integer DEFAULT 0,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."marketing_touchpoints" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."offline_outbox" (
    "id" "text" NOT NULL,
    "tenant_id" character varying(50) DEFAULT 'galvanik-kreile'::character varying NOT NULL,
    "mutation_type" character varying(100) NOT NULL,
    "payload" "jsonb" NOT NULL,
    "status" character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    "retry_count" integer DEFAULT 0,
    "last_error" "text",
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp without time zone
);


ALTER TABLE "public"."offline_outbox" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."operator_control_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "policy_version" bigint NOT NULL,
    "plan" character varying(20) NOT NULL,
    "mode" character varying(20) NOT NULL,
    "reason" character varying(40) NOT NULL,
    "notice" character varying(500),
    "effective_at" timestamp with time zone NOT NULL,
    "expires_at" timestamp with time zone,
    "issued_at" timestamp with time zone NOT NULL,
    "canonical_payload" "text" NOT NULL,
    "signature" character varying(100) NOT NULL,
    "request_digest" character varying(64) NOT NULL,
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "operator_control_events_digest_chk" CHECK ((("request_digest")::"text" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "operator_control_events_grace_expiry_chk" CHECK (((("mode")::"text" <> 'grace'::"text") OR ("expires_at" IS NOT NULL))),
    CONSTRAINT "operator_control_events_mode_chk" CHECK ((("mode")::"text" = ANY ((ARRAY['active'::character varying, 'grace'::character varying, 'suspended'::character varying, 'maintenance'::character varying])::"text"[]))),
    CONSTRAINT "operator_control_events_notice_chk" CHECK (((("mode")::"text" = 'active'::"text") OR ("notice" IS NOT NULL))),
    CONSTRAINT "operator_control_events_plan_chk" CHECK ((("plan")::"text" = ANY ((ARRAY['basis'::character varying, 'pro'::character varying, 'premium'::character varying, 'enterprise'::character varying])::"text"[]))),
    CONSTRAINT "operator_control_events_reason_chk" CHECK ((("reason")::"text" = ANY ((ARRAY['payment_overdue'::character varying, 'contract_ended'::character varying, 'maintenance'::character varying, 'security_incident'::character varying, 'manual_review'::character varying, 'restored'::character varying])::"text"[]))),
    CONSTRAINT "operator_control_events_semantics_chk" CHECK ((((("mode")::"text" = 'active'::"text") AND (("reason")::"text" = 'restored'::"text")) OR ((("mode")::"text" = 'grace'::"text") AND (("reason")::"text" = ANY ((ARRAY['payment_overdue'::character varying, 'manual_review'::character varying])::"text"[]))) OR ((("mode")::"text" = 'suspended'::"text") AND (("reason")::"text" = ANY ((ARRAY['payment_overdue'::character varying, 'contract_ended'::character varying, 'security_incident'::character varying, 'manual_review'::character varying])::"text"[]))) OR ((("mode")::"text" = 'maintenance'::"text") AND (("reason")::"text" = ANY ((ARRAY['maintenance'::character varying, 'security_incident'::character varying])::"text"[]))))),
    CONSTRAINT "operator_control_events_signature_chk" CHECK ((("signature")::"text" ~ '^[A-Za-z0-9_-]{86}$'::"text")),
    CONSTRAINT "operator_control_events_tenant_chk" CHECK (("tenant_id" = 'galvanik-kreile'::"text")),
    CONSTRAINT "operator_control_events_version_chk" CHECK (("policy_version" > 0)),
    CONSTRAINT "operator_control_events_window_chk" CHECK ((("expires_at" IS NULL) OR ("expires_at" > "effective_at")))
);

ALTER TABLE ONLY "public"."operator_control_events" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."operator_control_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_cost_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" DEFAULT 'galvanik-kreile'::"text" NOT NULL,
    "order_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "amount_eur" numeric(12,2) NOT NULL,
    "reason" "text",
    "caused_by" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."order_cost_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_cost_positions" (
    "id" "text" NOT NULL,
    "tenant_id" character varying(50) DEFAULT 'galvanik-kreile'::character varying NOT NULL,
    "order_id" "text" NOT NULL,
    "type" character varying(50) NOT NULL,
    "description" "text" NOT NULL,
    "amount_cents" integer NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."order_cost_positions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_financials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" DEFAULT 'galvanik-kreile'::"text" NOT NULL,
    "order_id" "text" NOT NULL,
    "expected_revenue_net_eur" numeric(12,2),
    "approved_revenue_net_eur" numeric(12,2),
    "invoiced_revenue_net_eur" numeric(12,2),
    "price_status" "text" DEFAULT 'unpriced'::"text" NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."order_financials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "tenant_id" character varying(50) DEFAULT 'galvanik-kreile'::character varying,
    "order_number" "text" NOT NULL,
    "customer_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "task" "text",
    "station" character varying(100) DEFAULT 'wareneingang'::character varying NOT NULL,
    "current_station_id" character varying(100),
    "status" character varying(50) DEFAULT 'in_progress'::character varying NOT NULL,
    "risk" character varying(50) DEFAULT 'green'::character varying,
    "priority_computed" character varying(50) DEFAULT 'green'::character varying,
    "parts" "jsonb",
    "status_text" "text",
    "delay_reason" "text",
    "recommended_action" "text",
    "intake_date" timestamp without time zone DEFAULT "now"(),
    "due_date" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "current_station" "text" DEFAULT 'wareneingang'::"text",
    "attachment_url" "text",
    "attachment_urls" "jsonb" DEFAULT '[]'::"jsonb",
    "inquiry_id" "text",
    "kostenstelle_primaer_id" "uuid",
    "db_geplant" numeric(12,2),
    "db_ist" numeric(12,2),
    "db_letzte_berechnung" timestamp with time zone,
    "priority" "text" DEFAULT 'normal'::"text",
    "promised_due_date" timestamp with time zone,
    "completed_date" timestamp with time zone,
    "payment_status" "text" DEFAULT 'unpaid'::"text",
    "delivery_method" "text",
    "source" "text",
    "source_ref" "text",
    "freetext_original" "text",
    "is_quote" boolean DEFAULT false,
    "quote_status" "text",
    "quote_converted_order_id" "text"
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" DEFAULT 'galvanik-kreile'::"text" NOT NULL,
    "invoice_id" "uuid",
    "provider" "text",
    "method" "text",
    "status" "text",
    "paid_at" timestamp with time zone,
    "provider_reference" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "order_id" "text",
    "provider_intent_id" "text",
    "mollie_status" "text",
    "mollie_method" "text",
    "receipt_url" "text",
    "amount_eur" numeric(10,2)
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."periode" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "jahr" integer NOT NULL,
    "monat" integer NOT NULL,
    "status" "text" NOT NULL,
    "geschlossen_am" timestamp with time zone,
    "geschlossen_von" "uuid",
    "bemerkung" "text"
);


ALTER TABLE "public"."periode" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."phone_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" DEFAULT 'galvanik-kreile'::"text" NOT NULL,
    "thread_id" "uuid",
    "customer_id" "text",
    "order_id" "text",
    "raw_text" "text",
    "generated_answer" "text",
    "caller_name" "text",
    "company" "text",
    "phone" "text",
    "category" "text",
    "urgency" "text",
    "status" "text" DEFAULT 'draft'::"text",
    "extraction_json" "jsonb" DEFAULT '{}'::"jsonb",
    "links_json" "jsonb" DEFAULT '[]'::"jsonb",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."phone_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pin_rate_limits" (
    "operator_id" "uuid" NOT NULL,
    "failed_attempts" integer DEFAULT 0 NOT NULL,
    "last_failed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "text" DEFAULT 'galvanik-kreile'::"text" NOT NULL
);


ALTER TABLE "public"."pin_rate_limits" OWNER TO "postgres";


COMMENT ON TABLE "public"."pin_rate_limits" IS 'Rate-Limiting fuer PIN-Login-Versuche (M4: SEC-PIN-002B)';



CREATE TABLE IF NOT EXISTS "public"."price_agreements" (
    "id" "text" NOT NULL,
    "customer_id" "text" NOT NULL,
    "scope" "text" NOT NULL,
    "rate" "text" NOT NULL,
    "date" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."price_agreements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."price_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" DEFAULT 'galvanik-kreile'::"text" NOT NULL,
    "order_id" "text" NOT NULL,
    "item_id" "text",
    "position_text" "text" NOT NULL,
    "qty" numeric(10,2) DEFAULT 1,
    "unit_price_eur" numeric(10,2) NOT NULL,
    "unit_total_eur" numeric(10,2) GENERATED ALWAYS AS (("qty" * "unit_price_eur")) STORED,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."price_lines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scan_uploads" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "file_url" "text" NOT NULL,
    "file_type" "text",
    "uploaded_by" "uuid",
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "detected_type" "text",
    "detection_confidence" numeric(3,2),
    "extracted_data" "jsonb",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "linked_order_id" "text",
    "linked_customer_id" "text",
    "linked_invoice_id" "text",
    "ocr_provider" "text",
    "original_hash" "text",
    "original_storage_path" "text",
    "original_size_bytes" bigint,
    "original_secured_at" timestamp with time zone,
    "client_idempotency_key" "text",
    "field_confidence" "jsonb" DEFAULT '{}'::"jsonb",
    "review_required" boolean DEFAULT false NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "conversion_order_id" "text",
    "conversion_event_id" "text",
    "upload_claim_token" "text",
    "upload_claimed_at" timestamp with time zone
);


ALTER TABLE "public"."scan_uploads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."security_rate_limit_counters" (
    "namespace" "text" NOT NULL,
    "subject_hash" "text" NOT NULL,
    "window_started_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "clock_timestamp"() NOT NULL,
    CONSTRAINT "security_rate_limit_counters_attempt_count_check" CHECK ((("attempt_count" >= 0) AND ("attempt_count" <= 100000))),
    CONSTRAINT "security_rate_limit_counters_namespace_check" CHECK (("namespace" ~ '^[a-z0-9._-]{1,80}$'::"text")),
    CONSTRAINT "security_rate_limit_counters_subject_hash_check" CHECK (("subject_hash" ~ '^[0-9a-f]{64}$'::"text"))
);

ALTER TABLE ONLY "public"."security_rate_limit_counters" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."security_rate_limit_counters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."segment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "icon" "text",
    "farbe" "text" DEFAULT '#e91e63'::"text",
    "beschreibung" "text",
    "filter_regel" "jsonb",
    "is_demo" boolean DEFAULT false,
    "erstellt_am" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."segment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shipments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" DEFAULT 'galvanik-kreile'::"text" NOT NULL,
    "order_id" "text" NOT NULL,
    "carrier" "text",
    "tracking_number" "text",
    "label_url" "text",
    "weight_kg" numeric(8,2),
    "kolli_count" integer DEFAULT 1,
    "insurance_eur" numeric(10,2),
    "shipping_cost_eur" numeric(10,2),
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "shipped_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shipments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."statistik_kennzahl" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "metrik" "text" NOT NULL,
    "periode" "text" NOT NULL,
    "wert" numeric(12,2) NOT NULL,
    "quelle" "text",
    "aktualisiert_am" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."statistik_kennzahl" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."steuerprofil" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bezeichnung" "text" DEFAULT 'Standard'::"text" NOT NULL,
    "standard_ust_satz" numeric(4,2) DEFAULT 19.00,
    "reduziert_ust_satz" numeric(4,2) DEFAULT 7.00,
    "kleinunternehmer" boolean DEFAULT false,
    "voranmeldung_rhythmus" "text" DEFAULT 'monatlich'::"text",
    "sachkontenrahmen" "text" DEFAULT 'SKR03'::"text",
    "berater_nr" "text",
    "mandanten_nr" "text",
    "wj_beginn" "date",
    "aktiv" boolean DEFAULT true,
    "erstellt_am" timestamp with time zone DEFAULT "now"() NOT NULL,
    "app_lizenz_monat" numeric(10,2) DEFAULT 149.00,
    "app_einrichtung_einmalig" numeric(10,2) DEFAULT 0.00,
    "app_startdatum" "date" DEFAULT "now"()
);


ALTER TABLE "public"."steuerprofil" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stock_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" DEFAULT 'galvanik-kreile'::"text" NOT NULL,
    "inventory_item_id" "text",
    "movement_type" "text" NOT NULL,
    "quantity" numeric NOT NULL,
    "reason" "text",
    "order_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "kostenstelle_kuerzel" "text",
    "station_kuerzel" "text",
    "erfasst_von" "uuid",
    "war_aus_vorlage" boolean DEFAULT false,
    "vorlage_id" "uuid",
    "snapshot_einkaufspreis_eur" numeric(10,4),
    "notiz" "text"
);


ALTER TABLE "public"."stock_movements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teile_klassifikator" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "klasse" "text" NOT NULL,
    "keywords" "text"[] NOT NULL,
    "beispiel_oberflaechen" "text"[]
);


ALTER TABLE "public"."teile_klassifikator" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."telemetrie_event" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_typ" "text" NOT NULL,
    "meta" "jsonb",
    "zeitpunkt" timestamp without time zone DEFAULT "now"() NOT NULL,
    "is_anonym" boolean DEFAULT true
);


ALTER TABLE "public"."telemetrie_event" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_operator_controls" (
    "tenant_id" "text" NOT NULL,
    "plan" character varying(20) NOT NULL,
    "mode" character varying(20) NOT NULL,
    "reason" character varying(40) NOT NULL,
    "notice" character varying(500),
    "effective_at" timestamp with time zone NOT NULL,
    "expires_at" timestamp with time zone,
    "issued_at" timestamp with time zone NOT NULL,
    "policy_version" bigint NOT NULL,
    "canonical_payload" "text" NOT NULL,
    "signature" character varying(100) NOT NULL,
    "request_digest" character varying(64) NOT NULL,
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tenant_operator_controls_digest_chk" CHECK ((("request_digest")::"text" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "tenant_operator_controls_grace_expiry_chk" CHECK (((("mode")::"text" <> 'grace'::"text") OR ("expires_at" IS NOT NULL))),
    CONSTRAINT "tenant_operator_controls_mode_chk" CHECK ((("mode")::"text" = ANY ((ARRAY['active'::character varying, 'grace'::character varying, 'suspended'::character varying, 'maintenance'::character varying])::"text"[]))),
    CONSTRAINT "tenant_operator_controls_notice_chk" CHECK (((("mode")::"text" = 'active'::"text") OR ("notice" IS NOT NULL))),
    CONSTRAINT "tenant_operator_controls_plan_chk" CHECK ((("plan")::"text" = ANY ((ARRAY['basis'::character varying, 'pro'::character varying, 'premium'::character varying, 'enterprise'::character varying])::"text"[]))),
    CONSTRAINT "tenant_operator_controls_reason_chk" CHECK ((("reason")::"text" = ANY ((ARRAY['payment_overdue'::character varying, 'contract_ended'::character varying, 'maintenance'::character varying, 'security_incident'::character varying, 'manual_review'::character varying, 'restored'::character varying])::"text"[]))),
    CONSTRAINT "tenant_operator_controls_semantics_chk" CHECK ((((("mode")::"text" = 'active'::"text") AND (("reason")::"text" = 'restored'::"text")) OR ((("mode")::"text" = 'grace'::"text") AND (("reason")::"text" = ANY ((ARRAY['payment_overdue'::character varying, 'manual_review'::character varying])::"text"[]))) OR ((("mode")::"text" = 'suspended'::"text") AND (("reason")::"text" = ANY ((ARRAY['payment_overdue'::character varying, 'contract_ended'::character varying, 'security_incident'::character varying, 'manual_review'::character varying])::"text"[]))) OR ((("mode")::"text" = 'maintenance'::"text") AND (("reason")::"text" = ANY ((ARRAY['maintenance'::character varying, 'security_incident'::character varying])::"text"[]))))),
    CONSTRAINT "tenant_operator_controls_signature_chk" CHECK ((("signature")::"text" ~ '^[A-Za-z0-9_-]{86}$'::"text")),
    CONSTRAINT "tenant_operator_controls_tenant_chk" CHECK (("tenant_id" = 'galvanik-kreile'::"text")),
    CONSTRAINT "tenant_operator_controls_version_chk" CHECK (("policy_version" > 0)),
    CONSTRAINT "tenant_operator_controls_window_chk" CHECK ((("expires_at" IS NULL) OR ("expires_at" > "effective_at")))
);

ALTER TABLE ONLY "public"."tenant_operator_controls" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenant_operator_controls" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."touchpoint" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "aktion_id" "uuid",
    "kanal_id" "uuid",
    "externe_ref" "text",
    "utm_campaign" "text",
    "utm_source" "text",
    "utm_medium" "text",
    "reichweite" integer DEFAULT 0,
    "klicks" integer DEFAULT 0,
    "ausgefuehrt_am" timestamp without time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."touchpoint" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ui_events" (
    "id" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "tenant_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "session_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ui_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ustva_periode" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "zeitraum_von" "date" NOT NULL,
    "zeitraum_bis" "date" NOT NULL,
    "umsatz_19" numeric(12,2) DEFAULT 0,
    "ust_19" numeric(12,2) DEFAULT 0,
    "umsatz_7" numeric(12,2) DEFAULT 0,
    "ust_7" numeric(12,2) DEFAULT 0,
    "umsatz_0" numeric(12,2) DEFAULT 0,
    "vorsteuer" numeric(12,2) DEFAULT 0,
    "zahllast" numeric(12,2) DEFAULT 0,
    "status" "text" DEFAULT 'entwurf'::"text",
    "freigegeben_am" timestamp with time zone,
    "freigegeben_von" "uuid",
    "erstellt_am" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ustva_periode" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_aging" WITH ("security_invoker"='true') AS
 SELECT "ar"."id",
    "ar"."nummer" AS "rechnungsnummer",
    "ar"."kunde_id" AS "customer_id",
    "c"."name" AS "kunde_name",
    "c"."company_name",
    "ar"."netto",
    "ar"."brutto",
    "ar"."faellig_am",
    "ar"."bezahlt_am",
    "ar"."mahnstufe",
        CASE
            WHEN ("ar"."bezahlt_am" IS NOT NULL) THEN 'bezahlt'::"text"
            WHEN ("ar"."faellig_am" IS NULL) THEN 'ohne_faelligkeit'::"text"
            WHEN (("now"())::"date" <= "ar"."faellig_am") THEN 'nicht_faellig'::"text"
            WHEN ((("now"())::"date" - "ar"."faellig_am") <= 14) THEN '1-14'::"text"
            WHEN ((("now"())::"date" - "ar"."faellig_am") <= 30) THEN '15-30'::"text"
            WHEN ((("now"())::"date" - "ar"."faellig_am") <= 60) THEN '31-60'::"text"
            WHEN ((("now"())::"date" - "ar"."faellig_am") <= 90) THEN '61-90'::"text"
            ELSE '>90'::"text"
        END AS "aging_bucket",
        CASE
            WHEN (("ar"."bezahlt_am" IS NULL) AND ("ar"."faellig_am" IS NOT NULL)) THEN GREATEST(0, (("now"())::"date" - "ar"."faellig_am"))
            ELSE NULL::integer
        END AS "tage_ueberfaellig"
   FROM ("public"."ausgangsrechnung" "ar"
     LEFT JOIN "public"."customers" "c" ON (("c"."id" = "ar"."kunde_id")))
  WHERE ((("ar"."is_demo" IS NULL) OR ("ar"."is_demo" = false)) AND (("ar"."tenant_id")::"text" = 'galvanik-kreile'::"text"));


ALTER VIEW "public"."v_aging" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_production_orders" WITH ("security_invoker"='true') AS
 SELECT "id",
    "tenant_id",
    "order_number",
    "customer_id",
    "title",
    "task",
    "station",
    "current_station_id",
    "status",
    "risk",
    "priority_computed",
    "parts",
    "status_text",
    "delay_reason",
    "recommended_action",
    "intake_date",
    "due_date",
    "created_at",
    "current_station",
    "attachment_url",
    "attachment_urls",
    "inquiry_id",
    "kostenstelle_primaer_id",
    "db_geplant",
    "db_ist",
    "db_letzte_berechnung",
    "priority",
    "promised_due_date",
    "completed_date",
    "payment_status",
    "delivery_method",
    "source",
    "source_ref",
    "freetext_original",
    "is_quote",
    "quote_status",
    "quote_converted_order_id"
   FROM "public"."orders"
  WHERE ((("tenant_id")::"text" = 'galvanik-kreile'::"text") AND (COALESCE("source", ''::"text") <> ALL (ARRAY['seed'::"text", 'test'::"text", 'integration-test'::"text"])) AND ("customer_id" IS NOT NULL) AND (TRIM(BOTH FROM "customer_id") <> ''::"text") AND ("order_number" IS NOT NULL) AND (TRIM(BOTH FROM "order_number") <> ''::"text") AND ("order_number" !~* '^A-SEED-'::"text") AND ("order_number" !~* 'TEST'::"text") AND ((COALESCE(TRIM(BOTH FROM "title"), ''::"text") <> ''::"text") OR (COALESCE(TRIM(BOTH FROM "task"), ''::"text") <> ''::"text")) AND (NOT (((COALESCE("title", ''::"text") <> ''::"text") AND (TRIM(BOTH FROM "title") <> ''::"text") AND (("length"(TRIM(BOTH FROM "title")) < 3) OR (TRIM(BOTH FROM "title") ~* '^[bcdfghjklmnpqrstvwxyz]{5,}'::"text") OR (TRIM(BOTH FROM "title") ~* 'asd|sdf|dfg|fgh|ghj|hjk|jkl|yxc|xcv|cvb|vbn|bnm'::"text") OR (TRIM(BOTH FROM "title") ~* '^([a-z])\1+'::"text") OR ("lower"(TRIM(BOTH FROM "title")) = ANY (ARRAY['gjgvvh'::"text", 'sfdghgjklji'::"text"])) OR ("lower"(TRIM(BOTH FROM "title")) ~~ '%auftrag per scan test e2e%'::"text") OR ("lower"(TRIM(BOTH FROM "title")) ~~ '%test order%'::"text") OR ("lower"(TRIM(BOTH FROM "title")) ~~ '%test stoÃŸstange kundenakte%'::"text"))) OR ((COALESCE("task", ''::"text") <> ''::"text") AND (TRIM(BOTH FROM "task") <> ''::"text") AND (("length"(TRIM(BOTH FROM "task")) < 3) OR (TRIM(BOTH FROM "task") ~* '^[bcdfghjklmnpqrstvwxyz]{5,}'::"text") OR (TRIM(BOTH FROM "task") ~* 'asd|sdf|dfg|fgh|ghj|hjk|jkl|yxc|xcv|cvb|vbn|bnm'::"text") OR (TRIM(BOTH FROM "task") ~* '^([a-z])\1+'::"text") OR ("lower"(TRIM(BOTH FROM "task")) = ANY (ARRAY['gjgvvh'::"text", 'sfdghgjklji'::"text"])) OR ("lower"(TRIM(BOTH FROM "task")) ~~ '%auftrag per scan test e2e%'::"text") OR ("lower"(TRIM(BOTH FROM "task")) ~~ '%test order%'::"text") OR ("lower"(TRIM(BOTH FROM "task")) ~~ '%test stoÃŸstange kundenakte%'::"text"))))) AND (NOT ((COALESCE("order_number", ''::"text") ~* 'test|e2e|demo|seed|mock|fixture|sample|placeholder'::"text") OR (COALESCE("title", ''::"text") ~* 'test|e2e|demo|seed|mock|fixture|sample|placeholder'::"text") OR (COALESCE("task", ''::"text") ~* 'test|e2e|demo|seed|mock|fixture|sample|placeholder'::"text"))));


ALTER VIEW "public"."v_production_orders" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_analyse_durchlaufzeit" WITH ("security_invoker"='true') AS
 SELECT "round"("avg"((EXTRACT(epoch FROM ("completed_date" - ("created_at")::timestamp with time zone)) / 86400.0)), 1) AS "avg_tage",
    "count"(*) AS "n"
   FROM "public"."v_production_orders"
  WHERE (("completed_date" IS NOT NULL) AND ("completed_date" >= ("now"() - '30 days'::interval)));


ALTER VIEW "public"."v_analyse_durchlaufzeit" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_analyse_engpass" WITH ("security_invoker"='true') AS
 SELECT "current_station_id" AS "station",
    "count"(*) AS "teile_wartend"
   FROM "public"."items"
  WHERE ("current_station_id" IS NOT NULL)
  GROUP BY "current_station_id"
  ORDER BY ("count"(*)) DESC;


ALTER VIEW "public"."v_analyse_engpass" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_analyse_kunden_kpi" WITH ("security_invoker"='true') AS
 SELECT "id" AS "customer_id",
    COALESCE("company_name", "name") AS "kunde",
    "classification",
    "created_at" AS "kunde_seit",
    COALESCE(( SELECT "sum"("ar"."brutto") AS "sum"
           FROM ("public"."ausgangsrechnung" "ar"
             JOIN "public"."v_production_orders" "o" ON (("o"."id" = "ar"."order_id")))
          WHERE (("o"."customer_id" = "c"."id") AND ("ar"."status" <> 'storniert'::"text") AND (("ar"."tenant_id")::"text" = 'galvanik-kreile'::"text"))), (0)::numeric) AS "umsatz_ltv",
    ((COALESCE(( SELECT "sum"("i"."preis_netto") AS "sum"
           FROM ("public"."items" "i"
             JOIN "public"."v_production_orders" "o" ON (("o"."id" = "i"."order_id")))
          WHERE (("o"."customer_id" = "c"."id") AND (("i"."tenant_id")::"text" = 'galvanik-kreile'::"text"))), (0)::numeric) - COALESCE(( SELECT "sum"(("cu"."quantity" * "cu"."unit_cost_eur")) AS "sum"
           FROM ("public"."consumable_uses" "cu"
             JOIN "public"."v_production_orders" "o" ON (("o"."id" = "cu"."order_id")))
          WHERE (("o"."customer_id" = "c"."id") AND ("cu"."tenant_id" = 'galvanik-kreile'::"text"))), (0)::numeric)) - COALESCE(( SELECT "sum"(((("az"."dauer_minuten")::numeric / 60.0) * "az"."kostensatz_eur_pro_stunde")) AS "sum"
           FROM ("public"."arbeitszeit_buchung" "az"
             JOIN "public"."v_production_orders" "o" ON (("o"."id" = "az"."auftrag_id")))
          WHERE (("o"."customer_id" = "c"."id") AND ("az"."tenant_id" = 'galvanik-kreile'::"text"))), (0)::numeric)) AS "gewinn_ltv",
    COALESCE(( SELECT "sum"("ar"."brutto") AS "sum"
           FROM ("public"."ausgangsrechnung" "ar"
             JOIN "public"."v_production_orders" "o" ON (("o"."id" = "ar"."order_id")))
          WHERE (("o"."customer_id" = "c"."id") AND ("ar"."bezahlt_am" IS NULL) AND ("ar"."status" <> ALL (ARRAY['storniert'::"text", 'bezahlt'::"text"])) AND (("ar"."tenant_id")::"text" = 'galvanik-kreile'::"text"))), (0)::numeric) AS "offene_posten",
    ( SELECT "count"(*) AS "count"
           FROM "public"."v_production_orders" "o"
          WHERE (("o"."customer_id" = "c"."id") AND (("o"."status")::"text" <> ALL ((ARRAY['abgeschlossen'::character varying, 'storniert'::character varying])::"text"[])))) AS "aktive_auftraege",
        CASE
            WHEN (( SELECT "count"(*) AS "count"
               FROM "public"."v_production_orders" "o"
              WHERE (("o"."customer_id" = "c"."id") AND ("o"."completed_date" IS NOT NULL) AND ("o"."promised_due_date" IS NOT NULL))) > 0) THEN "round"((((( SELECT "count"(*) AS "count"
               FROM "public"."v_production_orders" "o"
              WHERE (("o"."customer_id" = "c"."id") AND ("o"."completed_date" <= "o"."promised_due_date") AND ("o"."completed_date" IS NOT NULL) AND ("o"."promised_due_date" IS NOT NULL))))::numeric * 100.0) / (( SELECT "count"(*) AS "count"
               FROM "public"."v_production_orders" "o"
              WHERE (("o"."customer_id" = "c"."id") AND ("o"."completed_date" IS NOT NULL) AND ("o"."promised_due_date" IS NOT NULL))))::numeric), 1)
            ELSE NULL::numeric
        END AS "puenklichkeit_pct",
    COALESCE(( SELECT "count"(*) AS "count"
           FROM ("public"."complaints" "co"
             JOIN "public"."v_production_orders" "o" ON (("o"."id" = "co"."order_id")))
          WHERE (("o"."customer_id" = "c"."id") AND ("co"."tenant_id" = 'galvanik-kreile'::"text"))), (0)::bigint) AS "reklamationen"
   FROM "public"."customers" "c"
  WHERE (("tenant_id")::"text" = 'galvanik-kreile'::"text");


ALTER VIEW "public"."v_analyse_kunden_kpi" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_analyse_station_durchlauf" WITH ("security_invoker"='true') AS
 WITH "eingang" AS (
         SELECT "events"."order_id",
            "events"."station",
            "min"("events"."created_at") AS "ts_ein"
           FROM "public"."events"
          WHERE ((("events"."event_type")::"text" = 'STATION_EINGANG'::"text") AND ("events"."station" IS NOT NULL) AND "public"."fn_is_production_order"("events"."order_id"))
          GROUP BY "events"."order_id", "events"."station"
        ), "ausgang" AS (
         SELECT "events"."order_id",
            "events"."station",
            "max"("events"."created_at") AS "ts_aus"
           FROM "public"."events"
          WHERE ((("events"."event_type")::"text" = 'STATION_AUSGANG'::"text") AND ("events"."station" IS NOT NULL) AND "public"."fn_is_production_order"("events"."order_id"))
          GROUP BY "events"."order_id", "events"."station"
        )
 SELECT "e"."station",
    "round"("avg"((EXTRACT(epoch FROM ("a"."ts_aus" - "e"."ts_ein")) / 86400.0)), 1) AS "avg_tage",
    "count"(*) AS "n",
    ( SELECT "count"(*) AS "count"
           FROM "public"."items"
          WHERE ((("items"."current_station_id")::"text" = "e"."station") AND "public"."fn_is_production_order"("items"."order_id"))) AS "teile_aktuell"
   FROM ("eingang" "e"
     JOIN "ausgang" "a" ON ((("a"."order_id" = "e"."order_id") AND ("a"."station" = "e"."station"))))
  WHERE ("e"."ts_ein" >= ("now"() - '30 days'::interval))
  GROUP BY "e"."station";


ALTER VIEW "public"."v_analyse_station_durchlauf" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_analyse_termintreue" WITH ("security_invoker"='true') AS
 SELECT "count"(*) FILTER (WHERE (("completed_date" IS NOT NULL) AND ("promised_due_date" IS NOT NULL) AND ("completed_date" <= "promised_due_date"))) AS "puenktlich",
    "count"(*) FILTER (WHERE (("completed_date" IS NOT NULL) AND ("promised_due_date" IS NOT NULL))) AS "nenner",
        CASE
            WHEN ("count"(*) FILTER (WHERE (("completed_date" IS NOT NULL) AND ("promised_due_date" IS NOT NULL))) > 0) THEN "round"(((("count"(*) FILTER (WHERE (("completed_date" <= "promised_due_date") AND ("completed_date" IS NOT NULL) AND ("promised_due_date" IS NOT NULL))))::numeric * 100.0) / ("count"(*) FILTER (WHERE (("completed_date" IS NOT NULL) AND ("promised_due_date" IS NOT NULL))))::numeric), 1)
            ELSE NULL::numeric
        END AS "termintreue_pct",
    "count"(*) FILTER (WHERE (("promised_due_date" IS NULL) AND (("status")::"text" <> 'storniert'::"text"))) AS "ohne_zusagetermin"
   FROM "public"."v_production_orders"
  WHERE ("created_at" >= "date_trunc"('week'::"text", "now"()));


ALTER VIEW "public"."v_analyse_termintreue" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_auftrag_db" AS
 SELECT "o"."id" AS "order_id",
    "o"."order_number",
    "o"."customer_id",
    "c"."name" AS "kunde_name",
    "c"."company_name",
    "o"."intake_date",
    "o"."status",
    "o"."current_station",
    "o"."due_date",
    COALESCE(( SELECT "sum"("ar"."netto") AS "sum"
           FROM "public"."ausgangsrechnung" "ar"
          WHERE (("ar"."order_id" = "o"."id") AND (("ar"."is_demo" IS NULL) OR ("ar"."is_demo" = false)) AND (("ar"."tenant_id")::"text" = 'galvanik-kreile'::"text"))), (0)::numeric) AS "erloes_netto",
    COALESCE(( SELECT "sum"(("abs"("sm"."quantity") * COALESCE("sm"."snapshot_einkaufspreis_eur", (0)::numeric))) AS "sum"
           FROM "public"."stock_movements" "sm"
          WHERE (("sm"."order_id" = "o"."id") AND ("sm"."movement_type" = 'verbrauch'::"text") AND ("sm"."tenant_id" = 'galvanik-kreile'::"text"))), (0)::numeric) AS "material_kosten",
    COALESCE(( SELECT "sum"(((("zb"."dauer_minuten")::numeric / 60.0) * "zb"."kostensatz_eur_pro_stunde")) AS "sum"
           FROM "public"."arbeitszeit_buchung" "zb"
          WHERE (("zb"."auftrag_id" = "o"."id") AND ("zb"."tenant_id" = 'galvanik-kreile'::"text"))), (0)::numeric) AS "arbeitszeit_kosten",
    COALESCE(( SELECT "sum"(((("zb"."dauer_minuten")::numeric / 60.0) * COALESCE("kem"."energie_eur_pro_stunde", (0)::numeric))) AS "sum"
           FROM (("public"."arbeitszeit_buchung" "zb"
             LEFT JOIN "public"."kostenstelle" "ks_bridge" ON ((("ks_bridge"."kuerzel" = "zb"."kostenstelle_kuerzel") AND ("ks_bridge"."tenant_id" = "zb"."tenant_id"))))
             LEFT JOIN "public"."kostenstellen_energie_monat" "kem" ON ((("kem"."kostenstelle_id" = "ks_bridge"."id") AND ("kem"."monat" = ("date_trunc"('month'::"text", "zb"."start_zeit"))::"date") AND ("kem"."tenant_id" = 'galvanik-kreile'::"text"))))
          WHERE (("zb"."auftrag_id" = "o"."id") AND ("zb"."tenant_id" = 'galvanik-kreile'::"text"))), (0)::numeric) AS "energie_anteil_kosten",
    (((COALESCE(( SELECT "sum"("ar"."netto") AS "sum"
           FROM "public"."ausgangsrechnung" "ar"
          WHERE (("ar"."order_id" = "o"."id") AND (("ar"."is_demo" IS NULL) OR ("ar"."is_demo" = false)) AND (("ar"."tenant_id")::"text" = 'galvanik-kreile'::"text"))), (0)::numeric) - COALESCE(( SELECT "sum"(("abs"("sm"."quantity") * COALESCE("sm"."snapshot_einkaufspreis_eur", (0)::numeric))) AS "sum"
           FROM "public"."stock_movements" "sm"
          WHERE (("sm"."order_id" = "o"."id") AND ("sm"."movement_type" = 'verbrauch'::"text") AND ("sm"."tenant_id" = 'galvanik-kreile'::"text"))), (0)::numeric)) - COALESCE(( SELECT "sum"(((("zb"."dauer_minuten")::numeric / 60.0) * "zb"."kostensatz_eur_pro_stunde")) AS "sum"
           FROM "public"."arbeitszeit_buchung" "zb"
          WHERE (("zb"."auftrag_id" = "o"."id") AND ("zb"."tenant_id" = 'galvanik-kreile'::"text"))), (0)::numeric)) - COALESCE(( SELECT "sum"(((("zb"."dauer_minuten")::numeric / 60.0) * COALESCE("kem"."energie_eur_pro_stunde", (0)::numeric))) AS "sum"
           FROM (("public"."arbeitszeit_buchung" "zb"
             LEFT JOIN "public"."kostenstelle" "ks_bridge" ON ((("ks_bridge"."kuerzel" = "zb"."kostenstelle_kuerzel") AND ("ks_bridge"."tenant_id" = "zb"."tenant_id"))))
             LEFT JOIN "public"."kostenstellen_energie_monat" "kem" ON ((("kem"."kostenstelle_id" = "ks_bridge"."id") AND ("kem"."monat" = ("date_trunc"('month'::"text", "zb"."start_zeit"))::"date") AND ("kem"."tenant_id" = 'galvanik-kreile'::"text"))))
          WHERE (("zb"."auftrag_id" = "o"."id") AND ("zb"."tenant_id" = 'galvanik-kreile'::"text"))), (0)::numeric)) AS "deckungsbeitrag",
        CASE
            WHEN (COALESCE(( SELECT "sum"("ar"."netto") AS "sum"
               FROM "public"."ausgangsrechnung" "ar"
              WHERE (("ar"."order_id" = "o"."id") AND (("ar"."is_demo" IS NULL) OR ("ar"."is_demo" = false)) AND (("ar"."tenant_id")::"text" = 'galvanik-kreile'::"text"))), (0)::numeric) > (0)::numeric) THEN ((((COALESCE(( SELECT "sum"("ar"."netto") AS "sum"
               FROM "public"."ausgangsrechnung" "ar"
              WHERE (("ar"."order_id" = "o"."id") AND (("ar"."is_demo" IS NULL) OR ("ar"."is_demo" = false)) AND (("ar"."tenant_id")::"text" = 'galvanik-kreile'::"text"))), (0)::numeric) - COALESCE(( SELECT "sum"(("abs"("sm"."quantity") * COALESCE("sm"."snapshot_einkaufspreis_eur", (0)::numeric))) AS "sum"
               FROM "public"."stock_movements" "sm"
              WHERE (("sm"."order_id" = "o"."id") AND ("sm"."movement_type" = 'verbrauch'::"text") AND ("sm"."tenant_id" = 'galvanik-kreile'::"text"))), (0)::numeric)) - COALESCE(( SELECT "sum"(((("zb"."dauer_minuten")::numeric / 60.0) * "zb"."kostensatz_eur_pro_stunde")) AS "sum"
               FROM "public"."arbeitszeit_buchung" "zb"
              WHERE (("zb"."auftrag_id" = "o"."id") AND ("zb"."tenant_id" = 'galvanik-kreile'::"text"))), (0)::numeric)) - COALESCE(( SELECT "sum"(((("zb"."dauer_minuten")::numeric / 60.0) * COALESCE("kem"."energie_eur_pro_stunde", (0)::numeric))) AS "sum"
               FROM (("public"."arbeitszeit_buchung" "zb"
                 LEFT JOIN "public"."kostenstelle" "ks_bridge" ON ((("ks_bridge"."kuerzel" = "zb"."kostenstelle_kuerzel") AND ("ks_bridge"."tenant_id" = "zb"."tenant_id"))))
                 LEFT JOIN "public"."kostenstellen_energie_monat" "kem" ON ((("kem"."kostenstelle_id" = "ks_bridge"."id") AND ("kem"."monat" = ("date_trunc"('month'::"text", "zb"."start_zeit"))::"date") AND ("kem"."tenant_id" = 'galvanik-kreile'::"text"))))
              WHERE (("zb"."auftrag_id" = "o"."id") AND ("zb"."tenant_id" = 'galvanik-kreile'::"text"))), (0)::numeric)) / NULLIF(( SELECT "sum"("ar"."netto") AS "sum"
               FROM "public"."ausgangsrechnung" "ar"
              WHERE (("ar"."order_id" = "o"."id") AND (("ar"."is_demo" IS NULL) OR ("ar"."is_demo" = false)) AND (("ar"."tenant_id")::"text" = 'galvanik-kreile'::"text"))), (0)::numeric))
            ELSE NULL::numeric
        END AS "db_marge",
    ( SELECT "count"(*) AS "count"
           FROM "public"."ausgangsrechnung" "ar"
          WHERE (("ar"."order_id" = "o"."id") AND (("ar"."tenant_id")::"text" = 'galvanik-kreile'::"text"))) AS "anz_rechnungen",
    ( SELECT "count"(*) AS "count"
           FROM "public"."stock_movements" "sm"
          WHERE (("sm"."order_id" = "o"."id") AND ("sm"."movement_type" = 'verbrauch'::"text") AND ("sm"."tenant_id" = 'galvanik-kreile'::"text"))) AS "anz_verbrauch",
    ( SELECT "count"(*) AS "count"
           FROM "public"."arbeitszeit_buchung" "zb"
          WHERE (("zb"."auftrag_id" = "o"."id") AND ("zb"."tenant_id" = 'galvanik-kreile'::"text"))) AS "anz_zeitbuchungen"
   FROM ("public"."v_production_orders" "o"
     LEFT JOIN "public"."customers" "c" ON (("c"."id" = "o"."customer_id")));


ALTER VIEW "public"."v_auftrag_db" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_analyse_werkstatt_puls_economics" WITH ("security_invoker"='true') AS
 SELECT "o"."id" AS "order_id",
    "o"."order_number",
    "o"."customer_id",
    "c"."name" AS "customer_name",
    COALESCE("o"."current_station", ("o"."station")::"text") AS "station_id",
    COALESCE("o"."current_station", ("o"."station")::"text") AS "station_name",
    COALESCE("ar_sum"."netto_sum", "ofi"."invoiced_revenue_net_eur", "ofi"."approved_revenue_net_eur", "ofi"."expected_revenue_net_eur") AS "revenue_reference_eur",
        CASE
            WHEN ("ar_sum"."netto_sum" IS NOT NULL) THEN 'invoice'::"text"
            WHEN ("ofi"."invoiced_revenue_net_eur" IS NOT NULL) THEN 'invoiced'::"text"
            WHEN ("ofi"."approved_revenue_net_eur" IS NOT NULL) THEN 'approved'::"text"
            WHEN ("ofi"."expected_revenue_net_eur" IS NOT NULL) THEN 'expected'::"text"
            ELSE 'missing'::"text"
        END AS "revenue_source",
    "vdb"."deckungsbeitrag" AS "db_ist",
    "vdb"."db_marge",
    "vdb"."erloes_netto",
    "vdb"."material_kosten",
    "vdb"."arbeitszeit_kosten",
        CASE
            WHEN (("o"."promised_due_date" IS NOT NULL) AND ("o"."completed_date" IS NULL)) THEN GREATEST((0)::numeric, (EXTRACT(epoch FROM ("now"() - "o"."promised_due_date")) / 86400.0))
            ELSE (0)::numeric
        END AS "delay_days",
    COALESCE("oce_sum"."actual_delay_cost_eur", (0)::numeric) AS "actual_delay_cost_eur",
        CASE
            WHEN (("kca_delay"."value_numeric" IS NOT NULL) AND ("o"."promised_due_date" IS NOT NULL) AND ("o"."completed_date" IS NULL)) THEN (GREATEST((0)::numeric, (EXTRACT(epoch FROM ("now"() - "o"."promised_due_date")) / 86400.0)) * "kca_delay"."value_numeric")
            ELSE NULL::numeric
        END AS "model_delay_risk_eur",
        CASE
            WHEN (("ar_sum"."netto_sum" IS NOT NULL) OR ("ofi"."invoiced_revenue_net_eur" IS NOT NULL)) THEN 'high'::"text"
            WHEN ("ofi"."approved_revenue_net_eur" IS NOT NULL) THEN 'medium'::"text"
            WHEN ("ofi"."expected_revenue_net_eur" IS NOT NULL) THEN 'low'::"text"
            ELSE 'none'::"text"
        END AS "confidence",
    "array_remove"(ARRAY[
        CASE
            WHEN (COALESCE("ar_sum"."netto_sum", "ofi"."invoiced_revenue_net_eur", "ofi"."approved_revenue_net_eur", "ofi"."expected_revenue_net_eur") IS NULL) THEN 'Auftragswert fehlt'::"text"
            ELSE NULL::"text"
        END,
        CASE
            WHEN (("vdb"."deckungsbeitrag" IS NULL) AND ("vdb"."erloes_netto" = (0)::numeric)) THEN 'DB-Grundlage fehlt'::"text"
            ELSE NULL::"text"
        END,
        CASE
            WHEN ("kca_delay"."value_numeric" IS NULL) THEN 'Terminrisiko-Modell nicht konfiguriert'::"text"
            ELSE NULL::"text"
        END,
        CASE
            WHEN ("o"."promised_due_date" IS NULL) THEN 'Zusagetermin fehlt'::"text"
            ELSE NULL::"text"
        END], NULL::"text") AS "missing_reasons"
   FROM (((((("public"."v_production_orders" "o"
     LEFT JOIN "public"."customers" "c" ON (("c"."id" = "o"."customer_id")))
     LEFT JOIN "public"."order_financials" "ofi" ON (("ofi"."order_id" = "o"."id")))
     LEFT JOIN "public"."v_auftrag_db" "vdb" ON (("vdb"."order_id" = "o"."id")))
     LEFT JOIN ( SELECT "ar"."order_id",
            "sum"("ar"."netto") AS "netto_sum"
           FROM "public"."ausgangsrechnung" "ar"
          WHERE ((("ar"."is_demo" IS NULL) OR ("ar"."is_demo" = false)) AND (("ar"."tenant_id")::"text" = 'galvanik-kreile'::"text"))
          GROUP BY "ar"."order_id") "ar_sum" ON (("ar_sum"."order_id" = "o"."id")))
     LEFT JOIN ( SELECT "oce"."order_id",
            "sum"("oce"."amount_eur") AS "actual_delay_cost_eur"
           FROM "public"."order_cost_events" "oce"
          WHERE (("oce"."caused_by" = ANY (ARRAY['delay'::"text", 'engpass'::"text", 'terminrettung'::"text"])) AND ("oce"."tenant_id" = 'galvanik-kreile'::"text"))
          GROUP BY "oce"."order_id") "oce_sum" ON (("oce_sum"."order_id" = "o"."id")))
     LEFT JOIN "public"."kpi_cost_assumptions" "kca_delay" ON ((("kca_delay"."key" = 'delay_cost_per_day_eur'::"text") AND ("kca_delay"."is_active" = true) AND ("kca_delay"."tenant_id" = ("o"."tenant_id")::"text"))))
  WHERE ((COALESCE("o"."status", ''::character varying))::"text" <> ALL ((ARRAY['closed'::character varying, 'abgeschlossen'::character varying, 'cancelled'::character varying, 'storniert'::character varying])::"text"[]));


ALTER VIEW "public"."v_analyse_werkstatt_puls_economics" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_analyse_wochenziel" WITH ("security_invoker"='true') AS
 SELECT "count"(*) AS "fertig_diese_woche"
   FROM "public"."v_production_orders"
  WHERE (("completed_date" IS NOT NULL) AND ("completed_date" >= "date_trunc"('week'::"text", "now"())));


ALTER VIEW "public"."v_analyse_wochenziel" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_engpass" WITH ("security_invoker"='true') AS
 SELECT "id" AS "kostenstelle_id",
    "kuerzel",
    "name",
    "typ",
    ( SELECT "count"(*) AS "count"
           FROM "public"."v_production_orders" "o"
          WHERE (("o"."current_station" = "ks"."kuerzel") AND (("o"."status")::"text" <> ALL ((ARRAY['completed'::character varying, 'abgeschlossen'::character varying, 'cancelled'::character varying, 'storniert'::character varying])::"text"[])))) AS "warteschlange_aktuell",
    ( SELECT "avg"((("zb"."dauer_minuten")::numeric / 60.0)) AS "avg"
           FROM "public"."arbeitszeit_buchung" "zb"
          WHERE (("zb"."kostenstelle_kuerzel" = "ks"."kuerzel") AND ("zb"."start_zeit" > ("now"() - '30 days'::interval)) AND ("zb"."tenant_id" = "ks"."tenant_id"))) AS "avg_stunden_pro_auftrag_30d",
    ( SELECT ((COALESCE("sum"("zb"."dauer_minuten"), (0)::bigint))::numeric / 60.0)
           FROM "public"."arbeitszeit_buchung" "zb"
          WHERE (("zb"."kostenstelle_kuerzel" = "ks"."kuerzel") AND ("date_trunc"('month'::"text", "zb"."start_zeit") = "date_trunc"('month'::"text", "now"())) AND ("zb"."tenant_id" = "ks"."tenant_id"))) AS "gebuchte_stunden_aktuell",
    "verfuegbare_stunden_monatlich",
        CASE
            WHEN (COALESCE("verfuegbare_stunden_monatlich", (0)::numeric) > (0)::numeric) THEN (( SELECT ((COALESCE("sum"("zb"."dauer_minuten"), (0)::bigint))::numeric / 60.0)
               FROM "public"."arbeitszeit_buchung" "zb"
              WHERE (("zb"."kostenstelle_kuerzel" = "ks"."kuerzel") AND ("date_trunc"('month'::"text", "zb"."start_zeit") = "date_trunc"('month'::"text", "now"())) AND ("zb"."tenant_id" = "ks"."tenant_id"))) / "verfuegbare_stunden_monatlich")
            ELSE NULL::numeric
        END AS "auslastung_quote",
    LEAST(1.0, GREATEST((0)::numeric,
        CASE
            WHEN (COALESCE("verfuegbare_stunden_monatlich", (0)::numeric) > (0)::numeric) THEN (( SELECT ((COALESCE("sum"("zb"."dauer_minuten"), (0)::bigint))::numeric / 60.0)
               FROM "public"."arbeitszeit_buchung" "zb"
              WHERE (("zb"."kostenstelle_kuerzel" = "ks"."kuerzel") AND ("date_trunc"('month'::"text", "zb"."start_zeit") = "date_trunc"('month'::"text", "now"())) AND ("zb"."tenant_id" = "ks"."tenant_id"))) / "verfuegbare_stunden_monatlich")
            ELSE (0)::numeric
        END)) AS "engpass_score"
   FROM "public"."kostenstelle" "ks"
  WHERE (("typ" = 'produktion'::"text") AND ("tenant_id" = 'galvanik-kreile'::"text"));


ALTER VIEW "public"."v_engpass" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_kostenstelle_monatswerte" WITH ("security_invoker"='true') AS
 SELECT "ks"."id" AS "kostenstelle_id",
    "ks"."kuerzel",
    "ks"."name",
    "ks"."typ",
    ("date_trunc"('month'::"text", "zb"."start_zeit"))::"date" AS "monat",
    COALESCE((("sum"("zb"."dauer_minuten"))::numeric / 60.0), (0)::numeric) AS "gebuchte_stunden",
    "ks"."verfuegbare_stunden_monatlich",
        CASE
            WHEN ("ks"."verfuegbare_stunden_monatlich" > (0)::numeric) THEN (((COALESCE("sum"("zb"."dauer_minuten"), (0)::bigint))::numeric / 60.0) / "ks"."verfuegbare_stunden_monatlich")
            ELSE NULL::numeric
        END AS "auslastung_quote",
    COALESCE("sum"(((("zb"."dauer_minuten")::numeric / 60.0) * "zb"."kostensatz_eur_pro_stunde")), (0)::numeric) AS "personalkosten_ist",
    "count"(DISTINCT "zb"."auftrag_id") AS "anz_auftraege"
   FROM ("public"."kostenstelle" "ks"
     LEFT JOIN "public"."arbeitszeit_buchung" "zb" ON ((("zb"."kostenstelle_kuerzel" = "ks"."kuerzel") AND ("zb"."tenant_id" = "ks"."tenant_id"))))
  WHERE ("ks"."tenant_id" = 'galvanik-kreile'::"text")
  GROUP BY "ks"."id", "ks"."kuerzel", "ks"."name", "ks"."typ", ("date_trunc"('month'::"text", "zb"."start_zeit")), "ks"."verfuegbare_stunden_monatlich";


ALTER VIEW "public"."v_kostenstelle_monatswerte" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_kunde_clv" WITH ("security_invoker"='true') AS
 SELECT "c"."id" AS "customer_id",
    "c"."name",
    "c"."company_name",
    "c"."type" AS "kundentyp",
    "c"."created_at" AS "erstkontakt",
    "count"(DISTINCT "o"."id") AS "auftraege_gesamt",
    "count"(DISTINCT "o"."id") FILTER (WHERE ("o"."intake_date" > ("now"() - '1 year'::interval))) AS "auftraege_12m",
    COALESCE("sum"("vdb"."erloes_netto"), (0)::numeric) AS "umsatz_gesamt",
    COALESCE("sum"("vdb"."deckungsbeitrag"), (0)::numeric) AS "db_gesamt",
        CASE
            WHEN (COALESCE("sum"("vdb"."erloes_netto"), (0)::numeric) > (0)::numeric) THEN ("sum"("vdb"."deckungsbeitrag") / "sum"("vdb"."erloes_netto"))
            ELSE NULL::numeric
        END AS "db_marge",
    "max"("o"."intake_date") AS "letzter_auftrag",
    ( SELECT "count"(*) AS "count"
           FROM "public"."complaints" "cpl"
          WHERE (("cpl"."customer_id" = "c"."id") AND ("cpl"."tenant_id" = 'galvanik-kreile'::"text"))) AS "reklamationen",
    ("avg"((EXTRACT(epoch FROM (( SELECT "max"("zb"."start_zeit") AS "max"
           FROM "public"."arbeitszeit_buchung" "zb"
          WHERE (("zb"."auftrag_id" = "o"."id") AND ("zb"."tenant_id" = 'galvanik-kreile'::"text"))) - ("o"."intake_date")::timestamp with time zone)) / 86400.0)))::numeric(8,1) AS "avg_durchlauf_tage",
    ("avg"(("ar"."bezahlt_am" - "ar"."faellig_am")))::numeric(8,1) AS "avg_zahlungsverzug_tage"
   FROM ((("public"."customers" "c"
     LEFT JOIN "public"."v_production_orders" "o" ON (("o"."customer_id" = "c"."id")))
     LEFT JOIN "public"."v_auftrag_db" "vdb" ON (("vdb"."order_id" = "o"."id")))
     LEFT JOIN "public"."ausgangsrechnung" "ar" ON ((("ar"."order_id" = "o"."id") AND (("ar"."is_demo" IS NULL) OR ("ar"."is_demo" = false)) AND (("ar"."tenant_id")::"text" = 'galvanik-kreile'::"text"))))
  WHERE (("c"."tenant_id")::"text" = 'galvanik-kreile'::"text")
  GROUP BY "c"."id", "c"."name", "c"."company_name", "c"."type", "c"."created_at";


ALTER VIEW "public"."v_kunde_clv" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_monatsergebnis" WITH ("security_invoker"='true') AS
 WITH "erloes" AS (
         SELECT ("date_trunc"('month'::"text", ("ar"."datum")::timestamp with time zone))::"date" AS "monat",
            "sum"("ar"."netto") AS "summe"
           FROM "public"."ausgangsrechnung" "ar"
          WHERE ((("ar"."is_demo" IS NULL) OR ("ar"."is_demo" = false)) AND (("ar"."tenant_id")::"text" = 'galvanik-kreile'::"text"))
          GROUP BY (("date_trunc"('month'::"text", ("ar"."datum")::timestamp with time zone))::"date")
        ), "material" AS (
         SELECT ("date_trunc"('month'::"text", "b"."erstellt_am"))::"date" AS "monat",
            "sum"("b"."netto") AS "summe"
           FROM ("public"."beleg" "b"
             LEFT JOIN "public"."konto" "k" ON (("k"."id" = "b"."konto_id")))
          WHERE (("k"."kategorie" = 'wareneinsatz'::"text") AND ("k"."tenant_id" = 'galvanik-kreile'::"text"))
          GROUP BY (("date_trunc"('month'::"text", "b"."erstellt_am"))::"date")
        ), "personal" AS (
         SELECT ("date_trunc"('month'::"text", "zb"."start_zeit"))::"date" AS "monat",
            "sum"(((("zb"."dauer_minuten")::numeric / 60.0) * "zb"."kostensatz_eur_pro_stunde")) AS "summe"
           FROM "public"."arbeitszeit_buchung" "zb"
          WHERE ("zb"."tenant_id" = 'galvanik-kreile'::"text")
          GROUP BY (("date_trunc"('month'::"text", "zb"."start_zeit"))::"date")
        ), "energie" AS (
         SELECT ("date_trunc"('month'::"text", "b"."erstellt_am"))::"date" AS "monat",
            "sum"("b"."netto") AS "summe"
           FROM ("public"."beleg" "b"
             LEFT JOIN "public"."konto" "k" ON (("k"."id" = "b"."konto_id")))
          WHERE (("k"."kategorie" = 'energie'::"text") AND ("k"."tenant_id" = 'galvanik-kreile'::"text"))
          GROUP BY (("date_trunc"('month'::"text", "b"."erstellt_am"))::"date")
        ), "sachkosten" AS (
         SELECT ("date_trunc"('month'::"text", "b"."erstellt_am"))::"date" AS "monat",
            "sum"("b"."netto") AS "summe"
           FROM ("public"."beleg" "b"
             LEFT JOIN "public"."konto" "k" ON (("k"."id" = "b"."konto_id")))
          WHERE (("k"."kategorie" = 'sachkosten'::"text") AND ("k"."tenant_id" = 'galvanik-kreile'::"text"))
          GROUP BY (("date_trunc"('month'::"text", "b"."erstellt_am"))::"date")
        ), "alle_monate" AS (
         SELECT "erloes"."monat"
           FROM "erloes"
        UNION
         SELECT "material"."monat"
           FROM "material"
        UNION
         SELECT "personal"."monat"
           FROM "personal"
        UNION
         SELECT "energie"."monat"
           FROM "energie"
        UNION
         SELECT "sachkosten"."monat"
           FROM "sachkosten"
        )
 SELECT "am"."monat",
    COALESCE("e"."summe", (0)::numeric) AS "erloes_netto",
    COALESCE("m"."summe", (0)::numeric) AS "material_kosten",
    COALESCE("p"."summe", (0)::numeric) AS "personal_kosten",
    COALESCE("en"."summe", (0)::numeric) AS "energie_kosten",
    COALESCE("s"."summe", (0)::numeric) AS "sachkosten",
    ((((COALESCE("e"."summe", (0)::numeric) - COALESCE("m"."summe", (0)::numeric)) - COALESCE("p"."summe", (0)::numeric)) - COALESCE("en"."summe", (0)::numeric)) - COALESCE("s"."summe", (0)::numeric)) AS "ergebnis"
   FROM ((((("alle_monate" "am"
     LEFT JOIN "erloes" "e" ON (("e"."monat" = "am"."monat")))
     LEFT JOIN "material" "m" ON (("m"."monat" = "am"."monat")))
     LEFT JOIN "personal" "p" ON (("p"."monat" = "am"."monat")))
     LEFT JOIN "energie" "en" ON (("en"."monat" = "am"."monat")))
     LEFT JOIN "sachkosten" "s" ON (("s"."monat" = "am"."monat")))
  ORDER BY "am"."monat" DESC;


ALTER VIEW "public"."v_monatsergebnis" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_periodenabschluss_status" WITH ("security_invoker"='true') AS
 SELECT "id",
    "jahr",
    "monat",
    "status",
    "geschlossen_am",
    ( SELECT "count"(*) AS "count"
           FROM "public"."beleg" "b"
          WHERE (("b"."periode_id" = "p"."id") AND ("b"."konto_id" IS NULL))) AS "belege_ohne_konto",
    ( SELECT "count"(*) AS "count"
           FROM "public"."beleg" "b"
          WHERE (("b"."periode_id" = "p"."id") AND ("b"."kostenstelle_id" IS NULL))) AS "belege_ohne_kostenstelle",
    ( SELECT "count"(*) AS "count"
           FROM "public"."ausgangsrechnung" "ar"
          WHERE (("ar"."periode_id" = "p"."id") AND ("ar"."order_id" IS NULL) AND (("ar"."tenant_id")::"text" = "p"."tenant_id"))) AS "rechnungen_ohne_auftrag",
    ( SELECT "count"(*) AS "count"
           FROM "public"."ausgangsrechnung" "ar"
          WHERE (("ar"."periode_id" = "p"."id") AND ("ar"."bezahlt_am" IS NULL) AND (("ar"."tenant_id")::"text" = "p"."tenant_id"))) AS "rechnungen_offen",
    ( SELECT "count"(*) AS "count"
           FROM "public"."v_production_orders" "o"
          WHERE ((("o"."status")::"text" = ANY ((ARRAY['completed'::character varying, 'abgeschlossen'::character varying])::"text"[])) AND ("date_trunc"('month'::"text", "o"."due_date") = "make_date"("p"."jahr", "p"."monat", 1)) AND ("o"."db_ist" IS NULL))) AS "auftraege_ohne_db"
   FROM "public"."periode" "p"
  WHERE ("tenant_id" = 'galvanik-kreile'::"text");


ALTER VIEW "public"."v_periodenabschluss_status" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_pipeline_forecast" WITH ("security_invoker"='true') AS
 SELECT ("date_trunc"('month'::"text", "o"."due_date"))::"date" AS "erwarteter_monat",
    "count"(*) AS "anz_auftraege",
    "sum"(
        CASE
            WHEN ("o"."intake_date" > ("now"() - '7 days'::interval)) THEN (COALESCE("ar"."netto", (0)::numeric) * 0.80)
            WHEN ("o"."intake_date" > ("now"() - '21 days'::interval)) THEN (COALESCE("ar"."netto", (0)::numeric) * 0.60)
            WHEN ("o"."intake_date" > ("now"() - '45 days'::interval)) THEN (COALESCE("ar"."netto", (0)::numeric) * 0.30)
            ELSE (COALESCE("ar"."netto", (0)::numeric) * 0.10)
        END) AS "pipeline_wert_gewichtet",
    "sum"(COALESCE("ar"."netto", (0)::numeric)) AS "pipeline_wert_ungewichtet"
   FROM ("public"."orders" "o"
     LEFT JOIN "public"."ausgangsrechnung" "ar" ON (("ar"."order_id" = "o"."id")))
  WHERE ((("o"."status")::"text" <> ALL ((ARRAY['completed'::character varying, 'abgeschlossen'::character varying, 'cancelled'::character varying, 'storniert'::character varying])::"text"[])) AND ("o"."due_date" IS NOT NULL) AND ((("o"."tenant_id")::"text" = 'galvanik-kreile'::"text") OR ("o"."tenant_id" IS NULL)))
  GROUP BY (("date_trunc"('month'::"text", "o"."due_date"))::"date")
  ORDER BY (("date_trunc"('month'::"text", "o"."due_date"))::"date");


ALTER VIEW "public"."v_pipeline_forecast" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_production_customers" WITH ("security_invoker"='true') AS
 SELECT "id",
    "customer_number",
    "name",
    "type",
    "city",
    "address",
    "phone",
    "email",
    "pref_comm",
    "risk",
    "risk_note",
    "notes",
    "created_at",
    "image_urls",
    "zip_code",
    "company_name",
    "approval_profile",
    "updated_at",
    "contact_person",
    "payment_profile",
    "expectation_profile",
    "technical_profile",
    "trust_level",
    "internal_warning",
    "tags",
    "credit_rating",
    "marketing_opt_out",
    "last_reactivated_at",
    "shipping_preference",
    "payment_preference",
    "classification",
    "internal_notes",
    "behavior_notes",
    "source",
    "source_ref",
    "enriched_fields",
    "is_lead",
    "lead_since",
    "converted_at",
    "street",
    "country",
    "tenant_id"
   FROM "public"."customers" "c"
  WHERE ((("tenant_id")::"text" = 'galvanik-kreile'::"text") AND ((EXISTS ( SELECT 1
           FROM "public"."v_production_orders" "v"
          WHERE ("v"."customer_id" = "c"."id"))) OR ((COALESCE("source", ''::"text") <> ALL (ARRAY['seed'::"text", 'test'::"text", 'integration-test'::"text"])) AND ("lower"(COALESCE("name", ''::"text")) !~ 'test|demo|muster|e2e'::"text") AND ("lower"(COALESCE("company_name", ''::"text")) !~ 'test|demo|muster|e2e'::"text") AND ("length"(TRIM(BOTH FROM COALESCE("name", "company_name", ''::"text"))) >= 3))));


ALTER VIEW "public"."v_production_customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vorlage_verbrauch" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "schluessel" "text" NOT NULL,
    "teilekategorie" "text",
    "oberflaeche" "text",
    "station_kuerzel" "text" NOT NULL,
    "inventory_item_id" "text" NOT NULL,
    "einheit_normiert" "text" NOT NULL,
    "median_menge" numeric(10,4) NOT NULL,
    "p25_menge" numeric(10,4),
    "p75_menge" numeric(10,4),
    "n_referenzauftraege" integer NOT NULL,
    "haeufigkeit_prozent" numeric(5,2),
    "letzte_aktualisierung" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vorlage_verbrauch" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vorlage_zeit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "schluessel" "text" NOT NULL,
    "teilekategorie" "text",
    "oberflaeche" "text",
    "station_kuerzel" "text" NOT NULL,
    "median_minuten" numeric(8,2) NOT NULL,
    "p25_minuten" numeric(8,2),
    "p75_minuten" numeric(8,2),
    "n_referenzauftraege" integer NOT NULL,
    "letzte_aktualisierung" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vorlage_zeit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."warning_event" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "text" NOT NULL,
    "typ" "text" NOT NULL,
    "titel" "text" NOT NULL,
    "beschreibung" "text" NOT NULL,
    "schwere" "text" NOT NULL,
    "payload" "jsonb",
    "link" "text",
    "erzeugt_am" timestamp with time zone DEFAULT "now"(),
    "dismissed_am" timestamp with time zone,
    "dismissed_von" "uuid",
    "begruendung" "text",
    "suppress_bis" timestamp with time zone
);


ALTER TABLE "public"."warning_event" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zahlung" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ausgangsrechnung_id" "uuid",
    "beleg_id" "uuid",
    "betrag" numeric(12,2) NOT NULL,
    "richtung" "text" NOT NULL,
    "datum" "date" NOT NULL,
    "art" "text",
    "bank_umsatz_ref" "text",
    "is_demo" boolean DEFAULT false
);


ALTER TABLE "public"."zahlung" OWNER TO "postgres";


ALTER TABLE ONLY "public"."ai_usage_reservations"
    ADD CONSTRAINT "ai_usage_reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."aktion"
    ADD CONSTRAINT "aktion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_kvp_items"
    ADD CONSTRAINT "app_kvp_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_usage_events"
    ADD CONSTRAINT "app_usage_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_usage_events"
    ADD CONSTRAINT "app_usage_events_tenant_client_uidx" UNIQUE ("tenant_id", "client_event_id");



ALTER TABLE ONLY "public"."app_users"
    ADD CONSTRAINT "app_users_tenant_email_unique" UNIQUE ("tenant_id", "email");



ALTER TABLE ONLY "public"."arbeitszeit_buchung"
    ADD CONSTRAINT "arbeitszeit_buchung_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attribution"
    ADD CONSTRAINT "attribution_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ausgangsrechnung"
    ADD CONSTRAINT "ausgangsrechnung_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ausgangsrechnung_position"
    ADD CONSTRAINT "ausgangsrechnung_position_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bath_measurements"
    ADD CONSTRAINT "bath_measurements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."baths"
    ADD CONSTRAINT "baths_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."beleg"
    ADD CONSTRAINT "beleg_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."beleg_position"
    ADD CONSTRAINT "beleg_position_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bh_audit_log"
    ADD CONSTRAINT "bh_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bh_einstellungen"
    ADD CONSTRAINT "bh_einstellungen_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."business_kvp_items"
    ADD CONSTRAINT "business_kvp_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."communication_drafts"
    ADD CONSTRAINT "communication_drafts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."communication_messages"
    ADD CONSTRAINT "communication_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."communication_threads"
    ADD CONSTRAINT "communication_threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."communications"
    ADD CONSTRAINT "communications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_settings"
    ADD CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."complaints"
    ADD CONSTRAINT "complaints_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."consumable_uses"
    ADD CONSTRAINT "consumable_uses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cost_positions"
    ADD CONSTRAINT "cost_positions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."developer_feedback"
    ADD CONSTRAINT "developer_feedback_actor_request_uidx" UNIQUE ("tenant_id", "actor_pseudonym", "client_request_id");



ALTER TABLE ONLY "public"."developer_feedback"
    ADD CONSTRAINT "developer_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."devices"
    ADD CONSTRAINT "devices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."einwilligung"
    ADD CONSTRAINT "einwilligung_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_templates"
    ADD CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_templates"
    ADD CONSTRAINT "email_templates_template_key_key" UNIQUE ("template_key");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."export_lauf"
    ADD CONSTRAINT "export_lauf_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feature_flags"
    ADD CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_eingang"
    ADD CONSTRAINT "feedback_eingang_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_mail"
    ADD CONSTRAINT "feedback_mail_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_notes"
    ADD CONSTRAINT "feedback_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forecast_version"
    ADD CONSTRAINT "forecast_version_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."import_job_rows"
    ADD CONSTRAINT "import_job_rows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."import_jobs"
    ADD CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inquiries"
    ADD CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_photo_jobs"
    ADD CONSTRAINT "item_photo_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_photos"
    ADD CONSTRAINT "item_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kampagne"
    ADD CONSTRAINT "kampagne_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kanal"
    ADD CONSTRAINT "kanal_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kategorie"
    ADD CONSTRAINT "kategorie_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."konto"
    ADD CONSTRAINT "konto_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."konto"
    ADD CONSTRAINT "konto_tenant_id_nummer_key" UNIQUE ("tenant_id", "nummer");



ALTER TABLE ONLY "public"."kosten_posten"
    ADD CONSTRAINT "kosten_posten_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kostenposten"
    ADD CONSTRAINT "kostenposten_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kostensatz_default"
    ADD CONSTRAINT "kostensatz_default_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kostensatz_default"
    ADD CONSTRAINT "kostensatz_default_tenant_id_station_kuerzel_gilt_ab_key" UNIQUE ("tenant_id", "station_kuerzel", "gilt_ab");



ALTER TABLE ONLY "public"."kostenstelle"
    ADD CONSTRAINT "kostenstelle_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kostenstelle"
    ADD CONSTRAINT "kostenstelle_tenant_id_kuerzel_key" UNIQUE ("tenant_id", "kuerzel");



ALTER TABLE ONLY "public"."kostenstellen_energie_monat"
    ADD CONSTRAINT "kostenstellen_energie_monat_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kostenstellen_energie_monat"
    ADD CONSTRAINT "kostenstellen_energie_monat_tenant_id_kostenstelle_id_monat_key" UNIQUE ("tenant_id", "kostenstelle_id", "monat");



ALTER TABLE ONLY "public"."kpi_cost_assumptions"
    ADD CONSTRAINT "kpi_cost_assumptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kpi_cost_assumptions"
    ADD CONSTRAINT "kpi_cost_assumptions_tenant_id_key_key" UNIQUE ("tenant_id", "key");



ALTER TABLE ONLY "public"."kpi_snapshots"
    ADD CONSTRAINT "kpi_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kpi_snapshots"
    ADD CONSTRAINT "kpi_snapshots_tenant_id_kpi_key_periode_periode_start_key" UNIQUE ("tenant_id", "kpi_key", "periode", "periode_start");



ALTER TABLE ONLY "public"."kraftstoff_detail"
    ADD CONSTRAINT "kraftstoff_detail_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kvp_items"
    ADD CONSTRAINT "kvp_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lern_metrik"
    ADD CONSTRAINT "lern_metrik_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."licenses"
    ADD CONSTRAINT "licenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lieferant"
    ADD CONSTRAINT "lieferant_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_tenant_id_location_code_key" UNIQUE ("tenant_id", "location_code");



ALTER TABLE ONLY "public"."marketing_asset"
    ADD CONSTRAINT "marketing_asset_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_touchpoints"
    ADD CONSTRAINT "marketing_touchpoints_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."offline_outbox"
    ADD CONSTRAINT "offline_outbox_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."operator_control_events"
    ADD CONSTRAINT "operator_control_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."operator_control_events"
    ADD CONSTRAINT "operator_control_events_tenant_version_uidx" UNIQUE ("tenant_id", "policy_version");



ALTER TABLE ONLY "public"."order_cost_events"
    ADD CONSTRAINT "order_cost_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_cost_positions"
    ADD CONSTRAINT "order_cost_positions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_financials"
    ADD CONSTRAINT "order_financials_order_id_key" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."order_financials"
    ADD CONSTRAINT "order_financials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_order_number_key" UNIQUE ("order_number");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."periode"
    ADD CONSTRAINT "periode_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."periode"
    ADD CONSTRAINT "periode_tenant_id_jahr_monat_key" UNIQUE ("tenant_id", "jahr", "monat");



ALTER TABLE ONLY "public"."phone_notes"
    ADD CONSTRAINT "phone_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pin_rate_limits"
    ADD CONSTRAINT "pin_rate_limits_pkey" PRIMARY KEY ("operator_id");



ALTER TABLE ONLY "public"."price_agreements"
    ADD CONSTRAINT "price_agreements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."price_lines"
    ADD CONSTRAINT "price_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scan_uploads"
    ADD CONSTRAINT "scan_uploads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."security_rate_limit_counters"
    ADD CONSTRAINT "security_rate_limit_counters_pkey" PRIMARY KEY ("namespace", "subject_hash");



ALTER TABLE ONLY "public"."segment"
    ADD CONSTRAINT "segment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shipments"
    ADD CONSTRAINT "shipments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."statistik_kennzahl"
    ADD CONSTRAINT "statistik_kennzahl_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."steuerprofil"
    ADD CONSTRAINT "steuerprofil_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teile_klassifikator"
    ADD CONSTRAINT "teile_klassifikator_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teile_klassifikator"
    ADD CONSTRAINT "teile_klassifikator_tenant_id_klasse_key" UNIQUE ("tenant_id", "klasse");



ALTER TABLE ONLY "public"."telemetrie_event"
    ADD CONSTRAINT "telemetrie_event_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_operator_controls"
    ADD CONSTRAINT "tenant_operator_controls_pkey" PRIMARY KEY ("tenant_id");



ALTER TABLE ONLY "public"."touchpoint"
    ADD CONSTRAINT "touchpoint_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ui_events"
    ADD CONSTRAINT "ui_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."app_users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ustva_periode"
    ADD CONSTRAINT "ustva_periode_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vorlage_verbrauch"
    ADD CONSTRAINT "vorlage_verbrauch_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vorlage_verbrauch"
    ADD CONSTRAINT "vorlage_verbrauch_tenant_id_schluessel_station_kuerzel_inve_key" UNIQUE ("tenant_id", "schluessel", "station_kuerzel", "inventory_item_id");



ALTER TABLE ONLY "public"."vorlage_zeit"
    ADD CONSTRAINT "vorlage_zeit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vorlage_zeit"
    ADD CONSTRAINT "vorlage_zeit_tenant_id_schluessel_station_kuerzel_key" UNIQUE ("tenant_id", "schluessel", "station_kuerzel");



ALTER TABLE ONLY "public"."warning_event"
    ADD CONSTRAINT "warning_event_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zahlung"
    ADD CONSTRAINT "zahlung_pkey" PRIMARY KEY ("id");



CREATE INDEX "app_usage_events_tenant_occurred_idx" ON "public"."app_usage_events" USING "btree" ("tenant_id", "occurred_at" DESC);



CREATE INDEX "app_usage_events_tenant_type_idx" ON "public"."app_usage_events" USING "btree" ("tenant_id", "event_type", "occurred_at" DESC);



CREATE INDEX "app_users_tenant_id_id_idx" ON "public"."app_users" USING "btree" ("tenant_id", "id");



CREATE UNIQUE INDEX "audit_log_tenant_request_action_uidx" ON "public"."audit_log" USING "btree" ("tenant_id", "client_request_id", "action") WHERE (("tenant_id" IS NOT NULL) AND ("client_request_id" IS NOT NULL));



CREATE INDEX "complaints_tenant_created_idx" ON "public"."complaints" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "developer_feedback_tenant_created_idx" ON "public"."developer_feedback" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "developer_feedback_tenant_status_idx" ON "public"."developer_feedback" USING "btree" ("tenant_id", "status", "created_at" DESC);



CREATE UNIQUE INDEX "events_tenant_client_event_uidx" ON "public"."events" USING "btree" ("tenant_id", "client_event_id") WHERE (("tenant_id" IS NOT NULL) AND ("client_event_id" IS NOT NULL));



CREATE INDEX "idx_ai_usage_tenant_window" ON "public"."ai_usage_reservations" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_ai_usage_user_window" ON "public"."ai_usage_reservations" USING "btree" ("tenant_id", "user_id", "feature", "created_at" DESC);



CREATE INDEX "idx_arbeitszeit_auftrag" ON "public"."arbeitszeit_buchung" USING "btree" ("auftrag_id");



CREATE INDEX "idx_arbeitszeit_employee_monat" ON "public"."arbeitszeit_buchung" USING "btree" ("employee_id", "start_zeit");



CREATE INDEX "idx_arbeitszeit_kostenstelle_monat" ON "public"."arbeitszeit_buchung" USING "btree" ("kostenstelle_kuerzel", "start_zeit");



CREATE INDEX "idx_ausgangsrechnung_order" ON "public"."ausgangsrechnung" USING "btree" ("order_id");



CREATE INDEX "idx_beleg_belegdatum" ON "public"."beleg" USING "btree" ("belegdatum");



CREATE INDEX "idx_beleg_kategorie" ON "public"."beleg" USING "btree" ("kategorie_id");



CREATE INDEX "idx_beleg_lieferant" ON "public"."beleg" USING "btree" ("lieferant_id");



CREATE INDEX "idx_beleg_status" ON "public"."beleg" USING "btree" ("status");



CREATE INDEX "idx_consumable_uses_order" ON "public"."consumable_uses" USING "btree" ("order_id");



CREATE INDEX "idx_consumable_uses_station" ON "public"."consumable_uses" USING "btree" ("station_kuerzel");



CREATE INDEX "idx_customers_customer_number" ON "public"."customers" USING "btree" ("customer_number");



CREATE INDEX "idx_email_templates_tenant" ON "public"."email_templates" USING "btree" ("tenant_id");



CREATE INDEX "idx_forecast_version_tenant" ON "public"."forecast_version" USING "btree" ("tenant_id");



CREATE INDEX "idx_inquiries_created_at" ON "public"."inquiries" USING "btree" ("created_at");



CREATE INDEX "idx_inquiries_status" ON "public"."inquiries" USING "btree" ("status");



CREATE INDEX "idx_inquiries_tenant_id" ON "public"."inquiries" USING "btree" ("tenant_id");



CREATE INDEX "idx_item_photo_item_created" ON "public"."item_photo_jobs" USING "btree" ("tenant_id", "item_id", "created_at" DESC);



CREATE INDEX "idx_item_photo_user_created" ON "public"."item_photo_jobs" USING "btree" ("tenant_id", "user_id", "created_at" DESC);



CREATE INDEX "idx_konto_tenant" ON "public"."konto" USING "btree" ("tenant_id");



CREATE INDEX "idx_kostenstelle_tenant" ON "public"."kostenstelle" USING "btree" ("tenant_id");



CREATE INDEX "idx_kostenstellen_energie_monat_tenant" ON "public"."kostenstellen_energie_monat" USING "btree" ("tenant_id");



CREATE INDEX "idx_lieferant_name_trgm" ON "public"."lieferant" USING "gin" ("name_normalisiert" "public"."gin_trgm_ops");



CREATE INDEX "idx_order_cost_events_caused" ON "public"."order_cost_events" USING "btree" ("caused_by");



CREATE INDEX "idx_order_cost_events_order" ON "public"."order_cost_events" USING "btree" ("order_id");



CREATE INDEX "idx_order_financials_order" ON "public"."order_financials" USING "btree" ("order_id");



CREATE INDEX "idx_payments_intent" ON "public"."payments" USING "btree" ("provider_intent_id");



CREATE INDEX "idx_payments_order" ON "public"."payments" USING "btree" ("order_id");



CREATE INDEX "idx_periode_tenant" ON "public"."periode" USING "btree" ("tenant_id");



CREATE INDEX "idx_pin_rate_limits_tenant" ON "public"."pin_rate_limits" USING "btree" ("tenant_id");



CREATE INDEX "idx_price_lines_item" ON "public"."price_lines" USING "btree" ("item_id");



CREATE INDEX "idx_price_lines_order" ON "public"."price_lines" USING "btree" ("order_id");



CREATE INDEX "idx_scan_uploads_cleanup_lease" ON "public"."scan_uploads" USING "btree" ("upload_claimed_at") WHERE ("status" = 'cleanup_claimed'::"text");



CREATE INDEX "idx_shipments_order" ON "public"."shipments" USING "btree" ("order_id");



CREATE INDEX "idx_teile_klassifikator_tenant" ON "public"."teile_klassifikator" USING "btree" ("tenant_id");



CREATE INDEX "idx_ui_events_created_at" ON "public"."ui_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_ui_events_event_type" ON "public"."ui_events" USING "btree" ("event_type");



CREATE INDEX "idx_ui_events_tenant_id" ON "public"."ui_events" USING "btree" ("tenant_id");



CREATE INDEX "idx_warning_tenant_aktiv" ON "public"."warning_event" USING "btree" ("tenant_id", "dismissed_am") WHERE ("dismissed_am" IS NULL);



CREATE INDEX "inquiries_received_at_idx" ON "public"."inquiries" USING "btree" ("received_at" DESC);



CREATE INDEX "inquiries_status_idx" ON "public"."inquiries" USING "btree" ("status");



CREATE INDEX "item_photos_item_id_idx" ON "public"."item_photos" USING "btree" ("item_id");



CREATE INDEX "item_photos_order_id_idx" ON "public"."item_photos" USING "btree" ("order_id");



CREATE INDEX "items_order_id_idx" ON "public"."items" USING "btree" ("order_id");



CREATE UNIQUE INDEX "items_tenant_order_id_uidx" ON "public"."items" USING "btree" ("tenant_id", "order_id", "id");



CREATE INDEX "items_tenant_order_idx" ON "public"."items" USING "btree" ("tenant_id", "order_id");



CREATE INDEX "operator_control_events_tenant_received_idx" ON "public"."operator_control_events" USING "btree" ("tenant_id", "received_at" DESC);



CREATE UNIQUE INDEX "orders_tenant_id_uidx" ON "public"."orders" USING "btree" ("tenant_id", "id");



CREATE UNIQUE INDEX "scan_uploads_tenant_client_idempotency_key_uidx" ON "public"."scan_uploads" USING "btree" ("tenant_id", "client_idempotency_key");



CREATE INDEX "tenant_operator_controls_mode_idx" ON "public"."tenant_operator_controls" USING "btree" ("mode", "effective_at");



CREATE INDEX "ui_events_tenant_created" ON "public"."ui_events" USING "btree" ("tenant_id", "created_at" DESC);



CREATE UNIQUE INDEX "uq_ai_usage_request" ON "public"."ai_usage_reservations" USING "btree" ("tenant_id", "user_id", "feature", "request_key_hash");



CREATE UNIQUE INDEX "uq_ausgangsrechnung_tenant_nummer" ON "public"."ausgangsrechnung" USING "btree" ("tenant_id", "nummer") WHERE ("is_demo" IS DISTINCT FROM true);



CREATE UNIQUE INDEX "uq_item_photo_content" ON "public"."item_photo_jobs" USING "btree" ("tenant_id", "item_id", "content_sha256");



CREATE UNIQUE INDEX "uq_item_photo_request" ON "public"."item_photo_jobs" USING "btree" ("tenant_id", "user_id", "request_key_hash");



CREATE OR REPLACE TRIGGER "tenant_operator_controls_monotonic_version_trg" BEFORE UPDATE ON "public"."tenant_operator_controls" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_operator_control_monotonic_version"();



CREATE OR REPLACE TRIGGER "trg_audit_no_delete" BEFORE DELETE ON "public"."bh_audit_log" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_audit_mutation"();



CREATE OR REPLACE TRIGGER "trg_audit_no_update" BEFORE UPDATE ON "public"."bh_audit_log" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_audit_mutation"();



CREATE OR REPLACE TRIGGER "trg_beleg_audit_insert" AFTER INSERT ON "public"."beleg" FOR EACH ROW EXECUTE FUNCTION "public"."log_beleg_insert"();



CREATE OR REPLACE TRIGGER "trg_beleg_gobd" BEFORE UPDATE ON "public"."beleg" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_beleg_mutation"();



CREATE OR REPLACE TRIGGER "trg_beleg_no_delete" BEFORE DELETE ON "public"."beleg" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_beleg_delete"();



CREATE OR REPLACE TRIGGER "trg_update_vorlagen" AFTER UPDATE OF "status" ON "public"."orders" FOR EACH ROW WHEN (((("new"."status")::"text" = ANY ((ARRAY['completed'::character varying, 'abgeschlossen'::character varying])::"text"[])) AND (("old"."status")::"text" IS DISTINCT FROM ("new"."status")::"text"))) EXECUTE FUNCTION "public"."fn_update_vorlagen"();



ALTER TABLE ONLY "public"."aktion"
    ADD CONSTRAINT "aktion_kampagne_id_fkey" FOREIGN KEY ("kampagne_id") REFERENCES "public"."kampagne"("id");



ALTER TABLE ONLY "public"."aktion"
    ADD CONSTRAINT "aktion_kanal_id_fkey" FOREIGN KEY ("kanal_id") REFERENCES "public"."kanal"("id");



ALTER TABLE ONLY "public"."aktion"
    ADD CONSTRAINT "aktion_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "public"."segment"("id");



ALTER TABLE ONLY "public"."app_kvp_items"
    ADD CONSTRAINT "app_kvp_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("id");



ALTER TABLE ONLY "public"."arbeitszeit_buchung"
    ADD CONSTRAINT "arbeitszeit_buchung_auftrag_id_fkey" FOREIGN KEY ("auftrag_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."arbeitszeit_buchung"
    ADD CONSTRAINT "arbeitszeit_buchung_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."app_users"("id");



ALTER TABLE ONLY "public"."arbeitszeit_buchung"
    ADD CONSTRAINT "arbeitszeit_buchung_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."attribution"
    ADD CONSTRAINT "attribution_touchpoint_id_fkey" FOREIGN KEY ("touchpoint_id") REFERENCES "public"."touchpoint"("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."app_users"("id");



ALTER TABLE ONLY "public"."ausgangsrechnung"
    ADD CONSTRAINT "ausgangsrechnung_bezahlt_payment_id_fkey" FOREIGN KEY ("bezahlt_payment_id") REFERENCES "public"."payments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ausgangsrechnung_position"
    ADD CONSTRAINT "ausgangsrechnung_position_ausgangsrechnung_id_fkey" FOREIGN KEY ("ausgangsrechnung_id") REFERENCES "public"."ausgangsrechnung"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."beleg"
    ADD CONSTRAINT "beleg_kategorie_id_fkey" FOREIGN KEY ("kategorie_id") REFERENCES "public"."kategorie"("id");



ALTER TABLE ONLY "public"."beleg"
    ADD CONSTRAINT "beleg_lieferant_id_fkey" FOREIGN KEY ("lieferant_id") REFERENCES "public"."lieferant"("id");



ALTER TABLE ONLY "public"."beleg_position"
    ADD CONSTRAINT "beleg_position_beleg_id_fkey" FOREIGN KEY ("beleg_id") REFERENCES "public"."beleg"("id");



ALTER TABLE ONLY "public"."beleg"
    ADD CONSTRAINT "beleg_storniert_von_fkey" FOREIGN KEY ("storniert_von") REFERENCES "public"."beleg"("id");



ALTER TABLE ONLY "public"."business_kvp_items"
    ADD CONSTRAINT "business_kvp_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("id");



ALTER TABLE ONLY "public"."communication_drafts"
    ADD CONSTRAINT "communication_drafts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."communication_messages"
    ADD CONSTRAINT "communication_messages_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("id");



ALTER TABLE ONLY "public"."communication_messages"
    ADD CONSTRAINT "communication_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."communication_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."communication_threads"
    ADD CONSTRAINT "communication_threads_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("id");



ALTER TABLE ONLY "public"."communication_threads"
    ADD CONSTRAINT "communication_threads_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."communication_threads"
    ADD CONSTRAINT "communication_threads_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."communications"
    ADD CONSTRAINT "communications_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."complaints"
    ADD CONSTRAINT "complaints_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."complaints"
    ADD CONSTRAINT "complaints_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."consumable_uses"
    ADD CONSTRAINT "consumable_uses_erfasst_von_fkey" FOREIGN KEY ("erfasst_von") REFERENCES "public"."app_users"("id");



ALTER TABLE ONLY "public"."consumable_uses"
    ADD CONSTRAINT "consumable_uses_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id");



ALTER TABLE ONLY "public"."consumable_uses"
    ADD CONSTRAINT "consumable_uses_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."consumable_uses"
    ADD CONSTRAINT "consumable_uses_vorlage_id_fkey" FOREIGN KEY ("vorlage_id") REFERENCES "public"."vorlage_verbrauch"("id");



ALTER TABLE ONLY "public"."cost_positions"
    ADD CONSTRAINT "cost_positions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."app_users"("id");



ALTER TABLE ONLY "public"."feedback_eingang"
    ADD CONSTRAINT "feedback_eingang_feedback_mail_id_fkey" FOREIGN KEY ("feedback_mail_id") REFERENCES "public"."feedback_mail"("id");



ALTER TABLE ONLY "public"."feedback_mail"
    ADD CONSTRAINT "feedback_mail_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "public"."segment"("id");



ALTER TABLE ONLY "public"."feedback_notes"
    ADD CONSTRAINT "feedback_notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("id");



ALTER TABLE ONLY "public"."arbeitszeit_buchung"
    ADD CONSTRAINT "fk_arbeitszeit_vorlage_id" FOREIGN KEY ("vorlage_id") REFERENCES "public"."vorlage_zeit"("id");



ALTER TABLE ONLY "public"."scan_uploads"
    ADD CONSTRAINT "fk_scan_uploads_conversion_order" FOREIGN KEY ("conversion_order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."scan_uploads"
    ADD CONSTRAINT "fk_scan_uploads_customer" FOREIGN KEY ("linked_customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."scan_uploads"
    ADD CONSTRAINT "fk_scan_uploads_order" FOREIGN KEY ("linked_order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."scan_uploads"
    ADD CONSTRAINT "fk_scan_uploads_reviewed_by" FOREIGN KEY ("reviewed_by") REFERENCES "public"."app_users"("id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "fk_stock_movements_erfasst_von" FOREIGN KEY ("erfasst_von") REFERENCES "public"."app_users"("id");



ALTER TABLE ONLY "public"."stock_movements"
    ADD CONSTRAINT "fk_stock_movements_vorlage_id" FOREIGN KEY ("vorlage_id") REFERENCES "public"."vorlage_verbrauch"("id");



ALTER TABLE ONLY "public"."import_job_rows"
    ADD CONSTRAINT "import_job_rows_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."import_jobs"
    ADD CONSTRAINT "import_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."item_photo_jobs"
    ADD CONSTRAINT "item_photo_tenant_order_fkey" FOREIGN KEY ("tenant_id", "order_id") REFERENCES "public"."orders"("tenant_id", "id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."item_photo_jobs"
    ADD CONSTRAINT "item_photo_tenant_order_item_fkey" FOREIGN KEY ("tenant_id", "order_id", "item_id") REFERENCES "public"."items"("tenant_id", "order_id", "id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."item_photos"
    ADD CONSTRAINT "item_photos_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."item_photos"
    ADD CONSTRAINT "item_photos_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."item_photos"
    ADD CONSTRAINT "item_photos_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."app_users"("id");



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."konto"
    ADD CONSTRAINT "konto_steuerprofil_id_fkey" FOREIGN KEY ("steuerprofil_id") REFERENCES "public"."steuerprofil"("id");



ALTER TABLE ONLY "public"."kostenposten"
    ADD CONSTRAINT "kostenposten_beleg_id_fkey" FOREIGN KEY ("beleg_id") REFERENCES "public"."beleg"("id");



ALTER TABLE ONLY "public"."kostenstellen_energie_monat"
    ADD CONSTRAINT "kostenstellen_energie_monat_kostenstelle_id_fkey" FOREIGN KEY ("kostenstelle_id") REFERENCES "public"."kostenstelle"("id");



ALTER TABLE ONLY "public"."kraftstoff_detail"
    ADD CONSTRAINT "kraftstoff_detail_beleg_id_fkey" FOREIGN KEY ("beleg_id") REFERENCES "public"."beleg"("id");



ALTER TABLE ONLY "public"."lieferant"
    ADD CONSTRAINT "lieferant_standard_kategorie_id_fkey" FOREIGN KEY ("standard_kategorie_id") REFERENCES "public"."kategorie"("id");



ALTER TABLE ONLY "public"."marketing_asset"
    ADD CONSTRAINT "marketing_asset_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "public"."segment"("id");



ALTER TABLE ONLY "public"."order_cost_events"
    ADD CONSTRAINT "order_cost_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_cost_positions"
    ADD CONSTRAINT "order_cost_positions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_financials"
    ADD CONSTRAINT "order_financials_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."phone_notes"
    ADD CONSTRAINT "phone_notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("id");



ALTER TABLE ONLY "public"."phone_notes"
    ADD CONSTRAINT "phone_notes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."phone_notes"
    ADD CONSTRAINT "phone_notes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."phone_notes"
    ADD CONSTRAINT "phone_notes_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."communication_threads"("id");



ALTER TABLE ONLY "public"."pin_rate_limits"
    ADD CONSTRAINT "pin_rate_limits_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "public"."app_users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."price_agreements"
    ADD CONSTRAINT "price_agreements_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."price_lines"
    ADD CONSTRAINT "price_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."price_lines"
    ADD CONSTRAINT "price_lines_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shipments"
    ADD CONSTRAINT "shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."touchpoint"
    ADD CONSTRAINT "touchpoint_aktion_id_fkey" FOREIGN KEY ("aktion_id") REFERENCES "public"."aktion"("id");



ALTER TABLE ONLY "public"."touchpoint"
    ADD CONSTRAINT "touchpoint_kanal_id_fkey" FOREIGN KEY ("kanal_id") REFERENCES "public"."kanal"("id");



ALTER TABLE ONLY "public"."vorlage_verbrauch"
    ADD CONSTRAINT "vorlage_verbrauch_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id");



ALTER TABLE ONLY "public"."zahlung"
    ADD CONSTRAINT "zahlung_ausgangsrechnung_id_fkey" FOREIGN KEY ("ausgangsrechnung_id") REFERENCES "public"."ausgangsrechnung"("id");



ALTER TABLE ONLY "public"."zahlung"
    ADD CONSTRAINT "zahlung_beleg_id_fkey" FOREIGN KEY ("beleg_id") REFERENCES "public"."beleg"("id");



CREATE POLICY "Allow all actions for public" ON "public"."kostenposten" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all actions for public" ON "public"."steuerprofil" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all actions for public" ON "public"."zahlung" USING (true) WITH CHECK (true);



CREATE POLICY "Allow full access to audit_log" ON "public"."audit_log" USING (true) WITH CHECK (true);



CREATE POLICY "Allow full access to feature_flags" ON "public"."feature_flags" USING (true) WITH CHECK (true);



CREATE POLICY "Allow full access to import_job_rows" ON "public"."import_job_rows" USING (true) WITH CHECK (true);



CREATE POLICY "Allow full access to import_jobs" ON "public"."import_jobs" USING (true) WITH CHECK (true);



CREATE POLICY "Enable all for authenticated users" ON "public"."communication_drafts" TO "authenticated" USING (true);



CREATE POLICY "Enable all for authenticated users" ON "public"."offline_outbox" TO "authenticated" USING (true);



CREATE POLICY "Enable all for authenticated users" ON "public"."order_cost_positions" TO "authenticated" USING (true);



CREATE POLICY "Enable all for public on kvp_items" ON "public"."kvp_items" USING (true);



ALTER TABLE "public"."ai_usage_reservations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "allow_all_calendar_events" ON "public"."calendar_events" USING (true) WITH CHECK (true);



CREATE POLICY "analyse_read" ON "public"."kpi_snapshots" FOR SELECT USING (true);



ALTER TABLE "public"."app_kvp_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."app_usage_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."app_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."arbeitszeit_buchung" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ausgangsrechnung" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ausgangsrechnung_position" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "auth_all_inquiries" ON "public"."inquiries" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "authenticated_finance_orders_select" ON "public"."orders" FOR SELECT TO "authenticated" USING ("private"."current_user_can_view_finance"(("tenant_id")::"text"));



CREATE POLICY "authenticated_finance_payments_select" ON "public"."payments" FOR SELECT TO "authenticated" USING ("private"."current_user_can_view_finance"("tenant_id"));



ALTER TABLE "public"."bath_measurements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."baths" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."beleg" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "beleg_all" ON "public"."beleg" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."beleg_position" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "beleg_position_all" ON "public"."beleg_position" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."bh_audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bh_audit_log_insert" ON "public"."bh_audit_log" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "bh_audit_log_select" ON "public"."bh_audit_log" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."bh_einstellungen" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bh_einstellungen_all" ON "public"."bh_einstellungen" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."business_kvp_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calendar_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."communication_drafts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."communication_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."communication_threads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."communications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."complaints" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."consumable_uses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cost_positions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."developer_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."devices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "email_templates_all" ON "public"."email_templates" USING (true) WITH CHECK (true);



ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."export_lauf" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "export_lauf_all" ON "public"."export_lauf" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."feature_flags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."import_job_rows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."import_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inquiries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."item_photo_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."item_photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kategorie" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kategorie_all" ON "public"."kategorie" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."konto" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kostenposten" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kpi_cost_assumptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kpi_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kraftstoff_detail" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kraftstoff_detail_all" ON "public"."kraftstoff_detail" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."kvp_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."licenses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lieferant" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lieferant_all" ON "public"."lieferant" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."locations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."offline_outbox" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."operator_control_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_cost_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_cost_positions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_financials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."phone_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pin_rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."price_lines" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public_all_inquiries_final" ON "public"."inquiries" USING (true) WITH CHECK (true);



CREATE POLICY "public_all_items_final" ON "public"."items" USING (true) WITH CHECK (true);



ALTER TABLE "public"."scan_uploads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "scan_uploads_insert_authenticated" ON "public"."scan_uploads" FOR INSERT TO "authenticated" WITH CHECK (("tenant_id" = "current_setting"('app.tenant_id'::"text", true)));



CREATE POLICY "scan_uploads_select_authenticated" ON "public"."scan_uploads" FOR SELECT TO "authenticated" USING (("tenant_id" = "current_setting"('app.tenant_id'::"text", true)));



CREATE POLICY "scan_uploads_service_role_all" ON "public"."scan_uploads" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "scan_uploads_update_authenticated" ON "public"."scan_uploads" FOR UPDATE TO "authenticated" USING (("tenant_id" = "current_setting"('app.tenant_id'::"text", true))) WITH CHECK (("tenant_id" = "current_setting"('app.tenant_id'::"text", true)));



ALTER TABLE "public"."security_rate_limit_counters" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_role_all_app_kvp" ON "public"."app_kvp_items" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all_business_kvp" ON "public"."business_kvp_items" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all_calendar_events" ON "public"."calendar_events" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all_communication_messages" ON "public"."communication_messages" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all_communication_threads" ON "public"."communication_threads" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all_consumable_uses" ON "public"."consumable_uses" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all_cost_positions" ON "public"."cost_positions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all_devices" ON "public"."devices" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all_feedback_notes" ON "public"."feedback_notes" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all_invoices" ON "public"."invoices" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all_kpi_cost_assumptions" ON "public"."kpi_cost_assumptions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all_licenses" ON "public"."licenses" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all_order_cost_events" ON "public"."order_cost_events" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all_order_financials" ON "public"."order_financials" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all_payments" ON "public"."payments" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all_phone_notes" ON "public"."phone_notes" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_all_shipments" ON "public"."shipments" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_bath_measurements" ON "public"."bath_measurements" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_baths" ON "public"."baths" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_customers" ON "public"."customers" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_items" ON "public"."items" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_orders" ON "public"."orders" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."shipments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."steuerprofil" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "steuerprofil_all" ON "public"."steuerprofil" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."stock_movements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_isolation" ON "public"."arbeitszeit_buchung" USING (("tenant_id" = "current_setting"('app.tenant_id'::"text", true)));



CREATE POLICY "tenant_isolation" ON "public"."ausgangsrechnung" USING ((("tenant_id")::"text" = "current_setting"('app.tenant_id'::"text", true)));



CREATE POLICY "tenant_isolation" ON "public"."ausgangsrechnung_position" USING ((EXISTS ( SELECT 1
   FROM "public"."ausgangsrechnung" "ar"
  WHERE (("ar"."id" = "ausgangsrechnung_position"."ausgangsrechnung_id") AND (("ar"."tenant_id")::"text" = "current_setting"('app.tenant_id'::"text", true))))));



CREATE POLICY "tenant_isolation" ON "public"."communications" USING (("tenant_id" = "current_setting"('app.tenant_id'::"text", true)));



CREATE POLICY "tenant_isolation" ON "public"."events" USING ((("tenant_id")::"text" = "current_setting"('app.tenant_id'::"text", true)));



CREATE POLICY "tenant_isolation" ON "public"."konto" USING (("tenant_id" = "current_setting"('app.tenant_id'::"text", true)));



CREATE POLICY "tenant_isolation_company_settings" ON "public"."company_settings" USING (("tenant_id" = "current_setting"('app.tenant_id'::"text", true))) WITH CHECK (("tenant_id" = "current_setting"('app.tenant_id'::"text", true)));



CREATE POLICY "tenant_isolation_complaints" ON "public"."complaints" USING (("tenant_id" = "current_setting"('app.tenant_id'::"text", true))) WITH CHECK (("tenant_id" = "current_setting"('app.tenant_id'::"text", true)));



CREATE POLICY "tenant_isolation_inquiries" ON "public"."inquiries" USING ((("tenant_id")::"text" = "current_setting"('app.tenant_id'::"text", true))) WITH CHECK ((("tenant_id")::"text" = "current_setting"('app.tenant_id'::"text", true)));



CREATE POLICY "tenant_isolation_items" ON "public"."items" USING ((("tenant_id")::"text" = "current_setting"('app.tenant_id'::"text", true))) WITH CHECK ((("tenant_id")::"text" = "current_setting"('app.tenant_id'::"text", true)));



CREATE POLICY "tenant_isolation_ui_events" ON "public"."ui_events" USING (("tenant_id" = "current_setting"('app.tenant_id'::"text", true))) WITH CHECK (("tenant_id" = "current_setting"('app.tenant_id'::"text", true)));



ALTER TABLE "public"."tenant_operator_controls" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ui_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ustva_periode" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ustva_periode_all" ON "public"."ustva_periode" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."zahlung" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "private" TO "authenticated";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "private"."current_user_can_view_finance"("expected_tenant" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."current_user_can_view_finance"("expected_tenant" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."bind_item_photo_upload"("p_job_id" "uuid", "p_tenant_id" "text", "p_user_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."bind_item_photo_upload"("p_job_id" "uuid", "p_tenant_id" "text", "p_user_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_ai_usage_reservation"("p_reservation_id" "uuid", "p_tenant_id" "text", "p_user_id" "text", "p_feature" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_ai_usage_reservation"("p_reservation_id" "uuid", "p_tenant_id" "text", "p_user_id" "text", "p_feature" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_item_photo_analysis"("p_job_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_item_photo_analysis"("p_job_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."consume_security_rate_limit"("p_namespace" "text", "p_subject_hash" "text", "p_limit" integer, "p_window_seconds" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consume_security_rate_limit"("p_namespace" "text", "p_subject_hash" "text", "p_limit" integer, "p_window_seconds" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."enforce_operator_control_monotonic_version"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."fn_compute_warnings"("p_tenant" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_compute_warnings"("p_tenant" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_is_production_order"("p_order_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_is_production_order"("p_order_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_update_vorlagen"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_update_vorlagen"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_verteile_energiekosten"("p_jahr" integer, "p_monat" integer, "p_tenant" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_verteile_energiekosten"("p_jahr" integer, "p_monat" integer, "p_tenant" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_beleg_insert"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_beleg_insert"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mark_item_photo_uncertain"("p_job_id" "uuid", "p_tenant_id" "text", "p_user_id" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_item_photo_uncertain"("p_job_id" "uuid", "p_tenant_id" "text", "p_user_id" "text", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."prevent_audit_mutation"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prevent_audit_mutation"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."prevent_beleg_delete"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prevent_beleg_delete"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."prevent_beleg_mutation"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prevent_beleg_mutation"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."reserve_ai_usage"("p_tenant_id" "text", "p_user_id" "text", "p_feature" "text", "p_request_key_hash" "text", "p_estimated_units" integer, "p_window_seconds" integer, "p_user_window_limit" integer, "p_tenant_window_limit" integer, "p_user_daily_unit_limit" bigint, "p_tenant_daily_unit_limit" bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reserve_ai_usage"("p_tenant_id" "text", "p_user_id" "text", "p_feature" "text", "p_request_key_hash" "text", "p_estimated_units" integer, "p_window_seconds" integer, "p_user_window_limit" integer, "p_tenant_window_limit" integer, "p_user_daily_unit_limit" bigint, "p_tenant_daily_unit_limit" bigint) TO "service_role";



REVOKE ALL ON FUNCTION "public"."reserve_item_photo_job"("p_job_id" "uuid", "p_tenant_id" "text", "p_user_id" "text", "p_order_id" "text", "p_item_id" "text", "p_request_key_hash" "text", "p_content_sha256" "text", "p_storage_path" "text", "p_mime_type" "text", "p_file_bytes" integer, "p_window_seconds" integer, "p_user_window_limit" integer, "p_item_limit" integer, "p_tenant_daily_bytes_limit" bigint, "p_user_daily_analysis_limit" integer, "p_tenant_daily_analysis_limit" integer, "p_user_concurrent_limit" integer, "p_tenant_concurrent_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reserve_item_photo_job"("p_job_id" "uuid", "p_tenant_id" "text", "p_user_id" "text", "p_order_id" "text", "p_item_id" "text", "p_request_key_hash" "text", "p_content_sha256" "text", "p_storage_path" "text", "p_mime_type" "text", "p_file_bytes" integer, "p_window_seconds" integer, "p_user_window_limit" integer, "p_item_limit" integer, "p_tenant_daily_bytes_limit" bigint, "p_user_daily_analysis_limit" integer, "p_tenant_daily_analysis_limit" integer, "p_user_concurrent_limit" integer, "p_tenant_concurrent_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."reset_security_rate_limit"("p_namespace" "text", "p_subject_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reset_security_rate_limit"("p_namespace" "text", "p_subject_hash" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."search_global"("query" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_global"("query" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."settle_ai_usage_reservation"("p_reservation_id" "uuid", "p_tenant_id" "text", "p_user_id" "text", "p_feature" "text", "p_outcome" "text", "p_actual_units" integer, "p_provider_status" "text", "p_result" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."settle_ai_usage_reservation"("p_reservation_id" "uuid", "p_tenant_id" "text", "p_user_id" "text", "p_feature" "text", "p_outcome" "text", "p_actual_units" integer, "p_provider_status" "text", "p_result" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."settle_item_photo_analysis"("p_job_id" "uuid", "p_outcome" "text", "p_actual_units" integer, "p_provider_status" "text", "p_result" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."settle_item_photo_analysis"("p_job_id" "uuid", "p_outcome" "text", "p_actual_units" integer, "p_provider_status" "text", "p_result" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."aktion" TO "service_role";



GRANT ALL ON TABLE "public"."app_kvp_items" TO "service_role";



GRANT SELECT ON TABLE "public"."app_usage_events" TO "service_role";



GRANT INSERT("tenant_id") ON TABLE "public"."app_usage_events" TO "service_role";



GRANT INSERT("client_event_id") ON TABLE "public"."app_usage_events" TO "service_role";



GRANT INSERT("actor_pseudonym") ON TABLE "public"."app_usage_events" TO "service_role";



GRANT INSERT("actor_role") ON TABLE "public"."app_usage_events" TO "service_role";



GRANT INSERT("session_id") ON TABLE "public"."app_usage_events" TO "service_role";



GRANT INSERT("event_type") ON TABLE "public"."app_usage_events" TO "service_role";



GRANT INSERT("route") ON TABLE "public"."app_usage_events" TO "service_role";



GRANT INSERT("target") ON TABLE "public"."app_usage_events" TO "service_role";



GRANT INSERT("device_class") ON TABLE "public"."app_usage_events" TO "service_role";



GRANT INSERT("outcome") ON TABLE "public"."app_usage_events" TO "service_role";



GRANT INSERT("duration_ms") ON TABLE "public"."app_usage_events" TO "service_role";



GRANT INSERT("result_count") ON TABLE "public"."app_usage_events" TO "service_role";



GRANT INSERT("query_length") ON TABLE "public"."app_usage_events" TO "service_role";



GRANT INSERT("click_count") ON TABLE "public"."app_usage_events" TO "service_role";



GRANT INSERT("build_id") ON TABLE "public"."app_usage_events" TO "service_role";



GRANT INSERT("occurred_at") ON TABLE "public"."app_usage_events" TO "service_role";



GRANT ALL ON TABLE "public"."app_users" TO "service_role";



GRANT ALL ON TABLE "public"."arbeitszeit_buchung" TO "service_role";



GRANT ALL ON TABLE "public"."attribution" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."ausgangsrechnung" TO "service_role";



GRANT ALL ON TABLE "public"."ausgangsrechnung_position" TO "service_role";



GRANT ALL ON TABLE "public"."bath_measurements" TO "service_role";



GRANT ALL ON TABLE "public"."baths" TO "service_role";



GRANT ALL ON TABLE "public"."beleg" TO "service_role";



GRANT ALL ON TABLE "public"."beleg_position" TO "service_role";



GRANT ALL ON TABLE "public"."bh_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."bh_einstellungen" TO "service_role";



GRANT ALL ON TABLE "public"."business_kvp_items" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_events" TO "service_role";



GRANT ALL ON TABLE "public"."communication_drafts" TO "service_role";



GRANT ALL ON TABLE "public"."communication_messages" TO "service_role";



GRANT ALL ON TABLE "public"."communication_threads" TO "service_role";



GRANT ALL ON TABLE "public"."communications" TO "service_role";



GRANT ALL ON TABLE "public"."company_settings" TO "service_role";



GRANT ALL ON TABLE "public"."complaints" TO "service_role";



GRANT ALL ON TABLE "public"."consumable_uses" TO "service_role";



GRANT ALL ON TABLE "public"."cost_positions" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT SELECT ON TABLE "public"."developer_feedback" TO "service_role";



GRANT INSERT("tenant_id") ON TABLE "public"."developer_feedback" TO "service_role";



GRANT INSERT("client_request_id") ON TABLE "public"."developer_feedback" TO "service_role";



GRANT INSERT("actor_pseudonym") ON TABLE "public"."developer_feedback" TO "service_role";



GRANT INSERT("actor_role") ON TABLE "public"."developer_feedback" TO "service_role";



GRANT INSERT("route") ON TABLE "public"."developer_feedback" TO "service_role";



GRANT INSERT("message") ON TABLE "public"."developer_feedback" TO "service_role";



GRANT INSERT("build_id") ON TABLE "public"."developer_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."devices" TO "service_role";



GRANT ALL ON TABLE "public"."einwilligung" TO "service_role";



GRANT ALL ON TABLE "public"."email_templates" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."export_lauf" TO "service_role";



GRANT ALL ON TABLE "public"."feature_flags" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_eingang" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_mail" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_notes" TO "service_role";



GRANT ALL ON TABLE "public"."forecast_version" TO "service_role";



GRANT ALL ON TABLE "public"."import_job_rows" TO "service_role";



GRANT ALL ON TABLE "public"."import_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."inquiries" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_items" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."item_photos" TO "service_role";



GRANT ALL ON TABLE "public"."items" TO "service_role";



GRANT ALL ON TABLE "public"."kampagne" TO "service_role";



GRANT ALL ON TABLE "public"."kanal" TO "service_role";



GRANT ALL ON TABLE "public"."kategorie" TO "service_role";



GRANT ALL ON TABLE "public"."konto" TO "service_role";



GRANT ALL ON TABLE "public"."kosten_posten" TO "service_role";



GRANT ALL ON TABLE "public"."kostenposten" TO "service_role";



GRANT ALL ON TABLE "public"."kostensatz_default" TO "service_role";



GRANT ALL ON TABLE "public"."kostenstelle" TO "service_role";



GRANT ALL ON TABLE "public"."kostenstellen_energie_monat" TO "service_role";



GRANT ALL ON TABLE "public"."kpi_cost_assumptions" TO "service_role";



GRANT ALL ON TABLE "public"."kpi_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."kraftstoff_detail" TO "service_role";



GRANT ALL ON TABLE "public"."kvp_items" TO "service_role";



GRANT ALL ON TABLE "public"."lern_metrik" TO "service_role";



GRANT ALL ON TABLE "public"."licenses" TO "service_role";



GRANT ALL ON TABLE "public"."lieferant" TO "service_role";



GRANT ALL ON TABLE "public"."locations" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_asset" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_touchpoints" TO "service_role";



GRANT ALL ON TABLE "public"."offline_outbox" TO "service_role";



GRANT SELECT,INSERT ON TABLE "public"."operator_control_events" TO "service_role";



GRANT ALL ON TABLE "public"."order_cost_events" TO "service_role";



GRANT ALL ON TABLE "public"."order_cost_positions" TO "service_role";



GRANT ALL ON TABLE "public"."order_financials" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."periode" TO "service_role";



GRANT ALL ON TABLE "public"."phone_notes" TO "service_role";



GRANT ALL ON TABLE "public"."pin_rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."price_agreements" TO "service_role";



GRANT ALL ON TABLE "public"."price_lines" TO "service_role";



GRANT ALL ON TABLE "public"."scan_uploads" TO "service_role";



GRANT ALL ON TABLE "public"."segment" TO "service_role";



GRANT ALL ON TABLE "public"."shipments" TO "service_role";



GRANT ALL ON TABLE "public"."statistik_kennzahl" TO "service_role";



GRANT ALL ON TABLE "public"."steuerprofil" TO "service_role";



GRANT ALL ON TABLE "public"."stock_movements" TO "service_role";



GRANT ALL ON TABLE "public"."teile_klassifikator" TO "service_role";



GRANT ALL ON TABLE "public"."telemetrie_event" TO "service_role";



GRANT SELECT,INSERT,UPDATE ON TABLE "public"."tenant_operator_controls" TO "service_role";



GRANT ALL ON TABLE "public"."touchpoint" TO "service_role";



GRANT ALL ON TABLE "public"."ui_events" TO "service_role";



GRANT ALL ON TABLE "public"."ustva_periode" TO "service_role";



GRANT ALL ON TABLE "public"."v_aging" TO "service_role";



GRANT ALL ON TABLE "public"."v_production_orders" TO "service_role";



GRANT ALL ON TABLE "public"."v_analyse_durchlaufzeit" TO "service_role";



GRANT ALL ON TABLE "public"."v_analyse_engpass" TO "service_role";



GRANT ALL ON TABLE "public"."v_analyse_kunden_kpi" TO "service_role";



GRANT ALL ON TABLE "public"."v_analyse_station_durchlauf" TO "service_role";



GRANT ALL ON TABLE "public"."v_analyse_termintreue" TO "service_role";



GRANT ALL ON TABLE "public"."v_auftrag_db" TO "service_role";



GRANT ALL ON TABLE "public"."v_analyse_werkstatt_puls_economics" TO "service_role";



GRANT ALL ON TABLE "public"."v_analyse_wochenziel" TO "service_role";



GRANT ALL ON TABLE "public"."v_engpass" TO "service_role";



GRANT ALL ON TABLE "public"."v_kostenstelle_monatswerte" TO "service_role";



GRANT ALL ON TABLE "public"."v_kunde_clv" TO "service_role";



GRANT ALL ON TABLE "public"."v_monatsergebnis" TO "service_role";



GRANT ALL ON TABLE "public"."v_periodenabschluss_status" TO "service_role";



GRANT ALL ON TABLE "public"."v_pipeline_forecast" TO "service_role";



GRANT ALL ON TABLE "public"."v_production_customers" TO "service_role";



GRANT ALL ON TABLE "public"."vorlage_verbrauch" TO "service_role";



GRANT ALL ON TABLE "public"."vorlage_zeit" TO "service_role";



GRANT ALL ON TABLE "public"."warning_event" TO "service_role";



GRANT ALL ON TABLE "public"."zahlung" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";








-- ===== PROD_LOCKDOWN_GRANTS.sql =====
-- Data-API Grant-Lockdown â€” reproduzierbare Form der Prod-Massnahmen (#86/#87/#88)
-- ZWINGEND zusammen mit der Schema-Baseline anzuwenden.
--
-- Grund (empirisch belegt 2026-08-06): Ein reiner Schema-Dump reproduziert den
-- Prod-Zustand "0 Grants an anon/authenticated" NICHT. Auf einer frischen Supabase-
-- Instanz vergeben die plattformseitigen Default Privileges alle public-Objekte
-- (94 Tabellen + 17 Views = 111) automatisch an anon UND authenticated zurueck
-- (Fresh-Replay-Messung: 666 Grants). Diese Migration entzieht sie wieder auf 0.
--
-- Verifiziert: nach Anwendung im Fresh-Replay -> 0 Grants (= Produktion).
-- Idempotent / replay-safe.

-- 1) Bestehende Tabellen- und View-Rechte entziehen
revoke all on all tables in schema public from anon, authenticated;

-- 2) Kuenftige Objekte fail-closed (Default Privileges)
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- Hinweis (nicht hier loesbar): Die supabase_admin-Default-Privileges auf Cluster-
-- Ebene (SUPABASE-ADMIN-DEFAULTPRIV-001) sind nur ueber Dashboard/Owner adressierbar
-- und bleiben ein separater, extern zu klaerender Punkt.

-- ===== PROD_STORAGE_POLICIES.sql =====
-- Storage-RLS-Policies (storage.objects) â€” Prod-Paritaet fuer F0-03/F0-06.
-- Exakte Prod-Definitionen (pg_get_expr). Idempotent/replay-safe.
-- Prod: 67 public/private + 4 storage = 71 Policies gesamt.

drop policy if exists "scan_objects_insert_authenticated" on storage.objects;
CREATE POLICY scan_objects_insert_authenticated ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'scans'::text) AND (EXISTS ( SELECT 1 FROM app_users au WHERE ((au.id = auth.uid()) AND (au.active IS TRUE) AND (au.tenant_id = (storage.foldername(objects.name))[1]) AND ((au.role)::text = ANY ((ARRAY['werkstatt'::character varying, 'meister'::character varying, 'buero'::character varying, 'admin'::character varying])::text[])))))));

drop policy if exists "scan_objects_select_authenticated" on storage.objects;
CREATE POLICY scan_objects_select_authenticated ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'scans'::text) AND (EXISTS ( SELECT 1 FROM app_users au WHERE ((au.id = auth.uid()) AND (au.active IS TRUE) AND (au.tenant_id = (storage.foldername(objects.name))[1]))))));

drop policy if exists "scan_objects_service_role_all" on storage.objects;
CREATE POLICY scan_objects_service_role_all ON storage.objects AS PERMISSIVE FOR ALL TO service_role USING ((bucket_id = 'scans'::text)) WITH CHECK ((bucket_id = 'scans'::text));

drop policy if exists "scan_objects_update_authenticated" on storage.objects;
CREATE POLICY scan_objects_update_authenticated ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'scans'::text) AND (EXISTS ( SELECT 1 FROM app_users au WHERE ((au.id = auth.uid()) AND (au.active IS TRUE) AND (au.tenant_id = (storage.foldername(objects.name))[1]) AND ((au.role)::text = ANY ((ARRAY['werkstatt'::character varying, 'meister'::character varying, 'buero'::character varying, 'admin'::character varying])::text[]))))))) WITH CHECK (((bucket_id = 'scans'::text) AND (EXISTS ( SELECT 1 FROM app_users au WHERE ((au.id = auth.uid()) AND (au.active IS TRUE) AND (au.tenant_id = (storage.foldername(objects.name))[1]) AND ((au.role)::text = ANY ((ARRAY['werkstatt'::character varying, 'meister'::character varying, 'buero'::character varying, 'admin'::character varying])::text[])))))));

-- ===== PROD_SERVICE_ROLE_ACL.sql =====
-- F0-03/05 ParitÃ¤t + Least-Privilege: service_role-ACL an Prod angleichen.
-- Selbst gefundener, entscheidungsfreier Fehler: Supabase-Default-Privileges granten service_role
-- auf neu erzeugten Tabellen VOLL (7 Rechte). Prod haelt service_role auf 4 Telemetrie-/Control-Tabellen
-- bewusst knapp. Richtung = restriktiver = sicher, Prod autoritativ -> REVOKE. Idempotent/replay-safe.

-- app_usage_events: Prod = SELECT
revoke delete, insert, references, trigger, truncate, update on public.app_usage_events from service_role;
-- developer_feedback: Prod = SELECT
revoke delete, insert, references, trigger, truncate, update on public.developer_feedback from service_role;
-- operator_control_events: Prod = INSERT, SELECT
revoke delete, references, trigger, truncate, update on public.operator_control_events from service_role;
-- tenant_operator_controls: Prod = INSERT, SELECT, UPDATE
revoke delete, references, trigger, truncate on public.tenant_operator_controls from service_role;

-- OFFEN (ENTSCHEIDUNG, NICHT hier): ai_usage_reservations, item_photo_jobs, security_rate_limit_counters.
-- Dort ist die Baseline restriktiver (nur REFERENCES/TRIGGER/TRUNCATE), Prod hat service_role VOLL.
-- ParitÃ¤t wuerde GRANT bedeuten; Security spricht fuer Least-Privilege (nur die SECURITY-DEFINER-RPC schreibt).
-- Richtung ist eine Produkt-/Security-Entscheidung -> bewusst ausgelassen.
