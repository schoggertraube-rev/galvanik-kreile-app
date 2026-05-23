# Kreile WerkstattCockpit — Wareneingang, Kamera, OCR und autonome Erfassung

## Ziel

Der Wareneingang wird radikal vereinfacht.

Der Nutzer sieht zuerst nur zwei große Hauptoptionen:

1. Kamera
2. Manuelle Eingabe

Der Rest ergibt sich aus dem erfassten Material.

## Grundprinzip

**Erst erfassen, dann korrigieren. Nicht mit einem langen Formular beginnen.**

Der Prozess soll sich wie ein Assistent verhalten:

- Kamera erkennt Dokumente, Text, QR/Barcode und Teile.
- App schlägt Kunde, Auftrag und Teile vor.
- Mitarbeiter bestätigt nur noch unsichere Stellen.
- App legt alles autonom in der Datei ab.

## UI: Einstieg

```text
Wareneingang
Neue Annahme erfassen

[ Kamera ]      [ Manuell ]

Letzte Annahmen / ähnliche Aufträge anzeigen
```

### Button-Anforderungen

- sehr groß,
- fingergerecht,
- klare Icons,
- maximal ein Wort plus kleiner Untertitel,
- keine Drittoption auf gleicher Ebene.

Beispiel:

```text
[ Kamera ]
Dokument, Teil oder Etikett scannen

[ Manuell ]
Ohne Scan erfassen
```

## Kamera-Autonomie: Zielbild

Die Kamera soll möglichst viele Aufgaben übernehmen:

| Aufgabe | Kamera/OCR-Verhalten | Nutzerrolle |
|---|---|---|
| Dokument scannen | Rand erkennen, entzerren, speichern | bestätigen |
| Text lesen | Kunde, Telefonnummer, E-Mail, Menge, Leistung erkennen | unsichere Felder korrigieren |
| QR/Barcode lesen | Auftrag/Teil/Lagerartikel erkennen | bestätigen |
| Teile zählen | ähnliche Objekte im Bild zählen | Zahl prüfen |
| Zustand dokumentieren | Fotos automatisch dem Teil zuordnen | Fotoart bestätigen |
| Wiedererkennung | ähnlichen Kunden/Auftrag vorschlagen | auswählen |

## MVP-Realität

Nicht alles muss sofort vollautomatisch perfekt funktionieren.

MVP-Stufen:

### Stufe 1 — Demo-Assistent

- Kamera-Button öffnet simulierten Scan.
- Demo-Dokument wird analysiert.
- OCR-Felder werden vorbefüllt.
- Nutzer bestätigt.
- Auftrag, Kunde, Teile, Fotos werden angelegt.

### Stufe 2 — echte Kamera im Browser/PWA

- Kamerazugriff über Browser-API.
- Foto aufnehmen.
- Dokumentfoto speichern.
- OCR noch simuliert oder über lokalen Dienst.

### Stufe 3 — echte OCR

- Texterkennung über ML Kit / OCR-Dienst / Backend.
- Confidence Scores je Feld.
- Unsichere Felder markieren.

### Stufe 4 — Teilezählung / KI-Assistenz

- einfache Bildanalyse für gleiche Kleinteile,
- später KI-Modell für wiederkehrende Teileklassen,
- immer manuelle Bestätigung vor finaler Übernahme.

## Ablauf Kamera

```text
1. Kamera öffnen
2. Dokument / Teil / Etikett erfassen
3. App erkennt Inhalt
4. App gruppiert erkannte Informationen
5. App schlägt Kunde vor
6. App schlägt Auftrag oder Neuanlage vor
7. App schlägt Teileliste vor
8. Nutzer prüft Unsicherheiten
9. Fotos/Dokumente werden abgelegt
10. Etikett/QR wird vorbereitet
11. Auftrag erscheint im Werkstattfluss
```

## OCR-Ergebnisstruktur

```ts
type OCRScan = {
  id: string;
  scanType: "document" | "label" | "part_photo" | "mixed";
  source: "camera" | "upload" | "demo";
  capturedAt: string;
  capturedBy: string;
  imageUrl?: string;
  documentUrl?: string;
  status: "captured" | "processed" | "needs_review" | "accepted" | "rejected";
  extractedFields: OCRExtractedField[];
  suggestedCustomerId?: string;
  suggestedOrderId?: string;
  suggestedItems?: SuggestedItem[];
};

type OCRExtractedField = {
  key:
    | "customerName"
    | "contactPerson"
    | "phone"
    | "email"
    | "address"
    | "itemName"
    | "quantity"
    | "material"
    | "surfaceRequested"
    | "dueDate"
    | "notes";
  value: string;
  confidence: number;
  sourceBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  reviewState: "accepted" | "edited" | "uncertain" | "ignored";
};

type SuggestedItem = {
  name: string;
  quantity: number;
  material?: string;
  surfaceRequested?: string;
  confidence: number;
  photos?: string[];
};
```

## Confidence-Logik

| Confidence | UI | Verhalten |
|---|---|---|
| > 0.85 | normal / grünlich | automatisch vorausgewählt |
| 0.60–0.85 | gelblich | Nutzer soll prüfen |
| < 0.60 | orange/rot | nicht automatisch übernehmen |

Unsichere Werte dürfen nie still übernommen werden.

## Kunden- und Auftragserkennung

Nach OCR sucht die App:

1. Exakte Kundennummer.
2. Exakter Name.
3. Telefonnummer/E-Mail.
4. Ähnlicher Name.
5. Ähnliche frühere Aufträge.

### UI-Vorschlag

```text
Gefundener Kunde
Museum Lenzburg
Treffer: Name + Telefonnummer

[Übernehmen] [Andere Kunden anzeigen] [Neuen Kunden anlegen]
```

## Link zu vergangenen Aufträgen

Unterhalb der Kamera-/Manuell-Buttons:

```text
Vergangene Annahmen / ähnliche Aufträge anzeigen
```

Bei Klick:

- zeigt Liste der letzten Annahmen,
- filtert nach erkanntem Kunden, falls vorhanden,
- führt bei Auswahl in das Kundenprofil,
- zeigt ähnliche Teile und Preise.

## Manuelle Eingabe

Manuell ist kein riesiges Formular.

Manuell wird ebenfalls als Assistent geführt:

1. Kunde suchen oder neu anlegen.
2. Auftragstitel / Leistung eingeben.
3. Teile hinzufügen.
4. Fotos optional ergänzen.
5. Zieltermin / Freigabe markieren.
6. Speichern.

## Fotodokumentation

Pflichtfoto-Logik:

| Fotoart | Wann | Blockiert? |
|---|---|---|
| Eingang Gesamt | Wareneingang | empfohlen, bei hochwertigen Teilen Pflicht |
| Schaden Detail | bei sichtbarer Beschädigung | ja bei Schadensmarkierung |
| Dokument / Lieferschein | bei Papieranlieferung | empfohlen |
| Endzustand | Qualitätskontrolle | empfohlen/pflicht je Auftragstyp |
| Verpackung | Versand | optional, bei Paketversand empfohlen |

## Dateiablage

Jeder Scan wird gespeichert unter:

```text
Customer
└── Order
    ├── Documents
    ├── Photos
    ├── OCRScans
    └── Items
```

Im UI erscheint alles im Zeitstrahl.

## Kamera-Modus: minimale Haptik

Kameraansicht:

- Vollbild.
- Großer Auslöser unten.
- Umschalter: Dokument / Teil / Etikett.
- Blitz-Button.
- „Fertig“ Button.
- Nach Foto direkt Vorschau mit „verwenden“ oder „neu“.

Keine langen Einstellungen im Kameramodus.

## Automatische Ablage-Regel

Wenn ein Foto während eines geöffneten Auftrags aufgenommen wird:

- automatisch diesem Auftrag zuordnen.

Wenn ein Foto während eines geöffneten Teils aufgenommen wird:

- automatisch diesem Teil zuordnen.

Wenn aus Wareneingang gestartet:

- zuerst temporärer Scan,
- nach Bestätigung Zuordnung zu Auftrag/Kunde.

## StatusEvents

Der Wareneingang erzeugt Events:

```text
OCR_SCAN_STARTED
OCR_SCAN_COMPLETED
DOCUMENT_CAPTURED
CUSTOMER_MATCHED
ORDER_CREATED_FROM_SCAN
ITEMS_SUGGESTED_FROM_SCAN
ITEM_COUNT_CONFIRMED
PHOTO_CAPTURED
LABEL_PREPARED
WARENEINGANG_COMPLETED
```

## Komponenten

```text
src/components/intake/IntakeEntry.tsx
src/components/intake/CameraCapture.tsx
src/components/intake/ManualIntakeWizard.tsx
src/components/intake/OCRReviewPanel.tsx
src/components/intake/CustomerMatchPanel.tsx
src/components/intake/SuggestedItemsPanel.tsx
src/components/intake/PastIntakesLink.tsx
src/components/intake/IntakeCompletionSummary.tsx
src/lib/ocr/demoOcr.ts
src/lib/ocr/confidence.ts
src/lib/intake/createOrderFromScan.ts
```

## Akzeptanzkriterien

- Wareneingang zeigt zuerst nur Kamera und Manuell als Hauptaktionen.
- Kamera-Assistent erzeugt mindestens Demo-OCR-Daten.
- Unsichere OCR-Werte werden markiert.
- Auftrag/Kunde/Teile/Fotos werden logisch verknüpft.
- Nutzer kann alle automatisch erkannten Werte korrigieren.
- Vergangene Annahmen führen in Kundenprofil oder ähnliche Aufträge.
- Nach Abschluss erscheint der Auftrag in der passenden Station.
