# Antigravity-Umsetzungsbriefing  
## Kreile WerkstattCockpit – UI-, Prozess- und OCR-Revision

**Ziel:** Die bestehende App ist funktional angelegt, wirkt aber noch zu statisch, zu tabellarisch und zu wenig wie ein Werkstatt-Cockpit. Sie soll zu einem visuell schnell erfassbaren Produktionssystem für ein handwerkliches Galvanik-/Restaurationsunternehmen weiterentwickelt werden: übersichtlich, tablet-tauglich, robust, hochwertig, aber nicht verspielt.  
**Priorität:** Shopfloor-Nutzbarkeit vor dekorativer Oberfläche. Jeder Screen muss aus 2–4 Metern Entfernung schneller verständlich sein als eine Excel-Liste.

---

## 1. Ausgangslage und Plausibilitätsprüfung

### Positiv vorhanden
- Grundstruktur existiert:
  - Dashboard / kommende Arbeiten
  - Auftragsbuch
  - Auftrag anlegen
  - Kundenkartei
  - Teile-/Objektakte
  - Status & Verzug
  - Performance
- Datenlogik ist grundsätzlich plausibel:
  - Kunde → Auftrag → Teil/Objekt → Status/Station → Termin/Verzug
- Der Screen **„Kommende Arbeiten“** geht bereits in die richtige Richtung:
  - große Karten
  - klare Ampelfarben
  - visuelle Priorisierung
  - Statusring rechts
- Performance-Idee ist brauchbar, aber aktuell noch nicht belastbar, solange echte Zeitstempel, Statuswechsel und Durchlaufzeiten fehlen.

### Problematisch / zu korrigieren
| Bereich | Befund | Korrektur |
|---|---|---|
| UI-Grundwirkung | zu leer, zu kleinteilig, zu bürokratisch | stärkeres Cockpit, mehr visuelle Hierarchie, weniger Admin-Look |
| Tablet-Nutzung | viele Informationen sind nur bei genauem Hinsehen lesbar | große Typografie für operative Hauptinformationen |
| Verzugserkennung | Status & Verzug ist noch zu listenartig | Verzug muss über Größe, Farbe, Form und Position sofort sichtbar werden |
| Navigation | Sidebar nimmt zu viel Aufmerksamkeit | Sidebar kompakter, nur aktive Sektion dominant |
| Performance | wirkt teilweise wie Dashboard-Demo | erst Datengrundlage schaffen, dann echte Kennzahlen |
| Markenlogik | Screenshot zeigt „Meisterbetrieb seit 1989“, Projektkontext spricht von Tradition/4. Generation/seit 1962 | einheitlich auf **„Meisterbetrieb seit 1962“** setzen, falls intern bestätigt |
| Typografie | Serifenschrift wirkt wertig, aber teils schlecht lesbar | Serif nur für Titel/Marke; operative Zahlen/Status in klarer UI-Schrift |
| Dateneingabe | Auftrag anlegen noch manuell und träge | Foto-/Scan-gestützte Erfassung ergänzen |
| OCR/Automatisierung | Idee plausibel, aber nur mit Human-in-the-loop sicher | automatischer Vorschlag, niemals blinde Buchung |

---

## 2. Übergeordnetes Produktprinzip

Die App ist kein klassisches CRM und kein bloßes Auftragsbuch. Sie ist ein **Werkstatt-Leitsystem** für eine kleine Traditionswerkstatt.

### Leitbild
> „Was muss als Nächstes passieren, wo droht Verzug, welches Teil liegt wo, und welcher Kunde ist betroffen?“

Jede Ansicht muss eine dieser Fragen beantworten:

1. **Was ist jetzt wichtig?**
2. **Was ist kritisch?**
3. **Wo liegt das Teil?**
4. **Was blockiert den Auftrag?**
5. **Was wurde zuletzt gemacht?**
6. **Welche Entscheidung muss jemand treffen?**

---

## 3. Neue Informationsarchitektur

### Primäre Navigation
Die Sidebar soll kompakter werden. Keine langen, gleichgewichtigen Menüpunkte.

**Navigation neu:**

1. **Heute**
   - zentrale Shopfloor-Ansicht
   - ersetzt bisheriges Dashboard als Startscreen
2. **Aufträge**
   - Auftragsbuch + Detailansichten
3. **Teile**
   - Teile-/Objektakten
4. **Kunden**
   - Kundenkartei
5. **Scan**
   - Foto, Versandetikett, Wareneingang, QR/Barcode
6. **Verzug**
   - Eskalation, Engpässe, Fristen
7. **Performance**
   - Kennzahlen, Level, Wochenziele
8. **Einstellungen**

### Startscreen
Nicht „Dashboard“ als abstrakte Übersicht, sondern **„Heute in der Werkstatt“**.

Hauptinhalte:
- große Liste „Kommende Arbeiten“
- kritische Aufträge prominent oben
- Engpass-Station rechts
- schneller Button: „Ware scannen“
- schneller Button: „Auftrag anlegen“
- letzter Scan / letzte Aktion klein am Rand

---

## 4. UI-Redesign: konkrete Vorgaben

### 4.1 Grundstil
Die App soll wirken wie:
- Werkstatt-Cockpit
- hochwertiger Manufaktur-Workflow
- klarer Produktionsmonitor
- leicht gamifiziert, aber seriös

Nicht wirken wie:
- Excel-Tabelle
- Steuerberater-Software
- billiger Website-Baukasten
- buntes Kinderspiel
- überladene Admin-Oberfläche

### 4.2 Farbwelt
Bestehende Farben sind grundsätzlich plausibel:
- Dunkelblau: Marke, Ruhe, Verlässlichkeit
- Orange/Kupfer: Handwerk, Wärme, Aufmerksamkeit
- Grün: im Plan
- Gelb: kritisch
- Rot: Verzug / sofortiger Handlungsbedarf
- Hellgrau: Hintergrund

**Wichtig:** Farbverläufe von Grün → Gelb → Orange → Rot sollen gezielt eingesetzt werden, nicht überall.

### 4.3 Design Tokens

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

### 4.4 Typografie
- Markenname und Haupttitel: elegante Serifenschrift erlaubt.
- Operative UI, Zahlen, Status, Buttons: klare Sans-Serif.
- Keine extrem kleinen Beschriftungen in operativen Bereichen.
- Mindestgrößen:
  - Hauptstatus: 28–44 px
  - Auftragstitel in Karten: 20–24 px
  - Zeit bis Fälligkeit: 26–40 px
  - Nebeninformationen: 13–15 px
  - Sidebar: 13–14 px

---

## 5. Zentrale Ansicht: „Heute in der Werkstatt“

### Zweck
Diese Ansicht muss auf einem Tablet an der Wand oder auf einer Werkbank funktionieren. Man soll im Vorbeigehen erkennen:
- welcher Auftrag kritisch ist
- welche Station blockiert
- was als Nächstes getan werden muss
- ob die Werkstatt im Plan ist

### Layout
```text
┌───────────────────────────────────────────────────────────────┐
│ Topbar: Suche | Scan | Heute | Benachrichtigungen | Nutzer     │
├───────────────┬───────────────────────────────────────────────┤
│ Kompakte Nav  │ HEUTE IN DER WERKSTATT                         │
│               │ [Schnellscan] [Auftrag anlegen] [Filter]       │
│               │                                               │
│               │ Prioritätsband Grün → Gelb → Orange → Rot      │
│               │                                               │
│               │ KRITISCHE KARTE GROSS                          │
│               │ Leicht kritisch                               │
│               │ Im Plan                                       │
│               │ Wartet / blockiert                            │
│               │                                               │
│               │ Rechts: Produktionsstatus / Engpass / Scanlog  │
└───────────────┴───────────────────────────────────────────────┘
```

### Kartenprinzip
Jede Auftragskarte besitzt:
- linke Statusform:
  - Kreis grün = im Plan
  - Dreieck gelb/orange = kritisch
  - roter Kreis mit Ausrufezeichen = Verzug
  - Pause-Symbol = wartet/blockiert
- große Zeitinformation rechts:
  - „3 Std. überfällig“
  - „morgen“
  - „2 Tage“
  - „wartet“
- klare Arbeitsart:
  - Vernickeln
  - Verchromen
  - Polieren
  - Entlacken
  - Verpacken
- Kunde kleiner darunter
- Station / nächster Arbeitsschritt sichtbar
- eine empfohlene Aktion als Button oder Chip

### Kritische Karte
Wenn ein Auftrag überfällig ist:
- Karte mindestens 1,25× höher als normale Karten
- roter linker Rand 6–8 px
- hellroter Hintergrund
- roter Schatten
- große Zeitangabe
- pulsierende, aber dezente Warnmarkierung
- keine hektische Animation

**Animation:** sehr langsam, 6–10 Sekunden Zyklus, nur für kritische Elemente. Nicht blinken.

### Beispielkarte
```text
[!] A-2025-0160
    Stoßstangen Opel Rekord C
    Museum Lenzburg · Station: Galvanik

    3 Std. überfällig
    Grund: Badkapazität / hohe Auslastung

    Empfohlen: Priorität erhöhen → Express-Schaltung
```

---

## 6. Verzug & Engpass: Neugestaltung

Der aktuelle „Status- & Verzugsmonitor“ ist logisch, aber zu administrativ.

### Neue Struktur
1. **Oben:** großer Eskalationsbereich
   - „1 Auftrag kritisch“
   - „2 Aufträge gefährdet“
   - „Engpass: Schleiferei & Polieren“
2. **Mitte:** große kritische Karten
3. **Rechts:** Stationen als Heatmap, nicht nur Balken
4. **Unten:** empfohlene Aktionen

### Stationen als Heatmap
Statt normaler Progressbars:
- jede Station als Kachel
- Größe nach Anzahl wartender Teile
- Farbe nach Auslastung
- Symbol für Art des Engpasses

Beispiel:
```text
Schleiferei / Politur
95 % Auslastung
8 Teile warten
Nächster freier Slot: morgen 11:00
Aktion: Zusatzschicht prüfen
```

### Engpasslogik
Engpass ist plausibel, wenn:
- Auslastung > 85 %
- mehr als X Teile in Warteschlange
- mindestens ein Auftrag mit Restpuffer < 1 Tag betroffen
- Station auf kritischem Pfad liegt

---

## 7. Auftrag anlegen: neue Scan-Logik

Der aktuelle Screen ist sauber, aber noch zu manuell. Für eine Werkstatt ist die Datenerfassung per Foto zwingend sinnvoll.

### Neuer Button oben
**„Wareneingang scannen“**

Funktion:
- Foto von Versandetikett
- Foto von Ware / Objekt
- optional Foto von Begleitzettel
- OCR-Vorschlag erzeugen
- Kunde / Adresse / Sendungsnummer / Carrier / Referenz erkennen
- Auftrag oder Teil vorschlagen
- Nutzer bestätigt oder korrigiert
- erst danach speichern

### Ablauf
```text
1. Foto aufnehmen / Datei hochladen
2. System erkennt:
   - Name
   - Adresse
   - Telefonnummer/E-Mail, falls sichtbar
   - Sendungsnummer
   - Paketdienst
   - Datum
   - mögliche Kundenreferenz
   - Objekt-/Teilebeschreibung aus Begleitzettel
3. System sucht Dubletten:
   - bestehender Kunde?
   - bestehender Auftrag?
   - ähnliche Telefonnummer?
   - ähnliche Adresse?
4. System zeigt Vorschlag:
   - Neuer Auftrag
   - Bestehendem Kunden zuordnen
   - Bestehendem Auftrag hinzufügen
5. Mitarbeiter bestätigt
6. Auftrag wird angelegt
7. QR-/Teilecode wird erzeugt
```

### Wichtig
Keine vollautomatische Buchung ohne Bestätigung. OCR irrt bei:
- handschriftlichen Notizen
- alten Etiketten
- beschädigten Paketen
- mehreren Adressen auf einem Paket
- fremden Absendern
- Museums-/Werkstatt-/Privatkunden mit abweichender Rechnungsadresse

---

## 8. OCR-/Bildimport: technische Umsetzung

### MVP-Variante
Für den ersten funktionsfähigen Stand:

- Browser-Dateiupload und Kameraaufnahme
- OCR lokal oder serverseitig
- Barcode/QR-Erkennung
- strukturierte Vorschlagsmaske
- manuelle Korrektur
- Speicherung der Originalbilder am Auftrag/Teil

### Empfohlene Komponenten
Je nach bestehendem Stack:

#### Frontend
- `getUserMedia` für Kameraaufnahme im Browser
- Drag & Drop Upload
- Crop-/Rotate-Funktion
- Bildqualität prüfen:
  - unscharf
  - zu dunkel
  - abgeschnitten
  - kein Etikett erkannt

#### OCR / Barcode
MVP:
- Tesseract.js für einfache lokale OCR
- Barcode-Scanner-Library für QR/EAN/Code128/DataMatrix

Besser, falls erlaubt:
- Google Vision API
- Azure AI Vision
- AWS Textract

**Datenschutzhinweis:** Versandetiketten enthalten personenbezogene Daten. Falls Cloud-OCR genutzt wird, muss es technisch und rechtlich bewusst entschieden werden. Standardmäßig erst einmal pluggable OCR-Service bauen, nicht fest verdrahten.

### Ergebnisdaten
```ts
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
    country?: string;
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

---

## 9. Waren-/Objektfoto: realistische Automatisierung

### Plausibilität
Ein Versandetikett lässt sich relativ gut automatisch auslesen.  
Ein Objektfoto ist schwieriger. Das System kann nicht zuverlässig erkennen, ob ein alter Stoßfänger verchromt, vernickelt oder nur poliert werden soll.

### Sinnvolle automatische Funktionen
- Foto dem Auftrag zuordnen
- sichtbare Beschädigungen dokumentieren
- Anzahl grob prüfen
- Material-Vorschlag machen, aber nur als Hypothese:
  - Stahl
  - Messing
  - Aluminium
  - Zinkdruckguss
  - unbekannt
- Objektkategorie vorschlagen:
  - Stoßstange
  - Motorradteil
  - Beschlag
  - Leuchte
  - Möbelteil
  - Kunstobjekt
  - unbekannt
- Ähnlichkeit mit alten Aufträgen finden
- Preisreferenzen aus früheren ähnlichen Teilen vorschlagen

### Nicht im MVP versprechen
- perfekte Materialerkennung per Foto
- automatische Preisermittlung ohne Mitarbeiterfreigabe
- automatische Reklamationsentscheidung
- sichere Erkennung von Schichtaufbau/Altverchromung

### UX-Vorgabe
Nach Objektfoto:
```text
Systemvorschlag:
- Objekt: Motorradteil / Tank / Chromteil
- Material: unbekannt, vermutlich Stahlblech
- Zustand: gebraucht / sichtbar beschädigt
- Empfohlene Prüfung: Entchromen + Schleiferei prüfen
- Ähnliche frühere Aufträge: 3 Treffer

[Bestätigen] [Korrigieren] [Manuelle Prüfung]
```

---

## 10. Datenmodell neu strukturieren

### Kernobjekte

```ts
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
    | "created"
    | "scanned"
    | "station_changed"
    | "status_changed"
    | "photo_added"
    | "deadline_changed"
    | "blocked"
    | "completed"
    | "shipped";
  userId?: string;
  note?: string;
};
```

### Wichtiger Punkt
Performance darf nicht aus statischen Auftragsdaten berechnet werden.  
Performance braucht **StatusEvents** mit Zeitstempeln.

---

## 11. Performance: realistische Kennzahlen

Die aktuelle Performance-Seite ist visuell brauchbar, aber inhaltlich noch nicht belastbar.

### Erst erfassen, dann bewerten
Für echte Performance werden benötigt:
- Eingangsdaten
- Statuswechsel je Station
- Start/Ende je Arbeitsschritt
- Wartezeiten
- Blocker
- Fertigstellung
- Reklamationen
- Versanddatum
- Soll-/Ist-Termin

### MVP-Kennzahlen
| Kennzahl | Bedeutung | Datenquelle |
|---|---|---|
| Termintreue | Anteil Aufträge pünktlich fertig | Order.dueDate + completed event |
| Durchlaufzeit | Eingang bis fertig | intakeDate + completed event |
| offene Aufträge | nicht abgeschlossen | Order.status |
| Engpassstation | höchste kritische Auslastung | WorkStep + Station |
| Wartezeit je Station | Zeit im Status waiting | StatusEvent |
| Reklamationsquote | Reklamationen / fertige Aufträge | manuelle Markierung |
| Scanquote | Anteil Aufträge per Scan angelegt | Order.source |

### Gamification nur seriös
- „Werkstatt-Level“ ist erlaubt, aber intern.
- Keine kindliche Darstellung.
- Belohnungen als Effizienz-Hinweise:
  - „5 Wochen ohne Terminverzug“
  - „Scanquote 80 % erreicht“
  - „Durchlaufzeit 12 % verbessert“
- Keine fiktiven XP, wenn keine echte Messlogik besteht.

---

## 12. UI-Screens: konkrete Umsetzungsaufträge

### 12.1 Screen „Heute“
Neu bauen oder bestehendes Dashboard ersetzen.

**Muss enthalten:**
- große Überschrift: „Heute in der Werkstatt“
- Schnellaktionen:
  - „Ware scannen“
  - „Auftrag anlegen“
  - „Kritische anzeigen“
- Prioritätsband
- große Kartenliste
- rechte Statusspalte:
  - Produktionsstatus
  - Engpass
  - letzte Scans
  - offene Entscheidungen

### 12.2 Screen „Scan“
Neu anlegen.

Tabs:
1. Versandetikett
2. Ware/Objekt
3. Begleitzettel
4. QR/Teilecode

Scanprozess:
- Foto aufnehmen
- Bild prüfen
- OCR/Barcode auslesen
- Vorschlag anzeigen
- Dublettenprüfung
- speichern nach Bestätigung

### 12.3 Screen „Auftrag anlegen“
Umbauen:
- nicht mehr primär Formular
- Start mit Auswahl:
  - „per Scan anlegen“
  - „manuell anlegen“
  - „bestehenden Kunden wählen“
- Teil-Erfassung stärker visuell:
  - Foto zuerst
  - Teilekarte
  - Material / Oberfläche / Zielarbeit
  - Lagerort
  - QR-Code

### 12.4 Screen „Teile-/Objektakte“
Erweitern:
- Foto-Thumbnail je Teil
- Status-Timeline
- Lagerort groß sichtbar
- QR-Code / Code scannen
- Historie:
  - Eingang
  - Fotos
  - Stationen
  - Bearbeitungen
  - Versand
- ähnliche frühere Teile anzeigen

### 12.5 Screen „Kundenkartei“
Verbessern:
- Kundenkarte öffnen mit:
  - Stammdaten
  - alle Aufträge
  - alle Teile
  - Preis-/Leistungshistorie
  - Reklamationen
  - Besonderheiten
  - bevorzugte Kommunikation
- Risikoprofil nicht zu dominant darstellen, eher als interner Hinweis.

### 12.6 Screen „Verzug“
Neubauen als Eskalationszentrale:
- nicht als klassische Liste
- kritische Karten oben
- Heatmap rechts
- empfohlene Aktionen
- Gründe:
  - Station überlastet
  - Material fehlt
  - Kunde muss freigeben
  - Zusatzarbeit nötig
  - Bad/Entlackung verzögert

### 12.7 Screen „Performance“
Erst sichtbar als „Beta“, solange echte Daten fehlen.

Inhalt:
- Termintreue
- Durchlaufzeit
- offene Aufträge
- Engpässe
- Wochenziel
- Trends
- Reklamationsquote
- Scanquote
- Verbesserungshinweise

Keine gefälschten Kennzahlen ohne Hinweis „Demo-Daten“.

---

## 13. UI-Komponenten

### PriorityCard
```ts
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
```

Designlogik:
- `risk=red`: größte Karte, roter Rand, roter Schatten
- `risk=orange`: mittlere Warnung
- `risk=yellow`: leichte Warnung
- `risk=green`: normal
- `risk=blocked`: graublau/grün, Pause-Symbol, „wartet auf …“

### StationHeatTile
```ts
type StationHeatTileProps = {
  stationName: string;
  utilization: number;
  waitingParts: number;
  criticalOrders: number;
  nextFreeSlot?: string;
};
```

### ScanReviewPanel
```ts
type ScanReviewPanelProps = {
  scanResult: ScanResult;
  onConfirm: () => void;
  onEdit: () => void;
  onManualReview: () => void;
};
```

---

## 14. Plausibilitätslogik / Regeln

### Risiko eines Auftrags
```ts
function calculateOrderRisk(order, workSteps, stationLoad) {
  // red:
  // - dueDate überschritten
  // - oder Restpuffer < 0
  // - oder kritischer WorkStep blockiert und dueDate <= 24h

  // orange:
  // - Restpuffer < 1 Tag
  // - oder Station > 85 % und Auftrag auf kritischem Pfad

  // yellow:
  // - Restpuffer 1–2 Tage
  // - oder Material/Freigabe offen

  // green:
  // - alles im Plan

  // blocked:
  // - Status waiting/blocker ohne aktive Bearbeitung
}
```

### Dublettenprüfung Kunde
Trefferlogik:
- gleicher Name + gleiche PLZ
- gleiche Telefonnummer
- gleiche E-Mail
- ähnliche Adresse
- Firmenname ähnlich
- Museums-/Institutionenname ähnlich

Bei mittlerem oder hohem Dublettenrisiko:
- nie automatisch neuen Kunden anlegen
- Vorschlagsliste anzeigen

### Versandetikettenprüfung
Wenn mehrere Namen erkannt:
- Absender und Empfänger unterscheiden
- Nutzer zur Auswahl zwingen
- Paketdienst/Tracking separat speichern

---

## 15. UX-Regeln für die Werkstatt

### Keine unnötigen Pflichtfelder
Beim Wareneingang reicht:
- Kunde oder unbekannter Kunde
- Foto
- Teilbeschreibung grob
- Zielarbeit
- Lagerort
- Status „Wareneingang geprüft“ oder „Prüfung offen“

Alles Weitere kann später ergänzt werden.

### Sofortige Rückmeldung
Nach jedem Scan:
```text
Scan gespeichert
3 Felder erkannt
1 möglicher bestehender Kunde gefunden
Bitte bestätigen
```

### Große Touch-Flächen
- Mindesthöhe wichtiger Buttons: 44–52 px
- Karten anklickbar
- keine winzigen Pfeile als einziger Einstieg
- Tablet-first denken

### Fehlerfreundlichkeit
- „Rückgängig“
- „als unbekannt speichern“
- „später prüfen“
- Audit-Log bei Änderungen

---

## 16. Sicherheit, Datenschutz, Betrieb

### Datenschutz
- Versandetiketten und Kundenfotos enthalten personenbezogene Daten.
- Cloud-OCR nur als austauschbarer Service, nicht hart codieren.
- Bilder sollten auftragsbezogen gespeichert werden.
- Zugriffsrechte:
  - Meister/Admin
  - Büro
  - Werkstatt
  - Nur-Lesen
- Lösch-/Archivlogik vorsehen.

### Audit
Jede Änderung an Auftrag, Kunde, Termin, Status und Preis muss protokolliert werden:
- wer
- wann
- was vorher
- was nachher

### Offline-/Werkstattrealität
Die App sollte bei schlechter Verbindung zumindest:
- Fotos zwischenspeichern
- Scans in Warteschlange legen
- später synchronisieren

---

## 17. Akzeptanzkriterien

Die Umsetzung gilt als gelungen, wenn:

1. Ein Mitarbeiter erkennt aus 2–4 m Entfernung den kritischsten Auftrag.
2. Auf einem Tablet sind die nächsten Arbeiten ohne Zoomen lesbar.
3. Der Startscreen beantwortet in unter 5 Sekunden:
   - Was ist kritisch?
   - Was ist als Nächstes dran?
   - Wo ist der Engpass?
4. Ein Versandetikett kann fotografiert und als Vorschlag in einen Auftrag überführt werden.
5. Keine OCR-Daten werden ohne Bestätigung final gespeichert.
6. Jedes Teil kann eine Fotoakte erhalten.
7. Performance-Kennzahlen werden nur aus echten Status-/Zeitdaten berechnet oder klar als Demo gekennzeichnet.
8. Die App wirkt wie ein hochwertiges Werkstatt-Leitsystem, nicht wie eine Tabellenverwaltung.

---

## 18. Konkrete nächste Entwicklungsaufgaben

### Phase 1: UI-Korrektur
- Sidebar verkleinern
- Startscreen zu „Heute in der Werkstatt“ umbauen
- „Kommende Arbeiten“ als Hauptscreen setzen
- kritische Karten größer und visuell stärker machen
- Engpassspalte rechts ergänzen
- Statusfarben konsequent definieren

### Phase 2: Datenbasis
- StatusEvent-Modell einführen
- WorkStep-Modell einführen
- Stationen sauber modellieren
- Risiko-/Verzugslogik zentralisieren
- Demo-Daten klar kennzeichnen

### Phase 3: Scan-MVP
- neuen Screen „Scan“ bauen
- Versandetikett-Foto hochladen/aufnehmen
- OCR-Service als Interface vorbereiten
- Barcode/Tracking erkennen
- Vorschlagsmaske bauen
- Dublettenprüfung implementieren
- Originalbild am Auftrag speichern

### Phase 4: Teilefoto & Objektakte
- Foto je Teil speichern
- Teilakte mit Bild, Status, Lagerort, Timeline
- QR-Code je Teil erzeugen
- QR-Code-Scan zum Öffnen der Teilakte

### Phase 5: Performance Beta
- echte Kennzahlen aus StatusEvents berechnen
- Performance-Screen als Beta markieren
- Wochenvergleich nur anzeigen, wenn Vorwoche Daten hat
- Gamification seriös halten

---

## 19. Wichtige Korrekturen aus den Screenshots

Bitte direkt prüfen und anpassen:

- „WerkstattCockpit“ einheitlich schreiben.
- „Meisterbetrieb seit 1989“ prüfen; wahrscheinlich auf **„Meisterbetrieb seit 1962“** ändern.
- Logo/Marke oben links größer und klarer, aber Sidebar insgesamt schmaler.
- „Dashboard“ als Begriff reduzieren; besser „Heute“.
- Status & Verzug nicht als tabellarische Kontrollseite, sondern als operative Eskalationsseite.
- Performance nicht als erster Hauptnutzen verkaufen, solange Datenbasis fehlt.
- Formulare nicht als Zentrum der App; Scan und Teilefoto müssen in den Workflow.
- Bei allen Listen: weniger feine Linien, mehr visuelle Kartenlogik.
- Auftragsnummern wichtig, aber nicht dominanter als Tätigkeit und Fälligkeit.
- Kunde sichtbar, aber kleiner als Arbeitsart und Frist.
- „Empfohlene Maßnahme“ muss als echter Workflow-Button funktionieren, nicht nur Text sein.

---

## 20. Umsetzungston für Antigravity

Arbeite nicht nur kosmetisch. Ziel ist eine strukturelle Produktverbesserung.

**Baue zuerst die Informationshierarchie um, dann die Optik.**  
Keine weiteren beliebigen Cards hinzufügen. Keine überflüssigen Statistiken. Keine Deko-Animationen.

Die App muss in einer echten Werkstatt funktionieren:
- schnelle Blicke
- schmutzige Hände
- Tablet an der Wand
- unvollständige Informationen
- nachträgliche Korrekturen
- Fotos statt langer Texte
- manuelle Kontrolle statt blindem KI-Automatismus

---

## 21. Priorisierter Arbeitsauftrag

Bitte setze als Nächstes um:

1. Erstelle/ersetze den Startscreen durch **„Heute in der Werkstatt“**.
2. Baue die bestehenden „Kommende Arbeiten“-Karten als Hauptkomponente aus.
3. Mache Verzug über **Größe, Farbe, Form und Position** sofort sichtbar.
4. Füge rechts eine kompakte Produktionsstatus-/Engpassspalte hinzu.
5. Ergänze einen prominenten Button **„Ware scannen“**.
6. Erstelle den neuen Screen **„Scan“** mit Upload/Kamera, OCR-Platzhalter, Vorschlagsmaske und manueller Bestätigung.
7. Lege die Datenmodelle `StatusEvent`, `WorkStep`, `ScanResult`, `Photo` an.
8. Markiere Performance als Beta und speise sie nur aus echten Events oder Demo-Daten mit Label.
9. Entferne visuelle Kleinteiligkeit, die im Werkstattbetrieb nicht lesbar ist.
10. Behalte die hochwertige, ruhige Kreile-Anmutung: dunkelblau, kupfer/orange, viel Weißraum, aber stärkere operative Priorität.

---

## 22. Beispiel für neue Startscreen-Microcopy

```text
Heute in der Werkstatt
Was jetzt zählt: Fristen, Engpässe, nächste Arbeitsschritte.

1 kritisch · 2 gefährdet · 5 im Plan · Engpass: Schleiferei

[Ware scannen] [Auftrag anlegen] [Nur kritische anzeigen]
```

Karten:
```text
A-2025-0160
Stoßstangen Opel Rekord C
Vernickeln · Museum Lenzburg · Station: Galvanik

3 Std. überfällig
Grund: Badkapazität / hohe Auslastung

[Priorität erhöhen] [Details öffnen]
```

Scan:
```text
Wareneingang scannen
Fotografiere Versandetikett, Ware oder Begleitzettel.
Das System macht Vorschläge. Du bestätigst die Daten vor dem Speichern.

[Versandetikett scannen] [Ware fotografieren] [Begleitzettel scannen]
```

---

## 23. Nicht verhandelbare Produktregeln

- Kein endgültiges Speichern von OCR-Daten ohne menschliche Bestätigung.
- Kein Performance-Wert ohne echte Datengrundlage oder Demo-Kennzeichnung.
- Kein Screen darf primär wie eine Tabelle wirken.
- Kritische Aufträge müssen größer, farbiger und höher platziert sein als normale Aufträge.
- Fotos gehören zur Objektakte, nicht nur als Anhang.
- Jedes Teil braucht perspektivisch einen QR-/Teilecode.
- Verzug wird nicht versteckt, sondern ins Zentrum gerückt.
- Die App muss für kleine Handwerksbetriebe praktikabel bleiben: wenig Eingabe, klare Vorschläge, schnelle Korrektur.

