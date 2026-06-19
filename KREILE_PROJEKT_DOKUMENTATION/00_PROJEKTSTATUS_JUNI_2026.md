# Kreile WerkstattCockpit — Projektstatus Juni 2026

**Stand:** 18. Juni 2026  
**Quelle:** Auswertung aller Specs, Buildbrief, Statusanalyse vom 22. Mai 2026, neueste SPECs (SPEC 46-E, SPEC 48-A vom 17. Juni 2026)

---

## 1. Was ist dieses Projekt?

Galvanischer Betrieb Rolf Kreile, Frankfurt am Main — Traditionswerkstatt seit 1962 (4. Generation).

Zwei parallele Produkte:

| Produkt | Zweck | Status |
|---|---|---|
| **WerkstattCockpit App** | Tablet-basiertes internes Leitsystem für Werkstattbetrieb | Fundament gebaut, ~30–35% der Gesamt-Spec umgesetzt |
| **Neue Website** | Öffentlicher Auftritt, Anfragen, Portfolio, Conversion | Spec liegt vor (v3.1), noch nicht gebaut |

---

## 2. App — Umsetzungsgrad (Stand 22. Mai 2026)

### Was ist gebaut und funktioniert

| Bereich | Status |
|---|---|
| App Shell (Topbar + Sidebar, Layout) | ✅ |
| Startseite / Leitstand mit Auftragskarten | ✅ teilweise |
| Auftragsliste mit Filter | ✅ |
| Wareneingang Kamera-Flow (Simulation) | ✅ |
| Wareneingang Manuell-Flow (3-Schritte) | ✅ |
| Etikettendruck A6 via `window.print()` | ✅ |
| Kundenkartei (Liste + Inline-Profil) | ✅ |
| Lager + Badregelkarte | ✅ |
| Performance-Seite (KPIs, Heatmap, Score) | ✅ teilweise |
| Verzug & Engpässe | ✅ |
| PWA / Offline / IndexedDB | ✅ |
| TypeScript 0 Fehler, Lint 0 Fehler | ✅ |

### Was fehlt (kritisch)

| Lücke | Priorität |
|---|---|
| Alle Stationsseiten `/station/*` → 404 | 🔴 sofort |
| `/today`, `/settings`, `/archive` → 404 | 🔴 sofort |
| Heute-Button in Topbar tot (kein Link) | 🔴 sofort |
| Tote Buttons in OrderActionGrid | 🔴 Demo-Blocker |
| Kundenprofil `/customers/[id]` sehr mager | 🟠 |
| Globale Suche: nur UI, keine Funktion | 🟠 |
| OCR: nur Simulation, kein echtes Google Vision | 🟠 |
| Echter QR-Code (aktuell: CSS-Fake) | 🟠 |
| Supabase nicht verbunden (läuft auf localStorage) | 🟡 |
| TanStack Query fehlt | 🟡 |
| Tests: `src/test/` leer | 🟡 |
| Auth / Rollen / RLS fehlen | 🟡 |
| Mockdaten: nur 4 Kunden, 7 Aufträge (braucht 25/40) | 🟡 |

### Seiten-Übersicht

| Route | Vorhanden | Funktion |
|---|---|---|
| `/` | ✅ | Dashboard Leitstand |
| `/orders` | ✅ | Auftragsliste |
| `/orders/new` | ✅ | Wareneingang-Wizard |
| `/orders/[id]` | ✅ | Auftragsdetail (teilw. tot) |
| `/customers` | ✅ | Kundenliste |
| `/customers/[id]` | ✅ | Profil (sehr mager) |
| `/items` | ✅ | Lager + Bäder |
| `/performance` | ✅ | KPIs |
| `/status` | ✅ | Verzug |
| `/login` | ✅ | Login |
| `/station/*` | ❌ 404 | alle fehlen |
| `/settings` | ❌ 404 | fehlt |
| `/archive` | ❌ 404 | fehlt |
| `/today` | ❌ 404 | Link in App führt dorthin |

---

## 3. Tech-Stack der App

```
Next.js 15 (App Router) · TypeScript · Tailwind · shadcn/ui
Prisma (DB-ORM)
localStorage → Supabase (geplant, noch nicht verbunden)
Drizzle (geplant)
TanStack Query (geplant)
Vitest + Playwright (geplant, noch leer)
PWA / Service Worker / IndexedDB (aktiv)
```

**Geplant (noch nicht gebaut):**
- Supabase (Auth + PostgreSQL + Storage + RLS)
- Google Vision API für echte OCR
- `getUserMedia` für Kamera
- `qrcode` npm-Paket für echte QR-Codes

---

## 4. Neueste Spezifikationen (Juni 2026)

### SPEC 46-E — Kundenkarte + Search Brain Anbindung
Ziel: Kundenkarte wird mit dem universellen Search Brain verknüpft — Anreicherung, Evidenz, externe Quellen.

### SPEC 48-A — Universelles Search Brain (17. Juni 2026)
Die vorhandene Suchleiste (UI-only) soll zum zentralen "Gehirn" der App ausgebaut werden:
- Exakte Navigation
- Volltextsuche
- Semantische Suche
- Operative Fragen in natürlicher Sprache
- Interne + externe Quellen kombiniert
- Sichere Befehlsvorschau + Folgeaktionen

Beispiel: Eingabe `300 SL` → App zeigt alle Kunden mit Mercedes 300 SL-Bezug, mit Evidenzstatus und Treffergrund.

---

## 5. Roadmap

### Phase 1 — Stabilisierung (1–2 Sessions)
- `/today`, `/settings`, `/archive` anlegen
- Alle `/station/[slug]`-Seiten (generisch)
- Heute-Button als echter Link
- Tote Buttons deaktivieren oder fix belegen

### Phase 2 — Demo-fähig (2–3 Sessions)
- Mockdaten aufstocken (12 Kunden, 25 Aufträge)
- Echter QR-Code via `qrcode`
- Kundenprofil ausbauen (Reklamationen, Feedback, Timeline)
- `priority.ts` dynamisch aus `dueDate` berechnen
- Performance-Score-Formel präzisieren

### Phase 3 — Wareneingang vollenden
- Echter Kamerazugriff (`getUserMedia`)
- Vorher-Fotos je Teil aktivieren

### Phase 4 — Analyse & Performance
- KPI-Drilldown
- Heatmap plastischer

### Phase 5 — Datenbankfähigkeit
- Supabase anbinden
- Drizzle ORM
- Auth-Flow
- Google Vision OCR
- Seed-Skript

### Phase 6 — Werkstatt-Test
- Tablet-Test (13.5")
- Echter Betrieb mit Beispielaufträgen
- Lighthouse ≥ 90 Performance

---

## 6. Website — Status

**Spec-Version:** v3.1 (20. Mai 2026) — vollständig ausgearbeitet, noch nicht gebaut.

**Stack-Empfehlung:** Next.js 15 + TypeScript + Tailwind + shadcn/ui + Supabase

**Wichtigste geplante Features:**
- Multi-Page (statt One-Pager), SEO-optimiert
- 5-Schritte-Anfrage-Wizard mit Pflicht-Foto-Upload → Supabase
- Portfolio mit Vorher/Nachher-Split-Slider
- Pressezentrum unter `/presse`
- Ablauf-Seite + FAQ + Versandhinweise
- Chef-Dashboard mit Funnel-Daten (Phase 2)
- Vimeo-Background-Hero (bestehendes Asset)

**Verhältnis zur App:** Website = öffentlicher Eingang. Phase 1: eigene Supabase-Instanz. Phase 2: gemeinsamer Datenkern mit App.

---

## 7. HTML-Previews (gespeicherte Artefakte)

| Datei | Inhalt |
|---|---|
| `kundenkarte_v1_CI.html` | Kundenkarte Corporate Identity |
| `kreile_performance_cockpit_final_dual_theme.html` | Performance Cockpit UI (dual theme) |
| `werkstatt_puls_level2.html` | Werkstatt-Puls-Anzeige Level 2 |
| `Galvanik Kreile - Galvanischer Meisterbetrieb seit 1962.html` | Bestehende Website (gespeichert) |

*Hinweis: Weitere HTML-Artefakte aus Claude-Chats wurden nicht automatisch lokal gespeichert. Diese müssen manuell aus den jeweiligen Chats heruntergeladen werden.*
