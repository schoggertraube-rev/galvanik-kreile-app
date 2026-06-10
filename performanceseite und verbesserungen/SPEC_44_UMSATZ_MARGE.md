# SPEC 44 · ANALYSESEITE KACHEL 2 — UMSATZ & MARGE (LIVE)

> Version: 1.0 · 10.06.2026
> Voraussetzung: SPEC 43 (Werkstatt-Puls) verifiziert, KPI-Fundament steht (kpi_snapshots, Shared Components).
> Dev: Antigravity + PowerShell · Stack: Next.js App Router, Supabase, Drizzle, Recharts, Framer Motion
> Tabellennamen-Disziplin: Übergabe-Dokument ist Gesetz. Deutsche Spalten NICHT umbenennen.

---

## 0 · LEITFRAGE

**„Verdienen wir Geld — und wenn ja, wie viel bleibt übrig?"**

Diese Kachel vereint:
- Die bisherige Analyse-Kachel „Umsatz und Marge" (Screenshot 3)
- Die Cockpit-Header-KPIs (Monatsumsatz, Monats-DB, DB-Marge, Offene Ford., Liquidität)
- Cockpit-Kacheln: Forderungen-Aging, Forecast & Pipeline, Auftrags-DB-Ranking

Nach diesem Build ist die gesamte finanzielle Sicht in EINER Analyse-Kachel + Drill-Down.

---

## 1 · BETEILIGTE TABELLEN (echte Namen, echte Spalten)

| Tabelle | Relevante Spalten | FK-Hinweis |
|---------|------------------|------------|
| `ausgangsrechnung` | `id`, `order_id`, `brutto_eur`, `netto_eur`, `status`, `bezahlt_am`, `bezahlt_methode`, `bezahlt_betrag_eur` | order_id → orders |
| `payments` | `id`, `order_id`, `amount_eur`, `status`, `provider`, `method`, `paid_at`, `invoice_id`, `created_at` | order_id → orders, invoice_id → ausgangsrechnung |
| `orders` | `id`, `order_number`, `customer_id`, `status`, `payment_status`, `db_geplant`, `db_ist`, `created_at`, `completed_date` | customer_id → customers |
| `items` | `id`, `order_id`, `preis_netto` | |
| `consumable_uses` | `order_id`, `item_id`, `quantity`, `unit_cost_eur` | |
| `arbeitszeit_buchung` | `auftrag_id` (**NICHT order_id!**), `item_id`, `station_kuerzel`, `dauer_minuten`, `kostensatz_eur_pro_stunde`, `employee_id` | auftrag_id → orders.id |
| `customers` | `id`, `company_name`, `first_name`, `last_name` | |

**Kritischer Hinweis `arbeitszeit_buchung`:** FK heißt `auftrag_id`, nicht `order_id`. Antigravity MUSS dies in allen JOINs beachten. Falsche FK-Referenz → stille leere Ergebnisse.

---

## 2 · VIEWS

### 2.1 Umsatz aktueller Monat

```sql
CREATE OR REPLACE VIEW v_analyse_umsatz_monat AS
SELECT
  coalesce(sum(netto_eur), 0) AS umsatz_netto,
  coalesce(sum(brutto_eur), 0) AS umsatz_brutto,
  count(*) AS anzahl_rechnungen,
  date_trunc('month', now()) AS monat_start
FROM ausgangsrechnung
WHERE created_at >= date_trunc('month', now())
  AND status != 'storniert';
```

### 2.2 Deckungsbeitrag (echte Kalkulation)

DB = Erlös − Materialkosten − Arbeitskosten. Drei Wege, Priorität:

1. `orders.db_ist` (wenn befüllt) → direkt verwenden
2. Berechnet aus Teilen, Material, Arbeitszeit → als Fallback

```sql
CREATE OR REPLACE VIEW v_analyse_deckungsbeitrag AS
WITH erloes AS (
  SELECT
    o.id AS order_id,
    coalesce(o.db_ist, 
      coalesce((SELECT sum(i.preis_netto) FROM items i WHERE i.order_id = o.id), 0)
      - coalesce((SELECT sum(c.quantity * c.unit_cost_eur) FROM consumable_uses c WHERE c.order_id = o.id), 0)
      - coalesce((SELECT sum(a.dauer_minuten / 60.0 * a.kostensatz_eur_pro_stunde) FROM arbeitszeit_buchung a WHERE a.auftrag_id = o.id), 0)
    ) AS db_eur,
    coalesce((SELECT sum(i.preis_netto) FROM items i WHERE i.order_id = o.id), 0) AS erloes_netto
  FROM orders o
  WHERE o.completed_date >= date_trunc('month', now())
    AND o.status NOT IN ('storniert')
)
SELECT
  round(coalesce(sum(db_eur), 0)::numeric, 2) AS db_summe,
  round(coalesce(sum(erloes_netto), 0)::numeric, 2) AS erloes_summe,
  CASE WHEN sum(erloes_netto) > 0
    THEN round((sum(db_eur) / sum(erloes_netto) * 100)::numeric, 1)
    ELSE NULL
  END AS db_marge_pct,
  count(*) AS n_auftraege
FROM erloes;
```

### 2.3 Top 5 Kunden (aktueller Monat nach Umsatz)

```sql
CREATE OR REPLACE VIEW v_analyse_top_kunden AS
SELECT
  c.id AS customer_id,
  coalesce(c.company_name, c.first_name || ' ' || c.last_name) AS kunde,
  sum(ar.netto_eur) AS umsatz_netto,
  round(sum(ar.netto_eur) * 100.0 / NULLIF((
    SELECT sum(ar2.netto_eur) FROM ausgangsrechnung ar2
    WHERE ar2.created_at >= date_trunc('month', now()) AND ar2.status != 'storniert'
  ), 0), 1) AS umsatzanteil_pct
FROM ausgangsrechnung ar
JOIN orders o ON o.id = ar.order_id
JOIN customers c ON c.id = o.customer_id
WHERE ar.created_at >= date_trunc('month', now())
  AND ar.status != 'storniert'
GROUP BY c.id, c.company_name, c.first_name, c.last_name
ORDER BY umsatz_netto DESC
LIMIT 5;
```

### 2.4 Forderungen-Aging (offene Rechnungen nach Alter)

```sql
CREATE OR REPLACE VIEW v_analyse_forderungen AS
SELECT
  ar.id,
  ar.order_id,
  o.order_number,
  coalesce(c.company_name, c.first_name || ' ' || c.last_name) AS kunde,
  ar.brutto_eur,
  ar.netto_eur,
  ar.created_at AS rechnungsdatum,
  (now() - ar.created_at)::int AS tage_offen,
  CASE
    WHEN (now() - ar.created_at) < interval '14 days' THEN 'aktuell'
    WHEN (now() - ar.created_at) < interval '30 days' THEN 'faellig'
    WHEN (now() - ar.created_at) < interval '60 days' THEN 'ueberfaellig'
    ELSE 'kritisch'
  END AS aging_stufe
FROM ausgangsrechnung ar
JOIN orders o ON o.id = ar.order_id
JOIN customers c ON c.id = o.customer_id
WHERE ar.status IN ('offen', 'gesendet', 'gemahnt')
  AND ar.bezahlt_am IS NULL
ORDER BY ar.created_at ASC;
```

### 2.5 Auftrags-DB-Ranking (bestes/schlechtestes DB pro Auftrag)

```sql
CREATE OR REPLACE VIEW v_analyse_db_ranking AS
WITH auftrag_db AS (
  SELECT
    o.id, o.order_number,
    coalesce(c.company_name, c.first_name || ' ' || c.last_name) AS kunde,
    coalesce((SELECT sum(i.preis_netto) FROM items i WHERE i.order_id = o.id), 0) AS erloes,
    coalesce(o.db_ist,
      coalesce((SELECT sum(i.preis_netto) FROM items i WHERE i.order_id = o.id), 0)
      - coalesce((SELECT sum(cu.quantity * cu.unit_cost_eur) FROM consumable_uses cu WHERE cu.order_id = o.id), 0)
      - coalesce((SELECT sum(az.dauer_minuten / 60.0 * az.kostensatz_eur_pro_stunde) FROM arbeitszeit_buchung az WHERE az.auftrag_id = o.id), 0)
    ) AS db_eur
  FROM orders o
  JOIN customers c ON c.id = o.customer_id
  WHERE o.completed_date >= date_trunc('month', now()) - interval '3 months'
    AND o.status NOT IN ('storniert')
)
SELECT *,
  CASE WHEN erloes > 0 THEN round((db_eur / erloes * 100)::numeric, 1) ELSE 0 END AS db_marge_pct
FROM auftrag_db
ORDER BY db_marge_pct DESC;
```

### 2.6 Zahlungseingänge (Mollie + andere)

```sql
CREATE OR REPLACE VIEW v_analyse_zahlungen AS
SELECT
  p.id,
  p.order_id,
  o.order_number,
  p.amount_eur,
  p.status,
  p.provider,
  p.method,
  p.paid_at,
  p.created_at,
  CASE WHEN p.paid_at IS NOT NULL AND p.created_at IS NOT NULL
    THEN extract(epoch FROM (p.paid_at - p.created_at)) / 86400.0
    ELSE NULL
  END AS durchlaufzeit_tage
FROM payments p
JOIN orders o ON o.id = p.order_id
WHERE p.created_at >= date_trunc('month', now()) - interval '3 months'
ORDER BY p.created_at DESC;
```

### 2.7 Forecast (laufende Aufträge → erwarteter Umsatz)

```sql
CREATE OR REPLACE VIEW v_analyse_forecast AS
SELECT
  sum(coalesce(i.preis_netto, 0)) AS pipeline_netto,
  count(DISTINCT o.id) AS offene_auftraege
FROM orders o
JOIN items i ON i.order_id = o.id
WHERE o.status NOT IN ('abgeschlossen', 'storniert')
  AND o.completed_date IS NULL;
```

---

## 3 · FRONTEND

### 3.1 Ordnerstruktur

```
src/features/analyse/kacheln/umsatz-marge/
  UmsatzMargeTile.tsx          ← Kachel auf Übersicht
  UmsatzMargeOverlay.tsx       ← Drill-Down mit Tabs
  TopKundenListe.tsx           ← Top 5 Kunden
  ForderungenAging.tsx         ← Forderungs-Aging mit Farbstufen
  DbRankingTable.tsx           ← Auftrags-DB-Ranking
  UmsatzChart.tsx              ← Recharts AreaChart
  ForecastCard.tsx             ← Pipeline/Forecast Mini-KPI
src/features/analyse/hooks/
  useUmsatzMarge.ts            ← Query-Hook für alle 7 Views
```

### 3.2 Kachel `UmsatzMargeTile.tsx`

Visuell wie Screenshot 1 (zweite Kachel, links):

```
┌────────────────────────────────────────────────────┐
│ 💰 Umsatz und Marge                        STABIL │
│    Finanzen · Forecast · Controlling                │
│                                                     │
│ UMSATZ NETTO        DECKUNGSBEITRAG                │
│ 42.500 €            11.850 €                       │
│ ▲ +7,2% vs. Vm.     27,9% Marge                   │
│ ~~~~~~~~~~~ (Sparkline)                             │
└────────────────────────────────────────────────────┘
```

| Element | Datenquelle | Leerzustand |
|---------|-------------|-------------|
| Umsatz Netto | `v_analyse_umsatz_monat.umsatz_netto` | „0 €" |
| Trend vs. Vormonat | `kpi_snapshots` WHERE kpi_key='umsatz_netto', periode='monat', −1 Monat | „Vormonat: wird aufgebaut" |
| Deckungsbeitrag | `v_analyse_deckungsbeitrag.db_summe` | „0 €" |
| DB-Marge % | `v_analyse_deckungsbeitrag.db_marge_pct` | „–" |
| Sparkline | letzte 6 Monats-Snapshots | leer |
| Status-Pill | DB-Marge < 15% → KRITISCH, 15–25% → BEOBACHTEN, >25% → STABIL | neutral |

### 3.3 Drill-Down `UmsatzMargeOverlay.tsx`

Visuell wie Screenshot 3 (Umsatz & Marge Overlay):

**Tab-Leiste:** Woche | **Monat** | Quartal | Jahr

**Abschnitt A — Hero:**
- „UMSATZ NETTO (AKTUELLER MONAT)" → `umsatz_netto` €
- Trend-Pill ▲ +17,2% vs. Vormonat
- Deckungsbeitrag: X% (Y €)
- Mini-Sparkline rechts

**Abschnitt B — Umsatz im Zeitverlauf:**
- Recharts AreaChart: X = Monat, Y = Umsatz netto (grüne Fläche)
- Vorjahr: gestrichelte Linie (aus kpi_snapshots, wenn vorhanden)
- „So liest du das"-Hinweisbox

**Abschnitt C — Top 5 Kunden:**
- Aus `v_analyse_top_kunden`
- Pro Zeile: Initiale-Badge | Kundenname | Umsatzanteil % | Umsatz €
- Klick → Kundendetail/Overlay (wenn vorhanden, sonst kein Klick)

**Abschnitt D — Was die Zahl im Verhältnis bedeutet:**
3 Mini-KPI-Karten nebeneinander:

| KPI | Berechnung | Quelle |
|-----|-----------|--------|
| DB/Auftrag | `db_summe / n_auftraege` | `v_analyse_deckungsbeitrag` |
| Umsatz/Mitarbeiter | `umsatz_netto / COUNT(DISTINCT employee_id)` aus `arbeitszeit_buchung` | eigene Subquery oder neue View |
| Forecast Monatsende | `umsatz_netto + pipeline_netto` | `v_analyse_umsatz_monat` + `v_analyse_forecast` |

**Abschnitt E — KI-Einschätzung:**
- Gleiche Edge Function `kpi-insight` wie Kachel 1
- Input: `{ kachel: "umsatz-marge", daten: { umsatz_netto, db_marge_pct, top_kunde, forderungen_summe, forecast } }`

**Abschnitt F — Forderungen-Aging (aus Cockpit migriert):**
- Aus `v_analyse_forderungen`
- Gruppiert nach aging_stufe: aktuell | fällig | überfällig | kritisch
- Farbcodierung: grün → gelb → orange → rot
- Pro Zeile: Auftragsnummer | Kunde | Betrag | Tage offen
- Summe pro Stufe am Header
- Leerzustand: „Keine offenen Forderungen" (grüner Zustand)

**Abschnitt G — Auftrags-DB-Ranking (aus Cockpit migriert):**
- Aus `v_analyse_db_ranking`
- Tabelle: Auftragsnr | Kunde | Erlös | DB | Marge %
- Sortiert nach Marge DESC (beste oben)
- Letzte Zeile: Aufträge mit negativem DB rot markiert
- Leerzustand: „Noch keine abgeschlossenen Aufträge mit Kostenerfassung"

---

## 4 · SEED-DATEN (für Präsentation)

Damit die Kachel bei der Demo nicht leer ist, braucht der Seed:

```sql
-- In src/db/seed_analyse.ts ERGÄNZEN (nicht neue Datei):

-- Rechnungen
INSERT INTO ausgangsrechnung (id, order_id, brutto_eur, netto_eur, status, created_at)
VALUES
  ('inv_seed_1', 'ord_1', 1060.00, 890.00, 'bezahlt', now() - interval '5 days'),
  ('inv_seed_2', 'ord_11', 595.00, 500.00, 'offen', now() - interval '20 days'),
  ('inv_seed_3', 'ord_21', 714.00, 600.00, 'gesendet', now() - interval '45 days')
ON CONFLICT (id) DO NOTHING;

-- Zahlungen
INSERT INTO payments (id, order_id, amount_eur, status, provider, method, paid_at, invoice_id, created_at)
VALUES
  (gen_random_uuid(), 'ord_1', 1060.00, 'succeeded', 'mollie', 'banktransfer', now() - interval '3 days', 'inv_seed_1', now() - interval '5 days')
ON CONFLICT (id) DO NOTHING;

-- Materialverbrauch
INSERT INTO consumable_uses (order_id, item_id, description, quantity, unit, unit_cost_eur)
VALUES
  ('ord_1', 'item_1', 'Nickelsalz', 2.5, 'kg', 18.00),
  ('ord_1', 'item_1', 'Schleifpapier P240', 5, 'stk', 1.20)
ON CONFLICT DO NOTHING;

-- Arbeitszeit (ACHTUNG: auftrag_id, NICHT order_id!)
INSERT INTO arbeitszeit_buchung (auftrag_id, station_kuerzel, dauer_minuten, kostensatz_eur_pro_stunde)
VALUES
  ('ord_1', 'schleifen', 120, 45.00),
  ('ord_1', 'galvanik', 90, 50.00)
ON CONFLICT DO NOTHING;
```

**Seed-Daten klar markiert:** Alle IDs mit `_seed_`-Prefix, damit löschbar.

---

## 5 · EDGE FUNCTION ERWEITERUNG

Die bestehende `kpi-insight` Function muss den neuen Kachel-Typ `umsatz-marge` unterstützen:

```ts
// In supabase/functions/kpi-insight/index.ts
// Erweitern: wenn kachel === 'umsatz-marge', System-Prompt anpassen:
// "Du bewertest die finanzielle Lage eines Galvanik-Betriebs.
//  Beobachtung zur Umsatz-/Margenentwicklung.
//  Achtung bei sinkender Marge oder wachsenden Forderungen.
//  Empfehlung: konkret, umsetzbar, für einen Handwerksmeister verständlich."
```

---

## 6 · ABHÄNGIGKEIT ZUR BUCHHALTUNGSSEITE

Die Übergabe nennt: `buchhaltung/analysis.actions.ts enthält noch Math.random`. Die Analyse-Kachel **darf diese Datei NICHT importieren**. Die Views lesen direkt aus `ausgangsrechnung` und `payments`. Wenn die Buchhaltungsseite später bereinigt wird, ändert sich für die Analyse nichts — sie hat ihre eigenen Views.

---

## 7 · AKZEPTANZKRITERIEN

| Nr | Kriterium | Prüfmethode |
|----|----------|-------------|
| 1 | Alle 7 Views existieren auf Supabase | SQL: `SELECT * FROM v_analyse_umsatz_monat;` etc. |
| 2 | `v_analyse_deckungsbeitrag` berechnet DB korrekt (Erlös − Material − Arbeitszeit) | Manuell nachrechnen: Seed ord_1 Erlös − Nickelsalz − Schleifpapier − Arbeitszeit |
| 3 | `arbeitszeit_buchung` JOIN über `auftrag_id` (nicht `order_id`) | SQL: `SELECT * FROM v_analyse_deckungsbeitrag;` muss Werte zeigen |
| 4 | Forderungen-Aging zeigt offene Rechnungen mit korrekter Altersstufe | inv_seed_2 (20 Tage) = „fällig", inv_seed_3 (45 Tage) = „überfällig" |
| 5 | Top 5 Kunden sortiert nach Umsatz DESC | SQL-Check |
| 6 | Forecast = aktueller Umsatz + Pipeline offener Aufträge | SQL-Check |
| 7 | UI: UmsatzMargeTile zeigt Umsatz aus View (DB = UI) | Browser + DB vergleichen |
| 8 | UI: Drill-Down öffnet, zeigt alle 7 Abschnitte (A–G) | Klick-Test |
| 9 | Kein Import aus `mockData` oder `analysis.actions.ts` | `grep -r "mockData\|analysis.actions" src/features/analyse/kacheln/umsatz-marge/` |
| 10 | Leerzustand: keine Rechnungen → „0 €" + Aktionslink, kein Mock | DB leeren, prüfen |
| 11 | KI-Block liefert Finanz-Einschätzung | Edge Function testen |
| 12 | Seed-Daten mit `_seed_`-Prefix, löschbar | SQL: `DELETE FROM ausgangsrechnung WHERE id LIKE '%seed%';` |

---

## 8 · ANTI-DRIFT / STOPP

1. **`auftrag_id` in `arbeitszeit_buchung`** — nicht `order_id`. Bei falschem JOIN: STOPP, nicht umgehen.
2. **Keine Berechnung im Frontend.** DB-Marge kommt aus der View.
3. **Kein Import aus `buchhaltung/analysis.actions.ts`** — die enthält Math.random.
4. **Keine `any`-Casts.** TypeScript-Typen für alle View-Ergebnisse.
5. **Seed-Daten klar markiert.** IDs mit `_seed_`, damit vor Livegang löschbar.
6. **Navigation/Sidebar NICHT anfassen.**
7. **Git manuell durch Siglinder.**
8. **STOPP bei:** `ausgangsrechnung` hat andere Spalten als in Übergabe beschrieben → zuerst `information_schema` prüfen, melden.

---

## 9 · REIHENFOLGE FÜR ANTIGRAVITY

```
Phase 1 — DB-Prüfung
  1.0  ZUERST: Schema der 4 kritischen Tabellen prüfen:
       SELECT column_name, data_type FROM information_schema.columns
       WHERE table_name IN ('ausgangsrechnung', 'payments', 'arbeitszeit_buchung', 'consumable_uses')
       ORDER BY table_name, ordinal_position;
  1.1  Ergebnis als Tabelle ausgeben. STOPP bis verifiziert.

Phase 2 — Migrations
  2.1  7 Views anlegen (v_analyse_umsatz_monat, _deckungsbeitrag, _top_kunden,
       _forderungen, _db_ranking, _zahlungen, _forecast)
  2.2  npx supabase db push → NOTIFY → verifizieren
  2.3  Seed-Daten in bestehenden seed_analyse.ts ergänzen, ausführen

Phase 3 — Edge Function
  3.1  kpi-insight um kachel 'umsatz-marge' erweitern
  3.2  Redeployen

Phase 4 — Frontend
  4.1  Ordnerstruktur unter umsatz-marge/ anlegen
  4.2  useUmsatzMarge Hook
  4.3  UmsatzMargeTile
  4.4  UmsatzMargeOverlay mit allen 7 Abschnitten
  4.5  TopKundenListe, ForderungenAging, DbRankingTable, UmsatzChart, ForecastCard

Phase 5 — Verifikation
  5.1  Alle 12 Akzeptanzkriterien durchlaufen
  5.2  Ergebnis als Tabelle (ORIGINAL-Kriterien, nicht umformuliert!)
  5.3  STOPP — auf Freigabe warten vor Kachel 3

Zwischen Phasen: kein Parallelstart. Phase 1 fertig → Phase 2.
```

**WICHTIG FÜR ANTIGRAVITY:** Die Verifikationstabelle in Phase 5.2 muss die EXAKTEN 12 Kriterien aus Abschnitt 7 dieser Spec verwenden — nicht eigene Kriterien erfinden. Jedes Kriterium mit der Nummer aus der Spec referenzieren.
