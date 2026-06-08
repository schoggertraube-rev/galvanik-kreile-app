-- ==========================================
-- VIEW 1: v_auftrag_db
-- ==========================================
CREATE OR REPLACE VIEW v_auftrag_db AS
SELECT
  o.id AS order_id,
  o.order_number,
  o.customer_id,
  c.name AS kunde_name,
  c.company_name,
  o.intake_date,
  o.status,
  o.current_station,
  o.due_date,
  -- Erlös
  COALESCE((
    SELECT SUM(ar.netto) FROM ausgangsrechnung ar
    WHERE ar.order_id = o.id
      AND (ar.is_demo IS NULL OR ar.is_demo = false)
  ), 0) AS erloes_netto,
  -- Materialkosten
  COALESCE((
    SELECT SUM(abs(sm.quantity) * COALESCE(sm.snapshot_einkaufspreis_eur, 0))
    FROM stock_movements sm
    WHERE sm.order_id = o.id AND sm.movement_type = 'verbrauch'
  ), 0) AS material_kosten,
  -- Arbeitszeitkosten
  COALESCE((
    SELECT SUM(zb.dauer_minuten / 60.0 * zb.kostensatz_eur_pro_stunde)
    FROM arbeitszeit_buchung zb
    WHERE zb.auftrag_id = o.id
  ), 0) AS arbeitszeit_kosten,
  -- Energieanteil (über Energie-Verteilung pro Stationsstunde)
  COALESCE((
    SELECT SUM(zb.dauer_minuten / 60.0 * COALESCE(kem.energie_eur_pro_stunde, 0))
    FROM arbeitszeit_buchung zb
    LEFT JOIN kostenstelle ks_bridge
      ON ks_bridge.kuerzel = zb.kostenstelle_kuerzel AND ks_bridge.tenant_id = zb.tenant_id
    LEFT JOIN kostenstellen_energie_monat kem
      ON kem.kostenstelle_id = ks_bridge.id
     AND kem.monat = date_trunc('month', zb.start_zeit)::date
    WHERE zb.auftrag_id = o.id
  ), 0) AS energie_anteil_kosten,
  -- Berechnete Felder
  COALESCE((
    SELECT SUM(ar.netto) FROM ausgangsrechnung ar
    WHERE ar.order_id = o.id AND (ar.is_demo IS NULL OR ar.is_demo = false)
  ), 0)
  - COALESCE((SELECT SUM(abs(sm.quantity) * COALESCE(sm.snapshot_einkaufspreis_eur, 0))
              FROM stock_movements sm WHERE sm.order_id = o.id AND sm.movement_type = 'verbrauch'), 0)
  - COALESCE((SELECT SUM(zb.dauer_minuten / 60.0 * zb.kostensatz_eur_pro_stunde)
              FROM arbeitszeit_buchung zb WHERE zb.auftrag_id = o.id), 0)
  - COALESCE((SELECT SUM(zb.dauer_minuten / 60.0 * COALESCE(kem.energie_eur_pro_stunde, 0))
              FROM arbeitszeit_buchung zb
              LEFT JOIN kostenstelle ks_bridge
                ON ks_bridge.kuerzel = zb.kostenstelle_kuerzel AND ks_bridge.tenant_id = zb.tenant_id
              LEFT JOIN kostenstellen_energie_monat kem
                ON kem.kostenstelle_id = ks_bridge.id
               AND kem.monat = date_trunc('month', zb.start_zeit)::date
              WHERE zb.auftrag_id = o.id), 0)
  AS deckungsbeitrag,
  -- DB-Marge
  CASE WHEN COALESCE((SELECT SUM(ar.netto) FROM ausgangsrechnung ar
    WHERE ar.order_id = o.id AND (ar.is_demo IS NULL OR ar.is_demo = false)), 0) > 0
  THEN (
    COALESCE((SELECT SUM(ar.netto) FROM ausgangsrechnung ar
      WHERE ar.order_id = o.id AND (ar.is_demo IS NULL OR ar.is_demo = false)), 0)
    - COALESCE((SELECT SUM(abs(sm.quantity) * COALESCE(sm.snapshot_einkaufspreis_eur, 0))
                FROM stock_movements sm WHERE sm.order_id = o.id AND sm.movement_type = 'verbrauch'), 0)
    - COALESCE((SELECT SUM(zb.dauer_minuten / 60.0 * zb.kostensatz_eur_pro_stunde)
                FROM arbeitszeit_buchung zb WHERE zb.auftrag_id = o.id), 0)
    - COALESCE((SELECT SUM(zb.dauer_minuten / 60.0 * COALESCE(kem.energie_eur_pro_stunde, 0))
                FROM arbeitszeit_buchung zb
                LEFT JOIN kostenstelle ks_bridge
                  ON ks_bridge.kuerzel = zb.kostenstelle_kuerzel AND ks_bridge.tenant_id = zb.tenant_id
                LEFT JOIN kostenstellen_energie_monat kem
                  ON kem.kostenstelle_id = ks_bridge.id
                 AND kem.monat = date_trunc('month', zb.start_zeit)::date
                WHERE zb.auftrag_id = o.id), 0)
  ) / NULLIF((SELECT SUM(ar.netto) FROM ausgangsrechnung ar
    WHERE ar.order_id = o.id AND (ar.is_demo IS NULL OR ar.is_demo = false)), 0)
  ELSE NULL END AS db_marge,
  -- Anzahl Buchungen (für Datenherkunfts-Zeile)
  (SELECT COUNT(*) FROM ausgangsrechnung ar WHERE ar.order_id = o.id) AS anz_rechnungen,
  (SELECT COUNT(*) FROM stock_movements sm WHERE sm.order_id = o.id AND sm.movement_type = 'verbrauch') AS anz_verbrauch,
  (SELECT COUNT(*) FROM arbeitszeit_buchung zb WHERE zb.auftrag_id = o.id) AS anz_zeitbuchungen
FROM orders o
LEFT JOIN customers c ON c.id = o.customer_id;

-- ==========================================
-- VIEW 2: v_kostenstelle_monatswerte
-- ==========================================
CREATE OR REPLACE VIEW v_kostenstelle_monatswerte AS
SELECT
  ks.id AS kostenstelle_id,
  ks.kuerzel,
  ks.name,
  ks.typ,
  date_trunc('month', zb.start_zeit)::date AS monat,
  COALESCE(SUM(zb.dauer_minuten) / 60.0, 0) AS gebuchte_stunden,
  ks.verfuegbare_stunden_monatlich,
  CASE WHEN ks.verfuegbare_stunden_monatlich > 0
       THEN COALESCE(SUM(zb.dauer_minuten), 0) / 60.0 / ks.verfuegbare_stunden_monatlich
       ELSE NULL END AS auslastung_quote,
  COALESCE(SUM(zb.dauer_minuten / 60.0 * zb.kostensatz_eur_pro_stunde), 0) AS personalkosten_ist,
  COUNT(DISTINCT zb.auftrag_id) AS anz_auftraege
FROM kostenstelle ks
LEFT JOIN arbeitszeit_buchung zb 
  ON zb.kostenstelle_kuerzel = ks.kuerzel
  AND zb.tenant_id = ks.tenant_id
WHERE ks.tenant_id = 'galvanik-kreile'
GROUP BY ks.id, ks.kuerzel, ks.name, ks.typ, 
  date_trunc('month', zb.start_zeit), ks.verfuegbare_stunden_monatlich;

-- ==========================================
-- VIEW 3: v_periodenabschluss_status
-- ==========================================
CREATE OR REPLACE VIEW v_periodenabschluss_status AS
SELECT
  p.id,
  p.jahr,
  p.monat,
  p.status,
  p.geschlossen_am,
  -- Belege ohne Konto
  (SELECT COUNT(*) FROM beleg b 
   WHERE b.periode_id = p.id AND b.konto_id IS NULL) AS belege_ohne_konto,
  -- Belege ohne Kostenstelle
  (SELECT COUNT(*) FROM beleg b 
   WHERE b.periode_id = p.id AND b.kostenstelle_id IS NULL) AS belege_ohne_kostenstelle,
  -- Rechnungen ohne Auftragszuordnung
  (SELECT COUNT(*) FROM ausgangsrechnung ar 
   WHERE ar.periode_id = p.id AND ar.order_id IS NULL) AS rechnungen_ohne_auftrag,
  -- Rechnungen unbezahlt
  (SELECT COUNT(*) FROM ausgangsrechnung ar 
   WHERE ar.periode_id = p.id AND ar.bezahlt_am IS NULL) AS rechnungen_offen,
  -- Aufträge mit Abschluss im Monat aber ohne DB
  (SELECT COUNT(*) FROM orders o 
   WHERE o.status IN ('completed','abgeschlossen')
     AND date_trunc('month', o.due_date) = make_date(p.jahr, p.monat, 1)
     AND o.db_ist IS NULL) AS auftraege_ohne_db
FROM periode p
WHERE p.tenant_id = 'galvanik-kreile';
