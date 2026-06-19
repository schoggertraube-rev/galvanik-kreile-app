# UX/Design-Audit: Kreile WerkstattCockpit
## Principal Product Designer – Vollständige Analyse
**Datum:** 2026-06-19 | **Analysierer:** Claude (Principal Product Designer Framework)

---

## Gesamturteil: FUNKTIONAL, ABER GESTALTERISCH UNZUREICHEND

Die App hat eine solide technische Grundstruktur, ein brauchbares Token-System und einzelne gute Interaktionsideen (Drag-to-Advance auf OrderWideCard, GlobalSearch mit ⌘K, PIN-Login). Sie scheitert jedoch an vier Kernanforderungen des Frameworks:

1. **Fake-Daten werden nicht von echten Daten unterschieden.** Animierte Zähler fallen auf hartcodierte Fallback-Werte zurück (84 Aufträge, 3 kritisch, Demo-Badges überall) — die App wirkt auf echten Nutzern nicht informativ, sondern unglaubwürdig.
2. **Navigation funktioniert auf dem primären Zielgerät (Tablet) nicht.** Hover-abhängige Sidebar-Expansion ist auf Touchscreens funktionslos. Der Nutzer sieht nur Icons ohne Labels.
3. **Alle authentifizierten Seiten sind leer.** Ohne sichtbaren Hinweis auf die fehlende Session zeigt die App exakt die gleiche leere Ansicht wie ein echter Nullbestand. Kein Nutzer versteht, warum.
4. **Zwei parallele Token-Systeme.** `ci-tokens.css` (--ci- Präfix) und `tokens.css` (navy-, gold-, accent- Präfix) koexistieren. OrderWideCard ignoriert beide und verwendet 8 hartcodierte Hex-Farben.

---

## 1. Hauptprobleme

| Prio | Problem | Auswirkung auf Nutzer | Ursache | Empfohlene Lösung |
|------|---------|----------------------|---------|------------------|
| **P0** | Auth-Failure ohne UI-Feedback | Alle Datenseiten zeigen leere Listen. Nutzer weiß nicht, ob keine Daten existieren oder ob er nicht eingeloggt ist. | `checkAppAuth()` → `UNAUTHORIZED` → `return []`, kein Toast, kein Redirect | Bei `!auth.ok`: Redirect zu `/start` oder sichtbarer Banner „Bitte erneut einloggen" |
| **P0** | Animierte Zähler mit Fake-Fallback | Home-Dashboard zeigt "84 Aufträge / 3 kritisch" wenn DB leer. Nutzer vertraut der App nicht. | `orders.length > 0 ? orders.length : 84` und `|| 3` in page.tsx Z.203-204 | Zähler nur anzeigen wenn Daten da; sonst Skeleton oder `—` |
| **P0** | Demo-Badges in Produktionsoberfläche | „Stressphasen", „Urlaub M. Müller", „S. Schmidt" sind hartcodiert in Home-Render. Fake-Inhalte statt echter Daten. | Hartcodierte JSX-Blöcke in page.tsx (Zeile ~500ff.) | Diese Blöcke entfernen oder hinter Feature-Flag; nur echte Kalender-/HR-Daten zeigen |
| **P1** | Hover-Only Navigation auf Tablet-Zielgerät | Sidebar bleibt auf Touch-Geräten kollabiert (72px Icons). Kein Label sichtbar. Unterpunkte nicht erreichbar. | `onMouseEnter`/`onMouseLeave` in RightNav.tsx, keine Touch-Alternative | Toggle-Button oder persistente Labels ab md-Viewport; Bottom-Navigation für Mobile |
| **P1** | Doppelte Icons: BarChart3 für Cockpit + Analyse | Nutzer kann nicht unterscheiden welcher Nav-Eintrag was ist | Gleiche Icon-Komponente zweimal importiert | Cockpit → PieChart oder LayoutDashboard; Analyse → TrendingUp |
| **P1** | `dangerouslySetInnerHTML` Inline-CSS in OrderWideCard | 8 hardcodierte Hex-Farben (`#c0392b`, `#d4850a`, `#1e7e45`, `#2471a3`, etc.) außerhalb des Token-Systems; JetBrains Mono statt Fraunces | Keine Token-Bindung in OrderWideCard.tsx | Farben auf CI-Danger, CI-Warn, CI-Success, navy-900 umschreiben; Monofont → `font-serif` (Fraunces) |
| **P1** | Magenta (#C2185B) ist CI-Accent aber kaum sichtbar | Kreile-Brand-Farbe erscheint in keiner primären UI-Aktion; accent-orange dominiert stattdessen | tokens.css bildet --ci-accent: #C2185B ab, Komponenten nutzen accent-orange als primär | Primär-Buttons auf ci-accent (Magenta) umstellen; Accent-Orange für Warnungen/Sekundär reservieren |
| **P1** | Warendurchlauf-Leitstand zeigt 0 Aufträge + leere Checklist | Prod-MA (Sohn) öffnet Hauptseite → sieht leere Prozessliste → kein Handlungsansatz | Auth-Failure (B-03 aus Audit) + generierte Checklist basiert auf `orders` Array | Auth-Fix + Skeleton + "Heute noch nichts erfasst – Auftrag anlegen" als Leer-State |
| **P2** | TopWorkflowBar zeigt nur 3 von 5 Stationen | Entmetallisierung und Schleiferei fehlen; für Prod-MA an diesen Stationen kein direkter Navpfad | STATIONS-Array in TopWorkflowBar.tsx hat nur 3 Einträge | Alle 5 Stationen oder explizit "Galvanik" als Oberbegriff für alle Zwischen-Stationen kennzeichnen |
| **P2** | „Warendurchlauf" als Route-Name irreführend | Mitarbeiter erwartet Hallenübersicht, landet bei Auftragserfassung | `/warendurchlauf/neu` redirectet zu Wareneingang, nicht zu Übersicht | Route `/warendurchlauf` = Hallenübersicht/Kanban; `/warendurchlauf/eingang` = Auftragserfassung |
| **P2** | Station-Seite: technischer Text als Beschreibung | „Stationsspezifische Übersicht der Werkstücke in Schritt: BESCHICHTUNG" | Direkte string interpolation statt nutzerorientierter Formulierung | „Galvanik – Aufträge in Bearbeitung" oder stationsspezifischen Leitspruch |
| **P2** | Scan-Page: False-Success ohne Datenbankschreibvorgang | „Scan erfolgreich verarbeitet – Auftrag wird erstellt." — kein Auftrag wird erstellt | `console.log` statt Server Action | Fix aus Audit B-02; Erfolgsmeldung erst nach DB-Bestätigung |
| **P3** | Home: Feedback-Formular mit „Demo-Modus"-Hinweis | Nutzer soll Feedback geben, bekommt aber „Speicherung wird später angebunden" | `(Demo-Modus)` Text in page.tsx | Formular entweder vollständig anschließen (Supabase) oder entfernen |
| **P3** | Menü-Label „Kunden/Aufträge" für einen Eintrag | Zwei Konzepte, ein Label, drei Unterseiten — kognitive Belastung | Historisch gewachsen | Oberebene „Auftragsmanagement"; Sub: Kunden / Aufträge / Anfragen |

---

## 2. Nutzerfluss – Drei kritische Pfade

### Pfad A: Prod-MA (Sohn) — Morgenstart

| Schritt | Aktueller Ablauf | Problem | Empfohlener Ablauf |
|---------|-----------------|---------|-------------------|
| 1 | Öffnet /start → sieht Wetter + PIN-Pad | ✓ Gut | Behalten |
| 2 | PIN eingeben → Redirect zu Home | ✓ Gut | Behalten |
| 3 | Home zeigt „84 Aufträge / 3 kritisch" | Fake-Zahlen, echte Daten: 0 wegen Auth | Echte Zähler oder Skeleton; nach Login auto-refresh |
| 4 | Klickt TopWorkflowBar → Beschichtung | Öffnet Station mit 0 Aufträgen, kein Hinweis | „Noch keine Aufträge an dieser Station" + CTA „Neuen Auftrag erfassen" |
| 5 | Sucht bestimmten Auftrag | Muss zu /orders → sieht 0 Aufträge | GlobalSearch (⌘K) direkt im Header prominent zeigen; touch-aktivierbar |
| 6 | Dragging OrderWideCard → weiterleiten | ✓ Gute Interaktion — wenn Daten vorhanden wären | Fix Auth-Kette, dann sofort nutzbar |

### Pfad B: Büro-MA — Kundenanruf

| Schritt | Aktueller Ablauf | Problem | Empfohlener Ablauf |
|---------|-----------------|---------|-------------------|
| 1 | Kunde ruft an: „Wann ist Auftrag A-2026-042 fertig?" | — | — |
| 2 | Öffnet App, geht zu Kunden/Aufträge | Leere Liste, keine Session-Info | Direktlink GlobalSearch öffnen |
| 3 | Keine Suchergebnisse | Auth-Failure | Fix Auth; Suche funktioniert dann |
| 4 | Findet Auftrag, öffnet Detail | ✓ OrderOverlay vorhanden | Auftragsstatus + Stationsposition klar anzeigen |
| 5 | Gibt Auskunft | Aktuell unmöglich | Nach Fix: in <10 Sekunden möglich |

### Pfad C: Chef — Montagmorgen-Überblick

| Schritt | Aktueller Ablauf | Problem | Empfohlener Ablauf |
|---------|-----------------|---------|-------------------|
| 1 | Öffnet Cockpit | ✓ Nur für Inhaber-Rolle | Behalten |
| 2 | Sieht KPIs (Termintreue, Durchlaufzeit…) | Evtl. 0 wegen Auth | Auth-Fix |
| 3 | Sieht „Urlaub M. Müller in 2 Wochen" | Fake-Daten hartcodiert | Echte Kalenderintegration oder Block entfernen |
| 4 | Öffnet Scan-Feature für Beleg-OCR | Scheinbar funktioniert es — tut es aber nicht | Fix B-01/B-02 |
| 5 | Erwartet Auftrag im System | Kein Auftrag erstellt | Korrekte Rückmeldung nach Fix |

---

## 3. UI-Hierarchie — Hauptseiten

### Home-Dashboard (/)

| Ebene | Aktuell | Soll |
|-------|---------|------|
| Primäre Information | Animierter Zähler (84 Aufträge — fake) | Echte offene Aufträge mit Status-Breakdown |
| Primäre Aktion | Unklare Quick-Cards (4 gleichgewichtige Buttons) | 1 CTA: „Auftrag erfassen" oder „Warendurchlauf öffnen" |
| Sekundäre Information | Checklist-Tasks (generiert aus leeren Daten) | Echte kritische Aufträge als Liste (max. 5) |
| Sekundäre Aktion | „Cockpit öffnen" (Button + Nav-Eintrag = doppelt) | Button entfernen; Nav reicht |
| Ausgeblendete Details | Stressphasen, Urlaub (Fake) | Entfernen bis echte Daten-Integration |
| Fehler-/Warnzustände | Offline-Banner wenn Sync-Probleme | ✓ Gut implementiert — behalten |

### Warendurchlauf (/warendurchlauf)

| Ebene | Aktuell | Soll |
|-------|---------|------|
| Primäre Information | 4 KPI-Kacheln (Termintreue, Durchlaufzeit, Engpass, Offen) | ✓ Richtig — aber echte Daten nötig |
| Primäre Aktion | Keine explizite CTA auf der Übersicht | „Neuen Auftrag erfassen" prominent |
| Sekundäre Information | Checklist (dynamisch, aber auth-abhängig) | Stationsauslastung visuell (Balken pro Station) |
| Ausgeblendete Details | Einzelaufträge pro Station | Via Station-Kachel aufklappbar oder Drill-Down |
| Fehler-/Warnzustände | Keine Leeranzeige für 0 Aufträge | Leer-State: „Noch keine Aufträge erfasst – Eingang öffnen" |

### Station-Seite (/station/beschichtung)

| Ebene | Aktuell | Soll |
|-------|---------|------|
| Primäre Information | Stationsname (technisch: „BESCHICHTUNG") | Stationsname menschlich + Anzahl Aufträge aktuell |
| Primäre Aktion | Kein erkennbarer CTA | „Teil übernehmen" / „Station starten" |
| Sekundäre Information | Auftragsliste (0 Einträge) | Auftragsliste sortiert nach Dringlichkeit |
| Ausgeblendete Details | OrderWideCard Drag-Geste | ✓ Behalten — aber besser dokumentieren (Swipe-Hint) |

---

## 4. Responsive-Analyse

| Gerät | Layout | Navigation | Detaildarstellung | Hauptaktion | Scrollverhalten | Urteil |
|-------|--------|------------|-------------------|-------------|-----------------|--------|
| Desktop (>1280px) | 72px Sidebar + Content | Hover-Expansion auf 200px | Overlay/Drawer ✓ | Gut erreichbar | Normal | ✓ Akzeptabel |
| Tablet quer (1024px) | 72px Sidebar + Content | **Hover-Expansion nicht aktivierbar** | Overlay funktioniert | Buttons erreichbar | Normal | ❌ Navigation kaputt |
| Tablet hochkant (768px) | MobileNav/BottomNav laut Shell | Unbekannt ob konsistent | Overlay auf vollem Screen | Evtl. außerhalb Daumenzone | Möglicherweise doppelt | ⚠️ Nicht verifiiziert |
| Smartphone (375px) | Vermutlich Einspalte | MobileBottomNav | Vollbild-Overlay | Sticky-CTA unklar | Möglicherweise doppelt | ⚠️ Nicht verifiziert |

**Kritischster Responsive-Fehler:** Der primäre Betriebsmodus (Tablet quer — Prod-MA in der Halle) nutzt genau die Navigation, die auf Touch nicht bedienbar ist.

**Empfehlung:** 
```
@media (pointer: coarse) {
  /* Sidebar immer expanded ODER Bottom Sheet ODER Toggle-Button */
}
```
Alternativ: RightNav erhält einen permanenten Toggle-Button (Hamburger-Icon oben), der unabhängig von Hover funktioniert.

---

## 5. Token-System — Konsolidierung notwendig

### Ist-Zustand

```
ci-tokens.css       → --ci-accent: #C2185B (Magenta), --ci-ink: #1A1F2E
tokens.css          → --navy-900, --accent-orange, --bg-app, ...
globals.css         → Maps beide Systeme + 20 Backward-Compat-Aliases
OrderWideCard.tsx   → 8 hardcodierte Hex-Farben + JetBrains Mono (nicht im Stack)
HomePage.tsx        → Inline style={{ color: '#0E8C8C', background: '#E1F1F1' }} (teal — CI-fremd)
```

### Soll-Zustand

| Anwendungsfall | Farbe | Token |
|----------------|-------|-------|
| Primär-Button, Haupt-CTA | Magenta #C2185B | `--ci-accent` / `ci-accent` class |
| Warnungen, Urgency-Soon | Orange #E86A33 | `--accent-orange` |
| Kritisch/Gefahr | #B0413E | `--ci-danger` |
| Erfolg | #4F8F58 | `--ci-success` |
| Neutrale Daten | Navy #1A1F2E | `--navy-900` / `--ci-ink` |
| Hintergrund | Cream #F1E9DC | `--bg-app` / `--ci-bg` |
| Zahlen-Typografie | Fraunces | `font-serif` |
| UI-Text | Inter | `font-sans` |

**Sofortmaßnahme:** OrderWideCard.tsx `dangerouslySetInnerHTML` ersetzen durch CSS-Custom-Properties aus dem Token-System.

---

## 6. Konkrete Umsetzung — Prioritätsliste

### Sprint 1 — Blocker (parallel zu Bug-Fixes aus Audit)

**A. Auth-Feedback-Banner** (`src/app/actions/orders.actions.ts` + alle Pages)
- Bei `!auth.ok`: `router.push('/start?reason=session_expired')` oder
- Persistenter Banner: `SessionWarningBanner` Komponente in KreileAppShell
- Betroffene Dateien: `orders.actions.ts`, `customers.actions.ts`, `KreileAppShell.tsx`
- Neues UI-State: `unauthorized` mit Text „Sitzung abgelaufen – bitte erneut einloggen"

**B. Home-Dashboard Fake-Daten bereinigen** (`src/app/page.tsx`)
- Zeilen 203-204: `|| 84` und `|| 3` entfernen
- Wenn `orders.length === 0 && !loading`: Skeleton ODER gezielter Leer-State statt Fake-Zahlen
- Demo-Blöcke (Stressphasen, Urlaub M. Müller, S. Schmidt): Entfernen oder hinter `NEXT_PUBLIC_DEMO_MODE` Flag
- Feedback-Formular: An echten Endpunkt anschließen oder entfernen

**C. Navigation Tablet-Fix** (`src/components/layout/RightNav.tsx`)
```tsx
// Statt nur onMouseEnter/Leave: Toggle-Button hinzufügen
const [pinned, setPinned] = useState(false);
const expanded = pinned || isHovered;
// + Button oben in der Sidebar: onClick={() => setPinned(!pinned)}
```
- Oder: Ab `md:` Breakpoint permanent 180px (Labels immer sichtbar)

### Sprint 2 — Design-Konsistenz

**D. OrderWideCard Token-Migration** (`src/components/orders/OrderWideCard.tsx`)
- `dangerouslySetInnerHTML` block → CSS classes via Token-Variablen
- `JetBrains Mono` → `font-serif` (Fraunces) für `c-due-val`
- Urgency-Farben über `data-urgency` Attribut + CSS:
```css
[data-urgency="crit"] .card-bar { background: var(--ci-danger); }
[data-urgency="soon"] .card-bar { background: var(--accent-orange); }
```

**E. Primärfarbe auf Magenta** (alle Primär-Buttons)
- `bg-navy-900 text-white` auf primären Buttons → `bg-[--ci-accent] text-white`
- Betrifft: `button.tsx`, `ScanPage`, `WideCard Confirm`, `ErfassungsModal`

**F. Station-Seite Text** (`src/app/station/[slug]/page.tsx`)
```tsx
// Statt: `Stationsspezifische Übersicht der Werkstücke in Schritt: ${slug.toUpperCase()}`
const stationLabels: Record<string, string> = {
  beschichtung: "Galvanik — Aufträge in Bearbeitung",
  wareneingang: "Wareneingang — Neue Aufträge",
  warenausgang: "Warenausgang — Bereit zur Lieferung",
  // ...
};
```

**G. Doppel-Icons Navigation** (`src/components/layout/RightNav.tsx`)
- Cockpit: `LayoutDashboard` statt `BarChart3`
- Analyse: `TrendingUp` statt `BarChart3`

### Sprint 3 — Workflow-Erweiterungen

**H. TopWorkflowBar: Alle 5 Stationen**
- Wareneingang → Entmetallisierung → Schleiferei → Galvanik → Warenausgang
- Kompakte Darstellung auf Tablet (Icons + kurze Labels)
- Horizontal scrollbar auf Mobile

**I. GlobalSearch auf Touch verfügbar machen**
- Derzeit: ⌘K (Keyboard-Shortcut) — für Tablet kein Touch-Trigger
- Header: Search-Icon-Button → öffnet GlobalSearch Overlay
- Betroffene Datei: `KreileHeader.tsx`

**J. Leer-Zustände aller Daten-Seiten**
Jede Seite mit datenabhängigen Listen braucht 3 distinct States:
```
loading:        <Skeleton /> (nur bei tatsächlicher Ladezeit)
empty-auth:     "Bitte einloggen, um Daten zu sehen" + Redirect-CTA
empty-data:     "Noch keine [X] vorhanden – [Aktion starten]"
error:          "Daten konnten nicht geladen werden – [Erneut versuchen]"
```
- Betrifft: `orders/page.tsx`, `customers/page.tsx`, `station/[slug]/page.tsx`, `warendurchlauf/`

---

## 7. Motion Design — Bestandsaufnahme

| Komponente | Animation | Bewertung |
|-----------|-----------|-----------|
| OrderWideCard Drag-to-Advance | Framer Motion, dragElastic | ✓ Funktional sinnvoll |
| Home floatIn Keyframes | `hm-floatIn .5s ease` | ⚠️ Nicht über `prefers-reduced-motion` geschützt (außer global) |
| Home gradShift Keyframes | Dauerhaft animierter Hintergrund | ❌ Verbraucht CPU, kein Nutzen |
| Home pulse Keyframes | Box-shadow pulsiert | ❌ Dauerhaftes Pulsieren ohne Kontext |
| RightNav width transition | `transition-[width] duration-200` | ✓ Kurz, ruhig, funktional |
| Card `card-pulse` auf crit | 3s animation loop | ⚠️ Nur bei P0-Aufträgen okay — nicht dauerhaft auf idle |

**Empfehlung:** `hm-gradShift` und `hm-pulse` aus `page.tsx` entfernen. `card-pulse` nur bei tatsächlich kritischen Aufträgen (risk=red) und maximal 3 Zyklen.

---

## 8. Barrierefreiheit — Sofortmaßnahmen

| Befund | Betroffene Komponente | Maßnahme |
|--------|----------------------|---------|
| Statusfarben nur über Farbe (rot/grün) | OrderWideCard, Badges | Icon + Farbe + Text kombinieren |
| RightNav-Icons ohne `aria-label` | RightNav.tsx / RightNavItem | `aria-label={label}` bei collapsed state |
| GlobalSearch: Fokus-Trap fehlt | GlobalSearch.tsx | `focus-trap-react` oder manuelle Implementierung |
| Inline-Styles ohne semantischen Kontext | HomePage Demo-Blöcke | Enfernen — Problem löst sich |
| Touch-Targets in Sub-Menü: 12px Font | SubMenuLink in RightNav | `min-h-[44px]` sicherstellen |

---

## 9. Definition of Done — Prüfstatus

| Kriterium | Status | Aktion erforderlich |
|-----------|--------|---------------------|
| Realer Nutzerfluss vollständig beschrieben | ✅ Analyse abgeschlossen | — |
| Jede Hauptaktion funktional verdrahtet | ❌ Scan/OCR/Auth kaputt | Bugs aus Audit beheben |
| Loading-/Empty-/Error-/Data-States | ❌ Fehlend auf allen Hauptseiten | Sprint 3, Punkt J |
| Speichern und Reload nachgewiesen | ❌ Nicht möglich ohne Auth-Fix | — |
| Desktop geprüft | ✅ Akzeptabel | Minor-Fixes |
| Tablet quer geprüft | ❌ Navigation kaputt | Sprint 1, Punkt C |
| Smartphone hochkant geprüft | ⚠️ Nicht vollständig verifiziert | Sprint 2 |
| Fokus/Tastatur geprüft | ⚠️ Partial | Sprint 3 |
| Keine Mockdaten im Produktionspfad | ❌ 30+ Mock-Referenzen | Bereinigung |
| CI-Tokens zentral verwendet | ❌ Zwei parallele Systeme + Inline-Styles | Sprint 2, Punkte D+E |
| Nachweisbar schneller/klarer bedienbar | ❌ Noch nicht messbar | Nach Allen Fixes |

---

## 10. Empfohlene Token-Bereinigung (Einmalig)

**Konsolidierungsziel:** Ein einziges Token-System, das den CI-Standard widerspiegelt.

```css
/* BEHALTEN in tokens.css — werden von Komponenten genutzt */
--bg-app: #F1E9DC;          /* Kreile Cream */
--navy-900: #1A1F2E;        /* Haupttext + Primäre Flächen */
--accent-orange: #E86A33;   /* Sekundär-Accent, Warnungen */

/* HINZUFÜGEN / STÄRKEN */
--brand-magenta: #C2185B;   /* Primär-CTA, Hauptaktion — bisher untergenutzt */
--gradient-brand: linear-gradient(115deg, #7A3FB0 0%, #C2185B 38%, #F2643C 72%, #F6A93B 100%);

/* ENTFERNEN: ci-tokens.css Doppel-Definitionen */
/* → Alle --ci-* durch die entsprechenden neuen Tokens ersetzen */
/* → ci-tokens.css leert sich auf 0 Zeilen */
/* → globals.css: 20 Backward-Compat-Aliases entfernen */
```

Geschätzter Aufwand der Token-Konsolidierung: 4h (Suchen+Ersetzen in ~40 Komponenten).

---

*Analyse durchgeführt: 2026-06-19 | Methodik: Statische Codeanalyse, Komponenteninspektion, Nutzerfluss-Simulation | Framework: Principal Product Designer & Interaction Architect*
