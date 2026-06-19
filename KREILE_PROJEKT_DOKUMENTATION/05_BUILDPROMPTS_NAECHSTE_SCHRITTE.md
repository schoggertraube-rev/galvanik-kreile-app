# Kreile — Fertige Build-Prompts für nächste Antigravity-Sessions

**Zweck:** Direkt kopierbar in Antigravity / Claude Code. Jeder Prompt ist in sich abgeschlossen.

---

## Prompt 1: Phase 1 Stabilisierung (SOFORT)

```
Kontext: Kreile WerkstattCockpit — Next.js 15 App Router, TypeScript, Tailwind, shadcn/ui.
Projektpfad: [dein Pfad]/02_app/

Aufgabe: Behebe alle kritischen 404-Fehler und toten Buttons.

Schritt für Schritt:

1. Erstelle /src/app/today/page.tsx
   → Einfacher Redirect auf "/" mittels next/navigation redirect()

2. Erstelle /src/app/settings/page.tsx
   → Platzhalter-Seite mit Titel "Einstellungen" und Hinweis "Wird in Kürze verfügbar"
   → Gleicher Layout-Rahmen wie andere Seiten

3. Erstelle /src/app/archive/page.tsx
   → Platzhalter-Seite mit Titel "Archiv"
   → Gefilterte Auftragsliste: nur status === 'done' oder status === 'shipped'

4. Erstelle /src/app/station/[slug]/page.tsx
   → Generische Stationsseite
   → Liest den slug aus den Params (Promise<{slug: string}> für Next.js 15)
   → Lädt Aufträge aus ordersRepository, filtert nach current_station === slug
   → Zeigt gefilterte Liste mit Detailpanel (gleiche Struktur wie /orders/page.tsx)
   → Stationsname aus /src/constants/stations.ts

5. In Topbar.tsx: Heute-Button zu <Link href="/"> machen

6. In OrderActionGrid.tsx:
   → Alle Buttons ohne Handler: disabled={true} setzen
   → title="In Entwicklung" als Tooltip
   → Keine sichtbare Änderung am Design

7. Nach jeder Änderung prüfen: TypeScript 0 Fehler, ESLint 0 Fehler.

Wichtig:
- Keine neue Architektur
- Kein Supabase
- Keine OCR
- Mockdaten und Repositories unverändert
- Bestehendes Design nicht anfassen
```

---

## Prompt 2: Mockdaten aufstocken + QR-Code

```
Kontext: Kreile WerkstattCockpit — gleicher Stack wie oben.

Aufgabe: Mockdaten aufstocken und echten QR-Code einbauen.

1. Mockdaten in /src/lib/mockData.ts aufstocken:
   → 12 realistische Kunden (Mix: Privatpersonen, Oldtimer-Sammler, Museen, Firmen)
   → 25 Aufträge (diverse Stationen, diverse Zustände: 5 kritisch, 8 in Arbeit, 7 wartend, 5 fertig)
   → Jeder Auftrag hat 2–4 Teile
   → Realistische Teilebeschreibungen: Stoßstange, Motorradteil, Türgriff, Chromleiste, Felge etc.
   → Typische Kundennamen: Mix aus Deutsch, einige Firmen
   → cuid2 für alle IDs
   → Aufträge gleichmäßig auf alle 5 Stationen verteilt

2. Echter QR-Code:
   → npm install qrcode @types/qrcode
   → In /src/lib/services/labelService.ts: QR-Code-Generator einbauen
   → QR-Code-Inhalt: JSON mit { orderId, partId, orderNumber, partNumber }
   → In LabelPrintView.tsx: CSS-Fake-Barcode ersetzen durch echten QR-Code (als <img src={qrDataUrl}>)

3. TypeScript 0 Fehler, Lint 0 Fehler.
```

---

## Prompt 3: Kundenprofil ausbauen

```
Kontext: Kreile WerkstattCockpit.
Ziel: /customers/[id]/page.tsx von 55 Zeilen auf vollständiges Kundenprofil ausbauen.

Bestehendes beibehalten:
- CustomerProfileHeader.tsx
- PriceAgreementPanel.tsx

Neu hinzufügen:

1. OrderTimeline-Sektion:
   → Alle Aufträge des Kunden als Timeline
   → Status-Icons, Datum, kurze Beschreibung
   → Letzte 10, mit "Alle anzeigen" Toggle

2. ComplaintPanel.tsx erstellen:
   → Liste der Reklamationen
   → Status: offen / in Bearbeitung / gelöst
   → Neue Reklamation anlegen Button (Modal)

3. SimilarOrdersPanel.tsx erstellen:
   → Aufträge anderer Kunden mit gleichen Teile-Typen
   → Zeigt: Teil-Typ, Finish, Preis (wenn vorhanden), Auftragsnummer
   → "Ähnliche frühere Aufträge als Preisreferenz"

4. FeedbackPanel.tsx erstellen:
   → Interne Notizen und Bewertungen
   → Freitextfeld "Interner Hinweis"
   → Ampel-Bewertung (gut / neutral / problematisch)

Layout: Tabs oder vertikale Sections — kein zu langer Scroll.
Mobile/Tablet: alle Sections zusammenklappbar.
```

---

## Prompt 4: Wareneingang — Echter Kamerazugriff

```
Kontext: Kreile WerkstattCockpit.
Aktuell: CameraCapture.tsx simuliert Kamera, kein echter Zugriff.

Aufgabe:

1. In CameraCapture.tsx: navigator.mediaDevices.getUserMedia einbauen
   → Constraint: { video: { facingMode: 'environment' } } (Rückkamera)
   → Fallback: falls getUserMedia nicht verfügbar → file input <input type="file" accept="image/*">
   → Live-Vorschau als <video> Element
   → "Foto aufnehmen" Button → canvas.drawImage → Blob → Base64
   → Fehlerbehandlung: Kamera verweigert → freundliche Meldung + file input Fallback

2. Bildqualitätsprüfung (einfach):
   → Prüfen ob Bild min. 400x400px
   → Falls zu klein: Warnung "Bitte näherkommen oder besser belichten"
   → Trotzdem fortfahren erlauben

3. ocrService.ts: Interface vorbereiten für austauschbaren OCR-Dienst
   → Klare Schnittstelle: async analyze(imageBase64: string): Promise<ScanResult>
   → Phase 1: Simulation bleibt drin
   → Phase 2: Google Vision wird hier eingehängt

4. CameraCapture in bestehendem IntakeEntry-Flow ersetzen.
   Kein Breaking Change für Manuell-Flow.
```

---

## Prompt 5: Performance-Score-Formel

```
Kontext: Kreile WerkstattCockpit — /performance/page.tsx.

Aufgabe: Score-Formel präzisieren und Priority-Logik dynamisch machen.

1. Score-Formel (aus §12 der Korrekturdatei):
   Werkstatt-Score = (
     Termintreue × 0.35 +
     Durchlaufzeit-Effizienz × 0.25 +
     Engpass-Auslastung-inverted × 0.20 +
     Reklamationsquote-inverted × 0.10 +
     Scanquote × 0.10
   ) × 100

   Termintreue = fertige Aufträge pünktlich / alle fertigen Aufträge
   Durchlaufzeit-Effizienz = Ziel-Durchlaufzeit / tatsächliche Durchlaufzeit (cap bei 1.0)
   Engpass-Auslastung = max(auslastungen aller Stationen) → invertieren (1 - x)
   Reklamationsquote = Reklamationen / fertige Aufträge → invertieren
   Scanquote = Aufträge per Scan / alle Aufträge

2. In /src/lib/priority.ts:
   → Statt statischer Texte: dynamisch aus dueDate berechnen
   → Heute + X Tage → Ampelfarbe
   → red: überfällig oder < 0 Tage
   → orange: < 1 Tag
   → yellow: 1–2 Tage
   → green: > 2 Tage

3. Performance-Seite: Label "Demo-Daten" solange keine echten StatusEvents vorhanden.
   → Prüfung: gibt es StatusEvents in localStorage? Wenn ja: echte Daten. Wenn nein: Demo-Label.

4. TypeScript 0 Fehler.
```

---

## Prompt 6: Supabase-Anbindung (Phase 5)

```
Kontext: Kreile WerkstattCockpit — Stack: Next.js 15, TypeScript, Tailwind, shadcn/ui.
Aktuell läuft alles auf localStorage. Supabase soll angebunden werden.

Voraussetzung: Supabase-Projekt erstellen, ENVs bereitstellen.

Aufgabe:

1. Drizzle ORM einrichten:
   → npm install drizzle-orm @supabase/supabase-js
   → Schema in /src/lib/db/schema.ts (alle Tabellen aus Datenmodell)
   → Migration erstellen und anwenden

2. Repositories umschreiben:
   → ordersRepository.ts: von localStorage auf Supabase-Queries
   → customersRepository.ts: Supabase
   → Alle anderen Repositories: Supabase
   → localStorage bleibt als Offline-Cache (IndexedDB)

3. TanStack Query einrichten:
   → npm install @tanstack/react-query
   → QueryProvider in layout.tsx
   → useOrders(), useCustomers() etc. als Query-Hooks
   → Optimistic Updates für Statusänderungen

4. Auth-Flow:
   → Supabase Auth (E-Mail + Passwort)
   → /login/page.tsx auf echte Supabase-Auth umstellen
   → middleware.ts (nicht proxy.ts!) für Route-Protection
   → Rollen aus user_metadata lesen

5. RLS-Policies für alle Tabellen anlegen.

6. Seed-Skript /src/scripts/seed.ts:
   → 12 Kunden, 25 Aufträge, 50 StatusEvents, 80 Teile
   → Realistische Verteilung auf Stationen

7. TypeScript 0 Fehler. Offline-Funktionalität bleibt erhalten.
```

---

## Prompt 7: Website bauen (Phase 1)

```
Ziel: Neue Website für Galvanik Kreile bauen.
Stack: Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui + Supabase

Kernaufgaben:

1. Seitenstruktur anlegen:
   / (Startseite), /leistungen, /oldtimer, /portfolio, /ablauf, /versand, /ueber-uns, /presse, /anfrage, /kontakt, /impressum, /datenschutz

2. Startseite (/):
   → Hero-Video: Vimeo 415243473 als Background-Player (background=1&autoplay=1&loop=1&muted=1&dnt=true)
   → Kernbotschaft: "Meisterbetrieb seit 1962"
   → Adresse: Kölner Str. 80, 60327 Frankfurt am Main
   → CTA: "Anfrage stellen" (primär) + "Portfolio ansehen" (sekundär)
   → Referenzlogos (12 Kunden)
   → Pressezitat (1–2 Stimmen prominent)

3. Anfrage-Wizard (/anfrage):
   → 5-Schritte-Wizard
   → Schritt 3: Pflicht-Foto-Upload (react-dropzone)
   → Nach Absenden: Supabase-Insert (Tabelle: inquiries) + bestätigungs-E-Mail (Supabase Edge Function)
   → Felder: type, services, photos[], name, phone, email, company, notes

4. Portfolio (/portfolio + /portfolio/[slug]):
   → Karten-Übersicht mit Filter (Oldtimer / Industrie / Design / Kunst)
   → Story-Seite: Vorher/Nachher-Split-Slider, Material, Technik, Beschreibung

5. Analytics: Plausible einbinden (1 Script-Tag, kein Cookie-Banner)

6. DSGVO: Datenschutzerklärung, Cookie-freie Analyse, Impressum.

Farben: dunkelblau #12213A, kupfer #E6862E, weiß
Schrift: elegante Serifenschrift für Titel, klare Sans-Serif für Text.
Lighthouse-Ziel: ≥ 90 Performance, ≥ 95 Accessibility.
```

---

## Prompt 8: Search Brain (SPEC 48-A)

```
Kontext: Kreile WerkstattCockpit — bestehende Suchleiste (GlobalSearch.tsx) ist UI-only.
Spec: SPEC 48-A Universelles Search Brain

Aufgabe: Search Brain implementieren (Phase 1 — intern, kein Internet).

1. SearchService in /src/lib/services/searchService.ts:
   → Suche über: customers, orders, parts (lokal / Supabase)
   → Volltext über name, orderNumber, partTitle, notes
   → Ergebnis-Typen: 'customer' | 'order' | 'part' | 'action'

2. GlobalSearch.tsx erweitern:
   → Debounce 200ms
   → Ergebnisse nach Typ gruppiert anzeigen
   → Tastaturnavigation (Pfeiltasten + Enter)
   → Direktnavigation zu Ergebnis (Link)

3. Semantische Suche (Phase 1 einfach):
   → Synonym-Mapping: "SL" → "Mercedes SL", "300 SL", "R107"
   → Teilekategorie-Mapping: "Stoßstange" → Teile mit category='bumper'
   → Fuzzy-Search über Levenshtein-Distanz (Fehlertoleranz)

4. Aktions-Vorschläge:
   → Eingabe "neuer Auftrag" → [Neuen Auftrag anlegen]
   → Eingabe "wareneingang" → [Zum Wareneingang]
   → Eingabe "verzug" → [Zu Verzug & Engpässe]

5. Null-Treffer-Handling:
   → "Keine Treffer in Kreile-Daten für X"
   → Vorschläge: ähnliche Begriffe / Navigationsziele

Keine externen API-Aufrufe in Phase 1.
TypeScript 0 Fehler.
```
