# SPEC 45 · KUNDENKARTE & KUNDENKARTEI — VOLLSTÄNDIG (LIVE, VERNETZT)

> Version: 2.0 · 10.06.2026 · ersetzt SPEC 45 v1.0
> Quellen: `43_UNIVERSELLE_KUNDENKARTE.md`, `KUNDENKARTEI_RECHERCHE_KOMPILATION.md`, `KREILE_RECHERCHE_KUNDENKARTE_KUNDENKARTEI.md`, `kundenkarte_v1_CI.html`, Übergabe-DB-Stand.
> Visuelle Referenz: `kundenkarte_v2_CI.html` (in dieser Spec aktualisiert).
> Entscheidung Siglinder: **Variante A** — alle 6 Erweiterungstabellen jetzt anlegen. **Overlay + Vollseite**, beide aus denselben Komponenten.
> Dev: Antigravity + PowerShell · Stack: Next.js App Router, Supabase, Drizzle, Recharts, Framer Motion
> Tabellennamen-Disziplin: Übergabe ist Gesetz. Deutsche Spalten NICHT umbenennen.

---

## 0 · LEITBILD

Die Kundenkarte ist das **Werkstattgedächtnis**. Kein Adressbuch. Ein Mitarbeiter sieht in 3 Sekunden: Wer ist der Kunde, was wurde früher gemacht, welche Preise/Risiken/Reklamationen gab es, wie zahlt und kommuniziert er, was ist die nächste sinnvolle Aktion.

**Vier eiserne Regeln:**
1. **Eine** `CustomerTile.tsx`, **eine** `CustomerOverlay.tsx`, **eine** `/customers/[id]`-Vollseite. Alle teilen dieselben Sektions-Komponenten. Keine zweite Kunden-Detail-Implementierung irgendwo.
2. **Kein Mock, kein `Math.random`, keine Fake-FKs.** Leere Tabelle → „Noch keine Einträge erfasst".
3. **Keine Sackgasse.** Jede Zahl, jeder Name, jede KPI ist anklickbar und führt zu echtem Inhalt oder einer nächsten Aktion.
4. **Alles im Kreislauf.** Was die Kundenkarte zeigt, stammt aus echten Tabellen; was sie ändert, fließt zurück und wirkt auf Analyse + Buchhaltung.

---

## 1 · ABGRENZUNG — WAS GEHÖRT WOHIN (Anti-Doppelung)

Die Kundenkarte **besitzt** manche Daten, **zeigt** andere nur und **verlinkt** dorthin. Diese Trennung ist verbindlich, damit nichts doppelt gebaut wird.

| Inhalt | Besitzende Stelle (CRUD) | Kundenkarte tut | Verlinkt nach |
|--------|--------------------------|-----------------|---------------|
| Stammdaten, Kontaktpersonen, techn. Profil, Preisabsprachen, Komm-Präferenz, Zahlungs-/Freigabeprofil, Tags, interne Notizen, Insights | **Kundenkarte** | anlegen/bearbeiten/anzeigen | — |
| Aufträge, Teile, Stationen | `orders`/`items` (Auftragsmodul) | anzeigen, Status, Historie | OrderOverlay |
| Rechnungen, Zahlungen | `ausgangsrechnung`/`payments` (Buchhaltung) | Status + Summen + Drill-Down anzeigen, Erinnerung auslösen | Buchhaltungsseite, InvoiceOverlay |
| Reklamationen (Bearbeitung) | `complaints` (Qualität/OrderOverlay) | Quote + Liste anzeigen | OrderOverlay → Reklamation |
| Umsatz-/Marge-/Zielgruppen-Gesamtanalyse | **Analyseseite** (Kachel 2/5/6) | nur kundenspezifischen Ausschnitt zeigen | Analyseseite |
| OCR/Kunden-Matching beim Wareneingang | Wareneingang-Flow (eigene Spec) | Ergebnis übernehmen (neuer/bestehender Kunde) | — |
| Ähnliche-Aufträge-Vorschlag beim Anlegen | Auftragsanlage-Flow | Historie als Datenquelle bereitstellen | Auftragsanlage |
| Marketing-Kampagnen | Analyse-Kachel 6 | Zielgruppenfit-Flag + Reaktivierungs-Aktion | Analyse-Kachel 6 |
| Telefonnotizen (Erfassung) | `phone_notes` + Kommzentrale (eigene Spec) | im Zeitstrahl anzeigen, Zuordnung bestätigen | Kommzentrale |

**Regel für Antigravity:** Wenn ein Inhalt „besitzende Stelle ≠ Kundenkarte" hat, baut die Kundenkarte **nur Anzeige + Klick-Weiterleitung**, keine eigene Bearbeitungslogik.

---

## 2 · DATENMODELL — ALLE 6 ERWEITERUNGSTABELLEN

### 2.0 Pflicht-Vorprüfung (Phase 1.0, vor jeder Migration)

```sql
-- a) customers Ist-Zustand
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'customers' ORDER BY ordinal_position;

-- b) tenant_id auf customers vorhanden?
SELECT EXISTS (SELECT 1 FROM information_schema.columns
  WHERE table_name='customers' AND column_name='tenant_id') AS hat_tenant;

-- c) phone_notes vorhanden?
SELECT EXISTS (SELECT 1 FROM information_schema.tables
  WHERE table_name='phone_notes') AS hat_phone_notes;

-- d) image_urls auf customers?
SELECT EXISTS (SELECT 1 FROM information_schema.columns
  WHERE table_name='customers' AND column_name='image_urls') AS hat_image_urls;
```

Ergebnis als Tabelle ausgeben. **STOPP** bis dokumentiert. Danach:
- Fehlt `tenant_id` auf `customers` → ergänzen (`ADD COLUMN IF NOT EXISTS tenant_id text DEFAULT 'galvanik-kreile'`).
- Alle neuen Tabellen bekommen `tenant_id text NOT NULL DEFAULT 'galvanik-kreile'`.

### 2.1 Erweiterung `customers`

```sql
-- Migration: 20260610_customers_kundenkarte.sql
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS tenant_id            text DEFAULT 'galvanik-kreile',
  ADD COLUMN IF NOT EXISTS customer_number      text,
  ADD COLUMN IF NOT EXISTS type                 text DEFAULT 'private',      -- private|business|institution|dealer|museum|church|oldtimer|gallery|restorer
  ADD COLUMN IF NOT EXISTS status               text DEFAULT 'normal',       -- normal|regular|vip|sensitive|blocked
  ADD COLUMN IF NOT EXISTS shipping_preference  text DEFAULT 'abholung',     -- abholung|versand|spedition
  ADD COLUMN IF NOT EXISTS payment_preference   text DEFAULT 'rechnung_14',  -- bar|karte|ueberweisung|qr|zahlungslink|rechnung_14|rechnung_30|vorkasse
  ADD COLUMN IF NOT EXISTS classification       text DEFAULT 'B',            -- A|B|C
  ADD COLUMN IF NOT EXISTS communication_preference text DEFAULT 'unknown',  -- phone|email|whatsapp|post|unknown
  ADD COLUMN IF NOT EXISTS communication_tone   text,                        -- kurz_sachlich|erklaerungsbeduerftig|formell|persoenlich
  ADD COLUMN IF NOT EXISTS language             text DEFAULT 'de',
  ADD COLUMN IF NOT EXISTS source               text,                        -- empfehlung|google|website|stammkunde|...
  ADD COLUMN IF NOT EXISTS tax_id               text,
  ADD COLUMN IF NOT EXISTS tags                 jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS internal_notes       text,
  ADD COLUMN IF NOT EXISTS image_urls           jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS approval_required_above_eur numeric,              -- Preisfreigabe ab Betrag
  ADD COLUMN IF NOT EXISTS approval_process     text;                        -- telefonisch|schriftlich|email|portal
```

Kundennummer-Format `K-YYYY-XXXX` (Jahr + 4-stellig inkrementell). Generierung serverseitig bei Anlage, nicht im Browser.

### 2.2 `customer_contacts` (mehrere Kontaktpersonen)

```sql
CREATE TABLE IF NOT EXISTS customer_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  customer_id text NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  email text,
  phone text,
  is_primary boolean DEFAULT false,
  is_billing_contact boolean DEFAULT false,
  is_technical_contact boolean DEFAULT false,
  is_approval_contact boolean DEFAULT false,
  preferred_channel text DEFAULT 'unknown',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contacts_customer ON customer_contacts(customer_id);
```

### 2.3 `customer_price_agreements` (Preis- und Angebotsgedächtnis)

```sql
CREATE TABLE IF NOT EXISTS customer_price_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  customer_id text NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  title text NOT NULL,
  scope text DEFAULT 'general',          -- general|surface|item_type|order|custom
  surface text,
  item_type text,
  price_net numeric,
  discount_percent numeric,
  minimum_price_net numeric,
  valid_from date,
  valid_until date,
  requires_approval boolean DEFAULT false,
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_price_customer ON customer_price_agreements(customer_id);
```

### 2.4 `customer_technical_profiles` (technisches Werkstattgedächtnis)

```sql
CREATE TABLE IF NOT EXISTS customer_technical_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  customer_id text NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  material text,
  surface text,
  item_type text,
  quality_expectation text DEFAULT 'normal',   -- normal|high|museum|technical|unclear
  recurring_item_name text,
  known_risk text,
  preparation_hint text,
  packaging_hint text,
  photo_ids jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_techprofile_customer ON customer_technical_profiles(customer_id);
```

### 2.5 `customer_communication_events` (Kommunikationsakte)

```sql
CREATE TABLE IF NOT EXISTS customer_communication_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  customer_id text NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id text REFERENCES orders(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES customer_contacts(id) ON DELETE SET NULL,
  channel text NOT NULL,                  -- phone|email|whatsapp|post|in_person|system
  direction text NOT NULL,                -- inbound|outbound|internal
  subject text,
  summary text NOT NULL,
  body_preview text,
  source text NOT NULL,                   -- phone_note|email|manual|system|draft
  status text,                            -- draft|sent|received|action_required
  follow_up_at timestamptz,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_commevent_customer ON customer_communication_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_commevent_order ON customer_communication_events(order_id);
```

### 2.6 `customer_quality_cases` (Reklamations-/Kulanzarchiv)

```sql
CREATE TABLE IF NOT EXISTS customer_quality_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  customer_id text NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id text REFERENCES orders(id) ON DELETE SET NULL,
  item_id text,
  type text NOT NULL,                     -- complaint|rework|goodwill|technical_limit|expectation_issue
  cause text,                             -- preparation|material|wrong_surface|communication|transport|unclear_expectation|technical_limit|other
  customer_affected boolean DEFAULT true,
  cost_net numeric,
  time_spent_minutes integer,
  resolution text,
  photo_ids jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qualcase_customer ON customer_quality_cases(customer_id);
```

> Hinweis: `complaints` (Übergabe) bleibt die operative Reklamationstabelle am Auftrag. `customer_quality_cases` ist die kundenweite Sicht inkl. Kulanz/technische Grenzen/Erwartungsprobleme — fachlich breiter. Beide koexistieren: `complaints` = pro Auftrag, `customer_quality_cases` = Kundengedächtnis. **Doppelerfassung vermeiden:** Wenn eine `complaint` angelegt wird, kann optional ein `customer_quality_case` mit `type='complaint'` + Verweis auf dieselbe order_id entstehen. Für jetzt: Kundenkarte zeigt beide Quellen gemerged im Reklamations-Tab, ohne Doppelzählung (DISTINCT über order_id+typ).

### 2.7 `customer_insights` — ALS VIEW, nicht als Tabelle

Insights werden **berechnet**, nie manuell gepflegt → immer aktuell, keine Sackgasse, kein Mock.

```sql
CREATE OR REPLACE VIEW v_customer_insights AS
SELECT
  c.id AS customer_id,
  -- Umsatz 12M
  coalesce((SELECT sum(ar.brutto_eur) FROM ausgangsrechnung ar
    JOIN orders o ON o.id = ar.order_id
    WHERE o.customer_id = c.id AND ar.status != 'storniert'
      AND ar.created_at >= now() - interval '12 months'), 0) AS revenue_12m,
  -- Marge 12M (Erlös − Material − Arbeitszeit)
  (
    coalesce((SELECT sum(i.preis_netto) FROM items i JOIN orders o ON o.id=i.order_id
      WHERE o.customer_id=c.id AND o.completed_date >= now() - interval '12 months'),0)
    - coalesce((SELECT sum(cu.quantity*cu.unit_cost_eur) FROM consumable_uses cu JOIN orders o ON o.id=cu.order_id
      WHERE o.customer_id=c.id AND o.completed_date >= now() - interval '12 months'),0)
    - coalesce((SELECT sum(az.dauer_minuten/60.0*az.kostensatz_eur_pro_stunde) FROM arbeitszeit_buchung az JOIN orders o ON o.id=az.auftrag_id
      WHERE o.customer_id=c.id AND o.completed_date >= now() - interval '12 months'),0)
  ) AS margin_12m,
  -- Auftragsanzahl 12M
  (SELECT count(*) FROM orders o WHERE o.customer_id=c.id
    AND o.created_at >= now() - interval '12 months') AS order_count_12m,
  -- Ø Durchlaufzeit
  (SELECT round(avg(extract(epoch FROM (o.completed_date - o.created_at))/86400.0)::numeric,1)
    FROM orders o WHERE o.customer_id=c.id AND o.completed_date IS NOT NULL) AS avg_throughput_days,
  -- Reklamationsquote
  CASE WHEN (SELECT count(*) FROM orders o WHERE o.customer_id=c.id AND o.status='abgeschlossen') > 0
    THEN round((SELECT count(*) FROM complaints co JOIN orders o ON o.id=co.order_id WHERE o.customer_id=c.id)::numeric
      * 100.0 / (SELECT count(*) FROM orders o WHERE o.customer_id=c.id AND o.status='abgeschlossen'),1)
    ELSE NULL END AS complaint_rate,
  -- Ø Zahlungsdauer
  (SELECT round(avg(extract(epoch FROM (p.paid_at - p.created_at))/86400.0)::numeric,1)
    FROM payments p JOIN orders o ON o.id=p.order_id
    WHERE o.customer_id=c.id AND p.status='succeeded' AND p.paid_at IS NOT NULL) AS avg_payment_delay_days,
  -- Inaktiv seit (Tage seit letztem Auftrag)
  (SELECT extract(day FROM now() - max(o.created_at))::int FROM orders o WHERE o.customer_id=c.id) AS inactive_days,
  -- Risk-Level abgeleitet
  CASE
    WHEN (SELECT count(*) FROM complaints co JOIN orders o ON o.id=co.order_id WHERE o.customer_id=c.id) >= 3 THEN 'high'
    WHEN coalesce((SELECT sum(ar.brutto_eur) FROM ausgangsrechnung ar JOIN orders o ON o.id=ar.order_id
      WHERE o.customer_id=c.id AND ar.bezahlt_am IS NULL AND ar.status NOT IN ('storniert','bezahlt')),0) > 1000 THEN 'medium'
    ELSE 'low'
  END AS risk_level
FROM customers c;
```

### 2.8 `email_templates` (für Trigger)

```sql
-- Prüfen, ggf. anlegen (wie SPEC 45 v1)
CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  template_key text NOT NULL,
  subject text NOT NULL,
  body_html text, body_text text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (tenant_id, template_key)
);
-- Seed: zahlungserinnerung, mahnung, verzoegerung, abholbereit, versandbereit
```

### 2.9 RLS für alle neuen Tabellen

```sql
-- Für jede neue Tabelle:
ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;
-- analog: price_agreements, technical_profiles, communication_events, quality_cases
-- Policy: eingeloggte Session liest/schreibt eigene tenant_id-Daten
-- KEINE Browser-Direktzugriffe auf Kernkundendaten → über Server Actions/Repository
```

---

## 3 · UI — OVERLAY + VOLLSEITE

### 3.1 Zwei Darstellungen, geteilte Komponenten

| Darstellung | Zweck | Inhalt |
|-------------|-------|--------|
| **CustomerOverlay** (zentriert, Blur-Backdrop) | schneller Blick, von überall | Kopfkarte, 5 KPIs, Überblick, aktuelle Aufträge, Quick Actions, Zeitstrahl (kurz) |
| **`/customers/[id]` Vollseite** | tiefe Arbeit | alle 11 Sektionen mit Tabs |

Beide nutzen dieselben Sektions-Komponenten. Overlay rendert eine Teilmenge, Vollseite alle. **Keine doppelte Logik.**

Im Overlay: Button „Ganze Akte öffnen" → navigiert zu `/customers/[id]`.

### 3.2 Kopfkarte (3-Sekunden-Regel)

```
┌─ Gradient-Stripe 4px ───────────────────────────────────┐
│ Museum Lenzburg                  [Institution] [Stammkunde]
│ K-2026-0018                      letzte Aktivität: 03.06.2026
│ Anna Beispiel · +49… · mail@…                            │
│ [⚡2 offen] [📋1 Freigabe offen] [✓keine offene Zahlung] │
│ Hinweis: bevorzugt E-Mail · Preisfreigabe schriftlich    │
└──────────────────────────────────────────────────────────┘
```

Statuschips (dynamisch, nur wenn zutreffend): Stammkunde, Institution, offene Freigabe, Rechnung offen, Reklamation in Historie, besondere Verpackung, technische Besonderheit, Zielkunde, hoher Aufwand, kritischer Kunde.

### 3.3 Die 11 Sektionen (Vollseite-Tabs; Overlay zeigt 1,2,6,8)

| # | Sektion | Quelle | Klick-Ziele |
|---|---------|--------|-------------|
| 1 | **Überblick** | `v_customer_insights` + offene Aufträge/Freigaben/Rechnungen | „Nächste Aktion"-Button |
| 2 | **Aktuelle Aufträge** | `orders WHERE status NOT IN (abgeschlossen,storniert)` | → OrderOverlay |
| 3 | **Historie & ähnliche Arbeiten** | `orders` abgeschlossen + `items` | Filter nach Oberfläche/Material; „Als Referenz verwenden" |
| 4 | **Teile & technisches Profil** | `customer_technical_profiles` + `items`-Historie | bearbeiten |
| 5 | **Preise & Angebote** | `customer_price_agreements` + frühere Auftragspreise | Warnung bei Abweichung |
| 6 | **Kommunikation & Telefonnotizen** | `customer_communication_events` + `phone_notes` (merge) | Zeitstrahl, Filter, → Notiz |
| 7 | **Reklamationen & Qualität** | `complaints` + `customer_quality_cases` (merged, DISTINCT) | → OrderOverlay |
| 8 | **Rechnungen & Zahlungen** | `ausgangsrechnung` + `payments` | Status; „Erinnerung senden"; → Buchhaltung |
| 9 | **Fotos & Dokumente** | `item_photos` + Dokumente (via orders/items) | Lightbox |
| 10 | **Analyse & Marketing** | `v_customer_insights` | Zielgruppenfit, Reaktivierung → Analyse-Kachel 6 |
| 11 | **Interne Notizen / Admin** | `customers.internal_notes`, `tags`, Audit | nur berechtigte Rollen |

### 3.4 5 KPIs (Kopf, jede klickbar → Sub-Overlay)

| KPI | Quelle | Drill-Down |
|-----|--------|-----------|
| Umsatz LTV | `ausgangsrechnung` Summe via orders | Rechnungsliste, sortierbar |
| Gewinn LTV | Erlös − Material − Arbeitszeit | Marge pro Auftrag |
| Offene Posten | `ausgangsrechnung WHERE bezahlt_am IS NULL` | offene Rechnungen + Alter + „Erinnerung senden" |
| Pünktlichkeit | `completed_date <= promised_due_date` | Auftrags-Soll/Ist-Liste |
| Reklamation | `complaints` count | Reklamationsliste |

### 3.5 Responsive
- ≥ 900px: zweispaltig (links 62% Sektionen, rechts 38% Quick Actions + Zeitstrahl)
- < 900px: einspaltig, Quick-Action-Grid 2×4, keine verschachtelten Scrollfenster
- Tablet quer ist Primärziel.

### 3.6 CI-Tokens (zwingend, kein Hardcode-Hex)
`--ci-bg #F1E9DC` · `--ci-surface #FBF6ED` · `--ci-ink #1A1F2E` · `--ci-accent #C2185B` · `--ci-success #4F8F58` · `--ci-warn #D89A2C` · `--ci-danger #B0413E` · Gradient `linear-gradient(115deg,#7A3FB0,#C2185B 38%,#F2643C 72%,#F6A93B)` · Fraunces (Namen/Nummern/Beträge) · Inter (Rest).

---

## 4 · KOMPONENTEN

```
src/components/customers/
  CustomerTile.tsx                 -- Kompaktkachel (Name, Firma, aktive Aufträge, Risk-Badge)
  CustomerOverlay.tsx              -- Overlay-Hülle (zentriert, Blur, lädt Teilmenge der Sektionen)
  CustomerFullPage.tsx             -- /customers/[id] (alle 11 Sektionen, Tabs)
  CustomerHeader.tsx               -- Kopfkarte + Statuschips (geteilt)
  CustomerKpiRow.tsx               -- 5 KPIs, jede klickbar (geteilt)
  sections/
    SectionUeberblick.tsx
    SectionAuftraege.tsx           -- aktuelle + abgeschlossene
    SectionHistorie.tsx            -- ähnliche Arbeiten, Filter
    SectionTechnischesProfil.tsx
    SectionPreise.tsx
    SectionKommunikation.tsx       -- Zeitstrahl (merge), Filter
    SectionReklamationen.tsx
    SectionZahlungen.tsx
    SectionFotos.tsx
    SectionAnalyseMarketing.tsx
    SectionInterneNotizen.tsx
  CustomerQuickActions.tsx         -- rechte Spalte
  CustomerTagEditor.tsx
  KpiDrillDown.tsx                 -- generisches Sub-Overlay
  NewCustomerForm.tsx              -- 30-Sekunden-Anlage (FocusOverlay)
src/lib/customers/
  customerQueries.ts               -- alle Drizzle-Queries (serverseitig)
  customerRepository.ts            -- Server Actions, RLS-konform
src/features/customers/
  useCustomerOverlay.ts            -- globaler State openCustomer/close (LIFO-fähig)
  useCustomerData.ts               -- bündelt alle Sektionsdaten
  useCustomerInsights.ts           -- v_customer_insights
```

### 4.1 Globaler Overlay-State (LIFO-Stack)
`CustomerOverlayProvider` liegt in **App-`layout.tsx`** (nicht in Einzelseiten — sonst funktioniert das Overlay nur dort). Stack-Logik: CustomerOverlay → OrderOverlay → ItemDrawer. ESC schließt nur den obersten Layer.

---

## 5 · ERFASSUNGSWEGE

| Weg | Verhalten | DB |
|-----|-----------|-----|
| **Manuell (30 Sek.)** | NewCustomerForm: Name/Firma + (Tel ODER Mail ODER Adresse) + Typ + Quelle. Kundennummer auto. Unvollständig erlaubt → Hinweis „Es fehlen: …" | `customers` INSERT |
| **Aus Auftrag** | Auftrag als Intake-Draft, Kunde übernehmen/verknüpfen, Dublettenprüfung | `customers` |
| **Aus Wareneingang/OCR** | OCR → `matchCustomer()` → Treffer/Dublette/neu, unsichere Werte markiert, max. 3–5 Schritte | Wareneingang-Flow (eigene Spec) |
| **Aus Telefonnotiz** | Notiz → erkannter Kunde/Auftrag → Bestätigung → erscheint in Akte + Folgeaktion | `phone_notes` + `customer_communication_events` |
| **Aus Kommunikation** (später) | Resend/Outlook: Absender erkennen, Kontakt ergänzen | später |

Adress-Autocomplete (Google Places): Straße → PLZ+Stadt. **Stack-Entscheidung:** Google Places ist hier gerechtfertigt (UX-Gewinn bei Adresserfassung, geringe Datenschutz-Exposition da nur Adressfeld). Key serverseitig, nicht im Client-Bundle.

---

## 6 · VERNETZUNG — ALLE TRIGGER-STELLEN (keine Sackgasse)

### 6.1 Wo die Kundenkarte geöffnet wird
| Ort | Prio | Aktion |
|-----|------|--------|
| OrderOverlay → Kunden-Pill | P1 | `openCustomer(id)` |
| OrderOverlay → „Andere Aufträge" → Name | P1 | `openCustomer` |
| Kundenkartei `/customers` Zeile | P1 | `openCustomer` |
| Globale Suche → Kunden-Treffer | P1 | `openCustomer` |
| Analyse → Top-Kunden (Kachel 2) | P2 | `openCustomer` |
| Analyse → Forderungen-Aging | P2 | `openCustomer` |
| Buchhaltung → Rechnungsempfänger | P3 | `openCustomer` |
| Kommzentrale → erkannter Kunde | P3 | `openCustomer` |
| Warenausgang → Name | P3 | `openCustomer` |

### 6.2 Wohin die Kundenkarte verlinkt (Rückwege)
- Auftrag → OrderOverlay (Sub-Layer)
- Rechnung/Zahlung → Buchhaltung / InvoiceOverlay
- Reklamation → OrderOverlay → Reklamation
- Zielgruppenfit/Reaktivierung → Analyse-Kachel 6
- Telefonnotiz → Kommzentrale

### 6.3 Wirkung zurück auf Analyse + Buchhaltung
- Klassifikation/Tags ändern → wirkt auf Top-Kunden-Segmentierung (Analyse)
- „Erinnerung senden" → erzeugt `customer_communication_events` + Resend-Mail (wenn verbunden) → erscheint in Forderungen-Aging
- Neuer Auftrag aus Kundenkarte → fließt in Werkstatt-Puls + Umsatz-Forecast

---

## 7 · AUTOMATISCHE TRIGGER (vorschlagend, nicht autosendend)

| Trigger | Aktion | Template |
|---------|--------|----------|
| Rechnung > 14 T unbezahlt | Erinnerung vorschlagen | `zahlungserinnerung` |
| Rechnung > 30 T unbezahlt | Mahnung vorschlagen + Warn-Badge auf Pill | `mahnung` |
| Auftrag überfällig > 3 T | Statusmail vorschlagen | `verzoegerung` |
| Auftrag fertig + Abholung | Abholmail | `abholbereit` |
| Auftrag fertig + Versand | Versandmail | `versandbereit` |
| Letzter Auftrag > 9 Monate + ≥3 Aufträge | „inaktiv"-Flag + Reaktivierung | — |

Trigger schlagen vor, senden nie automatisch (außer abhol-/versandbereit nach Freigabe). Status ehrlich: „Mollie verbunden" nur wenn verbunden, sonst „vorbereitet"/„nicht angebunden".

---

## 8 · NACHARBEIT KACHEL 1 (mockData-Fix, falls noch offen)

Aus vorherigem Build offen: `TermintreueChart.tsx` enthält `const mockData`. Phase 0 dieser Spec:
1. `mockData`-Array entfernen, Chart auf Props aus `kpi_snapshots` umstellen.
2. Leerzustand wenn keine Snapshots.
3. Verifikation: `Get-ChildItem -Path "src\features\analyse" -Recurse -Filter "*.ts*" | Select-String "mockData"` = leer.

---

## 9 · AKZEPTANZKRITERIEN (ORIGINAL — Antigravity darf NICHT umformulieren)

| Nr | Kriterium | Prüfmethode |
|----|----------|-------------|
| 1 | Alle 6 Tabellen + `v_customer_insights` existieren auf Supabase | `\dt customer_*` + `SELECT * FROM v_customer_insights LIMIT 1;` |
| 2 | `customers` hat alle neuen Spalten inkl. tenant_id | `information_schema` |
| 3 | Genau EINE CustomerOverlay + EINE CustomerFullPage, geteilte Sektions-Komponenten | Code-Review: keine zweite Kunden-Detail-Implementierung |
| 4 | CustomerOverlay öffnet identisch von OrderOverlay, Kundenkartei, Suche (P1) | 3× testen |
| 5 | „Ganze Akte öffnen" → `/customers/[id]` mit allen 11 Sektionen | Klick |
| 6 | 5 KPIs klickbar → Sub-Overlay mit echten Daten | je KPI testen |
| 7 | Offene-Posten-Drill-Down hat „Erinnerung senden" pro Zeile | Klick |
| 8 | Jedes Stammdaten-Feld inline editierbar, persistiert nach Supabase | Edit + DB-Check |
| 9 | Aufträge-Liste → OrderOverlay als Sub-Layer (LIFO), ESC schließt nur oberste | Klick |
| 10 | Zeitstrahl merged communication_events + phone_notes + events + payments, sortiert DESC | Sichtprüfung |
| 11 | Reklamations-Tab merged complaints + customer_quality_cases ohne Doppelzählung | Sichtprüfung |
| 12 | Kontaktpersonen, Preisabsprachen, techn. Profile anleg-/editierbar | je 1 Eintrag anlegen |
| 13 | Insights (Umsatz 12M, Marge, Reklaquote, Zahlungsdauer, Risk) aus View, kein Mock | DB = UI |
| 14 | Leere Erweiterungstabelle → „Noch keine Einträge erfasst", kein Mock | Sichtprüfung |
| 15 | CI-Tokens durchgehend, kein hardcoded Hex | grep Hex in components/customers |
| 16 | Kein `mockData`/`Math.random` in components/customers UND TermintreueChart gefixt | grep |
| 17 | NewCustomerForm: Anlage mit Minimaldaten, Kundennummer auto, „fehlt noch"-Hinweis | testen |
| 18 | CustomerOverlayProvider in App-layout (nicht Einzelseite) | Code-Check |
| 19 | Server Actions/Repository für Kernkundendaten, kein Browser-Direktzugriff | Code-Check |
| 20 | Navigation/Sidebar unverändert | Sichtprüfung |

---

## 10 · ANTI-DRIFT / STOPP

1. **EINE Komponente überall.** Keine „vereinfachte Kundenkarte" irgendwo.
2. **CustomerOverlayProvider in App-layout.**
3. **Kein Mock, keine Fake-FK.** Leer → Leerzustand.
4. **`arbeitszeit_buchung.auftrag_id`** (nicht order_id) in allen JOINs.
5. **`customer_insights` ist VIEW**, keine Tabelle. Nicht manuell pflegen.
6. **Server-Bridge/RLS nicht beschädigen.** Kernkundendaten über Server Actions.
7. **Keine Doppelzählung** complaints ↔ customer_quality_cases.
8. **Navigation NICHT anfassen. Git manuell.**
9. **STOPP bei:** fehlendem tenant_id, fehlender Tabelle, Spaltenabweichung von Übergabe → melden, nicht umgehen.
10. **Status ehrlich:** keine „verbunden"-Anzeige für nicht verbundene Dienste (Mollie/Resend).

---

## 11 · REIHENFOLGE FÜR ANTIGRAVITY

```
Phase 0 — Nacharbeit Kachel 1
  0.1  mockData aus TermintreueChart entfernen, Props/Leerzustand
  0.2  Verifikation grep = leer

Phase 1 — DB
  1.0  Vorprüfung (Abschnitt 2.0): customers-Schema, tenant_id, phone_notes, image_urls → Tabelle, STOPP
  1.1  customers erweitern (2.1)
  1.2  6 Tabellen anlegen (2.2–2.6) + email_templates (2.8)
  1.3  v_customer_insights anlegen (2.7)
  1.4  RLS-Policies (2.9)
  1.5  npx supabase db push → NOTIFY → auf Supabase verifizieren
  1.6  Seed: 2–3 Kontaktpersonen, 1 Preisabsprache, 1 techn. Profil (mit _seed_-Prefix)

Phase 2 — Repository/Queries (serverseitig)
  2.1  customerRepository.ts (Server Actions, RLS-konform)
  2.2  customerQueries.ts (alle Drizzle-Queries)
  2.3  useCustomerData, useCustomerInsights, useCustomerOverlay (LIFO)

Phase 3 — Komponenten (geteilt)
  3.1  CustomerHeader, CustomerKpiRow
  3.2  Alle 11 Section-Komponenten
  3.3  CustomerQuickActions, CustomerTagEditor, KpiDrillDown
  3.4  CustomerOverlay (Teilmenge) + CustomerFullPage (alle Sektionen)
  3.5  NewCustomerForm
  3.6  CustomerOverlayProvider in App-layout

Phase 4 — Vernetzung P1
  4.1  OrderOverlay Kunden-Pill → openCustomer
  4.2  /customers Liste → openCustomer
  4.3  Globale Suche Kunden-Treffer → openCustomer
  4.4  „Ganze Akte öffnen" → /customers/[id]

Phase 5 — Verifikation
  5.1  Alle 20 Akzeptanzkriterien (ORIGINAL aus Abschnitt 9, mit Nummer referenzieren)
  5.2  Ergebnis als Tabelle
  5.3  STOPP — Freigabe vor Spec 44 (Umsatz & Marge)

Kein Parallelstart zwischen Phasen.
```

**FÜR ANTIGRAVITY:** Verifikationstabelle MUSS die exakten 20 Kriterien aus Abschnitt 9 verwenden, mit Spec-Nummer. Keine eigenen Kriterien erfinden. Bei jedem Kriterium: tatsächlicher Prüfbefehl + Ergebnis.
