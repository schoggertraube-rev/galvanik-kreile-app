# 08 — Analyse-Drilldown & Detailkacheln (Performance + Buchhaltung)

**Status:** Spezifikation v1 · baureif
**Geltungsbereich:** Galvanik Kreile WerkstattCockpit — Performance-Seite, Buchhaltungsmodul, alle Detail-Kacheln
**Vorrang:** untergeordnet `00_PRIORITY_RULES_KREILE.md`, `AGENTS.md`, `SPEC_LICENSE_FEATURE_TOGGLES_v1.md`
**Build-Tool:** Antigravity · Terminal PowerShell · Commits manuell durch Siglinder

---

## 0 STOPP-Bedingungen & Tabu-Zonen (zuerst lesen)

**STOPP — Antigravity hält an und meldet, bevor weitergebaut wird, wenn:**
- eine bestehende, funktionierende Visualisierung verändert oder entfernt werden müsste, die nicht ausdrücklich in §9 als „zu ersetzen" gelistet ist;
- ein Datenfeld für eine Berechnung fehlt und kein Erfassungsweg gemäß §6 existiert (NIEMALS einen Wert raten, schätzen oder interpolieren, außer er ist explizit als Schätzung gekennzeichnet und von der Rechnung ausgeschlossen — siehe §6.4);
- eine Migration nötig wird, die über die in §4 definierten Tabellen hinausgeht;
- der Marketing-Bereich optisch angefasst werden müsste (NUR Dat/Verknüpfungs-Hooks gemäß §10, KEINE UI).

**TABU:**
- keine Änderung an bestehenden Chart-Komponenten außerhalb des `analytics/`-Ordners ohne STOPP-Meldung;
- kein neuer Export-Pfad (Exporte laufen ausschließlich über den bestehenden DATEV/Lexware-Weg);
- kein `localStorage`/`sessionStorage` für Fachdaten;
- keine Commits durch Antigravity.

**Plan strikt:** Reihenfolge B1 → B6 (§11) wird eingehalten. Keine vorgezogenen Features, keine eigenmächtigen Zusatzmodule.

---

## 1 Ziel & Problem

Heutige Detail-Kacheln (Buchhaltungs-Kategorien, Performance-KPIs) sind **Sackgassen**: eine Zahl, ein Balken, ein Prozentwert — danach kein Drilldown, keine Belegverknüpfung, keine Verhältniszahlen, kein Zeitverlauf, keine Handlungsableitung. Das Detail-Popup (aktuell) zeigt 4 Werte auf viel Leerfläche.

**Zielbild:** Ein einziges, app-weit wiederverwendetes Muster — `AnalyticsDrillDrawer` — das jede Kachel zum analytischen Einstiegspunkt macht. Sechs feste Sektionen (A–F). Visuell hochwertig, nicht „Excel". In einfacher Sprache erklärt. Mit klarer Erfassungsführung bei fehlenden Daten.

**Erfolgskriterium (Chef-Perspektive):** Der Inhaber öffnet eine Kachel und versteht in < 10 Sekunden: *Wie viel? Mehr oder weniger als sonst? Woraus besteht es? Was bedeutet das für meine Marge? Was soll ich tun?* — ohne Schulung, ohne Fachjargon.

---

## 2 Designprinzipien (verbindlich)

| # | Prinzip | Konkret |
|---|---|---|
| P1 | **Jede Zahl wird erklärt** | Über/neben jeder Kennzahl: Klartext-Label (was ist das), Farb-Pill (gut/beobachten/kritisch), optional „i" mit Detail. Nie eine nackte Zahl. |
| P2 | **Einfache Sprache** | Keine Fachbegriffe ohne Erklärung. „von jedem Euro Umsatz gehen 23 Cent in Energie" statt „Energiekostenquote 23 %". |
| P3 | **Charts immer beschriftet** | Jeder Chart: Y-Achsen-Label mit Einheit, X-Achsen-Label, Legende, ein „So liest du das"-Satz. Keine Diagramme ohne Achsenkontext. |
| P4 | **Weniger Excel** | Karten statt Gitter-Tabellen. Große Zahlen, Sparklines, abgerundete Flächen, sanfte Tiefe, farbcodierte Bedeutung. Belege als Karten-Zeilen mit Lieferanten-Avatar. |
| P5 | **Nie raten** | Fehlt ein Input, wird der Wert NICHT berechnet. Stattdessen Fehl-Zustand + Erfassungslink. |
| P6 | **Zentrale Erfassung, automatische Zuweisung** | Daten werden an EINER Stelle eingerichtet (§5). Neue Belege/Werte ordnen sich danach automatisch zu. Schnellerfassung im Drawer möglich (§6.3). |
| P7 | **Bestehendes nicht zerstören** | Gute vorhandene Visualisierungen bleiben. Drawer ist additiv, hinter Feature-Flag (§9). |
| P8 | **Eine Komponente, viele KPIs** | Neue Kachel = neuer Registry-Eintrag (§7), keine neue Komponente. |
| P9 | **Offen für Integrationen** | Datenmodell und Verknüpfungen halten Steckplätze frei (Marketing folgt, §10). |
| P10 | **Drilldown statt Endpunkt** | Jedes Element in C/D/F ist klickbar → tiefere Ebene oder Ursprungsseite mit gesetztem Filter. |

---

## 3 Komponentenarchitektur

```text
src/components/analytics/
├── AnalyticsDrillDrawer.tsx        # Container: dockt rechts (Desktop) / Vollbild (Mobile/Tablet)
│                                   #   Props: kpiId, period, onClose
│                                   #   liest kpiRegistry, orchestriert Sektionen A–F
├── DrillCategoryHeader.tsx         # farbiger Kopf: Icon, Titel, Untertitel, Periodenschalter
├── DrillHero.tsx                   # A: große Zahl + Sparkline + Klartext-Bedeutung + i-Popover
├── DrillTrendChart.tsx             # B: Zeitverlauf (Chart.js), Achsen, Legende, "So liest du das"
├── DrillComposition.tsx            # C: polymorphe Bestandteil-Liste (Belege ODER Aufträge ODER Messungen)
│                                   #   Sortierung, Klick → DrillItemPreview
├── DrillItemPreview.tsx            # zweite Ebene: ein einzelner Beleg/Auftrag im Detail
├── DrillCrossKpi.tsx               # D: Verhältniszahlen als Carousel (Mobile + Desktop)
├── DrillInsight.tsx                # E: regelbasierter ODER LLM-Insight + Handlungs-CTAs
├── DrillLinkChips.tsx              # F: Verknüpfungs-Chips inkl. Zukunfts-Hooks (Marketing)
├── DrillDataMissing.tsx            # Fehl-Zustand: schraffierte Karte + "So erfasst du das"
├── DataCaptureHintDialog.tsx       # Hinweisfenster: 3 Erfassungswege (Schnell/Beleg/Zentral)
├── InfoPopover.tsx                 # generisches "i" → Formel, Quelle, Farb-Logik, was tun
└── MeaningPill.tsx                 # Klartext-Bedeutung-Pill (gut/beobachten/kritisch)

src/components/settings/
└── DataSourceCockpit.tsx           # ZENTRALE ERFASSUNG: Kategorie-Mapping, Bezugsgrößen-Quellen,
                                    #   Datenstatus je Kategorie, Toggle "automatische Zuweisung"

src/lib/analytics/
├── kpiRegistry.ts                  # Single Source of Truth: KPI-Definitionen (§7)
├── crossKpiFormulas.ts             # Verhältniszahlen + Schwellen (§8)
├── dataCompleteness.ts             # prüft, welche Inputs je KPI vorhanden/fehlend sind (§6)
├── insightRules.ts                 # regelbasierte Insights (Stufe B5)
├── insightLlm.ts                   # LLM-Insight via Bedrock (Stufe B6, hinter Lizenz)
├── plainLanguage.ts                # Klartext-Strings + "So liest du das"-Texte (§2 P2/P3)
└── drillContext.ts                 # State: kpiId, period, sortKey, URL-Sync (§3.2)
```

### 3.1 Drawer-Mechanik

| Eigenschaft | Wert |
|---|---|
| Position Desktop | rechts angedockt, Breite 640 px, Vollhöhe, Overlay-Backdrop |
| Position Tablet | rechts, 70 % Breite |
| Position Mobile | Vollbild |
| Öffnen | Klick auf jede Detail-Kachel in Performance/Buchhaltung |
| Schließen | `Esc`, Backdrop-Klick, X-Button |
| Animation | 200 ms Slide-in, kein Bounce |
| Scroll | Drawer-Inhalt scrollt intern; Sektionen gestapelt |
| Verschachtelung | max. 2 Ebenen (Drawer → DrillItemPreview) |

### 3.2 Deep-Link & State

- URL-Parameter `?drill={kpiId}&period={period}` — Drawer ist verlink- und reload-fest.
- `period`-Format: `2026-06` (Monat), `2026-Q2` (Quartal), `2026-W22` (Woche), `2026-06-05` (Tag).
- Periodenschalter aktualisiert Hero, Verlauf, Composition, Cross-KPI, Insight gleichzeitig (Periode #1 umschaltbar — bestätigt).

---

## 4 Datenmodell (Supabase / Drizzle)

> **Migrationsregel beachten** (Pflicht nach jeder Migration): `npx supabase login` → `npx supabase link --project-ref REF` → `npx supabase db push`; bei CLI-Fehler SQL manuell im Dashboard ausführen; danach `NOTIFY pgrst, 'reload schema'`; **live auf Supabase verifizieren, nicht nur lokale Datei prüfen.**

### 4.1 Neue Tabellen

```sql
-- KPI-Metadaten (Klartext, Einheiten, Schwellen) — ergänzt kpiRegistry zur Laufzeit/Pflege
create table kpi_metadata (
  kpi_id        text primary key,            -- z.B. 'energy_costs'
  display_label text not null,               -- "Energie"
  plain_meaning text not null,               -- "Was kostet dich Energie"
  unit          text not null,               -- 'EUR' | 'PERCENT' | 'KWH' | 'COUNT' | ...
  source_module text not null,               -- 'accounting' | 'performance' | 'operations'
  threshold_warn  numeric,                   -- ab hier "beobachten" (gegen Vorperiode %)
  threshold_crit  numeric,                   -- ab hier "kritisch"
  info_text     text,                        -- Inhalt des "i"-Popovers
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Kategorie-Zuordnungsregeln (zentrale Erfassung → automatische Zuweisung)
create table category_mapping_rules (
  id          uuid primary key default gen_random_uuid(),
  kpi_id      text not null references kpi_metadata(kpi_id),
  match_type  text not null,                 -- 'supplier' | 'account' | 'keyword'
  match_value text not null,                 -- "Mainova" | "4400" | "Strom"
  priority    int  not null default 100,     -- niedrig = zuerst
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Bezugsgrößen-Quellen (Nenner für Verhältniszahlen)
create table reference_metric_sources (
  metric_key  text primary key,              -- 'revenue' | 'order_count' | 'bath_active_hours' | 'energy_kwh'
  label       text not null,                 -- "Umsatz"
  source_kind text not null,                 -- 'auto_orders' | 'auto_bath' | 'manual_meter' | 'from_invoice'
  status      text not null default 'pending', -- 'auto' | 'configured' | 'pending'
  config      jsonb,                         -- quellspezifische Konfiguration
  updated_at  timestamptz not null default now()
);

-- Manuell/aus Beleg erfasste Verbrauchswerte (z.B. kWh, Liter) je Periode
create table consumption_readings (
  id          uuid primary key default gen_random_uuid(),
  metric_key  text not null references reference_metric_sources(metric_key),
  period      text not null,                 -- '2026-06'
  value       numeric not null,
  unit        text not null,                 -- 'kWh' | 'l'
  source_ref  text,                          -- Belegnummer o.ä.
  captured_by uuid not null,
  captured_at timestamptz not null default now()
);

-- Acknowledgments (Punkt #5 bestätigt) — append-only, GoBD-konform
create table analytics_acknowledgments (
  id              uuid primary key default gen_random_uuid(),
  kpi_id          text not null,
  period          text not null,
  user_id         uuid not null,
  acknowledged_at timestamptz not null default now(),
  note            text
);
```

### 4.2 RLS

- `kpi_metadata`, `category_mapping_rules`, `reference_metric_sources`: lesbar für alle authentifizierten Nutzer; schreibbar nur Rolle mit `accounting:admin`.
- `consumption_readings`, `analytics_acknowledgments`: schreibbar für `accounting:write`; lesbar für `accounting:read`.
- `analytics_acknowledgments`: **kein UPDATE/DELETE** (append-only). Korrektur = neue Zeile mit Notiz.

### 4.3 Bestehende Daten (nicht migrieren, nur lesen)

Belege, Aufträge, Badregelkarten, Lager bleiben in ihren vorhandenen Tabellen. Der Drawer liest sie über die bestehenden Repositories (Data-Provider-Pattern Mock/Api). **Kein Schema-Eingriff dort.**

---

## 5 Zentrale Erfassung — `DataSourceCockpit`

**Ort:** Buchhaltung → Einstellungen → „Datenquellen & Zuordnung" (hinter Zahnrad, gemäß Onboarding-Prinzip „set it once, then runs automatically").

**Inhalt:**

1. **Kategorien & Datenstatus** — Liste aller Kostenkategorien mit:
   - zugeordneten Lieferanten/Konten (aus `category_mapping_rules`),
   - Statuspill: `vollständig` (grün) / `Input fehlt` (gelb, mit benanntem fehlendem Feld),
   - Bearbeiten der Zuordnungsregeln.

2. **Bezugsgrößen** (Nenner der Verhältniszahlen) — Liste aus `reference_metric_sources`:
   - `Umsatz` → automatisch aus Aufträgen/Rechnungen (`auto_orders`),
   - `Anzahl Aufträge` → automatisch aus Auftragsmodul (`auto_orders`),
   - `Bad-Aktivstunden` → automatisch aus Badregelkarten (`auto_bath`),
   - `Energie in kWh` → `manual_meter` oder `from_invoice` → Status `pending` bis eingerichtet.

3. **Toggle „automatische Zuweisung"** — global ein/aus. Wenn aus: Belege landen in „nicht zugeordnet" und müssen manuell zugewiesen werden.

**Automatische Zuweisung (Logik):**
```ts
// beim Erfassen/Import eines Belegs
function assignCategory(beleg): KpiId | 'unassigned' {
  const rules = activeMappingRules().sort(byPriority);
  for (const r of rules) {
    if (r.match_type === 'supplier' && beleg.supplier.includes(r.match_value)) return r.kpi_id;
    if (r.match_type === 'account'  && beleg.account === r.match_value)        return r.kpi_id;
    if (r.match_type === 'keyword'  && beleg.text.includes(r.match_value))     return r.kpi_id;
  }
  return 'unassigned';
}
```

**Akzeptanz:** Ein neu erfasster Mainova-Beleg landet ohne manuelles Zutun in „Energie", sobald die Regel `supplier=Mainova → energy_costs` existiert.

---

## 6 Fehlende Daten — niemals raten (Kernregel P5)

### 6.1 Vollständigkeits-Prüfung

`dataCompleteness.ts` prüft je KPI und je Cross-KPI, ob alle benötigten Inputs vorhanden sind:

```ts
type CompletenessResult = {
  computable: boolean;
  missing: MissingInput[];        // z.B. [{ metricKey:'energy_kwh', label:'Stromverbrauch in kWh', period:'2026-06' }]
};
```

### 6.2 Darstellung des Fehl-Zustands (`DrillDataMissing`)

- **Nicht** als roter Fehler/Alarm — neutraler, einladender Ton.
- Schraffierte/gedämpfte Karte, Wert als `— [Einheit]`.
- Klartext: „Für diese Berechnung fehlt der **Stromverbrauch in kWh**."
- Button „So erfasst du das →" → öffnet `DataCaptureHintDialog`.
- Betrifft es einen ganzen Insight, erscheint ein Platzhalter „Tiefere Analyse braucht noch eine Angabe" + CTA.

### 6.3 Erfassungs-Hinweisfenster (`DataCaptureHintDialog`)

Drei Wege, klar gestaffelt:

| Weg | Inhalt | Default |
|---|---|---|
| **Schnell hier eintragen** (empfohlen) | Inline-Feld für den fehlenden Wert + Zeitraum + Quelle. Speichert in `consumption_readings`. „Reicht, um sofort loszulegen." | hervorgehoben |
| **Aus Beleg übernehmen** | Öffnet den zugehörigen Beleg; Wert aus OCR/Feld übernehmen. | |
| **Dauerhaft automatisch** | Link zu `DataSourceCockpit` → Quelle einmal hinterlegen (Zähler/Rechnungsfeld). | |

Erklärung in einfacher Sprache, **wo** der Wert zu finden ist (z.B. „auf der Stromrechnung unter ‚Verbrauch' in kWh").

### 6.4 Schätzwerte (nur wenn ausdrücklich erlaubt)

Standard ist: kein Wert. Falls eine abgeleitete Kennzahl trotzdem sinnvoll ist (z.B. CO₂ aus kWh × Faktor), gilt:
- nur berechnen, wenn die **Basis** (kWh) real erfasst ist;
- Ergebnis als „(geschätzt)" labeln;
- niemals in harte Soll/Ist- oder Margenrechnungen einfließen lassen.

---

## 7 KPI-Registry (`kpiRegistry.ts`)

Eine Map. Neue Kachel = neuer Eintrag, keine neue Komponente (P8).

```ts
type Period = string; // '2026-06' | '2026-Q2' | '2026-W22' | '2026-06-05'

type CompositionType = 'belege' | 'auftraege' | 'messungen' | 'artikel';

type KpiDefinition = {
  id: KpiId;
  label: string;                  // "Energie"
  icon: string;                   // Tabler-Icon-Name / SVG-Key
  accentColor: AccentToken;       // 'amber' | 'teal' | 'blue' | ...  (Kategorie-Kopf-Farbe)
  source: 'accounting' | 'performance' | 'operations';
  unit: 'EUR' | 'PERCENT' | 'COUNT' | 'KWH' | 'HOURS';

  plainMeaning: string;           // "Was kostet dich Energie"
  infoText: string;               // "i"-Popover (Formel, Quelle, Farb-Logik)

  value: (p: Period) => Promise<number>;
  changeVsPrev: (p: Period) => Promise<number>;       // %
  budget?: (p: Period) => Promise<number | null>;

  trend: (p: Period) => Promise<{ labels: string[]; current: number[]; prevYear: number[]; avg: number }>;
  trendReadAs: string;            // "So liest du das: ..." (P3)

  composition: {
    type: CompositionType;        // Energie='belege', Termintreue='auftraege', Bad='messungen'
    list: (p: Period) => Promise<CompositionItem[]>;
  };

  crossKpis: CrossKpiKey[];       // Verweise in crossKpiFormulas (§8)

  insightRules: InsightRule[];    // regelbasiert (B5)
  enableLlmInsight?: boolean;     // B6, nur Pro

  linkedAreas: LinkedArea[];      // F-Chips, inkl. Zukunfts-Hooks (Marketing, §10)
};
```

**Pflicht-Einträge (Buchhaltung):** `energy_costs`, `material_costs`, `kfz_costs`, `office_costs`, `fuel_costs`, `hospitality_costs`, `other_costs`, `revenue_net`, `gross_profit`, `fixed_costs`, `variable_costs`.
**Pflicht-Einträge (Performance):** `on_time_rate`, `cycle_time`, `critical_orders`, `complaint_rate`, `scan_rate`, `station_load`, `bath_stability`, `inventory_health`.

**Polymorphe Composition (Punkt #3 bestätigt):** Performance-KPIs setzen `composition.type='auftraege'` (statt Belege), Bad-KPIs `='messungen'`. Gleiche Komponente, anderer Datentyp.

---

## 8 Cross-KPI-Formeln & Schwellen (`crossKpiFormulas.ts`)

Alle aus vorhandenen Daten berechenbar (kein neues Tracking nötig, außer wo Verbrauch angereichert wird).

| Key | Formel | Klartext | Schwellen (warn / krit) |
|---|---|---|---|
| `energy_per_revenue` | `energy_costs / revenue_net` | „je Umsatz-Euro X ct Energie" | >15 % / >20 % |
| `energy_per_order` | `energy_costs / order_count` | „Energie je Auftrag" | Trend-getrieben |
| `energy_per_kwh` | `energy_costs / energy_kwh` | „Preis je kWh" | benötigt kWh → sonst Fehl-Zustand |
| `energy_per_db` | `energy_costs / (revenue_net − variable_costs)` | „Anteil am Deckungsbeitrag" | >70 % / >85 % |
| `material_per_revenue` | `material_costs / revenue_net` | „Wareneinsatz je Umsatz-Euro" | >40 % / >50 % |
| `payroll_per_revenue` | `payroll / revenue_net` | „Personal je Umsatz-Euro" | >35 % / >45 % |
| `db_ratio` | `(revenue_net − variable_costs) / revenue_net` | „Marge nach variablen Kosten" | <30 % / <25 % |
| `cost_per_order` | `category_costs / order_count` | „Kosten je Auftrag (Kategorie)" | Trend-getrieben |
| `co2_estimate` | `energy_kwh × faktor` | „CO₂ (geschätzt)" | nur wenn kWh real |

**Regel:** Schwellen liefern die Farbe (`gut`/`beobachten`/`kritisch`) und damit die `MeaningPill`. Vergleich immer gegen Vorperiode **und** gegen Schwelle.

---

## 9 Koexistenz mit bestehenden Visualisierungen (Kernregel P7)

### 9.1 Was bleibt (NICHT anfassen)
- Performance-Hero-Score, KPI-Grid-Karten, Stationen-Heatmap, Wochenziel, Streaks (aus `06_PERFORMANCE_GAMEDESIGN_ANALYTIK.md`) — die Übersichts-Visualisierung bleibt.
- Inline-Sparklines/Balken auf den Kacheln bleiben (gute, kompakte Vorschau).
- Buchhaltungs-Übersichtsraster (die Kategorie-Kacheln selbst) bleibt — nur der **Klick** ändert sich.

### 9.2 Was ersetzt wird
- Das aktuelle Detail-**Modal** (4 Werte, viel Leerfläche) → ersetzt durch `AnalyticsDrillDrawer`.
- Alte „Detail-Aufschlüsselung"-Unterseite (Screenshot Buchhaltung) → ihr Inhalt wandert in Sektion C/D des Drawers.

### 9.3 Feature-Flag
- `useFeatureFlag('analyticsDrawer')` steuert die Umstellung. Während der Migration kann pro Bereich umgeschaltet werden.
- **Akzeptanz:** Mit deaktiviertem Flag verhält sich die App exakt wie heute (keine Regression).

### 9.4 Anti-Duplikat-Regel (aus Lessons Learned)
- Funktionen NICHT doppeln. Wenn eine Aktion (z.B. „Beleg öffnen") schon existiert, wird sie im Drawer **verlinkt/wiederverwendet**, nicht neu gebaut. Kein zweiter Export-Knopf.

---

## 10 Integrations- & Vernetzungs-Hooks (Marketing folgt — KEINE UI jetzt)

**Optisch NICHT anfassen.** Nur Daten- und Verknüpfungs-Steckplätze:

- `kpiRegistry` ist offen für spätere Marketing-KPIs (`inquiry_count`, `marketing_spend`, `cost_per_inquiry`, `inquiry_to_order_rate`). Diese werden später als Einträge ergänzt — die Komponenten müssen es ohne Codeänderung tragen.
- `crossKpiFormulas` ist offen für Marketing-Bezüge (z.B. `marketing_spend / revenue_net`).
- `LinkedArea` unterstützt einen Status `future` → Chip wird gedämpft/gestrichelt dargestellt („Marketing (folgt)") und ist ein Platzhalter-Link auf die spätere Route. **Kein** echtes Marketing-Screen-Design.
- `reference_metric_sources` kann später `inquiry_count` etc. aufnehmen.

**Akzeptanz:** Ein künftiger Marketing-KPI lässt sich allein durch Registry-/Formel-/Source-Einträge anbinden, ohne `AnalyticsDrillDrawer` o.ä. zu ändern.

---

## 11 Rollout — strikt sequenziell (B1 → B6)

Nach jedem Block: STOPP, Bericht, manueller Commit durch Siglinder. Migrationen am Ende des Tages gesammelt pushen (gemäß Praxis).

| Block | Inhalt | Migration? |
|---|---|---|
| **B1** | `AnalyticsDrillDrawer`-Skelett + alle 6 Sektions-Komponenten als Stub; `kpiRegistry` mit **einem** Eintrag `energy_costs` end-to-end; Klick-Handler in Buchhaltungs-Übersicht auf Drawer umstellen (hinter Flag); Tabellen `kpi_metadata`, `analytics_acknowledgments`. | ja |
| **B2** | Alle 7 Buchhaltungs-Kategorien in Registry; `crossKpiFormulas` + Schwellen; `DrillComposition` mit echter Belegliste + Sortierung; `DrillItemPreview`; altes Detail-Modal entfernen. | nein |
| **B3** | `dataCompleteness` + `DrillDataMissing` + `DataCaptureHintDialog`; Tabellen `reference_metric_sources`, `consumption_readings`, `category_mapping_rules`; `DataSourceCockpit` (zentrale Erfassung) Basis. | ja |
| **B4** | Performance-Seite umstellen: `revenue_net`, `gross_profit`, `fixed_costs`, `variable_costs`, dann Stationen/Bad/Lager auf Drawer (polymorphe Composition `auftraege`/`messungen`). Bestehende Übersicht unangetastet (§9.1). | nein |
| **B5** | `insightRules` (regelbasiert) für alle KPIs; `MeaningPill`, `InfoPopover`, `plainLanguage`-Texte flächendeckend (P1–P3). | nein |
| **B6** | `insightLlm` via Bedrock eu-central-1, hinter `useFeatureFlag` + Pro-Lizenz (LLM erst B6 — bestätigt). Nur Cross-KPI-Zahlen an das Modell, KEINE Lieferantennamen/Belegnummern. | nein |

---

## 12 Akzeptanzkriterien (Antigravity-Prüfplan)

1. Klick auf eine Detail-Kachel (Buchhaltung **und** Performance) öffnet `AnalyticsDrillDrawer`, nicht das alte Modal (bei aktivem Flag).
2. Mit deaktiviertem Flag identisches Verhalten wie heute — keine Regression an bestehenden Visualisierungen (§9.1).
3. Periodenschalter Tag/Woche/Monat/Quartal aktualisiert Hero, Verlauf, Composition, Cross-KPI, Insight konsistent.
4. **Jede** Zahl im Drawer hat: Klartext-Label, farbcodierte Bedeutung, optional „i" mit Detail. Keine nackte Zahl.
5. **Jeder** Chart hat: Y-Achsen-Label mit Einheit, X-Achsen-Label, Legende, „So liest du das"-Satz in einfacher Sprache.
6. Belege/Posten als Karten-Zeilen (kein Excel-Gitter), sortierbar nach Betrag/Datum/Lieferant; Klick öffnet `DrillItemPreview`.
7. Cross-KPI als Carousel (Mobile **und** Desktop), Werte stimmen mit BWA überein.
8. Fehlt ein Input: Wert wird **nicht** berechnet/geraten; `DrillDataMissing` zeigt den benannten fehlenden Wert + „So erfasst du das"; Dialog bietet Schnellerfassung, Beleg-Übernahme, zentrale Einrichtung.
9. Schnellerfassung schreibt nach `consumption_readings`; danach wird die zuvor fehlende Verhältniszahl berechnet und angezeigt.
10. `DataSourceCockpit`: neue Mapping-Regel `supplier=Mainova → energy_costs` führt dazu, dass ein neuer Mainova-Beleg automatisch der Kategorie Energie zugewiesen wird.
11. „Als erledigt markieren" schreibt eine Zeile in `analytics_acknowledgments` (append-only); kein UPDATE/DELETE möglich.
12. Drawer ist deep-linkbar (`?drill=…&period=…`), Reload erhält den Zustand.
13. Mobile/Tablet: Vollbild-Variante, alle Sektionen scrollbar, Touch-Ziele ≥ 44×44 px.
14. Performance: Drawer öffnet < 300 ms, Trendchart rendert < 500 ms.
15. Marketing-Hook: ein `LinkedArea` mit Status `future` rendert als gedämpfter Platzhalter-Chip; **kein** Marketing-UI gebaut.
16. Keine alten Detail-Modals mehr im Code: `grep -ri "DetailModal\|KachelDetailDialog" src/` liefert leer (nach B2/B4).
17. Keine doppelten Funktionen/Buttons (Anti-Duplikat, §9.4).

---

## 13 Datenschutz & Recht

| Thema | Regel |
|---|---|
| Belegdaten im Drawer | nur Rollen mit `accounting:read` |
| LLM-Insight (B6) | nur aggregierte Cross-KPI-Zahlen an Claude Sonnet (Bedrock eu-central-1); **keine** Lieferantennamen, Belegnummern, Klarbeträge einzelner Belege |
| Audit/GoBD | `analytics_acknowledgments` append-only mit Hash-Chain-kompatibler Zeitstempelung; jede „erledigt"-Aktion protokolliert |
| Export | ausschließlich über bestehenden DATEV/Lexware-Pfad; kein neuer Export aus dem Drawer |
| Verbrauchswerte | `consumption_readings` enthält keine personenbezogenen Daten |

---

## 14 Tests

**Unit:**
- `crossKpiFormulas`: jede Formel mit Beispielwerten + Schwellen-Klassifikation.
- `dataCompleteness`: vollständig / einzelner fehlender Input / mehrere fehlend.
- `assignCategory`: supplier/account/keyword + Priorität + „unassigned".

**Komponenten:**
- `AnalyticsDrillDrawer` rendert alle 6 Sektionen für `energy_costs`.
- `DrillDataMissing` rendert bei fehlendem `energy_kwh`, kein geratener Wert.
- `DrillComposition` Sortierung (Betrag/Datum/Lieferant) + Leerzustand.
- Periodenwechsel aktualisiert alle Sektionen.

**Integration:**
- Schnellerfassung → `consumption_readings` → Verhältniszahl erscheint.
- Mapping-Regel → Auto-Zuweisung eines neuen Belegs.
- Acknowledgment → Zeile angelegt, UPDATE/DELETE verweigert (RLS).

**Visuell/Regression:**
- Flag aus = Snapshot identisch zur heutigen Ansicht.
- Mobile/Tablet-Vollbild, Touch-Ziele.

---

## 15 Übergabe nach dem Build (PowerShell — separater Block, NICHT für Antigravity)

> Diese Befehle führt **Siglinder manuell** in PowerShell aus. Antigravity committet nicht.

```powershell
# 1) Status & Sicherung vor Commit
git status
git add -A
git commit -m "feat(analytics): AnalyticsDrillDrawer Pattern – Block Bx"

# 2) Migration auf Supabase (nach Tagesabschluss gesammelt)
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push

# 3) Schema-Reload erzwingen, danach live verifizieren
#    (im Supabase SQL-Editor, falls CLI fehlschlägt: SQL manuell ausführen)
#    NOTIFY pgrst, 'reload schema';
```

**Verifikation (Pflicht):** In Supabase-Dashboard prüfen, dass `kpi_metadata`, `analytics_acknowledgments`, `reference_metric_sources`, `consumption_readings`, `category_mapping_rules` real existieren — nicht nur die lokale SQL-Datei.

---

## 16 Offene Punkte (entschieden)

| Frage | Entscheidung |
|---|---|
| Periodengranularität Composition | umschaltbar Tag/Woche/Monat/Quartal ✓ |
| LLM-Insight Zeitpunkt | erst B6 ✓ |
| Performance-KPI Composition | gleiche Komponente, polymorph (`auftraege` statt `belege`) ✓ |
| Cross-KPI Mobile | Carousel ✓ |
| Acknowledgment-Persistenz | Tabelle `analytics_acknowledgments` ✓ |

**Noch offen (vor B1 zu klären):** Farbschema des Drawers — exakte App-Palette (creme/ruhig) vs. Sektions-Farbcodierung (blau Cross-KPI, violett Insight). Empfehlung: Sektions-Farbcodierung dezent auf creme-Basis (wie in der Showcase), erhöht Lesbarkeit ohne den ruhigen Look zu brechen.
