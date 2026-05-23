# Kreile WerkstattCockpit — Korrekturen, Konsolidierung und verbindliche Bauentscheidungen

> **Status: VERBINDLICH. Diese Datei hat Vorrang vor allen Aussagen in `00_…` bis `07_…` und `README_INTEGRATION_ANTIGRAVITY.md`, wo Widersprüche bestehen.**
>
> **Antigravity-Hinweis:** Diese Datei wird als „08" einsortiert. Sie ist die letzte zu lesende Datei vor dem Build. Bei Konflikt mit früheren Dateien zählt diese Datei.
>
> **Ablage:** `docs/antigravity/kreile-workshop-app/08_KORREKTUREN_VERBINDLICH_KREILE.md`

## 0. Zweck

Die Dateien 00–07 sind fachlich solide, enthalten aber Widersprüche, offene technische Entscheidungen und mehrere unrealistische MVP-Annahmen. Diese Datei räumt auf:

- Stack-Entscheidung fixiert
- Stationsmodell entdoppelt
- Datenmodell-Lücken geschlossen
- OCR/Kamera realistisch eingeordnet
- Offline-Strategie ergänzt
- Test- und Build-Strategie konkretisiert
- Antigravity-Prompts entschärft

Annahmen werden offen dokumentiert. Blockierende Restfragen stehen am Ende.

---

## 1. Verbindlicher Stack (Lock-In)

Die Datei `03_DATENMODELL_ARCHITEKTUR_BACKEND.md` enthält eine Bewertungsmatrix ohne Entscheidung. Gemäß Höchster Projektregel (Pragmatik, kein EU-/Dogma-Verbot, klare Empfehlung) gilt verbindlich:

| Schicht | Entscheidung | Begründung |
|---|---|---|
| Frontend-Framework | **Next.js 14 (App Router) + React + TypeScript** | PWA-fähig, Server Components für Datenzugriff, Vercel-deploybar, ein Tool für Frontend und API-Routen |
| UI-Kit | **Tailwind CSS + shadcn/ui + lucide-react** | tablet-tauglich, schnell, keine Designspielerei |
| State/Query | **TanStack Query v5** (für Server-State), Zustand für UI-State | nicht Redux, nicht Context-Hölle |
| Backend / DB | **Supabase (Postgres 16, Auth, Storage, Realtime, RLS)** | ein Anbieter für Auth + DB + Datei-Storage + Realtime. Spart ca. 4 Wochen Infra-Arbeit gegenüber Neon-Eigenbau |
| ORM / Query Layer | **Drizzle ORM** | TypeScript-first, leichter als Prisma, gut mit Supabase |
| ID-Strategie | **`cuid2`** (`@paralleldrive/cuid2`) | kollisionsfest, URL-safe, kürzer als UUID, sortierbar genug für unsere Zwecke |
| OCR | **Google Cloud Vision API** (DOCUMENT_TEXT_DETECTION) | preislich ~1.50 USD / 1000 Bilder, sehr gute Erkennung, kein eigenes Modell nötig |
| Datei-Storage | **Supabase Storage** (Bucket `customer-files`) | direkt mit RLS gekoppelt |
| Mockdaten | **`@faker-js/faker`** mit fixem Seed `42` | reproduzierbar, gleicher Demo-Stand bei jedem Start |
| Tests | **Vitest** (Unit), **Playwright** (E2E auf Tablet-Viewport 1024×1366) | kein Jest, kein Cypress |
| Linting / Format | **ESLint + Prettier + TypeScript strict mode** | erzwungen via Pre-Commit (Husky + lint-staged) |
| Deployment | **Vercel** für App, **Supabase Cloud** (EU-West, Frankfurt-Region) | wartungsarm |

### Wichtige Folge

Die Aussage in `03_…` *„MVP: noch keine harte Backend-Festlegung im UI-Code"* wird **kassiert**. Wir bauen sofort gegen Supabase, weil der Mockprovider-Pattern-Aufwand bei diesem Stack-Mix mehr Reibung erzeugt als spart. Wir nutzen stattdessen **Seed-Skripte** für Demo-Daten direkt in Supabase.

Begründung: Antigravity/Claude Code schreibt schneller direkt gegen Supabase als gegen einen abstrakten `WorkshopDataProvider`. Der Provider-Pattern aus `03_…` ist Overengineering für ein 1-Mandanten-MVP.

---

## 2. Korrektur: Stationsmodell

### Problem

In `00_…` und `01_…` werden 6 Stationen genannt, aber **„Galvanik" erscheint zweimal** (einmal als „Galvanik / Entmetallisierung", einmal als „Veredelung / Galvanik"). Das verwirrt Nutzer und Datenmodell.

Außerdem ist **„Lager" keine Werkstatt-Station** im Sinne eines Auftragsdurchlaufs, sondern ein Querschnittsmodul.

### Korrektur (verbindlich)

**Werkstattfluss-Stationen (genau 5, in Reihenfolge):**

```text
1. Wareneingang
2. Entmetallisierung
3. Schleiferei
4. Galvanik (Veredelung)
5. Warenausgang
```

**„Lager" gehört nicht in den Werkstattfluss.** Lager wird:
- als eigener Bereich in der Sidebar geführt (Menüpunkt „Lager")
- zusätzlich als kompakter Statusindikator rechts vom Werkstattfluss eingeblendet (analog zum „Heute"-Button)
- bei kritischem Bestand färbt der Lager-Indikator und nicht eine Pseudo-Station

**Stationsbezeichnungen in DB (Slugs):**

```text
wareneingang
entmetallisierung
schleiferei
galvanik
warenausgang
```

**Topbar-Layout (Korrektur zu `01_…`):**

```text
[Logo] [Wareneingang][Entmetallisierung][Schleiferei][Galvanik][Warenausgang] | [Lager-Status] [Heute-Status] [Suche] [User]
```

---

## 3. Korrektur: OCR und Kamera-Realität

Die Datei `02_WARENEINGANG_KAMERA_OCR_AUTONOMIE.md` setzt zu hohe Erwartungen. Korrekturen:

### 3.1. Stufenmodell ersetzen

Die 4 Stufen aus `02_…` werden ersetzt durch **2 realistische Stufen**:

| Stufe | Inhalt | MVP-Status |
|---|---|---|
| **A — Foto + Server-OCR** | Browser-Foto → Upload → Google Vision DOCUMENT_TEXT_DETECTION → strukturierter Text zurück → Field-Extraction via Regex + Heuristik (Telefon, E-Mail, IBAN, Datum, Menge) → Review-Panel | **MVP, sofort baubar** |
| **B — Kunden-Fuzzy-Match** | OCR-Text gegen `customers`-Tabelle: exakter Name, Telefon, E-Mail, dann Trigram-Ähnlichkeit (Postgres `pg_trgm`) | **MVP, sofort baubar** |

**Nicht im MVP:**
- Live-Edge-Detection im Kamerabild (braucht opencv.js oder native App)
- KI-Teilezählung im Bild (braucht trainiertes Modell oder kostenpflichtige API wie Google Vision Object Localization)
- Wiedererkennung ähnlicher Teile per Bild (braucht Embeddings + Vector-DB)

**Was MVP stattdessen leistet:**
- Foto wird als Beleg gespeichert
- OCR liefert Text
- Nutzer korrigiert/bestätigt
- Mengen werden per **Stepper/Slider** manuell eingegeben (nicht aus Bild gezählt)

### 3.2. ML-Kit-Erwähnung kassiert

`02_…` Stufe 3 nennt „ML Kit". Das ist eine native Android-Library und passt nicht zur PWA-Linie aus `00_…`. **Streichen.** Stattdessen: Server-OCR über Google Vision REST-API.

### 3.3. Confidence-Score normalisieren

Google Vision liefert pro Wort Confidence 0–1. Wir normalisieren auf **0–100** für die UI:

| Confidence | Verhalten |
|---|---|
| ≥ 85 | grün, vorausgewählt |
| 60–84 | gelb, Nutzer muss prüfen |
| < 60 | orange, nicht automatisch übernommen |

`OCRExtractedField.confidence` wird auf `0–100` Integer fixiert (nicht `number` mit unklarem Bereich).

### 3.4. Kameraaufnahme — konkrete API

```text
Component: <CameraCapture />
API: navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
Foto: canvas.toBlob() → JPEG ~80% Qualität → max. 2048px Kantenlänge
Upload: direkt zu Supabase Storage → Trigger Edge Function → Google Vision → DB
Fallback: <input type="file" accept="image/*" capture="environment" /> für Geräte ohne getUserMedia
```

---

## 4. Korrektur: Datenmodell

### 4.1. Fehlende Entitäten ergänzen

`03_…` referenziert mehrfach Entitäten, die nicht definiert sind. Pflicht-Ergänzungen:

```ts
type User = {
  id: string;                 // cuid2, gleich Supabase auth.users.id
  email: string;
  fullName: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
};

type Supplier = {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  notes?: string;
  active: boolean;
};

type Communication = {
  id: string;
  customerId: string;
  orderId?: string;
  channel: "phone" | "email" | "whatsapp" | "in_person" | "post";
  direction: "in" | "out";
  subject?: string;
  body?: string;
  occurredAt: string;
  createdBy: string;
};

type Shipment = {
  id: string;
  orderId: string;
  customerId: string;
  carrier?: "dhl" | "ups" | "self_pickup" | "courier" | "other";
  trackingNumber?: string;
  shippedAt?: string;
  deliveredAt?: string;
  weightKg?: number;
  notes?: string;
};
```

### 4.2. `PriceAgreement` — Widerspruch lösen

In `03_…` ist `priceAgreements?: PriceAgreement[]` als Property im `Customer`-Typ definiert. In `05_…` ist `PriceAgreement` als eigene Entität definiert.

**Verbindlich:** Eigene Tabelle `price_agreements` mit `customerId` als FK. Im `Customer`-Type **kein** eingebettetes Array.

### 4.3. `StatusEvent.eventType` — typsicher machen

```ts
type StatusEventType =
  | "OCR_SCAN_STARTED"
  | "OCR_SCAN_COMPLETED"
  | "DOCUMENT_CAPTURED"
  | "CUSTOMER_MATCHED"
  | "ORDER_CREATED_FROM_SCAN"
  | "ORDER_CREATED_MANUAL"
  | "ITEMS_SUGGESTED_FROM_SCAN"
  | "ITEM_COUNT_CONFIRMED"
  | "PHOTO_CAPTURED"
  | "LABEL_PREPARED"
  | "WARENEINGANG_COMPLETED"
  | "STATION_STARTED"
  | "STATION_COMPLETED"
  | "QUALITY_CHECK_PASSED"
  | "QUALITY_CHECK_FAILED"
  | "REWORK_STARTED"
  | "SHIPMENT_PREPARED"
  | "SHIPMENT_SENT"
  | "CUSTOMER_PICKUP"
  | "COMPLAINT_OPENED"
  | "COMPLAINT_RESOLVED"
  | "BATH_MEASUREMENT_TAKEN"
  | "BATH_BLOCKED"
  | "BATH_RELEASED"
  | "STOCK_LOW"
  | "STOCK_REPLENISHED"
  | "NOTE_ADDED";

type StatusEvent = {
  id: string;
  eventType: StatusEventType;    // statt string
  // ... wie in 03_… definiert
};
```

### 4.4. `WorkTimeLog` — Pausen abbilden

```ts
type WorkTimeLog = {
  id: string;
  orderId: string;
  itemId?: string;
  stationId: string;
  userId: string;
  activityType: WorkTimeActivity;
  startedAt: string;
  endedAt?: string;            // null = läuft noch
  pauseMinutes: number;        // accumulated breaks
  netMinutes?: number;         // computed: (ended - started) - pause
  bookingMethod: "slider" | "timer" | "manual";
  note?: string;
};
```

`netMinutes` wird serverseitig berechnet, nicht von der UI gesendet.

### 4.5. Badstatus-Logik korrigieren

`04_…` zeigt einen `computeBathStatus`, der bei Temperatur-Overrun `critical` zurückgibt, bei pH-Overrun nur `watch`. Das ist inkonsistent.

**Korrektur — worst-status-wins:**

```ts
function computeBathStatus(m: BathMeasurement, t: BathTargetValues): BathStatus {
  const checks: BathStatus[] = [];

  if (t.temperatureMin != null && m.temperature != null && m.temperature < t.temperatureMin) checks.push("critical");
  if (t.temperatureMax != null && m.temperature != null && m.temperature > t.temperatureMax) checks.push("critical");
  if (t.phMin != null && m.ph != null && m.ph < t.phMin) checks.push("critical");
  if (t.phMax != null && m.ph != null && m.ph > t.phMax) checks.push("critical");

  if (t.concentrationMin != null && m.concentration != null && m.concentration < t.concentrationMin) checks.push("watch");
  if (t.concentrationMax != null && m.concentration != null && m.concentration > t.concentrationMax) checks.push("watch");

  if (m.visualState === "contaminated") checks.push("critical");
  if (m.visualState === "cloudy") checks.push("watch");

  if (checks.includes("critical")) return "critical";
  if (checks.includes("watch")) return "watch";
  return "stable";
}
```

Die Fachgrenzwerte selbst (Temperatur, pH, Konzentration) sind Domänenwissen von Kreile und müssen vor Produktivbetrieb von der Galvanik-Fachseite bestätigt werden. → siehe blockierende Fragen.

---

## 5. Berechtigungsmatrix (konkret)

`03_…` skizziert Rollen, aber keine Berechtigungen. Verbindlich für MVP:

| Aktion | admin | meister | office | workshop | quality | viewer |
|---|---|---|---|---|---|---|
| Kunden anlegen / bearbeiten | ✅ | ✅ | ✅ | – | – | – |
| Kunden lesen | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Preisabsprachen anlegen / sehen | ✅ | ✅ | ✅ | – | – | – |
| Aufträge anlegen | ✅ | ✅ | ✅ | ✅* | – | – |
| Aufträge bearbeiten | ✅ | ✅ | ✅ | ✅** | ✅** | – |
| Stationsstatus ändern | ✅ | ✅ | – | ✅ | ✅ | – |
| Material buchen / Zeit buchen | ✅ | ✅ | – | ✅ | – | – |
| Qualitätskontrolle | ✅ | ✅ | – | – | ✅ | – |
| Badmessung eintragen | ✅ | ✅ | – | ✅ | – | – |
| Lager: Stock In / Out | ✅ | ✅ | ✅ | ✅ | – | – |
| Lager: Korrektur / Inventur | ✅ | ✅ | – | – | – | – |
| Performance-Seite | ✅ | ✅ | ✅ | (gefiltert) | (gefiltert) | (gefiltert) |
| Stammdaten / Kataloge | ✅ | ✅ | – | – | – | – |
| Nutzerverwaltung | ✅ | – | – | – | – | – |

*Workshop legt Aufträge **nur** über Wareneingang an, nicht ad hoc.
**Workshop ändert nur eigene Station; Quality nur QK-relevante Felder.

Umsetzung: **Supabase Row Level Security (RLS)** pro Tabelle. Policy-Templates werden in `db/policies/` versioniert.

---

## 6. Offline-Strategie (fehlt komplett)

Die 00–07 Dateien erwähnen Offline-Betrieb nicht. Werkstatt-Tablets verlieren regelmäßig WLAN.

### 6.1. MVP-Niveau

- **Service Worker** via `next-pwa`: App-Shell, Routen, statische Assets offline verfügbar
- **Read-Cache** für letzte 50 Aufträge und 100 Kunden via IndexedDB (Dexie.js)
- **Schreibvorgänge offline:**
  - Statusänderung, Materialbuchung, Zeitbuchung, Foto: in IndexedDB-Queue gepuffert
  - Sync-Worker pusht bei Reconnect
  - Konfliktstrategie: **last-write-wins** mit Server-Timestamp; bei Konflikt zeigt UI Warnung
- **Nicht offline:** OCR (braucht Cloud), Suche über alle Daten (braucht DB), Performance-Analytics

### 6.2. UI-Indikator

Topbar: kleiner Punkt zeigt Online/Offline. Bei Offline und vorhandener Queue: Badge mit Anzahl ausstehender Sync-Vorgänge.

---

## 7. Etikettendruck (fehlt)

`02_…` erwähnt „Etikett/QR wird vorbereitet", aber kein Druckpfad.

### Verbindlich für MVP:

- **Etikett-Format:** A6 (105×148 mm), QR-Code mit Order-ID, Klartext: Kundenname, Auftragsnummer, Teilname, Datum
- **Erzeugung:** serverseitig als PDF (Library: `pdf-lib` oder `puppeteer`)
- **Druck:** Browser-Druckdialog (`window.print()` auf PDF-Vorschau) oder Download
- **Spätere Stufe:** Direktdruck via Bluetooth-Etikettendrucker (z. B. Brother QL-820NWB) — **nicht im MVP**

---

## 8. Mockdaten / Seed-Strategie

`07_…` spricht von „Mockdaten", aber ohne Strategie. Verbindlich:

- **Seed-Skript:** `db/seed.ts`, ausführbar via `npm run db:seed`
- **Bibliothek:** `@faker-js/faker` mit `faker.seed(42)`
- **Inhalt:**
  - 1 Hotel-Mandant „Kreile Werkstatt" (für spätere Mandantenfähigkeit vorbereitet)
  - 6 User: 1 admin, 1 meister, 1 office, 2 workshop, 1 quality
  - 25 Kunden (Mischung: 15 Privat, 5 Business, 5 Institution wie Museum/Kirche)
  - 12 Lagerartikel (Chemie, Schleifpapier, Polierscheibe, Bürste, Verpackung)
  - 4 Bäder (Nickelbad 1, Chrombad 1, Entfettung 1, Entmetallisierung 1)
  - 40 Aufträge in unterschiedlichen Stationen und Statuszuständen
  - 8 davon kritisch / verspätet (damit Statusfarben sichtbar wirken)
  - 60 Bestandsbewegungen
  - 30 Badmessungen
  - 80 StatusEvents
  - 15 Fotos (Platzhalter-Bilder von picsum.photos in Supabase Storage)

---

## 9. Suche und Performance

`00_…` listet Suchfelder, aber keine Implementierung.

### Verbindlich:

- **Postgres Full-Text-Search** auf `customers`, `orders`, `items` mit `tsvector`-Spalten + GIN-Index
- **Trigram-Suche** (`pg_trgm`) für Fuzzy-Match auf Namen
- **Debounce** im Such-Input: 250 ms
- **Limit** pro Suchanfrage: 20 Treffer, gruppiert nach Entität
- **Keyboard-Shortcut:** `Cmd/Ctrl + K` öffnet globale Suche
- **Keine Volltextsuche** in Anhängen/PDFs im MVP

---

## 10. Test- und Build-Strategie

`07_…` erwähnt `npm test` „falls vorhanden". Verbindlich:

| Test-Ebene | Tool | Coverage-Ziel | Wann gegen |
|---|---|---|---|
| Type-Check | `tsc --noEmit` | 100% Pass | Pre-Commit + CI |
| Lint | ESLint | 0 Errors, 0 Warnings | Pre-Commit + CI |
| Unit-Tests | Vitest | 60% auf `lib/`, 80% auf `lib/priority/`, `lib/status/`, `lib/baths/` | CI |
| Komponenten-Tests | Vitest + React Testing Library | kritische Pfade: Wareneingang-Wizard, Verbrauchsbuchung, Bad-Messung | CI |
| E2E | Playwright auf Viewport 1024×1366 (Tablet) | 1 Happy Path pro Block aus `07_…` | CI nightly + pre-release |
| Visual | optional, später | – | – |

**Pflicht-CI vor Merge:** Type-Check + Lint + Unit + Komponenten + 1 E2E-Smoketest.

---

## 11. Antigravity-Prompts: Korrekturen

### 11.1. Prompt 1 (Analyse) — zu groß

`07_…` Prompt 1 verlangt eine Gesamtanalyse. Bei nicht-trivialer Codebasis sprengt das das Token-Fenster.

**Ersatz — drei kleinere Prompts:**

```text
Prompt 1a (Routing & Shell):
Liste alle Dateien unter src/app oder src/pages auf. Zeige Routen, Layouts und Auth-Middleware. Verändere nichts.

Prompt 1b (Komponenten-Inventur):
Liste alle Dateien unter src/components mit Pfad und Hauptzweck (eine Zeile pro Datei). Markiere Komponenten, die nirgendwo importiert werden.

Prompt 1c (Datenzugriff & Mocks):
Zeige alle Dateien, die Supabase aufrufen oder Mockdaten enthalten. Liste tote / nicht referenzierte Mockdaten.
```

### 11.2. Reihenfolge der Prompts korrigieren

`README_INTEGRATION_…` empfiehlt Reihenfolge `00 → 03 → 01 → 02 → 05 → 04 → 06 → 07`.

**Korrigierte Reihenfolge gemäß Stack-Lock-In:**

```text
1. 08_KORREKTUREN_VERBINDLICH_KREILE.md     (diese Datei zuerst)
2. 00_KREILE_APP_NEUSTART_MASTERPROMPT.md
3. 03_DATENMODELL_ARCHITEKTUR_BACKEND.md    (mit Patches aus §1 und §4)
4. 01_NAVIGATION_STARTSEITE_WERKSTATTFLUSS.md (mit Stationskorrektur aus §2)
5. 02_WARENEINGANG_KAMERA_OCR_AUTONOMIE.md  (mit OCR-Realität aus §3)
6. 05_KUNDENKARTEI_AUFTRAG_DETAIL_ZEITSTRAHL.md
7. 04_WARENWIRTSCHAFT_BADREGELKARTE_VERBRAUCH.md
8. 06_PERFORMANCE_GAMEDESIGN_ANALYTIK.md
9. 07_UMSETZUNGSPLAN_ANTIGRAVITY_TESTS.md   (mit Prompt-Patches aus §11.1)
```

### 11.3. Sicherheitsregel ergänzen

In jedem Antigravity-Build-Prompt vorab einfügen:

```text
Vor jeder Dateioperation: git status zeigen. Vor jedem destruktiven Befehl (rm, drop, truncate): expliziten Plan ausgeben und auf Freigabe warten. Keine Migrationen ohne vorheriges Backup-Statement.
```

---

## 12. Performance-Score: Formel präzisieren

`06_…` nennt Gewichtungen, aber keine Formel. Verbindlich:

```ts
function computeScore(i: PerformanceScoreInput): number {
  // Alle Eingaben werden auf 0..100 normalisiert (höher = besser)
  const onTime     = clamp(i.onTimeRate * 100, 0, 100);
  const cycle      = clamp(100 - (i.avgCycleTimeIndex - 1) * 50, 0, 100); // index 1 = soll, 1.5 = 50% schlechter → 25 Punkte
  const critical   = clamp(100 - i.criticalOrders * 15, 0, 100);          // jeder kritische Auftrag kostet 15 Punkte
  const complaints = clamp(100 - i.complaintRate * 100, 0, 100);
  const docs       = clamp(((i.scanRate + i.documentationRate) / 2) * 100, 0, 100);
  const stations   = clamp(i.stationHealthIndex * 100, 0, 100);

  return Math.round(
    onTime     * 0.25 +
    cycle      * 0.20 +
    critical   * 0.20 +
    complaints * 0.15 +
    docs       * 0.10 +
    stations   * 0.10
  );
}
```

Die Eingaben kommen aus aggregierten SQL-Views (`v_performance_inputs`), die täglich materialisiert werden.

---

## 13. UX-Korrekturen

| Stelle | Problem | Korrektur |
|---|---|---|
| `00_…` „Lagerbutton im Wareneingang" vs. `01_…` „Lager als Station" | Doppelt | Lager ist eigener Bereich (siehe §2). In Wareneingang nur sekundärer Link „Lagerbestand prüfen" |
| `02_…` „Vergangene Annahmen / ähnliche Aufträge" | Algorithmus unklar | MVP: SQL-Filter `customerId = ?` ORDER BY `receivedAt` DESC LIMIT 10. Trigram-Fuzzy auf Teilname. Embeddings später. |
| `05_…` ActionGrid mit 10+ Buttons | Visuelle Überladung | Primäre Aktion groß. Max. 4 sekundäre Kacheln. Rest in Drop-Menü „Mehr". |
| `06_…` „Streaks" | Risiko: alberne Optik | Streaks nur bei objektiven Werten (Wochenziel, 0 Reklamationen, pünktliche Badmessung). Keine Pokale, keine Avatare. |
| `01_…` „Heute"-Button neben Werkstattfluss | OK, aber Datum fehlt im Button | Format: `[Heute · Mi 21.05.]` mit Statusfarbe |

---

## 14. Konsolidierte Akzeptanzkriterien

Diese Akzeptanzkriterien ersetzen die teilweise widersprüchlichen Listen in den Einzeldateien:

1. App startet ohne Konsolenfehler.
2. Login funktioniert (Supabase Auth, E-Mail + Passwort).
3. Nach Login: Startseite mit Begrüßung, Tagesstatus, 3 priorisierten Aktionen.
4. Werkstattfluss zeigt **genau 5 Stationen** (siehe §2). Lager ist separat.
5. Jeder Stationsbutton spiegelt Live-Status aus DB (`station_health` View).
6. Wareneingang zeigt zuerst nur **Kamera** und **Manuell** als Hauptbuttons.
7. Kamera-Flow erzeugt einen Auftrag mit verknüpften Fotos, OCR-Daten und Vorschlägen.
8. OCR liefert reale Daten via Google Vision (kein Demo-Fake, sondern echte API-Antwort).
9. Auftragsdetail erlaubt: Status ändern, Material buchen, Zeit buchen, Foto ergänzen.
10. Verbrauchsbuchung erzeugt `stock_movement`-Eintrag, reduziert `inventory_items.currentStock` atomar.
11. Badmessung speichert in `bath_measurements`, aktualisiert `baths.status` über Trigger.
12. Bei `bath.status = critical` färbt der Galvanik-Stationsbutton sich rot.
13. Bei `inventory_item.currentStock < minStock` färbt sich der Lager-Indikator.
14. Performance-Seite lädt Werte aus `v_performance_inputs` und zeigt Score per Formel aus §12.
15. Alle roten Karten enthalten konkrete Handlungsempfehlung mit Klickziel.
16. Offline: Statusänderung möglich, wird gepuffert, synct bei Reconnect.
17. RLS-Policies aktiv: Workshop-User sehen keine Preisabsprachen.
18. E2E-Smoketest „Wareneingang → Auftrag → Schleiferei → Galvanik → QK → Versand" läuft in Playwright durch.
19. Lighthouse-Score: ≥ 90 für Performance, ≥ 95 für Accessibility auf Tablet-Viewport.
20. Keine toten Buttons. Jeder Button hat Handler oder ist `disabled` mit Tooltip.

---

## 15. Geänderte Umsetzungsreihenfolge

Korrigiert gegenüber `07_…`:

| Phase | Inhalt | Geschätzter Aufwand (Tagewerke) |
|---|---|---|
| 0 | Repo-Setup: Next.js 14, Tailwind, shadcn/ui, Supabase-Init, Drizzle, ESLint, Vitest, Playwright | 1 |
| 1 | DB-Schema in Drizzle, Migrationen, Seed-Skript mit faker | 2 |
| 2 | Auth + RLS-Policies + Rollenlogik | 1 |
| 3 | App-Shell: Header, Topbar (Werkstattfluss + Lager-Status + Heute-Status), Sidebar, Routing | 2 |
| 4 | Startseite + Stationsseiten mit Live-Daten | 2 |
| 5 | Wareneingang: Kamera, Foto-Upload, Vision-OCR, Review-Panel, Auftragserstellung | 3 |
| 6 | Auftragsdetail + Material- und Zeitbuchung | 2 |
| 7 | Kundenkartei + Zeitstrahl + Preisabsprachen + Reklamationen | 2 |
| 8 | Lager-Modul + Bestandsbewegungen | 1.5 |
| 9 | Badregelkarte + Messungen + Statusberechnung | 1.5 |
| 10 | Performance-Seite + Score + Heatmap + Insights | 2 |
| 11 | Offline / PWA / Service Worker / Sync-Queue | 2 |
| 12 | E2E-Tests, Lighthouse, Polish, Etikettendruck | 1.5 |
| | **Summe MVP** | **~23.5 Tagewerke** |

Phasen 5, 11, 12 sind die größten Risikoposten. Bei Zeitnot zuerst Etikettendruck und Offline-Schreibvorgänge auf v1.1 verschieben, aber **nicht** Tests.

---

## 16. Blockierende offene Fragen

Diese müssen vor Phase 9 bzw. Phase 5 beantwortet sein:

1. **Bad-Grenzwerte:** Welche konkreten Soll- und Grenzwerte gelten je Bad (Nickel, Chrom, Entfettung, Entmetallisierung)? — Fachfrage an Kreile / Galvanik-Meister.
2. **Stationsnamen:** Heißt die Station offiziell „Galvanik" oder „Veredelung"? Verbindliche Bezeichnung für Etiketten und Kundenkommunikation.
3. **Preislogik:** Sind Preisabsprachen pauschal pro Kunde, pro Oberfläche, oder als Stückpreis? → bestimmt Tabellenstruktur.
4. **Etikett:** Gibt es einen Bestandsdrucker? Welches Format, welcher Anschluss?
5. **DSGVO:** Werden Mitarbeiterzeiten (`WorkTimeLog` mit `userId`) für Lohnabrechnung verwendet? Falls ja: Betriebsrat/Mitbestimmung relevant, separate Auftragsverarbeitung.
6. **Mandantenfähigkeit:** MVP nur Kreile, oder soll DB-Schema von Anfang an `tenant_id`-Spalten haben? → Empfehlung: ja, da später ohne Schmerz reaktivierbar.

## 17. Nicht-blockierende dokumentierte Annahmen

- Sprache: ausschließlich Deutsch (keine i18n im MVP).
- Region: Supabase EU-West (Frankfurt).
- Zeitzone serverseitig UTC, UI in `Europe/Berlin`.
- Währung: EUR fix, keine Multi-Currency.
- Datumsformat UI: `Mi 21.05.2026` (deutsche Kurzform).
- Logging: serverseitig in Supabase `pg_audit`, clientseitig keine externen Tracker im MVP (Plausible/Umami in v1.1).
- Backup: Supabase Point-in-Time-Recovery, 7-Tage-Fenster reicht für MVP.

---

## 18. Was Antigravity in dieser Datei beachten muss

- **Vorrang:** Bei Widerspruch zu 00–07 gilt diese Datei.
- **Reihenfolge:** Diese Datei zuerst lesen (siehe §11.2).
- **Stack:** Keine Abweichung vom Lock-In aus §1 ohne Rückfrage.
- **Mockprovider-Pattern:** Wird ersetzt durch direktes Supabase + Seed (§1).
- **Stationsanzahl:** Genau 5 (§2), Lager separat.
- **OCR:** Sofort echtes Google Vision, kein Demo-Fake (§3).
- **Tests:** Vitest + Playwright, nicht Jest (§10).
- **Build-Prompts:** Prompt 1 aus 07_… ist ersetzt durch 1a/1b/1c (§11.1).

Ende der verbindlichen Korrekturen.
