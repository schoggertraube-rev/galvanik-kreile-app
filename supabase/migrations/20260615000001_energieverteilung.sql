-- Migration für die Energieverteilung (Spec 36 Phase 4)
CREATE OR REPLACE FUNCTION fn_verteile_energiekosten(p_jahr INT, p_monat INT, p_tenant TEXT)
RETURNS void AS $$
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
$$ LANGUAGE plpgsql
