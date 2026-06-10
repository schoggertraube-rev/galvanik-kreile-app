# SPEC 45 · UNIVERSELLE KUNDENKARTE + NACHARBEIT KACHEL 1

> Version: 1.0 · 10.06.2026
> Voraussetzung: SPEC 43 (Werkstatt-Puls) deployed. Visuelle Referenz: `kundenkarte_v1_CI.html` im Projekt.
> Referenz-Dokument: `43_UNIVERSELLE_KUNDENKARTE.md` — enthält das vollständige Link-Inventar, Overlay-Struktur, KPI-Drill-Downs, Quick Actions und automatische Trigger. Dieses Dokument ist PFLICHTLEKTÜRE vor Build-Start.
> Dev: Antigravity + PowerShell · Stack: Next.js App Router, Supabase, Drizzle, Recharts, Framer Motion

---

## 0 · NACHARBEIT KACHEL 1 — MOCKDATA ENTFERNEN

**Befund:** `src/features/analyse/kacheln/werkstatt-puls/TermintreueChart.tsx` Zeile 12 enthält `const mockData = [...]` und Zeile 23 nutzt diesen Array als Chart-Daten. Das verletzt die Live-Data-Policy.

**Fix (Phase 0, VOR allem anderen):**

1. `TermintreueChart.tsx` öffnen
2. `const mockData = [...]` Array komplett entfernen
3. Chart-Daten durch Props ersetzen, die aus `kpi_snapshots` kommen:

```tsx
// TermintreueChart.tsx — KORREKTUR
interface TermintreueChartProps {
  data: Array<{ kw: string; wert: number | null; vorjahr?: number | null }>;
}

export function TermintreueChart({ data }: TermintreueChartProps) {
  if (!data || data.length === 0) {
    return <LeerzustandHinweis text="Noch keine Verlaufsdaten. Wird ab der ersten vollständigen Woche aufgebaut." />;
  }
  return (
    <AreaChart data={data} ...>
      {/* blaue Fläche = aktuelle Termintreue */}
      {/* gestrichelte Linie = Vorjahr (wenn vorhanden) */}
    </AreaChart>
  );
}
```

4. Im `WerkstattPulsOverlay.tsx` die Daten aus `kpi_snapshots` laden:

```tsx
// In useWerkstattPuls.ts oder separater Hook
const { data: snapshots } = useQuery({
  queryKey: ['kpi-snapshots', 'termintreue', 'woche'],
  queryFn: async () => {
    const { data } = await supabase
      .from('kpi_snapshots')
      .select('periode_start, wert, meta')
      .eq('kpi_key', 'termintreue')
      .eq('periode', 'woche')
      .order('periode_start', { ascending: true })
      .limit(12); // letzte 12 Wochen
    return data;
  }
});
```

5. **Verifizierung:** `Select-String -Path "src\features\analyse\kacheln\werkstatt-puls\TermintreueChart.tsx" -Pattern "mockData"` → muss leer sein.

**Wenn noch keine Snapshots in `kpi_snapshots` existieren:** Chart zeigt Leerzustand, NICHT den alten mockData-Array. Das ist korrekt.

---

## 1 · KERNREGEL DER KUNDENKARTE

**Eine einzige `CustomerTile.tsx`. Eine einzige `CustomerOverlay.tsx`. Überall in der App identisch.**

Klick auf Kundenname, Kundenkachel oder Kunden-Pill — egal wo — öffnet IMMER dasselbe zentrierte Overlay. Keine Kopien, keine Varianten, keine vereinfachten Versionen.

---

## 2 · DB-MIGRATIONEN

### 2.0 Schema-Prüfung ZUERST

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'customers' ORDER BY ordinal_position;
```

Ergebnis dokumentieren, DANN entscheiden welche Spalten fehlen.

### 2.1 Neue Spalten `customers`

```sql
-- Migration: 20260610_customers_kundenkarte.sql
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS shipping_preference text DEFAULT 'abholung',
  ADD COLUMN IF NOT EXISTS payment_preference text DEFAULT 'rechnung_14',
  ADD COLUMN IF NOT EXISTS classification text DEFAULT 'B',
  ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS internal_notes text;
```

### 2.2 Email-Templates prüfen/anlegen

```sql
-- Prüfen ob email_templates existiert:
SELECT column_name FROM information_schema.columns WHERE table_name = 'email_templates';

-- Wenn ja: Seed-Templates
INSERT INTO email_templates (tenant_id, template_key, subject, body_html, body_text) VALUES
  ('galvanik-kreile', 'zahlungserinnerung', 'Zahlungserinnerung – {auftragsnummer}',
   '<p>Sehr geehrte/r {kunde_name},</p><p>die Rechnung {rechnungsnummer} über {betrag} € ist seit {tage} Tagen offen. Wir bitten um zeitnahe Überweisung.</p>',
   'Sehr geehrte/r {kunde_name}, die Rechnung {rechnungsnummer} über {betrag} € ist seit {tage} Tagen offen.'),
  ('galvanik-kreile', 'mahnung', 'Mahnung – {rechnungsnummer}',
   '<p>Sehr geehrte/r {kunde_name},</p><p>trotz unserer Erinnerung ist die Rechnung {rechnungsnummer} weiterhin offen.</p>',
   'Sehr geehrte/r {kunde_name}, trotz unserer Erinnerung ist die Rechnung {rechnungsnummer} weiterhin offen.')
ON CONFLICT DO NOTHING;
```

**Wenn `email_templates` NICHT existiert:** Tabelle anlegen:

```sql
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  template_key text NOT NULL,
  subject text NOT NULL,
  body_html text,
  body_text text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (tenant_id, template_key)
);
```

### 2.3 View für Kunden-KPIs

```sql
CREATE OR REPLACE VIEW v_analyse_kunden_kpi AS
SELECT
  c.id AS customer_id,
  coalesce(c.company_name, c.first_name || ' ' || c.last_name) AS kunde,
  c.classification,
  c.created_at AS kunde_seit,
  -- Umsatz LTV
  coalesce((
    SELECT sum(ar.brutto_eur) FROM ausgangsrechnung ar
    JOIN orders o ON o.id = ar.order_id
    WHERE o.customer_id = c.id AND ar.status != 'storniert'
  ), 0) AS umsatz_ltv,
  -- Gewinn LTV (Erlös − Material − Arbeitszeit)
  coalesce((
    SELECT sum(i.preis_netto) FROM items i
    JOIN orders o ON o.id = i.order_id WHERE o.customer_id = c.id
  ), 0)
  - coalesce((
    SELECT sum(cu.quantity * cu.unit_cost_eur) FROM consumable_uses cu
    JOIN orders o ON o.id = cu.order_id WHERE o.customer_id = c.id
  ), 0)
  - coalesce((
    SELECT sum(az.dauer_minuten / 60.0 * az.kostensatz_eur_pro_stunde) FROM arbeitszeit_buchung az
    JOIN orders o ON o.id = az.auftrag_id WHERE o.customer_id = c.id
  ), 0) AS gewinn_ltv,
  -- Offene Posten
  coalesce((
    SELECT sum(ar.brutto_eur) FROM ausgangsrechnung ar
    JOIN orders o ON o.id = ar.order_id
    WHERE o.customer_id = c.id AND ar.bezahlt_am IS NULL AND ar.status NOT IN ('storniert', 'bezahlt')
  ), 0) AS offene_posten,
  -- Aktive Aufträge
  (SELECT count(*) FROM orders o WHERE o.customer_id = c.id AND o.status NOT IN ('abgeschlossen', 'storniert')) AS aktive_auftraege,
  -- Pünktlichkeit
  CASE WHEN (SELECT count(*) FROM orders o WHERE o.customer_id = c.id AND o.completed_date IS NOT NULL AND o.promised_due_date IS NOT NULL) > 0
    THEN round(
      (SELECT count(*) FROM orders o WHERE o.customer_id = c.id AND o.completed_date <= o.promised_due_date AND o.completed_date IS NOT NULL AND o.promised_due_date IS NOT NULL)
      * 100.0
      / (SELECT count(*) FROM orders o WHERE o.customer_id = c.id AND o.completed_date IS NOT NULL AND o.promised_due_date IS NOT NULL)
    , 1)
    ELSE NULL
  END AS puenktlichkeit_pct,
  -- Reklamationen
  coalesce((SELECT count(*) FROM complaints co JOIN orders o ON o.id = co.order_id WHERE o.customer_id = c.id), 0) AS reklamationen
FROM customers c;
```

---

## 3 · FRONTEND — KOMPONENTEN

```
src/components/customers/
  CustomerTile.tsx              ← Kompaktkachel (Name, Firma, aktive Aufträge, Badge)
  CustomerOverlay.tsx           ← Hauptoverlay (zweispaltig wie OrderOverlay)
  CustomerHeader.tsx            ← Name, Firma, Pills, Gradient-Stripe
  CustomerKpiRow.tsx            ← 5 KPIs, jede klickbar → Sub-Drill-Down
  CustomerStammdaten.tsx        ← editierbare Felder
  CustomerAuftraege.tsx         ← aktive + abgeschlossene Aufträge
  CustomerZahlungen.tsx         ← Zahlungshistorie mit Status-Pills
  CustomerQuickActions.tsx      ← E-Mail, Anrufen, Neuer Auftrag, Rechnung, Reklamation
  CustomerKommHistorie.tsx      ← Zeitstrahl rechte Spalte
  CustomerTagEditor.tsx         ← Freitext-Chips, JSONB
  useCustomerOverlay.ts         ← globaler State: openCustomer(id), closeCustomer()
  useCustomerKpi.ts             ← Query-Hook für v_analyse_kunden_kpi
```

### 3.1 Globaler Overlay-State

```tsx
// useCustomerOverlay.ts — globaler Zustand (Zustand/Jotai/Context)
// EINE Instanz, ÜBERALL nutzbar

export function useCustomerOverlay() {
  const [customerId, setCustomerId] = useState<string | null>(null);
  const open = (id: string) => setCustomerId(id);
  const close = () => setCustomerId(null);
  return { customerId, open, close, isOpen: !!customerId };
}
```

Dieser Hook muss in einem Provider sitzen, der die gesamte App umschließt — so kann jede Stelle `openCustomer(id)` aufrufen.

### 3.2 Sub-Overlay Stack (LIFO)

Wenn aus dem CustomerOverlay ein OrderOverlay geöffnet wird (Klick auf Auftrag), öffnet sich das OrderOverlay ALS Sub-Overlay über dem CustomerOverlay. ESC schließt nur das oberste. Zurück-Button geht zurück zum CustomerOverlay.

---

## 4 · TRIGGER-STELLEN (WO KUNDENKARTE ANGEBUNDEN WIRD)

| Ort | Datei (ungefähr) | Aktion |
|-----|-----------------|--------|
| OrderOverlay → Kunden-Pill | `OrderOverlay.tsx` | `onClick={() => openCustomer(order.customer_id)}` |
| OrderOverlay → Kunden-KPI-Zeile | `OrderOverlay.tsx` | jede KPI klickbar |
| Auftragsbuch → Kundenname in Zeile | Auftragsbuch-Komponente | Klick → `openCustomer` |
| Kundenkartei `/customers` | `/customers/page.tsx` | Klick auf Zeile → `openCustomer` |
| **Analyseseite → Top 5 Kunden** (Kachel 2) | `TopKundenListe.tsx` | Klick auf Kundenname → `openCustomer` |
| **Analyseseite → Forderungen-Aging** | `ForderungenAging.tsx` | Klick auf Kundenname → `openCustomer` |
| Globale Suche → Kunden-Treffer | `SearchResults` | Klick → `openCustomer` |
| Buchhaltung → Rechnungsempfänger | Buchhaltungs-Komponente | Klick → `openCustomer` |
| Warenausgang → Kundenname | Warenausgangs-Komponente | Klick → `openCustomer` |
| Kommunikationszentrale | Komm-Komponente | Klick → `openCustomer` |

**Nicht alle Trigger-Stellen müssen sofort angebunden werden.** Priorität:

| Prio | Trigger | Warum |
|------|---------|-------|
| P1 (jetzt) | OrderOverlay, Kundenkartei, Globale Suche, Analyseseite | Core-Funktionalität |
| P2 (mit Spec 44) | Forderungen-Aging, Top-Kunden | Teil von Umsatz & Marge |
| P3 (später) | Buchhaltung, Kommunikationszentrale, Warenausgang | eigene Specs |

---

## 5 · VERNETZUNG MIT ANALYSE

### 5.1 search_global erweitern

`search_global` (aus Spec 43) liefert bereits Kunden-Treffer. Diese müssen im Frontend beim Klick `openCustomer(id)` aufrufen statt zu einer Seite zu navigieren.

### 5.2 Analyse → Kundenkarte

In **Spec 44** (Umsatz & Marge) werden `TopKundenListe.tsx` und `ForderungenAging.tsx` gebaut. Beide enthalten Kundennamen. Diese Namen müssen ein `onClick={() => openCustomer(customer_id)}` haben. Das funktioniert nur, wenn der CustomerOverlay-Provider oberhalb der Analyse-Seite liegt.

**Architektur-Hinweis an Antigravity:** Der `CustomerOverlayProvider` muss in `layout.tsx` (App-Level) sitzen, NICHT in einzelnen Seiten. Sonst funktioniert das Overlay nur auf der Kundenkartei-Seite.

---

## 6 · AKZEPTANZKRITERIEN

| Nr | Kriterium | Prüfmethode |
|----|----------|-------------|
| 1 | mockData in TermintreueChart.tsx entfernt | `Select-String -Path "src\features\analyse\*" -Recurse -Include "*.ts*" \| Select-String "mockData"` = leer |
| 2 | TermintreueChart zeigt Leerzustand wenn keine Snapshots | kpi_snapshots leeren, Overlay öffnen |
| 3 | `customers`-Tabelle hat neue Spalten (shipping_preference, payment_preference, classification, tags, internal_notes) | SQL: `SELECT column_name FROM information_schema.columns WHERE table_name='customers';` |
| 4 | `v_analyse_kunden_kpi` existiert und liefert Daten | SQL: `SELECT * FROM v_analyse_kunden_kpi LIMIT 3;` |
| 5 | `CustomerOverlay` öffnet sich identisch von OrderOverlay, Kundenkartei und Globaler Suche | 3x testen: gleiche Darstellung |
| 6 | KPIs im Overlay (Umsatz LTV, Gewinn LTV, Offene Posten, Pünktlichkeit, Reklamation) zeigen echte View-Werte | DB-Werte vergleichen |
| 7 | CustomerOverlayProvider liegt in App-Layout (nicht in Einzelseite) | Code-Check: `layout.tsx` |
| 8 | Sub-Overlay Stack: Auftrag aus Kundenkarte öffnen → ESC schließt nur Auftrag, Kundenkarte bleibt | Klick-Test |
| 9 | Kein `mockData`-Import in gesamtem `components/customers/` | grep |
| 10 | Classification (A/B/C) änderbar im Header-Badge | Klick auf Badge → Dropdown → speichern → DB prüfen |
| 11 | Tags editierbar und als JSONB gespeichert | Tag hinzufügen → DB prüfen |
| 12 | Navigation/Sidebar unverändert | Sichtprüfung |

---

## 7 · ANTI-DRIFT / STOPP

1. **EINE Komponente, ÜBERALL.** Keine „vereinfachte Kundenkarte" an einzelnen Stellen.
2. **CustomerOverlayProvider in App-Layout.** Nicht in Einzelseiten.
3. **Kein Mock.** View-Daten oder Leerzustand.
4. **`arbeitszeit_buchung.auftrag_id`** (nicht order_id) in der Kunden-KPI-View.
5. **Sub-Overlay Stack darf nicht die gesamte Navigation brechen.** ESC-Logik sauber implementieren.
6. **Navigation NICHT anfassen.**
7. **Git manuell.**
8. **STOPP bei:** `email_templates` existiert nicht und soll angelegt werden → erst prüfen, dann anlegen, nicht annehmen.

---

## 8 · REIHENFOLGE FÜR ANTIGRAVITY

```
Phase 0 — Nacharbeit Kachel 1 (ZUERST)
  0.1  mockData aus TermintreueChart.tsx entfernen
  0.2  Chart auf Props umstellen (kpi_snapshots oder Leerzustand)
  0.3  Verifikation: grep mockData = leer

Phase 1 — DB
  1.0  Schema customers prüfen (information_schema)
  1.1  Migration: neue Spalten customers
  1.2  Schema email_templates prüfen → anlegen falls nötig + Seed
  1.3  View v_analyse_kunden_kpi anlegen
  1.4  npx supabase db push → NOTIFY → verifizieren

Phase 2 — Frontend Core
  2.1  CustomerOverlayProvider in App-Layout einbauen
  2.2  useCustomerOverlay Hook (globaler State)
  2.3  useCustomerKpi Hook
  2.4  CustomerOverlay.tsx (Hauptstruktur, zweispaltig)
  2.5  CustomerHeader, CustomerKpiRow, CustomerStammdaten
  2.6  CustomerAuftraege, CustomerZahlungen
  2.7  CustomerQuickActions, CustomerKommHistorie
  2.8  CustomerTagEditor
  2.9  Sub-Overlay Stack (LIFO-Logik)

Phase 3 — Trigger-Anbindung P1
  3.1  OrderOverlay → Kunden-Pill: openCustomer
  3.2  Kundenkartei /customers: Klick → openCustomer
  3.3  Globale Suche: Kunden-Treffer → openCustomer
  3.4  Analyse-Seite (soweit Komponenten existieren) → openCustomer

Phase 4 — Verifikation
  4.1  Alle 12 Akzeptanzkriterien (ORIGINAL aus Abschnitt 6!)
  4.2  Ergebnis als Tabelle
  4.3  STOPP — Freigabe warten

Zwischen Phasen: kein Parallelstart.
```
