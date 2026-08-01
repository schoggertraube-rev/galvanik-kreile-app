-- Migration: Verdichtungs-Views für Cockpit (Spec 37 Phase 6)
-- Views: v_kunde_clv, v_engpass, v_aging, v_monatsergebnis

-- View 1: v_kunde_clv
CREATE OR REPLACE VIEW v_kunde_clv AS
SELECT
  c.id AS customer_id,
  c.name,
  c.company_name,
  c.type AS kundentyp,
  c.created_at AS erstkontakt,
  COUNT(DISTINCT o.id) AS auftraege_gesamt,
  COUNT(DISTINCT o.id) FILTER (
    WHERE o.intake_date > NOW() - INTERVAL '12 months'
  ) AS auftraege_12m,
  COALESCE(SUM(vdb.erloes_netto), 0) AS umsatz_gesamt,
  COALESCE(SUM(vdb.deckungsbeitrag), 0) AS db_gesamt,
  CASE WHEN COALESCE(SUM(vdb.erloes_netto), 0) > 0
    THEN SUM(vdb.deckungsbeitrag) / SUM(vdb.erloes_netto)
    ELSE NULL END AS db_marge,
  MAX(o.intake_date) AS letzter_auftrag,
  (SELECT COUNT(*) FROM complaints cpl WHERE cpl.customer_id = c.id)
    AS reklamationen,
  -- Durchschnittliche Durchlaufzeit (Eingang bis letzte Zeitbuchung)
  AVG(EXTRACT(EPOCH FROM (
    (SELECT MAX(zb.start_zeit) FROM arbeitszeit_buchung zb WHERE zb.auftrag_id = o.id)
    - o.intake_date::timestamptz
  )) / 86400.0)::numeric(8,1) AS avg_durchlauf_tage,
  -- Zahlungsmoral
  AVG(ar.bezahlt_am - ar.faellig_am)::numeric(8,1) AS avg_zahlungsverzug_tage
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
LEFT JOIN v_auftrag_db vdb ON vdb.order_id = o.id
LEFT JOIN ausgangsrechnung ar ON ar.order_id = o.id
  AND (ar.is_demo IS NULL OR ar.is_demo = false)
GROUP BY c.id, c.name, c.company_name, c.type, c.created_at;

-- View 2: v_engpass
CREATE OR REPLACE VIEW v_engpass AS
SELECT
  ks.id AS kostenstelle_id,
  ks.kuerzel,
  ks.name,
  ks.typ,
  -- Aufträge die aktuell auf dieser Station stehen
  (SELECT COUNT(*) FROM orders o
   WHERE o.current_station = ks.kuerzel
     AND o.status NOT IN ('completed','abgeschlossen','cancelled','storniert')
  ) AS warteschlange_aktuell,
  -- Durchschnittliche Verweildauer der letzten 30 Tage
  (SELECT AVG(zb.dauer_minuten / 60.0)
   FROM arbeitszeit_buchung zb
   WHERE zb.kostenstelle_kuerzel = ks.kuerzel
     AND zb.start_zeit > NOW() - INTERVAL '30 days'
  ) AS avg_stunden_pro_auftrag_30d,
  -- Aktuelle Monatsauslastung
  (SELECT COALESCE(SUM(zb.dauer_minuten), 0) / 60.0
   FROM arbeitszeit_buchung zb
   WHERE zb.kostenstelle_kuerzel = ks.kuerzel
     AND date_trunc('month', zb.start_zeit) = date_trunc('month', NOW())
  ) AS gebuchte_stunden_aktuell,
  ks.verfuegbare_stunden_monatlich,
  CASE WHEN COALESCE(ks.verfuegbare_stunden_monatlich, 0) > 0
    THEN (SELECT COALESCE(SUM(zb.dauer_minuten), 0) / 60.0
          FROM arbeitszeit_buchung zb
          WHERE zb.kostenstelle_kuerzel = ks.kuerzel
            AND date_trunc('month', zb.start_zeit) = date_trunc('month', NOW())
         ) / ks.verfuegbare_stunden_monatlich
    ELSE NULL END AS auslastung_quote,
  -- Engpass-Score (0..1)
  LEAST(1.0, GREATEST(0,
    CASE WHEN COALESCE(ks.verfuegbare_stunden_monatlich, 0) > 0
      THEN (SELECT COALESCE(SUM(zb.dauer_minuten), 0) / 60.0
            FROM arbeitszeit_buchung zb
            WHERE zb.kostenstelle_kuerzel = ks.kuerzel
              AND date_trunc('month', zb.start_zeit) = date_trunc('month', NOW())
           ) / ks.verfuegbare_stunden_monatlich
      ELSE 0 END
  )) AS engpass_score
FROM kostenstelle ks
WHERE ks.typ = 'produktion' AND ks.tenant_id = 'galvanik-kreile';

-- View 3: v_aging
CREATE OR REPLACE VIEW v_aging AS
SELECT
  ar.id,
  ar.nummer AS rechnungsnummer,
  ar.kunde_id AS customer_id,
  c.name AS kunde_name,
  c.company_name,
  ar.netto,
  ar.brutto,
  ar.faellig_am,
  ar.bezahlt_am,
  ar.mahnstufe,
  CASE
    WHEN ar.bezahlt_am IS NOT NULL THEN 'bezahlt'
    WHEN ar.faellig_am IS NULL THEN 'ohne_faelligkeit'
    WHEN NOW()::date <= ar.faellig_am THEN 'nicht_faellig'
    WHEN NOW()::date - ar.faellig_am <= 14 THEN '1-14'
    WHEN NOW()::date - ar.faellig_am <= 30 THEN '15-30'
    WHEN NOW()::date - ar.faellig_am <= 60 THEN '31-60'
    WHEN NOW()::date - ar.faellig_am <= 90 THEN '61-90'
    ELSE '>90'
  END AS aging_bucket,
  CASE WHEN ar.bezahlt_am IS NULL AND ar.faellig_am IS NOT NULL
    THEN GREATEST(0, NOW()::date - ar.faellig_am)
    ELSE NULL END AS tage_ueberfaellig
FROM ausgangsrechnung ar
LEFT JOIN customers c ON c.id = ar.kunde_id
WHERE ar.is_demo IS NULL OR ar.is_demo = false;

-- View 4: v_monatsergebnis
CREATE OR REPLACE VIEW v_monatsergebnis AS
WITH erloes AS (
  SELECT date_trunc('month', ar.datum)::date AS monat,
         SUM(ar.netto) AS summe
  FROM ausgangsrechnung ar
  WHERE ar.is_demo IS NULL OR ar.is_demo = false
  GROUP BY 1
),
material AS (
  SELECT date_trunc('month', b.erstellt_am)::date AS monat,
         SUM(b.netto) AS summe
  FROM beleg b
  LEFT JOIN konto k ON k.id = b.konto_id
  WHERE k.kategorie = 'wareneinsatz'
  GROUP BY 1
),
personal AS (
  SELECT date_trunc('month', zb.start_zeit)::date AS monat,
         SUM(zb.dauer_minuten / 60.0 * zb.kostensatz_eur_pro_stunde) AS summe
  FROM arbeitszeit_buchung zb
  GROUP BY 1
),
energie AS (
  SELECT date_trunc('month', b.erstellt_am)::date AS monat,
         SUM(b.netto) AS summe
  FROM beleg b
  LEFT JOIN konto k ON k.id = b.konto_id
  WHERE k.kategorie = 'energie'
  GROUP BY 1
),
sachkosten AS (
  SELECT date_trunc('month', b.erstellt_am)::date AS monat,
         SUM(b.netto) AS summe
  FROM beleg b
  LEFT JOIN konto k ON k.id = b.konto_id
  WHERE k.kategorie = 'sachkosten'
  GROUP BY 1
),
alle_monate AS (
  SELECT monat FROM erloes
  UNION SELECT monat FROM material
  UNION SELECT monat FROM personal
  UNION SELECT monat FROM energie
  UNION SELECT monat FROM sachkosten
)
SELECT
  am.monat,
  COALESCE(e.summe, 0) AS erloes_netto,
  COALESCE(m.summe, 0) AS material_kosten,
  COALESCE(p.summe, 0) AS personal_kosten,
  COALESCE(en.summe, 0) AS energie_kosten,
  COALESCE(s.summe, 0) AS sachkosten,
  COALESCE(e.summe, 0)
    - COALESCE(m.summe, 0)
    - COALESCE(p.summe, 0)
    - COALESCE(en.summe, 0)
    - COALESCE(s.summe, 0) AS ergebnis
FROM alle_monate am
LEFT JOIN erloes e ON e.monat = am.monat
LEFT JOIN material m ON m.monat = am.monat
LEFT JOIN personal p ON p.monat = am.monat
LEFT JOIN energie en ON en.monat = am.monat
LEFT JOIN sachkosten s ON s.monat = am.monat
ORDER BY am.monat DESC;
