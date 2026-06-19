# Kreile WerkstattCockpit — Vollständige App-Spezifikation

**Konsolidiert aus:** APP_Galvanik_Werkstatt_OS.md, ANTIGRAVITY_BUILDBRIEF, Korrekturdatei, SPEC 46-E, SPEC 48-A  
**Stand:** 18. Juni 2026

---

## 1. Produktvision

**Das WerkstattCockpit ist kein CRM und kein Auftragsbuch. Es ist ein Werkstatt-Leitsystem für eine kleine Traditionswerkstatt.**

Leitbild:
> „Was muss als Nächstes passieren, wo droht Verzug, welches Teil liegt wo, und welcher Kunde ist betroffen?"

Jede Ansicht beantwortet eine dieser Fragen:
1. Was ist jetzt wichtig?
2. Was ist kritisch?
3. Wo liegt das Teil?
4. Was blockiert den Auftrag?
5. Was wurde zuletzt gemacht?
6. Welche Entscheidung muss jemand treffen?

**Nicht wirken wie:** Excel, Steuerberater-Software, buntes Kinderspiel, überladene Admin-Oberfläche.  
**Wirken wie:** Werkstatt-Cockpit, hochwertiger Manufaktur-Workflow, klarer Produktionsmonitor.

---

## 2. Zielgruppe & Rollen

| Rolle | Nutzung |
|---|---|
| Meister / Chef | Tagesüberblick, Engpässe, Performance, Entscheidungen |
| Werkstatt-Mitarbeiter | Wareneingang, Stationsarbeit, Teil-Scans |
| Büro | Kundenkartei, Auftragserfassung, Kommunikation |
| Nur-Lesen | Eingeschränkter Zugriff |

---

## 3. Navigation & Screens

### 3.1 Primäre Navigation (Sidebar)

1. **Heute** — zentraler Shopfloor-Startscreen
2. **Aufträge** — Auftragsbuch + Detailansichten
3. **Teile** — Teile-/Objektakten
4. **Kunden** — Kundenkartei
5. **Scan** — Foto, Versandetikett, Wareneingang, QR/Barcode
6. **Verzug** — Eskalation, Engpässe, Fristen
7. **Performance** — Kennzahlen, Level, Wochenziele
8. **Einstellungen**

### 3.2 Werkstattfluss-Topbar (oben)
Zeigt die 5 Produktionsstationen als klickbaren Status-Balken:
- Wareneingang → Schleiferei/Politur → Entmetallisierung → Galvanik → Warenausgang
- Farbe je Station: Grün/Gelb/Orange/Rot nach Auslastung
- Rechts: Lager-Indikator (separat, nicht Teil der Stationsleiste)

### 3.3 Screen: „Heute in der Werkstatt" (Startscreen)

**Zweck:** Tablet an Wand oder Werkbank — im Vorbeigehen erkennbar:
- welcher Auftrag kritisch
- welche Station blockiert
- was als Nächstes zu tun ist
- ob Werkstatt im Plan ist

**Layout:**
```
Topbar: Suche | Scan | Heute | Benachrichtigungen | Nutzer
├─────────────────┬──────────────────────────────────────┤
│ Kompakte Nav    │ HEUTE IN DER WERKSTATT                │
│                 │ [Ware scannen] [Auftrag anlegen]      │
│                 │                                       │
│                 │ Prioritätsband Grün → Gelb → Orange → Rot │
│                 │                                       │
│                 │ KRITISCHE KARTE GROSS                 │
│                 │ Leicht kritisch                       │
│                 │ Im Plan                               │
│                 │ Wartet / blockiert                    │
│                 │                                       │
│                 │ Rechts: Stationsstatus / Engpass / Scanlog │
└─────────────────┴──────────────────────────────────────┘
```

**Kartenprinzip:** Jede Auftragskarte hat:
- Linke Statusform: Kreis (grün/rot) oder Dreieck (gelb/orange) oder Pause
- Große Zeitinfo rechts: „3 Std. überfällig" / „morgen" / „2 Tage"
- Arbeitsart (Vernickeln, Verchromen, Polieren etc.)
- Kunde kleiner darunter
- Station / nächster Arbeitsschritt
- Eine empfohlene Aktion als Button

**Kritische Karte:**
- 1.25× höher als normale Karten
- Roter Rand 6–8px links
- Hellroter Hintergrund, roter Schatten
- Pulsierend (langsam, 6–10s Zyklus, kein Blinken)

### 3.4 Screen: Wareneingang / Scan

Tabs:
1. Versandetikett
2. Ware/Objekt
3. Begleitzettel
4. QR/Teilecode

Ablauf:
1. Foto aufnehmen oder hochladen
2. OCR/Barcode auslesen (Simulation → später Google Vision)
3. Erkannte Felder anzeigen (Name, Adresse, Telefon, Sendungsnummer, Carrier)
4. Dubletten-Check gegen bestehende Kunden/Aufträge
5. Vorschlag: neuer Auftrag / bestehenden Kunden zuordnen / bestehenden Auftrag ergänzen
6. Mitarbeiter bestätigt
7. QR-/Teilecode erzeugen
8. Etikett drucken (A6, `window.print()`)

**Wichtig: Kein automatisches Speichern ohne Bestätigung.**

### 3.5 Screen: Auftragsdetail

- Zeitstrahl (StatusEvents)
- Alle Teile mit Foto-Thumbnails
- Stationsverlauf
- Aktionsbuttons (müssen funktionieren): Station starten, Foto aufnehmen, Termin ändern
- Kommentare / interne Notizen
- Verbrauchsbuchungs-Drawer

### 3.6 Screen: Kundenprofil

- Stammdaten + Kontakt
- Alle Aufträge (Liste + Zeitstrahl)
- Alle Teile
- Preis-/Leistungshistorie + Preisabsprachen
- Reklamationen
- Feedback
- Ähnliche frühere Aufträge
- Risikoprofil (intern, nicht dominant)
- Bevorzugte Kommunikation

### 3.7 Screen: Verzug & Engpässe (Eskalationszentrale)

Nicht als Liste — als Cockpit:
- Oben: Eskalationskopf „1 Auftrag kritisch · 2 gefährdet · Engpass: Schleiferei"
- Mitte: Große kritische Karten
- Rechts: Stationen als Heatmap (Kacheln nach Auslastung)
- Unten: Empfohlene Aktionen

**Engpass-Logik:**
- Auslastung > 85%
- mehr als X Teile in Warteschlange
- mindestens ein Auftrag mit Restpuffer < 1 Tag betroffen
- Station auf kritischem Pfad

### 3.8 Screen: Performance

Erst als Beta sichtbar, solange echte Daten fehlen. Nur echte Kennzahlen:

| Kennzahl | Datenquelle |
|---|---|
| Termintreue | Order.dueDate + completed event |
| Durchlaufzeit | intakeDate + completed event |
| Offene Aufträge | Order.status |
| Engpassstation | WorkStep + Station |
| Wartezeit je Station | StatusEvent |
| Reklamationsquote | manuelle Markierung |
| Scanquote | Order.source |

Gamification: Seriös. „5 Wochen ohne Terminverzug" — keine fiktiven XP.

### 3.9 Screen: Stationsseiten `/station/[slug]`

Generische Seite pro Station. Zeigt:
- Alle Teile / Aufträge an dieser Station
- Auslastung
- Warteschlange
- Aktionen: Teil fertigstellen, weiterleiten

### 3.10 Globale Suche — Search Brain (SPEC 48-A)

Entwicklungsziel: Die Suchleiste wird zum zentralen Gehirn der App.

**Funktionen:**
- Exakte Navigation (Tastatur-Shortcut ⌘K)
- Volltext-Suche über Kunden, Aufträge, Teile
- Semantische Suche
- Operative Fragen in natürlicher Sprache
- Kombiniert intern + extern (internet-gestützt)
- Befehlsvorschau + Folgeaktionen

**Beispiel-Interaktion:**
```
Eingabe: "300 SL"

Antwort:
6 Kunden stehen mit „Mercedes 300 SL" in einem belegten Zusammenhang.
• 3 Kunden ließen bereits Teile eines 300 SL bearbeiten.
• 1 Kunde besitzt laut Kundeninformation ein solches Fahrzeug.
• 1 Kunde erwähnte Restaurierungsprojekt in der Kommunikationszentrale.
• 1 Kunde: unbestätigter Interessen-Claim.

Stärkste Bezüge: Chromteile, Stoßstangen, Zierleisten.
[6 Kunden anzeigen]
```

---

## 4. Datenmodell

### Kernobjekte

```typescript
type Customer = {
  id: string;
  name: string;
  type: "private" | "business" | "museum" | "institution";
  address?: Address;
  email?: string;
  phone?: string;
  riskProfile: "low" | "medium" | "high";
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

type Order = {
  id: string;
  orderNumber: string;
  customerId: string;
  intakeDate: string;
  dueDate?: string;
  desiredDueDate?: string;
  priority: "normal" | "high" | "express";
  status: "draft" | "intake" | "in_progress" | "waiting" | "done" | "shipped" | "cancelled";
  currentRisk: "green" | "yellow" | "orange" | "red";
  delayReason?: string;
  internalNote?: string;
  source: "manual" | "scan" | "email" | "phone";
};

type Part = {
  id: string;
  orderId: string;
  partNumber: string;
  title: string;
  category?: string;
  material?: "steel" | "brass" | "aluminum" | "zinc_die_cast" | "unknown";
  targetFinish?: "chrome" | "nickel" | "polish" | "dechrome" | "other";
  conditionNote?: string;
  storageLocation?: string;
  currentStationId?: string;
  qrCode?: string;
  photos: Photo[];
};

type Station = {
  id: string;
  name: string;
  type: "intake" | "grinding" | "polishing" | "deplating" | "bath" | "assembly" | "shipping";
  capacityPerDay?: number;
  active: boolean;
};

type WorkStep = {
  id: string;
  partId: string;
  stationId: string;
  title: string;
  status: "waiting" | "ready" | "in_progress" | "blocked" | "done";
  plannedStart?: string;
  plannedEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  estimatedMinutes?: number;
  assignedTo?: string;
  blockerReason?: string;
};

type StatusEvent = {
  id: string;
  entityType: "order" | "part" | "workstep";
  entityId: string;
  timestamp: string;
  eventType:
    | "created" | "scanned" | "station_changed" | "status_changed"
    | "photo_added" | "deadline_changed" | "blocked" | "completed" | "shipped";
  userId?: string;
  note?: string;
};

type ScanResult = {
  scanId: string;
  imageUrl: string;
  createdAt: string;
  scanType: "shipping_label" | "object_photo" | "document" | "unknown";
  confidence: number;
  extracted: {
    customerName?: string;
    companyName?: string;
    street?: string;
    postalCode?: string;
    city?: string;
    phone?: string;
    email?: string;
    trackingNumber?: string;
    carrier?: "DHL" | "DPD" | "UPS" | "GLS" | "FedEx" | "Other";
    referenceNumber?: string;
    freeText?: string;
  };
  suggestions: {
    matchingCustomerIds: string[];
    matchingOrderIds: string[];
    duplicateRisk: "low" | "medium" | "high";
    suggestedAction: "create_customer" | "link_customer" | "link_order" | "manual_review";
  };
};
```

### Wichtige Regel
**Performance darf NICHT aus statischen Auftragsdaten berechnet werden. Performance braucht StatusEvents mit Zeitstempeln.**

---

## 5. Design System

### 5.1 Farbpalette (CSS Design Tokens)

```css
:root {
  --kreile-blue-950: #0B1628;
  --kreile-blue-900: #12213A;
  --kreile-blue-700: #1E3A6D;

  --kreile-copper-600: #C96F18;
  --kreile-copper-500: #E6862E;
  --kreile-gold-soft: #D9B46A;

  --status-green: #10B981;
  --status-yellow: #FACC15;
  --status-orange: #F97316;
  --status-red: #EF233C;
  --status-muted: #94A3B8;

  --paper: #FFFFFF;
  --surface: #F5F7FA;
  --surface-warm: #FAF8F4;
  --border: #D8DEE8;
  --text-main: #111827;
  --text-muted: #64748B;

  --radius-card: 18px;
  --radius-pill: 999px;
  --shadow-soft: 0 10px 30px rgba(15, 23, 42, 0.08);
  --shadow-alert: 0 14px 36px rgba(239, 35, 60, 0.18);
}
```

### 5.2 Typografie

- **Markenname / Haupttitel:** elegante Serifenschrift erlaubt
- **Operative UI, Zahlen, Status, Buttons:** klare Sans-Serif
- **Mindestgrößen:**
  - Hauptstatus: 28–44px
  - Auftragstitel in Karten: 20–24px
  - Zeit bis Fälligkeit: 26–40px
  - Nebeninformationen: 13–15px
  - Sidebar: 13–14px

### 5.3 UX-Regeln

- Mindesthöhe wichtiger Buttons: 44–52px (Tablet-First)
- Karten anklickbar
- Keine winzigen Pfeile als einziger Einstieg
- Keine unnötigen Pflichtfelder beim Wareneingang
- Sofortige Rückmeldung nach jedem Scan
- Fehlerfreundlichkeit: „Rückgängig", „als unbekannt speichern", „später prüfen"
- Audit-Log bei allen Änderungen

### 5.4 Kernkomponenten

```typescript
// Auftragskarte
type PriorityCardProps = {
  orderNumber: string;
  title: string;
  customerName: string;
  stationName: string;
  dueLabel: string;
  risk: "green" | "yellow" | "orange" | "red" | "blocked";
  delayReason?: string;
  recommendedAction?: string;
};

// Stations-Heatmap-Kachel
type StationHeatTileProps = {
  stationName: string;
  utilization: number;
  waitingParts: number;
  criticalOrders: number;
  nextFreeSlot?: string;
};

// Scan-Review-Panel
type ScanReviewPanelProps = {
  scanResult: ScanResult;
  onConfirm: () => void;
  onEdit: () => void;
  onManualReview: () => void;
};
```

---

## 6. Risiko-Logik

```typescript
function calculateOrderRisk(order, workSteps, stationLoad) {
  // red:    dueDate überschritten ODER Restpuffer < 0
  //         ODER kritischer WorkStep blockiert + dueDate <= 24h
  // orange: Restpuffer < 1 Tag
  //         ODER Station > 85% + Auftrag auf kritischem Pfad
  // yellow: Restpuffer 1–2 Tage
  //         ODER Material/Freigabe offen
  // green:  alles im Plan
  // blocked: Status waiting ohne aktive Bearbeitung
}
```

---

## 7. Akzeptanzkriterien

1. Ein Mitarbeiter erkennt aus 2–4m den kritischsten Auftrag.
2. Auf einem Tablet sind die nächsten Arbeiten ohne Zoomen lesbar.
3. Der Startscreen beantwortet in unter 5 Sekunden: Was ist kritisch? Was kommt als nächstes? Wo ist der Engpass?
4. Ein Versandetikett kann fotografiert und als Vorschlag in einen Auftrag überführt werden.
5. Keine OCR-Daten werden ohne Bestätigung final gespeichert.
6. Jedes Teil kann eine Fotoakte erhalten.
7. Performance-Kennzahlen nur aus echten Status-/Zeitdaten oder klar als Demo.
8. Die App wirkt wie ein hochwertiges Werkstatt-Leitsystem, nicht wie eine Tabellenverwaltung.

---

## 8. Nicht verhandelbare Regeln

- Kein endgültiges Speichern von OCR-Daten ohne menschliche Bestätigung
- Kein Performance-Wert ohne echte Datengrundlage oder Demo-Kennzeichnung
- Kein Screen darf primär wie eine Tabelle wirken
- Kritische Aufträge müssen größer, farbiger und höher platziert sein
- Fotos gehören zur Objektakte, nicht nur als Anhang
- Jedes Teil braucht perspektivisch einen QR-/Teilecode
- Verzug wird nicht versteckt, sondern ins Zentrum gerückt
