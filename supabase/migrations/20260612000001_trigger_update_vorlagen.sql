-- Function: wird aufgerufen wenn orders.status auf 'completed' wechselt
CREATE OR REPLACE FUNCTION fn_update_vorlagen()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql

-- Trigger auf orders
CREATE TRIGGER trg_update_vorlagen
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (NEW.status IN ('completed', 'abgeschlossen') AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION fn_update_vorlagen()
