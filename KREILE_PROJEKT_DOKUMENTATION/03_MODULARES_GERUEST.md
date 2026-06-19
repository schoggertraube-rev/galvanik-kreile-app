# Modulares Grundgerüst — Wiederverwendbare Bausteine aus dem Kreile-Projekt

**Zweck:** Diese Datei extrahiert das generische Muster aus dem Kreile-WerkstattCockpit.  
Das Gerüst ist auf andere kleine Handwerks- und Produktionsbetriebe übertragbar.

---

## 1. Projekttyp: "Operations App für kleinen Produktionsbetrieb"

### Wann passt dieses Muster?

- Kleiner Betrieb (5–50 Mitarbeiter)
- Physische Objekte / Teile durchlaufen mehrere Arbeitsstationen
- Auftragsbasiert (kein Lager-Massengeschäft)
- Tablet-Nutzung am Arbeitsplatz
- Fotos als Dokumentationsmedium
- Kein komplexes ERP — aber mehr als Excel

**Beispiel-Branchen:**
- Galvanik, Oberflächenbehandlung
- Restaurationswerkstatt
- Schlosserei, Metallbau
- Schreinerei, Tischlerei
- Leder- / Textilverarbeitung
- Uhrmacherei, Goldschmied
- Reparatur-Service (Elektronik, Fahrrad, etc.)

---

## 2. Kern-Datenmodell (universell)

```typescript
// KERN: Diese 5 Entitäten reichen für 80% der Fälle

type Customer = {
  id: string;
  name: string;
  type: "private" | "business" | "institution";
  contact: { phone?: string; email?: string; address?: string };
  notes?: string;
  riskProfile?: "low" | "medium" | "high";  // optional
  createdAt: string;
};

type Order = {
  id: string;
  orderNumber: string;
  customerId: string;
  intakeDate: string;
  dueDate?: string;
  priority: "normal" | "high" | "express";
  status: "draft" | "intake" | "in_progress" | "waiting" | "done" | "shipped" | "cancelled";
  currentRisk: "green" | "yellow" | "orange" | "red";
  source: "manual" | "scan" | "phone" | "email";
  internalNote?: string;
};

type Item = {
  // "Teil", "Objekt", "Job", "Artikel" — je nach Branche umbenennen
  id: string;
  orderId: string;
  title: string;
  description?: string;
  storageLocation?: string;
  currentStationId?: string;
  qrCode?: string;
  photos: string[];  // URLs
};

type Station = {
  // Kann sein: Schleiferei, Galvanik, Küche, Schneiderei, Druckerei...
  id: string;
  name: string;
  slug: string;
  capacity?: number;
  active: boolean;
};

type StatusEvent = {
  // Das Herzstück — alle Bewegungen werden als Events gespeichert
  id: string;
  entityType: "order" | "item" | "workstep";
  entityId: string;
  timestamp: string;
  eventType: string;  // Enum je nach Branche definieren
  userId?: string;
  note?: string;
};
```

---

## 3. Kern-Module (wiederverwendbar)

### Modul A: Wareneingang / Auftragserfassung

**Was es tut:** Neuen Auftrag anlegen — manuell oder per Foto/Scan.

**Bestandteile:**
- `IntakeEntry` — Einstieg: Kamera oder Manuell
- `CameraCapture` — Foto aufnehmen (`getUserMedia`) oder hochladen
- `OCRReviewPanel` — OCR-Ergebnis prüfen und korrigieren
- `CustomerMatchPanel` — Kunden suchen / neu anlegen / Dubletten-Check
- `ItemsPanel` — Teile / Objekte erfassen
- `IntakeSummary` — Zusammenfassung + Bestätigung + Etikett

**Konfigurierbar:**
- OCR-Dienst (Tesseract lokal / Google Vision / Azure)
- Pflichtfelder anpassbar
- Schritt-Anzahl anpassbar

### Modul B: Auftragsliste + Dashboard

**Was es tut:** Aktuelle Aufträge mit Priorität, Filter, Detailpanel.

**Bestandteile:**
- `OrderList` — gefilterte Liste
- `OrderCard` — Karte mit Risikofarbe, Fälligkeit, Station
- `OrderDetailPanel` — Inline-Detail oder Vollseite
- `PriorityBand` — sortiertes Band Grün → Rot
- `StationFilter` — nach Arbeitsstationen filtern

**Konfigurierbar:**
- Sortierkriterien
- Sichtbare Felder je Karte
- Farbsemantik

### Modul C: Kundenkartei

**Was es tut:** Kunden anlegen, suchen, Profil einsehen.

**Bestandteile:**
- `CustomerList` — Suche + Liste
- `CustomerProfile` — Stammdaten, alle Aufträge, Timeline
- `PriceAgreementPanel` — Preisabsprachen je Kunde
- `ComplaintPanel` — Reklamationen
- `SimilarOrdersPanel` — ähnliche frühere Aufträge

### Modul D: Stationsseiten

**Was es tut:** Pro Arbeitsstation: Was liegt an, was wartet, was ist überfällig?

**Bestandteile:**
- `StationPage` (generisch, slug-basiert)
- `StationQueue` — Warteschlange
- `StationHeatTile` — Auslastungs-Kachel

### Modul E: Verzug & Engpass-Monitor

**Was es tut:** Eskalations-Cockpit — kritische Aufträge und überlastete Stationen.

**Bestandteile:**
- `EscalationHeader` — Zusammenfassung „X kritisch, Y gefährdet"
- `CriticalOrderCard` — große Karte mit Alarm-Stil
- `StationHeatmap` — Stationen als Kacheln nach Auslastung
- `DelayReasonPanel` — Gründe und empfohlene Aktionen

### Modul F: Performance / Analytik

**Was es tut:** Kennzahlen aus StatusEvents berechnen und visualisieren.

**Bestandteile:**
- `KPICard` — einzelne Kennzahl
- `TermintreueChart` — Balken/Linie über Zeit
- `DurchlaufzeitChart`
- `EngpassRanking` — Stationen nach Auslastung
- `WeeklyGoalBar` — Wochenziel

**Wichtig:** Nur aus echten StatusEvents berechnen oder Demo-Label.

### Modul G: Scan / OCR

**Was es tut:** Foto → OCR → strukturierter Vorschlag → manuell bestätigen.

**Bestandteile:**
- `ScanEntry` — Tabs: Label / Objekt / Dokument / QR
- `CameraCapture` (geteilt mit Modul A)
- `OCRService` (austauschbarer Interface)
- `ScanReviewPanel` — Vorschlag prüfen + bearbeiten
- `DuplicateChecker` — Dubletten-Erkennung

### Modul H: Etikettendruck

**Was es tut:** A6-Etikett mit QR-Code drucken via `window.print()`.

**Bestandteile:**
- `LabelPrintView` — Print-Portal
- `QRCodeGenerator` — echter QR-Code
- `LabelTemplate` — anpassbar je Betrieb

### Modul I: Offline / PWA

**Was es tut:** App läuft auch ohne Verbindung, synchronisiert später.

**Bestandteile:**
- `OfflineManager` — erkennt Netzstatus
- `SyncQueue` — Aktionen für spätere Synchronisation
- `IndexedDBHelper` — lokaler Cache
- `ServiceWorker` — PWA

### Modul J: Globale Suche / Search Brain

**Was es tut:** Universelle Suche — Navigation + Volltext + semantisch + Befehle.

**Bestandteile:**
- `GlobalSearchBar` — ⌘K Shortcut
- `SearchResultPanel` — Treffer nach Typ
- `SemanticSearchService` — Interface für KI-Suche
- `ExternalEnrichment` — externe Quellen

---

## 4. Tech-Stack-Vorlage

```
Frontend:
  Next.js 15 (App Router) + TypeScript
  Tailwind CSS + shadcn/ui
  Recharts (Charts)
  Framer Motion (Animationen, dezent)

Backend/DB:
  Supabase (PostgreSQL + Auth + Storage + Realtime + RLS)
  Drizzle ORM
  TanStack Query (Server-State-Management)

PWA:
  Service Worker
  IndexedDB (offline Cache + Sync Queue)

OCR/Scan:
  Phase 1: Tesseract.js (lokal)
  Phase 2: pluggable OCR Service (Google Vision / Azure)

QR-Code:
  qrcode npm-Paket

Tests:
  Vitest (Unit)
  Playwright (E2E, Tablet-Viewport 1024×1366)

ID-Strategie:
  cuid2

Analytics:
  Plausible oder Umami (DSGVO-konform)
```

---

## 5. Rollen-Modell (universell)

```typescript
type UserRole = "admin" | "manager" | "worker" | "office" | "readonly";

type RolePermissions = {
  admin: "full";
  manager: "read + edit + delete";
  worker: "read + create + update own";
  office: "read + create customers + orders";
  readonly: "read only";
};
```

Supabase RLS: Row Level Security pro Tabelle.

---

## 6. Routing-Muster

```
/                     → Heute / Dashboard
/orders               → Auftragsliste
/orders/new           → Wareneingang / Auftragserfassung
/orders/[id]          → Auftragsdetail
/customers            → Kundenliste
/customers/[id]       → Kundenprofil
/items                → Teile / Objekte / Lager
/scan                 → Scan-Modul
/station/[slug]       → Stationsseite (generisch)
/status               → Verzug & Engpässe
/performance          → Analytik
/settings             → Einstellungen
/archive              → Archiv
/login                → Login
```

---

## 7. Design-Prinzipien (übertragbar)

### Farbsemantik
- Primärfarbe: Markenfarbe (dunkel, seriös)
- Akzentfarbe: warme Kontrastfarbe (Energie, Aufmerksamkeit)
- Status: Grün / Gelb / Orange / Rot — immer konsistent

### Karten-Hierarchie
- Kritisch: größte Karte, stärkster visueller Akzent
- Normal: Standard-Karte
- Erledigt: gedimmt / archiviert

### Tablet-First
- Touch-Targets min. 44px
- Serifenschrift nur für Branding
- Operative Zahlen: groß, klar, Sans-Serif
- Sidebar kompakt

### Informationshierarchie
1. Was ist kritisch? (sofort sichtbar)
2. Was kommt als nächstes? (prominent)
3. Details auf Anfrage (Karten aufklappbar / Detailseite)

---

## 8. Checkliste für neue Projekte mit diesem Gerüst

- [ ] Branche definieren → Entitäten benennen (Teil / Auftrag / Station anpassen)
- [ ] Stationen definieren (Anzahl, Namen, Kapazitäten)
- [ ] Rollen definieren
- [ ] Design-Token an Kundenmarke anpassen (Farben, Typografie)
- [ ] OCR-Bedarf klären (Ja/Nein, welcher Dienst)
- [ ] Offline-Anforderung klären
- [ ] Analytics-Anforderung klären
- [ ] Website ↔ App-Integration planen (separate Instanz oder gemeinsam?)
- [ ] Phase 1 (Mock/localStorage) vs. Phase 2 (Supabase) abgrenzen
- [ ] Mockdaten erstellen (mind. 10 Kunden, 20 Aufträge)
- [ ] QR-Code-Strategie (welche Drucker? welches Format?)
