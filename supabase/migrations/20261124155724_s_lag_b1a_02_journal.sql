CREATE FUNCTION private.lager_bewegungsart_ist_gueltig(
  p_art text, p_grund text, p_qualitaet text, p_menge numeric
) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $funktion$
  SELECT CASE p_art
    WHEN 'opening' THEN p_grund = 'altbestand' AND p_qualitaet = 'unbestaetigt'
    WHEN 'stock_in' THEN p_menge > 0 AND p_grund IN ('wareneingang','rueckgabe')
    WHEN 'stock_out' THEN p_menge < 0 AND p_grund IN ('entnahme','rueckgabe')
    WHEN 'consumption' THEN p_menge < 0 AND p_grund = 'verbrauch'
    WHEN 'waste' THEN p_menge < 0 AND p_grund IN ('schwund','ausschuss')
    WHEN 'move' THEN p_grund IN ('umlagerung','badzugabe')
    WHEN 'count_correction' THEN p_grund = 'inventur'
    WHEN 'reversal' THEN p_grund = 'gegenbuchung'
    WHEN 'observation' THEN p_grund = 'fund' AND p_qualitaet = 'unbekannt'
    ELSE false
  END
$funktion$;
REVOKE ALL ON FUNCTION private.lager_bewegungsart_ist_gueltig(text, text, text, numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.lager_bewegungsart_ist_gueltig(text, text, text, numeric)
  TO service_role;

-- P0: Das vorhandene Journal bleibt die einzige Bewegungsquelle.
-- Altsätze ohne Befehlskennung behalten ihre unveränderte Menge und Herkunft.
ALTER TABLE public.stock_movements
  ALTER COLUMN quantity DROP NOT NULL,
  ADD COLUMN ort_id uuid,
  ADD COLUMN mengeneinheit text CHECK (mengeneinheit IN ('stk','paar','ml','l','g','kg','mm','cm','m')),
  ADD COLUMN befehl_id uuid,
  ADD COLUMN befehl_inhalt_sha256 text,
  ADD COLUMN befehl_zeile smallint,
  ADD COLUMN fachzeit timestamptz,
  ADD COLUMN revision integer,
  ADD COLUMN beleg_id uuid,
  ADD COLUMN original_datei_id uuid,
  ADD COLUMN gegenbuchung_id uuid,
  ADD COLUMN mengenqualitaet text,
  ADD COLUMN bestandsart text NOT NULL DEFAULT 'verfuegbar',
  ADD COLUMN eigentum text NOT NULL DEFAULT 'eigen',
  ADD COLUMN bad_id text,
  ADD COLUMN im_preis_enthalten boolean,
  ADD COLUMN lagerwirksam boolean NOT NULL DEFAULT true,
  ADD COLUMN geschaeftsgrund text,
  ADD CONSTRAINT stock_movements_lager_item_key UNIQUE (tenant_id, inventory_item_id, id),
  ADD CONSTRAINT stock_movements_lager_artikel_fk FOREIGN KEY (tenant_id, inventory_item_id)
    REFERENCES public.inventory_items (tenant_id, id) ON DELETE RESTRICT NOT VALID,
  ADD CONSTRAINT stock_movements_lager_ort_fk FOREIGN KEY (tenant_id, ort_id)
    REFERENCES public.stock_locations (tenant_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT stock_movements_lager_auftrag_fk FOREIGN KEY (tenant_id, order_id)
    REFERENCES public.orders (tenant_id, id) ON DELETE RESTRICT NOT VALID,
  ADD CONSTRAINT stock_movements_lager_akteur_fk FOREIGN KEY (tenant_id, erfasst_von)
    REFERENCES public.app_users (tenant_id, id) ON DELETE RESTRICT NOT VALID,
  ADD CONSTRAINT stock_movements_lager_beleg_fk FOREIGN KEY (tenant_id, beleg_id)
    REFERENCES public.intake_item (tenant_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT stock_movements_lager_original_fk FOREIGN KEY (tenant_id, original_datei_id)
    REFERENCES public.intake_file (tenant_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT stock_movements_lager_gegenbuchung_fk FOREIGN KEY (tenant_id, inventory_item_id, gegenbuchung_id)
    REFERENCES public.stock_movements (tenant_id, inventory_item_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT stock_movements_lager_bestandsart_chk CHECK (bestandsart IN
    ('verfuegbar','reserviert','werkstatt_prozess','gesperrt','beschaedigt','rueckgabe')),
  ADD CONSTRAINT stock_movements_lager_eigentum_chk CHECK (eigentum IN ('eigen','kunde','konsignation','leihe')),
  ADD CONSTRAINT stock_movements_lager_anker_chk CHECK (
    (befehl_id IS NULL AND quantity IS NOT NULL AND num_nonnulls(befehl_inhalt_sha256, befehl_zeile,
      fachzeit, revision, ort_id, mengeneinheit, beleg_id, original_datei_id, gegenbuchung_id, mengenqualitaet, bad_id, geschaeftsgrund) = 0)
    OR
    (befehl_id IS NOT NULL AND inventory_item_id IS NOT NULL AND created_at IS NOT NULL
      AND befehl_inhalt_sha256 IS NOT NULL AND befehl_inhalt_sha256 ~ '^[0-9a-f]{64}$'
      AND befehl_zeile IS NOT NULL AND befehl_zeile BETWEEN 1 AND 2
      AND fachzeit IS NOT NULL AND isfinite(fachzeit) AND revision IS NOT NULL AND revision > 0
      AND geschaeftsgrund IS NOT NULL AND geschaeftsgrund IN (
        'altbestand','wareneingang','entnahme','verbrauch','umlagerung','badzugabe',
        'schwund','ausschuss','rueckgabe','inventur','gegenbuchung','fund')
      AND mengenqualitaet IS NOT NULL AND mengenqualitaet IN ('exakt','geschaetzt','unbekannt','unbestaetigt')
      AND ((mengenqualitaet = 'unbekannt' AND quantity IS NULL AND movement_type = 'observation')
        OR (mengenqualitaet <> 'unbekannt' AND quantity IS NOT NULL
          AND abs(quantity) < 100000000000 AND scale(quantity) <= 3
          AND (quantity <> 0 OR movement_type = 'opening')))
      AND (ort_id IS NOT NULL OR movement_type = 'opening')
      AND (mengeneinheit IS NOT NULL OR movement_type = 'opening')
      AND (mengeneinheit NOT IN ('stk','paar') OR quantity = trunc(quantity))
      AND (erfasst_von IS NOT NULL OR movement_type = 'opening')
      AND (private.lager_bewegungsart_ist_gueltig(movement_type, geschaeftsgrund, mengenqualitaet, quantity))
      AND ((movement_type = 'reversal') = (gegenbuchung_id IS NOT NULL))
      AND gegenbuchung_id IS DISTINCT FROM id
      AND (bad_id IS NULL OR bestandsart = 'werkstatt_prozess')
    )
  );

CREATE UNIQUE INDEX stock_movements_lager_befehl_zeile_key
  ON public.stock_movements (tenant_id, befehl_id, befehl_zeile) WHERE befehl_id IS NOT NULL;
CREATE UNIQUE INDEX stock_movements_lager_gegenbuchung_key
  ON public.stock_movements (tenant_id, gegenbuchung_id) WHERE gegenbuchung_id IS NOT NULL;
CREATE INDEX stock_movements_lager_fachbestand_idx
  ON public.stock_movements (tenant_id, inventory_item_id, ort_id, fachzeit)
  WHERE befehl_id IS NOT NULL;

CREATE FUNCTION private.lager_journal_unveraenderlich() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $funktion$
BEGIN
  RAISE EXCEPTION 'LAGER_JOURNAL_UNVERAENDERLICH' USING ERRCODE = '23514';
END;
$funktion$;
REVOKE ALL ON FUNCTION private.lager_journal_unveraenderlich() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.lager_journal_unveraenderlich() TO service_role;
CREATE TRIGGER stock_movements_lager_unveraenderlich
  BEFORE UPDATE OR DELETE OR TRUNCATE ON public.stock_movements
  FOR EACH STATEMENT EXECUTE FUNCTION private.lager_journal_unveraenderlich();

-- Der vorhandene LagerPort verwaltet Auftragsrechte und Projektion. Diese
-- Funktion bindet den Journalbeleg an den Transaktionsmandanten und den Akteur.
CREATE FUNCTION private.lager_journal_anhaengen(
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
      bad_id text, notiz text, im_preis_enthalten boolean
    )
  ), buchung AS (
    INSERT INTO public.stock_movements (
      tenant_id, inventory_item_id, movement_type, quantity, ort_id, mengeneinheit, befehl_id, befehl_inhalt_sha256,
      befehl_zeile, fachzeit, created_at, revision, beleg_id, original_datei_id, gegenbuchung_id,
      mengenqualitaet, bestandsart, eigentum, geschaeftsgrund, erfasst_von, order_id,
      kostenstelle_kuerzel, bad_id, notiz, im_preis_enthalten
    )
    SELECT mandant, zeilen.artikel_id, zeilen.art, zeilen.menge, zeilen.ort_id, zeilen.einheit, p_befehl, p_hash,
      zeilen.nr, zeilen.fachzeit, statement_timestamp(), zeilen.revision, zeilen.beleg_id,
      zeilen.original_datei_id, zeilen.gegenbuchung_id, zeilen.mengenqualitaet,
      coalesce(zeilen.bestandsart, 'verfuegbar'), coalesce(zeilen.eigentum, 'eigen'),
      zeilen.geschaeftsgrund, p_akteur, zeilen.order_id, zeilen.kostenstelle, zeilen.bad_id, zeilen.notiz,
      zeilen.im_preis_enthalten
    FROM zeilen
    ORDER BY zeilen.nr
    RETURNING id, befehl_zeile
  )
  SELECT buchung.id, false FROM buchung ORDER BY buchung.befehl_zeile;
END;
$funktion$;
REVOKE ALL ON FUNCTION private.lager_journal_anhaengen(uuid, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.lager_journal_anhaengen(uuid, text, uuid, jsonb) TO service_role;

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.stock_movements FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.stock_movements TO service_role;
