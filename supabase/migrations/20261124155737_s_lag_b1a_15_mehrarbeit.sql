-- W1/W2: Die Mehrarbeit bleibt am unveränderlichen Materialjournal belegt.
ALTER TABLE public.stock_movements ADD COLUMN mehrarbeit_beleg_id text,
  ADD CONSTRAINT stock_movements_lager_mehrarbeit_fk FOREIGN KEY (mehrarbeit_beleg_id)
    REFERENCES public.events (id) ON DELETE RESTRICT,
  ADD CONSTRAINT stock_movements_lager_mehrarbeit_chk CHECK (
    mehrarbeit_beleg_id IS NULL OR (befehl_id IS NOT NULL AND order_id IS NOT NULL
      AND movement_type = 'consumption' AND im_preis_enthalten IS NOT NULL)
  );

CREATE FUNCTION private.lager_mehrarbeit_pruefen() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $funktion$
BEGIN
  IF NEW.mehrarbeit_beleg_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = NEW.mehrarbeit_beleg_id AND e.tenant_id = NEW.tenant_id AND e.order_id = NEW.order_id
      AND e.event_type = 'ORDER_ITEM_EXTRA_WORK_CHANGED_V1' AND e.status = 'success'
  ) THEN RAISE EXCEPTION 'LAGER_MEHRARBEIT_BELEG_PASST_NICHT' USING ERRCODE = '22023'; END IF;
  RETURN NEW;
END;
$funktion$;
REVOKE ALL ON FUNCTION private.lager_mehrarbeit_pruefen() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.lager_mehrarbeit_pruefen() TO service_role;
CREATE TRIGGER stock_movements_lager_mehrarbeit_pruefen
  BEFORE INSERT ON public.stock_movements FOR EACH ROW EXECUTE FUNCTION private.lager_mehrarbeit_pruefen();

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
