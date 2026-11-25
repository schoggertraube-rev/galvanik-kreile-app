BEGIN;

CREATE OR REPLACE VIEW private.lager_w1_auftragskosten WITH (security_invoker = true) AS
WITH vorschlaege AS (
  SELECT v.*, v.kandidaten->>0 AS vertreter FROM private.lager_w1_vorschlaege v
), kostenzeilen AS (
  SELECT j.id, j.order_id, j.inventory_item_id AS artikel_id,
    abs(j.quantity) AS menge, j.mengeneinheit,
    CASE WHEN j.befehl_id IS NULL THEN j.snapshot_einkaufspreis_eur
      WHEN j.kalk_ek IS NOT NULL THEN j.kalk_ek * (1 + j.aufschlag_pct/100) END AS ek,
    j.im_preis_enthalten
  FROM public.stock_movements j
  WHERE j.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
    AND j.order_id IS NOT NULL AND (
      (j.befehl_id IS NULL AND j.movement_type IN ('verbrauch','consumption'))
      OR (j.w1_original_id IS NOT NULL AND j.w1_zuordnung = 'zugeordnet')
      OR (j.befehl_id IS NOT NULL AND j.lagerwirksam AND j.quantity < 0
        AND (j.movement_type IN ('stock_out','consumption','waste')
          OR (j.movement_type = 'move' AND j.geschaeftsgrund = 'umlagerung'))
        AND NOT EXISTS (SELECT 1 FROM public.stock_movements g
          WHERE g.tenant_id = j.tenant_id AND g.gegenbuchung_id = j.id))
    )
    AND NOT EXISTS (SELECT 1 FROM vorschlaege v WHERE v.stand = 'vorschlag'
      AND v.kandidaten ? j.id::text AND v.vertreter <> j.id::text)
)
SELECT k.id AS journal_id, k.order_id, k.artikel_id, k.menge, k.mengeneinheit, k.ek,
  round(k.menge*k.ek,2) AS wert_eur, k.im_preis_enthalten,
  EXISTS (SELECT 1 FROM vorschlaege v WHERE v.stand = 'vorschlag' AND v.vertreter = k.id::text) AS vorlaeufig,
  coalesce((SELECT array_agg(v.original_id ORDER BY v.original_id) FROM vorschlaege v
    WHERE v.stand = 'zusammengefuehrt' AND v.journal_id = k.id), '{}'::uuid[]) AS weitere_original_ids
FROM kostenzeilen k;

CREATE OR REPLACE FUNCTION private.lager_journal_anhaengen(
  p_befehl uuid, p_hash text, p_akteur uuid, p_zeilen jsonb
) RETURNS TABLE (bewegung_id uuid, wiederholt boolean)
LANGUAGE plpgsql SET search_path = '' AS $funktion$
DECLARE
  mandant text := nullif(btrim(current_setting('app.tenant_id', true)), '');
  anz integer;
  identisch boolean;
  sortiert uuid[];
  positionsdaten record;
BEGIN
  IF mandant IS NULL OR p_befehl IS NULL OR p_hash IS NULL OR p_hash !~ '^[0-9a-f]{64}$'
    OR p_akteur IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.app_users WHERE tenant_id = mandant AND id = p_akteur AND active
    ) THEN
    RAISE EXCEPTION 'LAGER_JOURNAL_BEFEHL_UNGUELTIG' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'lager-journal:' || mandant || ':' || p_befehl::text, 0));
  SELECT array_agg(journal.id ORDER BY journal.befehl_zeile),
    bool_and(journal.befehl_inhalt_sha256 = p_hash AND journal.erfasst_von = p_akteur)
    INTO sortiert, identisch
  FROM public.stock_movements journal
  WHERE journal.tenant_id = mandant AND journal.befehl_id = p_befehl;
  IF sortiert IS NOT NULL THEN
    IF identisch IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'LAGER_JOURNAL_BEFEHLSKONFLIKT' USING ERRCODE = '23505';
    END IF;
    RETURN QUERY SELECT vorhanden.id, true FROM unnest(sortiert) vorhanden(id);
    RETURN;
  END IF;

  IF jsonb_typeof(p_zeilen) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'LAGER_JOURNAL_ZEILEN_UNGUELTIG' USING ERRCODE = '22023';
  END IF;
  anz := jsonb_array_length(p_zeilen);
  IF anz NOT BETWEEN 1 AND 2 OR EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_zeilen) AS eingabe(art text)
    WHERE eingabe.art IS NULL OR eingabe.art = 'opening'
      OR (anz = 1 AND eingabe.art = 'move')
      OR (anz = 2 AND eingabe.art NOT IN ('move','reversal'))
  ) THEN
    RAISE EXCEPTION 'LAGER_JOURNAL_ZEILEN_UNGUELTIG' USING ERRCODE = '22023';
  END IF;

  IF anz = 2 THEN
    SELECT count(DISTINCT eingabe.art) AS art, count(DISTINCT eingabe.artikel_id) AS artikel,
      count(DISTINCT eingabe.fachzeit) AS zeit,
      count(DISTINCT coalesce(eingabe.eigentum, 'eigen')) AS eigentum,
      count(DISTINCT ROW(eingabe.ort_id, coalesce(eingabe.bestandsart, 'verfuegbar'))) AS ziel,
      count(DISTINCT eingabe.mengenqualitaet) AS qualitaet, count(DISTINCT eingabe.geschaeftsgrund) AS grund,
      sum(eingabe.menge) AS summe
      INTO positionsdaten
    FROM jsonb_to_recordset(p_zeilen)
      AS eingabe(art text, artikel_id text, fachzeit timestamptz, eigentum text, ort_id uuid, bestandsart text,
        mengenqualitaet text, geschaeftsgrund text, menge numeric);
    IF positionsdaten.art <> 1 OR positionsdaten.artikel <> 1 OR positionsdaten.zeit <> 1 OR positionsdaten.eigentum <> 1
      OR positionsdaten.ziel <> 2 OR positionsdaten.qualitaet <> 1 OR positionsdaten.grund <> 1
      OR positionsdaten.summe IS DISTINCT FROM 0::numeric THEN
      RAISE EXCEPTION 'LAGER_JOURNAL_UMLAGERUNG_UNGUELTIG' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_zeilen) AS eingabe(artikel_id text, einheit text)
    JOIN public.inventory_items artikel ON artikel.tenant_id = mandant AND artikel.id = eingabe.artikel_id
    WHERE artikel.basiseinheit IS NOT NULL AND eingabe.einheit IS DISTINCT FROM artikel.basiseinheit
  ) THEN
    RAISE EXCEPTION 'LAGER_BASISEINHEIT_KONFLIKT' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_zeilen) AS eingabe(original_datei_id uuid, beleg_id uuid)
    WHERE eingabe.original_datei_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.v_lager_eingangsoriginale_v1 datei
      WHERE datei.tenant_id = mandant AND datei.id = eingabe.original_datei_id
        AND datei.item_id = eingabe.beleg_id AND datei.gespeichert
    )
  ) THEN
    RAISE EXCEPTION 'LAGER_JOURNAL_ORIGINAL_NICHT_BELEGT' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_zeilen) AS eingabe(gegenbuchung_id uuid, artikel_id text,
      ort_id uuid, menge numeric, bestandsart text, eigentum text, fachzeit timestamptz)
    WHERE eingabe.gegenbuchung_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.stock_movements ursprung
      WHERE ursprung.tenant_id = mandant AND ursprung.id = eingabe.gegenbuchung_id
        AND ursprung.befehl_id IS NOT NULL
        AND (ursprung.movement_type = 'move' OR ursprung.movement_type = 'reversal' AND EXISTS (
          SELECT 1 FROM public.stock_movements zweite_zeile
          WHERE zweite_zeile.tenant_id = mandant AND zweite_zeile.befehl_id = ursprung.befehl_id
            AND zweite_zeile.id <> ursprung.id
        )) = (anz = 2)
        AND ursprung.inventory_item_id = eingabe.artikel_id AND ursprung.ort_id = eingabe.ort_id
        AND ursprung.quantity = -eingabe.menge AND ursprung.fachzeit <= eingabe.fachzeit
        AND ursprung.bestandsart = coalesce(eingabe.bestandsart, 'verfuegbar')
        AND ursprung.eigentum = coalesce(eingabe.eigentum, 'eigen')
    )
  ) THEN
    RAISE EXCEPTION 'LAGER_JOURNAL_GEGENBUCHUNG_UNGUELTIG' USING ERRCODE = '22023';
  END IF;

  IF anz = 2 AND EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_zeilen) AS eingabe(art text, gegenbuchung_id uuid)
    LEFT JOIN public.stock_movements ursprung ON ursprung.tenant_id = mandant AND ursprung.id = eingabe.gegenbuchung_id
    WHERE eingabe.art = 'reversal'
    HAVING count(DISTINCT ursprung.befehl_id) > 1
  ) THEN
    RAISE EXCEPTION 'LAGER_JOURNAL_GEGENBUCHUNGSPAAR_UNGUELTIG' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH zeilen AS (
    SELECT position.nr, eingabe.*
    FROM jsonb_array_elements(p_zeilen) WITH ORDINALITY AS position(wert, nr)
    CROSS JOIN LATERAL jsonb_to_record(position.wert) AS eingabe(
      artikel_id text, art text, menge numeric, ort_id uuid, einheit text, fachzeit timestamptz, revision integer,
      beleg_id uuid, original_datei_id uuid, gegenbuchung_id uuid, mengenqualitaet text,
      bestandsart text, eigentum text, geschaeftsgrund text, order_id text, kostenstelle text,
      bad_id text, notiz text, im_preis_enthalten boolean, mehrarbeit_beleg_id text
    )
  ), buchung AS (
    INSERT INTO public.stock_movements (
      tenant_id, inventory_item_id, movement_type, quantity, ort_id, mengeneinheit, befehl_id, befehl_inhalt_sha256,
      befehl_zeile, fachzeit, created_at, revision, beleg_id, original_datei_id, gegenbuchung_id,
      mengenqualitaet, bestandsart, eigentum, geschaeftsgrund, erfasst_von, order_id,
      kostenstelle_kuerzel, bad_id, notiz, im_preis_enthalten, mehrarbeit_beleg_id
    )
    SELECT mandant, zeilen.artikel_id, zeilen.art, zeilen.menge, zeilen.ort_id, zeilen.einheit, p_befehl, p_hash,
      zeilen.nr, zeilen.fachzeit, statement_timestamp(), zeilen.revision, zeilen.beleg_id,
      zeilen.original_datei_id, zeilen.gegenbuchung_id, zeilen.mengenqualitaet,
      coalesce(zeilen.bestandsart, 'verfuegbar'), coalesce(zeilen.eigentum, 'eigen'),
      zeilen.geschaeftsgrund, p_akteur, zeilen.order_id, zeilen.kostenstelle, zeilen.bad_id, zeilen.notiz,
      zeilen.im_preis_enthalten, zeilen.mehrarbeit_beleg_id
    FROM zeilen
    ORDER BY zeilen.nr
    RETURNING id, befehl_zeile
  )
  SELECT buchung.id, false FROM buchung ORDER BY buchung.befehl_zeile;
END;
$funktion$;

CREATE VIEW public.v_lager_befehlsereignisse_v1 WITH (security_invoker = true) AS
  SELECT tenant_id, id, client_event_id, event_type, created_at
  FROM public.events
  WHERE tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
    AND event_type IN ('LAGER_INVENTUR_ZAEHLUNG_V1', 'LAGER_STAMMBEFEHL_V1');

CREATE VIEW public.v_lager_akteure_v1 WITH (security_invoker = true) AS
  SELECT tenant_id, id, full_name AS anzeigename
  FROM public.app_users
  WHERE tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

REVOKE ALL ON TABLE public.v_lager_befehlsereignisse_v1, public.v_lager_akteure_v1
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.v_lager_befehlsereignisse_v1, public.v_lager_akteure_v1 TO service_role;

COMMIT;
