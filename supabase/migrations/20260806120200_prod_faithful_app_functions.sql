-- Post-baseline migration: prod-faithful app functions (public + private, non-extension)
-- Source: read-only pg_get_functiondef() export from prod via Supabase MCP (project syhaigjhsbpjmtnggqka)
-- Purpose: reconcile function fingerprints with prod state, CREATE OR REPLACE only, no data mutation
SET check_function_bodies = false;

CREATE OR REPLACE FUNCTION private.current_user_can_view_finance(expected_tenant text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_users AS app_user
    WHERE app_user.id = (SELECT auth.uid())
      AND app_user.tenant_id = expected_tenant
      AND app_user.active IS TRUE
      AND lower(app_user.role) IN ('developer', 'admin', 'buero')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.bind_item_photo_upload(p_job_id uuid, p_tenant_id text, p_user_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.claim_ai_usage_reservation(p_reservation_id uuid, p_tenant_id text, p_user_id text, p_feature text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.claim_item_photo_analysis(p_job_id uuid)
 RETURNS TABLE(claimed boolean, replay boolean, job_status text, storage_path text, mime_type text, replay_result jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.consume_security_rate_limit(p_namespace text, p_subject_hash text, p_limit integer, p_window_seconds integer)
 RETURNS TABLE(allowed boolean, remaining integer, retry_after_seconds integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_operator_control_monotonic_version()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF NEW.policy_version <= OLD.policy_version THEN
    RAISE EXCEPTION 'operator control policy_version must increase (% <= %)', NEW.policy_version, OLD.policy_version
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$
;

CREATE OR REPLACE FUNCTION public.fn_compute_warnings(p_tenant text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- 1. Liquiditätswarnung: Forderungen >30 Tage > 15% Monatsumsatz
  INSERT INTO warning_event (tenant_id, typ, titel, beschreibung, schwere, link)
  SELECT p_tenant, 'liquiditaet',
    'Offene Forderungen über 30 Tage',
    COUNT(*) || ' Rechnungen über 30 Tage überfällig, Volumen ' || 
      COALESCE(SUM(netto)::int::text, '0') || ' €',
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
      COALESCE(SUM(umsatz_gesamt)::int::text, '0') || ' €)',
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
    'Auftrag ' || order_number || ' hat DB von ' || ROUND(deckungsbeitrag) || ' €',
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
$function$
;

CREATE OR REPLACE FUNCTION public.fn_is_production_order(p_order_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM v_production_orders WHERE id = p_order_id
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_update_vorlagen()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

  -- Für jedes Item des Auftrags
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
        -- Ähnlichkeits-Match: gleicher Schlüssel
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
        -- Ausreißer-Schutz: ignoriere Werte > 3x oder < 1/3 des bisherigen Medians
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
      -- Häufigkeit: in wieviel % der Aufträge dieser Klasse kommt dieser Artikel vor
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
$function$
;

CREATE OR REPLACE FUNCTION public.fn_verteile_energiekosten(p_jahr integer, p_monat integer, p_tenant text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

  -- 2. Bestehende Verteilung für diesen Monat löschen (Idempotenz)
  DELETE FROM kostenstellen_energie_monat
  WHERE tenant_id = p_tenant 
    AND monat = make_date(p_jahr, p_monat, 1);

  -- 3. Schleife über alle Produktions-Kostenstellen
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

    -- In kostenstellen_energie_monat einfügen
    IF v_ks_anteil > 0 THEN
      INSERT INTO kostenstellen_energie_monat (tenant_id, kostenstelle_id, monat, energie_eur_pro_stunde)
      VALUES (p_tenant, v_rec.ks_id, make_date(p_jahr, p_monat, 1), v_eur_pro_stunde);
    END IF;

  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.log_beleg_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO bh_audit_log (benutzer, entitaet, entitaet_id, aktion, nachher)
  VALUES (NEW.erstellt_von, 'beleg', NEW.id, 'create', to_jsonb(NEW));
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_item_photo_uncertain(p_job_id uuid, p_tenant_id text, p_user_id text, p_reason text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.prevent_audit_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RAISE EXCEPTION 'GoBD: Audit-Log ist append-only. Änderungen/Löschungen sind nicht erlaubt.';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.prevent_beleg_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RAISE EXCEPTION 'GoBD: Belege dürfen nicht gelöscht werden. Nur Storno ist erlaubt.';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.prevent_beleg_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF OLD.status = 'festgeschrieben' AND NEW.status != 'storniert' THEN
    RAISE EXCEPTION 'GoBD: Festgeschriebener Beleg darf nicht verändert werden. Nur Storno ist erlaubt.';
  END IF;
  IF OLD.status = 'storniert' THEN
    RAISE EXCEPTION 'GoBD: Stornierter Beleg darf nicht verändert werden.';
  END IF;
  -- Schutz: original_datei darf nie geändert werden
  IF OLD.original_datei IS DISTINCT FROM NEW.original_datei THEN
    RAISE EXCEPTION 'GoBD: original_datei darf nicht verändert werden.';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.reserve_ai_usage(p_tenant_id text, p_user_id text, p_feature text, p_request_key_hash text, p_estimated_units integer, p_window_seconds integer, p_user_window_limit integer, p_tenant_window_limit integer, p_user_daily_unit_limit bigint, p_tenant_daily_unit_limit bigint)
 RETURNS TABLE(allowed boolean, reservation_id uuid, replay boolean, usage_status text, replay_result jsonb, retry_after_seconds integer, decision_reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.reserve_item_photo_job(p_job_id uuid, p_tenant_id text, p_user_id text, p_order_id text, p_item_id text, p_request_key_hash text, p_content_sha256 text, p_storage_path text, p_mime_type text, p_file_bytes integer, p_window_seconds integer, p_user_window_limit integer, p_item_limit integer, p_tenant_daily_bytes_limit bigint, p_user_daily_analysis_limit integer, p_tenant_daily_analysis_limit integer, p_user_concurrent_limit integer, p_tenant_concurrent_limit integer)
 RETURNS TABLE(allowed boolean, job_id uuid, replay boolean, upload_required boolean, job_status text, reserved_storage_path text, replay_result jsonb, retry_after_seconds integer, decision_reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.reset_security_rate_limit(p_namespace text, p_subject_hash text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.search_global(query text)
 RETURNS TABLE(typ text, id text, label text, sublabel text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.settle_ai_usage_reservation(p_reservation_id uuid, p_tenant_id text, p_user_id text, p_feature text, p_outcome text, p_actual_units integer, p_provider_status text, p_result jsonb)
 RETURNS TABLE(changed boolean, usage_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.settle_item_photo_analysis(p_job_id uuid, p_outcome text, p_actual_units integer, p_provider_status text, p_result jsonb)
 RETURNS TABLE(changed boolean, job_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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
$function$
;
