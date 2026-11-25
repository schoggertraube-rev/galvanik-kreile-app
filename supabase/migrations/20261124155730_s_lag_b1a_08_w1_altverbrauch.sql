-- P2/W1: Einmalige historische Übernahme im selben Wartungsfenster wie der
-- Wechsel der Verbrauchsschreiber. Die Werte sind Originale, keine Neuberechnung.
BEGIN;
LOCK TABLE public.consumable_uses IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.stock_movements IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE public.stock_movements
  ADD COLUMN w1_original_id uuid,
  ADD COLUMN w1_zuordnung text CHECK (w1_zuordnung IN ('zugeordnet','klaeren')),
  ADD CONSTRAINT stock_movements_w1_original_key UNIQUE (tenant_id, w1_original_id),
  ADD CONSTRAINT stock_movements_w1_herkunft_chk CHECK (
    (w1_original_id IS NULL AND w1_zuordnung IS NULL
      AND movement_type <> 'w1_altverbrauch')
    OR (w1_original_id IS NOT NULL AND w1_zuordnung IS NOT NULL
      AND movement_type = 'w1_altverbrauch' AND befehl_id IS NULL AND NOT lagerwirksam
      AND altquelle IS NOT NULL AND (altquelle ->> 'id') = w1_original_id::text)
  );

-- Die Ereignisse ergänzen unveränderliche Journalzeilen um ihre zweite Quelle.
CREATE UNIQUE INDEX events_lager_w1_original_key ON public.events (tenant_id, ((payload->>'originalId')))
  WHERE event_type = 'LAGER_W1_ALTZUORDNUNG_V1';

WITH treffer AS (
  SELECT quelle.tenant_id, quelle.id AS original_id, journal.id AS journal_id,
    (journal.created_at AT TIME ZONE 'Europe/Berlin')::date =
      (quelle.created_at AT TIME ZONE 'Europe/Berlin')::date AS gleicher_tag,
    count(*) OVER (PARTITION BY journal.tenant_id,journal.id) AS anzahl_quellen
  FROM public.consumable_uses quelle
  JOIN public.stock_movements journal ON journal.tenant_id = quelle.tenant_id
    AND journal.befehl_id IS NULL AND journal.movement_type IN ('verbrauch','consumption')
    AND journal.order_id = quelle.order_id AND journal.inventory_item_id = quelle.inventory_item_id
    AND abs(journal.quantity) = abs(quelle.quantity)
    AND journal.snapshot_einkaufspreis_eur = quelle.unit_cost_eur
), kandidaten AS (
  SELECT tenant_id, original_id, array_agg(journal_id ORDER BY journal_id) AS ids,
    count(*) = 1 AND coalesce(bool_and(gleicher_tag AND anzahl_quellen = 1),false) AS automatisch
  FROM treffer GROUP BY tenant_id, original_id
)
INSERT INTO public.events (id,tenant_id,event_type,description,payload,status,
  client_event_id,event_schema_version,aggregate_version,correlation_id)
SELECT gen_random_uuid()::text, quelle.tenant_id, 'LAGER_W1_ALTZUORDNUNG_V1',
  CASE WHEN kandidat.automatisch THEN 'Zusammengeführt nach Regel W1' ELSE 'Doppelung zusammenführen' END,
  jsonb_build_object('originalId',quelle.id,'original',to_jsonb(quelle),'kandidaten',to_jsonb(kandidat.ids),
    'journalId',CASE WHEN kandidat.automatisch THEN kandidat.ids[1] END,
    'stand',CASE WHEN kandidat.automatisch THEN 'zusammengefuehrt' ELSE 'vorschlag' END,
    'titel','Doppelung zusammenführen · ' || coalesce(auftrag.order_number,quelle.order_id)
      || ' · ' || coalesce(artikel.name,quelle.item_name)),
  'success', gen_random_uuid(), 1, 1, quelle.id
FROM kandidaten kandidat
JOIN public.consumable_uses quelle ON quelle.tenant_id = kandidat.tenant_id AND quelle.id = kandidat.original_id
LEFT JOIN public.orders auftrag ON auftrag.tenant_id = quelle.tenant_id AND auftrag.id = quelle.order_id
LEFT JOIN public.inventory_items artikel ON artikel.tenant_id = quelle.tenant_id AND artikel.id = quelle.inventory_item_id;

CREATE FUNCTION private.lager_w1_original_anhaengen(p_mandant text, p_original uuid)
RETURNS uuid LANGUAGE sql VOLATILE SET search_path = '' AS $funktion$
  INSERT INTO public.stock_movements (
    tenant_id, inventory_item_id, order_id, erfasst_von, movement_type, quantity,
    station_kuerzel, vorlage_id, created_at, snapshot_einkaufspreis_eur,
    lagerwirksam, altquelle, w1_original_id, w1_zuordnung
  )
  SELECT quelle.tenant_id, artikel.id, auftrag.id, login.id, 'w1_altverbrauch', quelle.quantity,
    quelle.station_kuerzel, quelle.vorlage_id, quelle.created_at, quelle.unit_cost_eur,
    false, to_jsonb(quelle), quelle.id,
    CASE WHEN artikel.id IS NULL OR auftrag.id IS NULL THEN 'klaeren' ELSE 'zugeordnet' END
  FROM public.consumable_uses quelle
  LEFT JOIN public.inventory_items artikel ON artikel.tenant_id = quelle.tenant_id AND artikel.id = quelle.inventory_item_id
  LEFT JOIN public.orders auftrag ON auftrag.tenant_id = quelle.tenant_id AND auftrag.id = quelle.order_id
  LEFT JOIN public.app_users login ON login.tenant_id = quelle.tenant_id AND login.id = quelle.erfasst_von
  WHERE quelle.tenant_id = p_mandant AND quelle.id = p_original
  RETURNING id
$funktion$;

SELECT private.lager_w1_original_anhaengen(quelle.tenant_id,quelle.id)
FROM public.consumable_uses quelle
WHERE NOT EXISTS (SELECT 1 FROM public.events original WHERE original.tenant_id = quelle.tenant_id
  AND original.event_type = 'LAGER_W1_ALTZUORDNUNG_V1' AND original.payload->>'originalId' = quelle.id::text);

DO $pruefung$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.consumable_uses quelle
    LEFT JOIN public.stock_movements journal ON journal.tenant_id = quelle.tenant_id
      AND journal.w1_original_id = quelle.id
    LEFT JOIN public.events zuordnung ON zuordnung.tenant_id = quelle.tenant_id
      AND zuordnung.event_type = 'LAGER_W1_ALTZUORDNUNG_V1'
      AND zuordnung.payload->>'originalId' = quelle.id::text
    WHERE coalesce(journal.altquelle,zuordnung.payload->'original') IS DISTINCT FROM to_jsonb(quelle)
      OR (journal.id IS NOT NULL AND zuordnung.id IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'LAGER_W1_ORIGINALABWEICHUNG';
  END IF;
END;
$pruefung$;

-- Der alte Datenträger bleibt lesbar für Herkunft und Revision. Jeder alte
-- Schreiber fällt offen aus, bis er auf den LagerPort umgestellt wurde.
CREATE TRIGGER consumable_uses_lager_nur_herkunft
  BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.consumable_uses
  FOR EACH STATEMENT EXECUTE FUNCTION private.lager_journal_unveraenderlich();

CREATE UNIQUE INDEX events_lager_w1_entscheidung_key ON public.events (tenant_id, ((payload->>'originalId')))
  WHERE event_type = 'LAGER_W1_ALTENTSCHEIDUNG_V1';

CREATE VIEW private.lager_w1_vorschlaege WITH (security_invoker = true) AS
  SELECT basis.correlation_id AS original_id, basis.payload->>'titel' AS titel,
    basis.payload->'kandidaten' AS kandidaten,
    coalesce(entscheidung.payload->>'stand',basis.payload->>'stand') AS stand,
    coalesce(entscheidung.payload->>'journalId',basis.payload->>'journalId')::uuid AS journal_id,
    basis.payload->'original' AS original
  FROM public.events basis
  LEFT JOIN public.events entscheidung ON entscheidung.tenant_id = basis.tenant_id
    AND entscheidung.event_type = 'LAGER_W1_ALTENTSCHEIDUNG_V1'
    AND entscheidung.payload->>'originalId' = basis.payload->>'originalId'
  WHERE basis.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
    AND basis.event_type = 'LAGER_W1_ALTZUORDNUNG_V1';

CREATE VIEW private.lager_w1_altverbrauch WITH (security_invoker = true) AS
  SELECT id AS journal_id, tenant_id, w1_original_id, order_id, inventory_item_id,
    altquelle ->> 'order_id' AS original_auftrag_id, altquelle ->> 'unit' AS originale_einheit,
    quantity AS originale_menge, snapshot_einkaufspreis_eur AS originaler_ek_eur,
    quantity * snapshot_einkaufspreis_eur AS originaler_einkaufswert_eur,
    w1_zuordnung, created_at, altquelle AS original
  FROM public.stock_movements
  WHERE tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
    AND w1_original_id IS NOT NULL
  UNION ALL
  SELECT vorschlag.journal_id, vorschlag.original->>'tenant_id', vorschlag.original_id,
    vorschlag.original->>'order_id', vorschlag.original->>'inventory_item_id',
    vorschlag.original->>'order_id', vorschlag.original->>'unit',
    (vorschlag.original->>'quantity')::numeric, (vorschlag.original->>'unit_cost_eur')::numeric,
    (vorschlag.original->>'quantity')::numeric * (vorschlag.original->>'unit_cost_eur')::numeric,
    vorschlag.stand, (vorschlag.original->>'created_at')::timestamptz, vorschlag.original
  FROM private.lager_w1_vorschlaege vorschlag WHERE vorschlag.stand <> 'beide';

CREATE VIEW private.lager_w1_auftragskosten WITH (security_invoker = true) AS
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
          OR (j.movement_type = 'move' AND j.geschaeftsgrund = 'umlagerung')))
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

CREATE FUNCTION private.lager_w1_entscheiden(
  p_original uuid, p_akteur uuid, p_befehl uuid, p_wahl text, p_journal uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SET search_path = '' AS $funktion$
DECLARE
  mandant text := nullif(btrim(current_setting('app.tenant_id', true)), '');
  vorher record;
  bestimmt uuid;
BEGIN
  IF mandant IS NULL OR p_original IS NULL OR p_befehl IS NULL OR p_wahl IS NULL
    OR p_wahl NOT IN ('zusammengefuehrt','beide')
    OR NOT EXISTS (SELECT 1 FROM public.app_users WHERE tenant_id = mandant AND id = p_akteur AND active)
  THEN RAISE EXCEPTION 'LAGER_W1_ENTSCHEIDUNG_UNGUELTIG' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('lager-w1:' || mandant || ':' || p_original,0));
  SELECT id, payload, user_id INTO vorher FROM public.events event
  WHERE event.tenant_id = mandant AND event.event_type = 'LAGER_W1_ALTENTSCHEIDUNG_V1'
    AND event.payload->>'originalId' = p_original::text;
  IF FOUND THEN
    IF vorher.payload->>'befehlId' = p_befehl::text AND vorher.payload->>'stand' = p_wahl AND vorher.user_id = p_akteur
      AND (p_wahl = 'beide' OR vorher.payload->>'journalId' = p_journal::text)
    THEN RETURN (vorher.payload->>'journalId')::uuid; END IF;
    RAISE EXCEPTION 'LAGER_W1_ENTSCHEIDUNG_KONFLIKT' USING ERRCODE = '23505';
  END IF;
  SELECT v.* INTO vorher FROM private.lager_w1_vorschlaege v WHERE v.original_id = p_original;
  IF NOT FOUND OR (vorher.stand = 'zusammengefuehrt' AND p_wahl <> 'beide')
    OR (p_wahl = 'zusammengefuehrt' AND (p_journal IS NULL OR NOT (vorher.kandidaten ? p_journal::text)))
  THEN RAISE EXCEPTION 'LAGER_W1_VORSCHLAG_FEHLT' USING ERRCODE = '22023'; END IF;
  bestimmt := CASE p_wahl WHEN 'beide' THEN private.lager_w1_original_anhaengen(mandant,p_original) ELSE p_journal END;
  IF bestimmt IS NULL THEN RAISE EXCEPTION 'LAGER_W1_ORIGINAL_FEHLT'; END IF;
  INSERT INTO public.events (id,tenant_id,event_type,description,payload,status,user_id,client_event_id,
    event_schema_version,aggregate_version,correlation_id)
  VALUES (gen_random_uuid()::text,mandant,'LAGER_W1_ALTENTSCHEIDUNG_V1',
    CASE p_wahl WHEN 'beide' THEN 'Beide Verbrauchsoriginale behalten' ELSE 'Zusammengeführt nach Regel W1' END,
    jsonb_build_object('originalId',p_original,'befehlId',p_befehl,'stand',p_wahl,'journalId',bestimmt,
      'bisherJournalId',vorher.journal_id,'kandidaten',vorher.kandidaten),'success',p_akteur,p_befehl,1,2,p_original);
  RETURN bestimmt;
END;
$funktion$;

CREATE VIEW private.lager_w1_uebernahmeprotokoll WITH (security_invoker = true) AS
  SELECT count(*) FILTER (WHERE w1_zuordnung = 'zugeordnet') AS uebernommen,
    count(*) FILTER (WHERE w1_zuordnung = 'zusammengefuehrt') AS zusammengefuehrt,
    count(*) FILTER (WHERE w1_zuordnung = 'vorschlag') AS vorschlag_offen,
    count(*) FILTER (WHERE w1_zuordnung = 'klaeren') AS bezug_offen
  FROM private.lager_w1_altverbrauch;

REVOKE ALL ON FUNCTION private.lager_w1_original_anhaengen(text,uuid), private.lager_w1_entscheiden(uuid,uuid,uuid,text,uuid)
  FROM PUBLIC, anon, authenticated;
-- Nur diese Funktion kann mit demselben Mandantenkontext eine bestätigte Entscheidung verbuchen.
ALTER FUNCTION private.lager_w1_entscheiden(uuid,uuid,uuid,text,uuid) SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION private.lager_w1_entscheiden(uuid,uuid,uuid,text,uuid) TO service_role;
REVOKE ALL ON TABLE private.lager_w1_altverbrauch, private.lager_w1_vorschlaege, private.lager_w1_auftragskosten,
  private.lager_w1_uebernahmeprotokoll FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE private.lager_w1_altverbrauch, private.lager_w1_vorschlaege, private.lager_w1_auftragskosten,
  private.lager_w1_uebernahmeprotokoll TO service_role;
COMMIT;
