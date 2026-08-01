CREATE OR REPLACE FUNCTION fn_compute_warnings(p_tenant text)
RETURNS void AS $$
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
$$ LANGUAGE plpgsql;
