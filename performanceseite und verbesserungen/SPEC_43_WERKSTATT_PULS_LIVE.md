# SPEC 43 · ANALYSESEITE KACHEL 1 — WERKSTATT-PULS (LIVE)

> Version: 1.0 · 10.06.2026
> Voraussetzung: Übergabe-Dokument „ÜBERGABE AN ANALYSE-CHAT" ist Wahrheit.
> Cockpit-Seite: Inhalte wandern nach Analyse, Cockpit-Route wird Redirect.
> Dev: Antigravity + PowerShell · Stack: Next.js App Router, Supabase, Drizzle, Recharts, Framer Motion
> Tenant: galvanik-kreile

---

## 0 · KONTEXT UND GESAMTPLAN

Die Analyseseite wird zur **einzigen Chef-Seite**. Alles, was heute auf Cockpit und Analyse verteilt ist, wird hier vereint. Aufbau kachelweise, eine nach der anderen:

| Nr | Kachel | Datenquellen | Status |
|----|--------|-------------|--------|
| **1** | **Werkstatt-Puls** | orders, events, items | **← DIESE SPEC** |
| 2 | Umsatz & Marge | orders, ausgangsrechnung, payments, items, consumable_uses, arbeitszeit_buchung | nächste Spec |
| 3 | Qualität & Risiko | complaints, orders, events | folgt |
| 4 | Bäder & Material | consumable_uses, Badregelkarte-Tabellen | folgt |
| 5 | Kunden & Markt | customers, orders, ausgangsrechnung | folgt |
| 6 | Marketing & Reaktivierung | communication_messages, orders, customers | folgt |
| 7 | Was-wäre-wenn (aus Cockpit) | Simulationslogik auf Views | folgt |
| 8 | Frühwarnungen KI (aus Cockpit) | Edge Function auf alle Views | folgt |

**Cockpit-Route:** Nach Kachel 8 → Redirect auf Analyse. Bis dahin: Cockpit bleibt, Nav nicht anfassen.

---

## 1 · ARCHITEKTUR — KPI-FUNDAMENT (GILT FÜR ALLE KACHELN)

### 1.1 Zwei-Schicht-Modell (B + C)

```
Rohdaten (orders, events, items, payments, …)
     │
     ▼  Schicht B — Postgres Views (v_analyse_*)
     │  → EINZIGE Berechnungsstelle. Frontend rechnet NICHTS.
     │
     ├──► Frontend liest Views via Supabase-Client
     │
     └──► Schicht C — kpi_snapshots (Wochen-/Monatswerte)
          → Vorjahres-/Trendvergleich, historische Kurven
```

**Eiserne Regel:** Jede Zahl auf der Analyseseite hat genau EINE Quelle: die zugehörige View. Kein `Math.random`, kein Hardcode, kein Fallback auf `mockData`. NULL/0 → Leerzustand.

### 1.2 Snapshot-Tabelle (einmalig anlegen)

```sql
-- Migration: 20260610_create_kpi_snapshots.sql
CREATE TABLE IF NOT EXISTS kpi_snapshots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     text NOT NULL DEFAULT 'galvanik-kreile',
  kpi_key       text NOT NULL,
  periode       text NOT NULL,       -- 'woche' | 'monat' | 'quartal' | 'jahr'
  periode_start date NOT NULL,
  wert          numeric,
  einheit       text,                -- '%', 'tage', 'eur', 'anzahl'
  meta          jsonb,               -- z.B. {"n": 25, "station_detail": {...}}
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, kpi_key, periode, periode_start)
);

-- RLS
ALTER TABLE kpi_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "analyse_read" ON kpi_snapshots FOR SELECT USING (true);
```

**Nach Migration:** `npx supabase db push` → `NOTIFY pgrst, 'reload schema'` → auf Supabase Dashboard verifizieren, dass Tabelle existiert.

---

## 2 · VIEW: v_analyse_werkstatt_puls

```sql
-- Migration: 20260610_view_werkstatt_puls.sql

-- A: Termintreue (aktuelle Woche)
CREATE OR REPLACE VIEW v_analyse_termintreue AS
SELECT
  count(*) FILTER (
    WHERE completed_date IS NOT NULL
      AND promised_due_date IS NOT NULL
      AND completed_date <= promised_due_date
  ) AS puenktlich,
  count(*) FILTER (
    WHERE completed_date IS NOT NULL
      AND promised_due_date IS NOT NULL
  ) AS nenner,
  CASE
    WHEN count(*) FILTER (WHERE completed_date IS NOT NULL AND promised_due_date IS NOT NULL) > 0
    THEN round(
      count(*) FILTER (WHERE completed_date <= promised_due_date AND completed_date IS NOT NULL AND promised_due_date IS NOT NULL)
      * 100.0
      / count(*) FILTER (WHERE completed_date IS NOT NULL AND promised_due_date IS NOT NULL),
      1
    )
    ELSE NULL
  END AS termintreue_pct,
  count(*) FILTER (
    WHERE promised_due_date IS NULL AND status != 'storniert'
  ) AS ohne_zusagetermin
FROM orders
WHERE tenant_id = 'galvanik-kreile'
  AND created_at >= date_trunc('week', now());


-- B: Durchlaufzeit gesamt (letzte 30 Tage, abgeschlossene Aufträge)
CREATE OR REPLACE VIEW v_analyse_durchlaufzeit AS
SELECT
  round(avg(EXTRACT(EPOCH FROM (completed_date - created_at)) / 86400.0)::numeric, 1)
    AS avg_tage,
  count(*) AS n
FROM orders
WHERE tenant_id = 'galvanik-kreile'
  AND completed_date IS NOT NULL
  AND completed_date >= now() - interval '30 days';


-- C: Durchlaufzeit pro Station (Events-basiert)
CREATE OR REPLACE VIEW v_analyse_station_durchlauf AS
WITH eingang AS (
  SELECT order_id, station, MIN(created_at) AS ts_ein
  FROM events
  WHERE event_type = 'STATION_EINGANG' AND station IS NOT NULL
  GROUP BY order_id, station
),
ausgang AS (
  SELECT order_id, station, MAX(created_at) AS ts_aus
  FROM events
  WHERE event_type = 'STATION_AUSGANG' AND station IS NOT NULL
  GROUP BY order_id, station
)
SELECT
  e.station,
  round(avg(EXTRACT(EPOCH FROM (a.ts_aus - e.ts_ein)) / 86400.0)::numeric, 1) AS avg_tage,
  count(*) AS n,
  -- Engpass-Info: wie viele aktuell IN dieser Station (kein Ausgang)
  (SELECT count(*) FROM items WHERE current_station_id = e.station) AS teile_aktuell
FROM eingang e
JOIN ausgang a ON a.order_id = e.order_id AND a.station = e.station
WHERE e.ts_ein >= now() - interval '30 days'
GROUP BY e.station;


-- D: Wochenziel (abgeschlossene Aufträge diese Woche)
CREATE OR REPLACE VIEW v_analyse_wochenziel AS
SELECT
  count(*) AS fertig_diese_woche
FROM orders
WHERE tenant_id = 'galvanik-kreile'
  AND completed_date IS NOT NULL
  AND completed_date >= date_trunc('week', now());


-- E: Engpass-Heatmap (Teile pro Station JETZT)
CREATE OR REPLACE VIEW v_analyse_engpass AS
SELECT
  current_station_id AS station,
  count(*) AS teile_wartend
FROM items
WHERE current_station_id IS NOT NULL
GROUP BY current_station_id
ORDER BY teile_wartend DESC;
```

**Stations-Vokabular (aus Übergabe, verbindlich):**
`wareneingang`, `entmetallisierung`, `schleifen`, `galvanik`, `qk_versand`

**Fallback:** Wenn noch keine `STATION_EINGANG`/`STATION_AUSGANG`-Events existieren (Übergabe: „0 neu"), zeigt `v_analyse_station_durchlauf` 0 Zeilen → Frontend zeigt Leerzustand pro Station: „Noch keine Stationsdaten erfasst". Durchlaufzeit gesamt (View B) funktioniert trotzdem via `created_at → completed_date`.

---

## 3 · FRONTEND — ORDNERSTRUKTUR

```
src/
  features/
    analyse/
      AnalysePage.tsx              ← Hauptseite, rendert alle Kacheln
      hooks/
        useWerkstattPuls.ts        ← Query-Hook für Views A–E
        useKpiSnapshot.ts          ← historische Vergleichswerte aus kpi_snapshots
        useKiInsight.ts            ← Edge Function Aufruf
      kacheln/
        werkstatt-puls/
          WerkstattPulsTile.tsx     ← Kachel auf Übersicht (Hero + 3 KPIs + Sparkline)
          WerkstattPulsOverlay.tsx  ← Drill-Down (Chart + Stationen + KI)
          StationDurchlaufList.tsx  ← Stationsliste im Overlay
          TermintreueChart.tsx      ← Recharts AreaChart (KW-Verlauf)
        umsatz-marge/              ← leer, nächste Spec
        qualitaet-risiko/          ← leer
        …
      components/
        KachelShell.tsx            ← gemeinsames Layout: Titel, Untertitel, Status-Pill, onClick→Overlay
        OverlayShell.tsx           ← gemeinsames Overlay: Header, Tabs, Close, Scroll
        KpiMiniCard.tsx            ← wiederverwendbare KPI-Minikarte
        LeerzustandHinweis.tsx     ← "Noch keine Daten erfasst" + optionaler Aktionslink
        KiEinschaetzung.tsx        ← KI-Block (Beobachtung + Empfehlung)
```

### 3.1 Query-Hook `useWerkstattPuls.ts`

```ts
// Pseudocode — exakte Drizzle/Supabase-Syntax nach Stack
import { useQuery } from '@tanstack/react-query'; // oder SWR, je nachdem was im Projekt ist
import { supabase } from '@/lib/supabase';

export function useWerkstattPuls() {
  return useQuery({
    queryKey: ['analyse', 'werkstatt-puls'],
    queryFn: async () => {
      const [termintreue, durchlauf, stationen, wochenziel, engpass] = await Promise.all([
        supabase.from('v_analyse_termintreue').select('*').single(),
        supabase.from('v_analyse_durchlaufzeit').select('*').single(),
        supabase.from('v_analyse_station_durchlauf').select('*'),
        supabase.from('v_analyse_wochenziel').select('*').single(),
        supabase.from('v_analyse_engpass').select('*'),
      ]);
      return { termintreue, durchlauf, stationen, wochenziel, engpass };
    },
    staleTime: 60_000, // 1 Min Cache, dann Refresh
  });
}
```

**VERBOTEN:** Jede Berechnung im Hook oder in der Komponente. `termintreue_pct` kommt fertig aus der View.

### 3.2 Kachel `WerkstattPulsTile.tsx`

Visuell exakt wie Screenshot 1 (oberste Kachel), aber mit echten Daten:

```
┌─────────────────────────────────────────────────────────────────────┐
│ ⚡ Werkstatt-Puls                                    HANDLUNGSBEDARF │
│    Durchsatz · Stationen · Wochenziel                    (oder STABIL)│
│                                                                      │
│ TERMINTREUE    Ø DURCHLAUFZEIT    WOCHENZIEL        ┌─────────┐     │
│ 76 %           9,4 T              23 / 25           │  64%    │     │
│ ▼ −9 Pkt.vs.Vj  ▲ +1,2 T vs.Vj    ████████░ 92%   │ (Donut) │     │
│                                                      └─────────┘     │
│ ───────────────────────────────────────────────────                   │
│ Schleifen ··· Politur ··· Galvanik ··· Vorbeh. ··· QK/Vers.         │
└─────────────────────────────────────────────────────────────────────┘
```

| Element | Datenquelle | Leerzustand |
|---------|-------------|-------------|
| Termintreue % | `v_analyse_termintreue.termintreue_pct` | „–" |
| Trend vs. Vj. | `kpi_snapshots` WHERE kpi_key='termintreue', 52 Wochen zurück | „Vorjahr: wird aufgebaut" |
| Ø Durchlaufzeit | `v_analyse_durchlaufzeit.avg_tage` | „–" |
| Wochenziel Ist | `v_analyse_wochenziel.fertig_diese_woche` | „0" |
| Wochenziel Soll | `company_settings.wochenziel` (oder Default 25) | 25 |
| Status-Pill | Termintreue < 80% → HANDLUNGSBEDARF (rot), 80–90% → BEOBACHTEN (gelb), >90% → STABIL (grün) | neutral |
| Stationsleiste | `v_analyse_engpass` → je Station Punkt-Farbe | alle grau |
| Donut rechts | Score aus Performance-Spec (Termintreue 25%, Durchlaufzeit 20%, …) | „–" |

### 3.3 Drill-Down `WerkstattPulsOverlay.tsx`

Visuell wie Screenshot 2 (WerkstattPuls · Termintreue), aber echt:

**Tab-Leiste:** Tag | **Woche** | Monat | Quartal

**Abschnitt A — Hero:**
- „WIE PÜNKTLICH LIEFERST DU" → `termintreue_pct` %
- Trend-Pill (▼ −9 Pkt. vs. Vorjahr) aus Snapshots
- KW-Nummer + „Tendenz fallend seit X Wochen" (berechnet aus letzten 4 Snapshots)
- Mini-Sparkline rechts (Trend-Richtung)

**Abschnitt B — Termintreue im Zeitverlauf:**
- Recharts AreaChart: X = KW, Y = Termintreue %
- Aktuelle Werte: blaue Fläche (aus `kpi_snapshots` WHERE kpi_key='termintreue', periode='woche')
- Vorjahr: gestrichelte Linie (Snapshots −52 Wochen, wenn vorhanden)
- „So liest du das"-Hinweisbox darunter

**Abschnitt C — Durchlaufzeit pro Station:**
- Liste aus `v_analyse_station_durchlauf`, sortiert nach avg_tage DESC (langsamste oben)
- Pro Zeile: Stationsname | avg_tage + „Engpass: X Aufträge im Stau" (aus `teile_aktuell`) | Wartung-Hinweis falls relevant
- Leerzustand: „Noch keine Stationsdaten erfasst. Stationswechsel-Events werden ab dem ersten echten Durchlauf gesammelt."

**Abschnitt D — KI-Einschätzung:**
→ siehe Abschnitt 5

---

## 4 · WOCHENZIEL — WOHER KOMMT DIE SOLL-ZAHL?

Das Wochenziel (z.B. 25) muss konfigurierbar sein, nicht hardcoded:

```sql
-- Prüfen ob company_settings ein Feld hat:
SELECT column_name FROM information_schema.columns
WHERE table_name = 'company_settings';
```

**Option A:** `company_settings` hat ein jsonb-Feld → Wochenziel dort als `{"wochenziel": 25}`.
**Option B:** Eigenes Feld `wochenziel` in `company_settings` anlegen (integer, default 25).

Antigravity prüft zuerst, was `company_settings` bietet, und wählt die passende Option. In der Analyse-UI ein kleines Zahnrad-Icon neben dem Wochenziel → öffnet Admin-Modal zum Ändern (nur für Admin-Rolle).

---

## 5 · KI-EINSCHÄTZUNG (ECHT, KEIN MOCK)

### 5.1 Supabase Edge Function `kpi-insight`

```
Pfad: supabase/functions/kpi-insight/index.ts
```

**Input (POST body):**
```json
{
  "kachel": "werkstatt-puls",
  "daten": {
    "termintreue_pct": 76,
    "trend_vorjahr": -9,
    "durchlaufzeit_avg": 9.4,
    "schwachste_station": "schleifen",
    "teile_im_stau": 14,
    "wochenziel_ist": 23,
    "wochenziel_soll": 25
  }
}
```

**Logik:**
1. Function liest API-Key aus Supabase Secrets (NICHT aus Frontend, NICHT aus .env.local).
2. Baut System-Prompt: „Du bist Betriebsberater für einen Galvanik-Meisterbetrieb. Antworte auf Deutsch, maximal 3 Sätze: 1 Beobachtung, 1 Achtung-Hinweis (optional), 1 konkrete Empfehlung. Keine Fachbegriffe, die ein Handwerksmeister ohne PC-Kenntnisse nicht versteht. Keine erfundenen Zahlen — nur die übergebenen Werte verwenden."
3. Sendet an Modell, gibt JSON zurück: `{ beobachtung, achtung, empfehlung }`

**Fehlerfall:** Function nicht erreichbar oder Timeout → Frontend zeigt: „KI-Einschätzung gerade nicht verfügbar" (LeerzustandHinweis-Komponente). KEINE erfundene Empfehlung.

**Key-Management:**
```powershell
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
# NICHT in .env.local, NICHT in Vercel Environment
```

### 5.2 Frontend-Integration

```ts
// useKiInsight.ts
export function useKiInsight(kachel: string, daten: Record<string, number | string | null>) {
  return useQuery({
    queryKey: ['ki-insight', kachel, JSON.stringify(daten)],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('kpi-insight', {
        body: { kachel, daten },
      });
      if (error) throw error;
      return data as { beobachtung: string; achtung?: string; empfehlung: string };
    },
    staleTime: 5 * 60_000, // 5 Min — KI muss nicht bei jedem Render neu laufen
    retry: 1,
  });
}
```

---

## 6 · UNIVERSALSUCHE — DAS GEHIRN DER APP

Die Suchleiste (oben in der App, bereits visuell vorhanden) muss ALLES durchsuchen. Jede Eingabe + Enter liefert Treffer oder Trefferliste. Suche ist keine eigene Kachel, sondern Querschnittsfunktion.

### 6.1 Was durchsucht wird

| Entität | Suchfelder | Ergebnis-Anzeige |
|---------|-----------|-----------------|
| Aufträge | `order_number`, `title` | A-2026-0042 · Stoßstange W113 |
| Kunden | `first_name`, `last_name`, `company_name`, `email` | Mustermann · Autohaus Meier |
| Teile | `items.name`, `items.material` | T-01 Stoßstangenmittelteil · Stahl |
| Stationen | Stationsname → filtert Auftragsübersicht | Schleifen → 14 Teile aktuell |
| Rechnungen | `ausgangsrechnung.id` oder Rechnungsnummer | RE-2026-0012 · 890 € |
| KPI-Begriff | „Termintreue", „Durchlaufzeit", „Marge" | → springt zur entsprechenden Kachel auf Analyse |

### 6.2 Technisch

Supabase `textSearch` oder Postgres `to_tsvector` / `ts_query`. Für MVP reicht ein `ILIKE`-Multi-Table-Query mit UNION:

```sql
CREATE OR REPLACE FUNCTION search_global(query text)
RETURNS TABLE (typ text, id text, label text, sublabel text) AS $$
  SELECT 'auftrag', id, order_number, title FROM orders
    WHERE order_number ILIKE '%' || query || '%' OR title ILIKE '%' || query || '%'
  UNION ALL
  SELECT 'kunde', id, coalesce(company_name, first_name || ' ' || last_name), email FROM customers
    WHERE company_name ILIKE '%' || query || '%' OR last_name ILIKE '%' || query || '%'
      OR first_name ILIKE '%' || query || '%' OR email ILIKE '%' || query || '%'
  UNION ALL
  SELECT 'teil', id, name, material FROM items
    WHERE name ILIKE '%' || query || '%' OR material ILIKE '%' || query || '%'
  LIMIT 20;
$$ LANGUAGE sql STABLE;
```

**Später (>500 Datensätze):** `pg_trgm`-Extension + GIN-Index für Performance. Für jetzt reicht ILIKE.

### 6.3 Frontend

- Suchleiste im Top-Bar (vermutlich schon vorhanden als UI-Element).
- `useGlobalSearch(query)` Hook mit Debounce (300ms).
- Ergebnis als Dropdown mit Typ-Icon (Auftrag, Kunde, Teil, …).
- Klick → navigiert zur Detailseite/Overlay.
- KPI-Begriffe (hardcoded Map: „Termintreue" → `/analyse#werkstatt-puls`) als Sonderfall.

---

## 7 · COCKPIT → ANALYSE MIGRATION (Überblick, nicht jetzt bauen)

Was aus Cockpit (Screenshot 5) nach Analyse wandert:

| Cockpit-Kachel | Ziel-Kachel in Analyse | Priorität |
|---|---|---|
| Top Kunden (nach DB) | Kunden & Markt (Kachel 5) | mittel |
| Engpass-Heatmap | **Werkstatt-Puls** (Stationsleiste + Drill-Down C) | **in dieser Spec** |
| Forderungen-Aging | Umsatz & Marge (Kachel 2) | hoch |
| Forecast & Pipeline | Umsatz & Marge (Kachel 2) | hoch |
| Auftrags-DB-Ranking | Umsatz & Marge (Kachel 2) | mittel |
| Frühwarnungen (KI) | eigene Kachel 8 | niedrig |
| Was-wäre-wenn | eigene Kachel 7 | niedrig |
| Monatsumsatz / DB / Marge / Liquidität (Header-KPIs) | Umsatz & Marge Hero-Zeile | hoch |

**In dieser Spec bereits enthalten:** Engpass-Heatmap → `v_analyse_engpass` + Stationsleiste in WerkstattPulsTile.

---

## 8 · AKZEPTANZKRITERIEN

| Nr | Kriterium | Prüfmethode |
|----|----------|-------------|
| 1 | `kpi_snapshots`-Tabelle existiert auf Supabase | SQL: `SELECT * FROM kpi_snapshots LIMIT 1;` |
| 2 | Alle 5 Views existieren und liefern Daten (oder korrekt NULL) | SQL: `SELECT * FROM v_analyse_termintreue;` etc. |
| 3 | `search_global` Function existiert und liefert Ergebnisse | SQL: `SELECT * FROM search_global('Stoß');` |
| 4 | WerkstattPulsTile zeigt Hero-Termintreue aus View (DB-Wert = UI-Wert) | Browser + DB vergleichen |
| 5 | Kein Import aus `mockData` in gesamtem `features/analyse/` Ordner | `grep -r "mockData" src/features/analyse/` = leer |
| 6 | Leerzustand: bei 0 abgeschlossenen Aufträgen zeigt Kachel „Noch keine Daten" | DB leeren, Seite laden |
| 7 | Drill-Down-Overlay öffnet, zeigt Stationsliste (echt oder Leerzustand) | Klick auf Kachel |
| 8 | KI-Einschätzung: Edge Function `kpi-insight` deployed, liefert deutsch | `curl` Edge Function |
| 9 | KI-Fehlerfall: Function offline → „nicht verfügbar", keine erfundene Empfehlung | Function stoppen, Seite laden |
| 10 | Suchleiste: „A-2026" + Enter → Auftragstreffer | Eingabe testen |
| 11 | Suchleiste: „Termintreue" + Enter → springt zu Werkstatt-Puls | Eingabe testen |
| 12 | Keine Berechnung in TS/TSX-Dateien — nur View-Werte anzeigen | Code-Review |
| 13 | Navigation/Sidebar unverändert | Visueller Vergleich |

---

## 9 · ANTI-DRIFT / STOPP-BEDINGUNGEN

1. **Eine Kachel nach der anderen.** Werkstatt-Puls fertig + Akzeptanz bestanden → DANN Spec 44 (Umsatz & Marge).
2. **Kein Mock im Code-Pfad.** Seed-Daten für Demo OK, aber klar als Seed markiert und löschbar.
3. **Keine Berechnung im Frontend.** Termintreue wird in der View berechnet, nicht in React.
4. **Keine `any`-Casts.** TypeScript-Typen für View-Ergebnisse definieren.
5. **Nach jeder Migration:** `npx supabase db push` → `NOTIFY pgrst, 'reload schema'` → auf Supabase verifizieren.
6. **Navigation/Sidebar NICHT anfassen.** Cockpit-Route bleibt bis alle Kacheln migriert.
7. **Git manuell.** Antigravity committet nicht.
8. **STOPP wenn:** View liefert Fehler, Tabelle fehlt, Edge Function deployed nicht, Spaltenname weicht von Übergabe ab → melden, nicht umgehen.
9. **Tabellennamen aus Übergabe sind Gesetz:** `items` (nicht order_items), `events` (nicht status_events), `promised_due_date` (nicht zugesagt_am), `completed_date` (nicht geliefert_am), `arbeitszeit_buchung.auftrag_id` (nicht order_id).
10. **Deutsche Spaltennamen NICHT umbenennen** — Drizzle-Mapping.

---

## 10 · REIHENFOLGE FÜR ANTIGRAVITY

```
Phase 1 — DB
  1.1  Migration: kpi_snapshots Tabelle
  1.2  Migration: 5 Views (v_analyse_termintreue, _durchlaufzeit, _station_durchlauf, _wochenziel, _engpass)
  1.3  Migration: search_global Function
  1.4  npx supabase db push → NOTIFY → verifizieren
  1.5  Seed: 3–5 Testaufträge mit promised_due_date + completed_date + STATION_EINGANG/AUSGANG Events

Phase 2 — Edge Function
  2.1  supabase/functions/kpi-insight/index.ts erstellen
  2.2  Secret setzen (npx supabase secrets set)
  2.3  Deployen (npx supabase functions deploy kpi-insight)
  2.4  Testen (curl)

Phase 3 — Frontend
  3.1  Ordnerstruktur anlegen (features/analyse/…)
  3.2  Shared Components (KachelShell, OverlayShell, KpiMiniCard, LeerzustandHinweis, KiEinschaetzung)
  3.3  useWerkstattPuls Hook
  3.4  WerkstattPulsTile
  3.5  WerkstattPulsOverlay + TermintreueChart + StationDurchlaufList
  3.6  useKiInsight Hook + Integration in Overlay
  3.7  useGlobalSearch Hook + Suchleiste-Anbindung

Phase 4 — Verifikation
  4.1  Alle 13 Akzeptanzkriterien durchlaufen
  4.2  Ergebnis als Tabelle ausgeben
  4.3  STOPP — auf Freigabe warten vor Kachel 2
```

Zwischen Phasen: kein Parallelstart. Phase 1 fertig → Phase 2. Nicht gleichzeitig.
