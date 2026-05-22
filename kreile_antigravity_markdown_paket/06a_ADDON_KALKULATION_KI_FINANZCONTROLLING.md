# Kreile WerkstattCockpit — Add-on: KI-Kalkulation, Verbrauchsmaterial, Angebotsassistent und Finanzcontrolling

## Zweck dieser Datei

Diese Datei ist eine **ergänzende Implementierungsanweisung** für die bestehende Kreile-WerkstattCockpit-App.

Wichtig: Die bestehende App wird **nicht neu aufgebaut** und nicht strukturell umgeworfen. Dieses Dokument ergänzt den aktuellen Fortschritt um folgende Add-on-Schichten:

1. Foto-/KI-gestützte Arbeitserleichterung.
2. Wareneingang für Verbrauchsmaterial per Foto/OCR.
3. Aufwandserfassung für Entmetallisierung, Reinigung, Schleifen und Sonderarbeit.
4. Kalkulationslogik für realistische Preise.
5. Vergleich mit früheren ähnlichen Aufträgen.
6. Angebotsassistent für Website-Anfragen.
7. Finanzcontrolling: Umsatz, Gewinn, Fixkosten, variable Kosten, Deckungsbeitrag und Forecast.
8. Exportlogik für Buchhaltung, Steuerberater, Lexware/DATEV-Vorbereitung.

Dieses Add-on soll die vorhandenen Seiten, Komponenten und Datenmodelle erweitern. Es soll keine funktionierenden Seiten ersetzen.

---

## Kritische Einschätzung der Idee

### Was daran sehr stark ist

Die Grundidee ist fachlich richtig: Eine App bringt nur dann echten Nutzen, wenn sie **Daten fast nebenbei erzeugt**. In einer Werkstatt darf keine Software entstehen, die mehr Pflegeaufwand verursacht als sie einspart.

Die stärksten Punkte:

- Foto zuerst, Formular danach.
- KI/OCR zur Vorbefüllung, aber nie ungeprüft.
- Kostenlogik aus echten Aufträgen lernen lassen.
- Kundenhistorie und frühere Preise automatisch einbeziehen.
- Angebotsanfragen von der Website direkt in eine prüfbare Kalkulation verwandeln.
- Finanzkontrolle nicht als spätere Statistik, sondern als Teil des Auftragsprozesses.

Das ist deutlich wertvoller als ein reines Auftragsbuch.

### Was realistisch sofort machbar ist

Für die aktuelle App realistisch als Add-on:

- Neue Datenfelder für Kalkulation, Kosten, Material und Angebotsanfragen.
- Mockdaten für Kostenregeln und vergangene Aufträge.
- Buttonlogik für Zusatzaufwand: 1x, 2x, 3x, 4x.
- Kalkulationsfunktion auf Basis von Regeln, Faktoren und Stundenlohn.
- Angebotsvorschlag mit bearbeitbarem Preis.
- Vorformulierte Antwortmail als Textvorschlag.
- Finanz-KPI-Karten für Umsatz, Kosten, Deckungsbeitrag, geschätzten Gewinn.
- CSV-/Excel-Export als erste Buchhaltungsbrücke.
- Ähnlichkeitsvorschläge zunächst regelbasiert: Oberfläche, Teilart, Größe, Zustand, Kunde, Tags.

### Was später, aber nicht sofort sauber machbar ist

Nicht sofort als echter Vollautomat bauen:

- Vollautomatische Bilderkennung von Rostnarben, Öl, Lack, Gewinden und Verwinkelungen mit belastbarer Preisgarantie.
- Echte selbstlernende KI nur aus wenigen Altaufträgen.
- Vollautomatische DATEV- oder Lexware-Integration ohne konkretes Zielsystem, Format und Mandantenlogik.
- Automatisches Abschicken von Angeboten ohne menschliche Preisprüfung.

Die App soll diese Dinge **vorbereiten**, aber im MVP regelbasiert und prüfbar bleiben.

### Zentrale Warnung

Die Kalkulation darf nicht als schwarze KI-Box gebaut werden.

Wenn ein Mitarbeiter nicht versteht, warum ein Preis vorgeschlagen wird, wird die Funktion nicht genutzt. Deshalb muss jeder Preisvorschlag zerlegt werden:

```text
Grundarbeit
+ Reinigung / Entfettung
+ Entmetallisierung
+ Schleif-/Polieraufwand
+ Galvanik / Oberfläche
+ Materialverbrauch
+ Fremdleistung
+ Risiko / Nacharbeitsreserve
+ Gemeinkostenanteil
+ Zielgewinn
= Netto-Angebotspreis
```

Jede Position muss bearbeitbar sein.

---

## Zielbild des Add-ons

Ein Mitarbeiter oder Meister bekommt eine Anfrage oder einen Auftrag mit Bildern. Die App soll daraus möglichst viel vorbereiten:

1. Bilder und Beschreibung werden übernommen.
2. Kunde wird erkannt oder vorgeschlagen.
3. Frühere ähnliche Aufträge werden angezeigt.
4. Zustand, Verschmutzung, Geometrie und Beschädigung werden als Vorschlag klassifiziert.
5. Die App berechnet geschätzte Arbeit, Verbrauchsmaterial, Gemeinkosten und Zielpreis.
6. Der Mitarbeiter passt bei Bedarf einzelne Positionen an.
7. Die App erzeugt eine Antwortmail.
8. Der Mitarbeiter bestätigt oder bearbeitet die Mail.
9. Der Auftrag oder Angebotsdatensatz fließt in Umsatz-, Kosten- und Forecast-Auswertungen.
10. Nach Abschluss wird Soll/Ist verglichen, damit die Kalkulation besser wird.

---

## Neue Hauptmodule als Add-on

Diese Module sollen ergänzend eingeführt werden:

| Modul | Zweck | Seite/Integration |
|---|---|---|
| Material Intake | Verbrauchsmaterial per Foto/OCR erfassen | Scan/OCR, Lager/Wareneingang |
| Cost Rules | Pauschalen, Faktoren, Stundenlöhne, Materialpreise pflegen | Einstellungen oder Adminbereich |
| Work Effort | Zusatzaufwand je Teil erfassen | Teile, Auftrag-Detail, Stationen |
| Quote Assistant | Preisvorschlag und Mailentwurf erzeugen | Neue Seite „Anfragen“ oder Erweiterung Scan/OCR |
| Similarity Engine | Ähnliche frühere Aufträge finden | Kundenakte, Angebotsassistent, Auftrag-Detail |
| Finance KPIs | Umsatz, Kosten, Gewinn, Forecast | Performance-Seite |
| Export Center | CSV/Excel/Buchhaltungsexport vorbereiten | Performance oder Einstellungen |

---

## Datenmodell-Erweiterung

Die vorhandenen Entitäten `Customer`, `Order`, `Item`, `Photo`, `StatusEvent`, `Action` bleiben bestehen und werden erweitert. Keine vorhandenen Felder löschen.

### Neue Entität: MaterialProduct

```ts
type MaterialProduct = {
  id: string;
  name: string;
  category:
    | "chemical"
    | "polishing"
    | "abrasive"
    | "packaging"
    | "bath_additive"
    | "cleaning"
    | "other";

  supplier?: string;
  supplierSku?: string;
  internalSku?: string;

  unit: "ml" | "l" | "g" | "kg" | "piece" | "meter" | "set";
  packageSize?: number;
  packageUnit?: string;

  purchasePriceNet?: number;
  purchaseCurrency?: "EUR";
  vatRate?: number;

  stockQuantity?: number;
  minStockQuantity?: number;

  labelPhotoIds?: string[];
  lastOcrText?: string;

  createdAt: string;
  updatedAt: string;
};
```

### Neue Entität: MaterialIntakeEvent

```ts
type MaterialIntakeEvent = {
  id: string;
  materialProductId?: string;
  photoId?: string;

  eventType: "MATERIAL_LABEL_SCANNED" | "MATERIAL_CREATED" | "MATERIAL_STOCK_ADDED" | "MATERIAL_PRICE_UPDATED";

  recognizedName?: string;
  recognizedSupplier?: string;
  recognizedPackageSize?: number;
  recognizedUnit?: string;
  recognizedSku?: string;
  confidence?: "low" | "medium" | "high";

  quantityAdded?: number;
  purchasePriceNet?: number;

  timestamp: string;
  userId?: string;
  note?: string;
};
```

### Neue Entität: CostRule

Diese Regeln werden im Backend/Adminbereich gepflegt und dienen als Kalkulationsbasis.

```ts
type CostRule = {
  id: string;
  name: string;
  category:
    | "cleaning"
    | "deplating"
    | "sanding"
    | "polishing"
    | "galvanic_surface"
    | "repair"
    | "packaging"
    | "risk_buffer"
    | "overhead"
    | "other";

  unit:
    | "per_item"
    | "per_cm2"
    | "per_dm2"
    | "per_hour"
    | "per_batch"
    | "percentage"
    | "fixed";

  basePriceNet: number;
  estimatedMinutes?: number;
  materialCostNet?: number;

  appliesToSurface?: string[];
  appliesToMaterial?: string[];
  active: boolean;

  createdAt: string;
  updatedAt: string;
};
```

### Neue Entität: WorkEffortProfile

Diese Struktur beschreibt den Zustand eines angelieferten Teils. Sie kann vom Mitarbeiter gesetzt, von KI vorgeschlagen und später aus historischen Daten verbessert werden.

```ts
type WorkEffortProfile = {
  id: string;
  itemId?: string;
  requestItemId?: string;

  // Größe / Volumen / Oberfläche
  sizeClass: "xs" | "s" | "m" | "l" | "xl" | "custom";
  estimatedSurfaceDm2?: number;
  estimatedWeightKg?: number;

  // Verschmutzung
  dirtLevel: 0 | 1 | 2 | 3 | 4;
  oilGreaseLevel: 0 | 1 | 2 | 3 | 4;
  paintLacquerLevel: 0 | 1 | 2 | 3 | 4;

  // Geometrie
  hasThreads: boolean;
  hasDeepRecesses: boolean;
  hasComplexAngles: boolean;
  geometryComplexity: 1 | 2 | 3 | 4 | 5;

  // Zustand / Schleifaufwand
  rustPittingLevel: 0 | 1 | 2 | 3 | 4;
  dentsLevel: 0 | 1 | 2 | 3 | 4;
  holesOrCracksLevel: 0 | 1 | 2 | 3 | 4;
  badPreviousRestorationLevel: 0 | 1 | 2 | 3 | 4;
  straighteningNeeded: boolean;

  // Entmetallisierung / Vorbehandlung
  deplatingMultiplier: number; // 1, 2, 3, 4 ... per Button steuerbar
  extraWorkMultiplier: number; // 1, 2, 3, 4 ... allgemein

  // KI/Quelle
  source: "manual" | "ocr" | "ai_suggested" | "imported";
  confidence?: "low" | "medium" | "high";

  note?: string;
  createdAt: string;
  updatedAt: string;
};
```

### Erweiterung: Item

Bestehendes `Item` nicht ersetzen, sondern optional erweitern:

```ts
type ItemCostingExtension = {
  itemId: string;
  workEffortProfileId?: string;
  quoteCalculationId?: string;
  actualCostSummaryId?: string;

  estimatedLaborMinutes?: number;
  actualLaborMinutes?: number;

  estimatedMaterialCostNet?: number;
  actualMaterialCostNet?: number;

  estimatedPriceNet?: number;
  finalPriceNet?: number;
};
```

### Neue Entität: QuoteRequest

Für Website-Anfragen, E-Mail-Anfragen oder manuell erfasste Angebotsanfragen.

```ts
type QuoteRequest = {
  id: string;
  source: "website" | "email" | "phone" | "walk_in" | "manual";

  customerId?: string;
  matchedCustomerIds?: string[];

  requesterName?: string;
  requesterEmail?: string;
  requesterPhone?: string;

  subject?: string;
  description: string;
  photoIds: string[];
  documentIds?: string[];

  requestedSurface?: string;
  requestedDeadline?: string;

  status:
    | "new"
    | "ai_prepared"
    | "needs_review"
    | "offer_ready"
    | "offer_sent"
    | "accepted"
    | "rejected"
    | "converted_to_order"
    | "archived";

  matchedHistoricalOrderIds?: string[];
  suggestedQuoteCalculationId?: string;
  suggestedEmailDraftId?: string;

  createdAt: string;
  updatedAt: string;
};
```

### Neue Entität: QuoteCalculation

```ts
type QuoteCalculation = {
  id: string;
  quoteRequestId?: string;
  orderId?: string;
  itemId?: string;

  calculationVersion: number;

  lines: QuoteCalculationLine[];

  estimatedLaborMinutes: number;
  estimatedLaborCostNet: number;
  estimatedMaterialCostNet: number;
  estimatedExternalCostNet: number;
  estimatedOverheadNet: number;
  riskBufferNet: number;
  targetProfitNet: number;

  suggestedPriceNet: number;
  adjustedPriceNet?: number;
  finalPriceNet?: number;

  marginPercent?: number;
  contributionMarginNet?: number;

  confidence: "low" | "medium" | "high";
  explanation: string[];

  createdAt: string;
  updatedAt: string;
};

type QuoteCalculationLine = {
  id: string;
  label: string;
  category:
    | "cleaning"
    | "deplating"
    | "sanding"
    | "polishing"
    | "surface"
    | "material"
    | "repair"
    | "packaging"
    | "risk"
    | "overhead"
    | "profit"
    | "other";

  quantity: number;
  unit: string;
  unitPriceNet: number;
  totalNet: number;
  editable: boolean;
  source: "rule" | "historical_match" | "manual" | "ai_suggested";
  note?: string;
};
```

### Neue Entität: EmailDraft

```ts
type EmailDraft = {
  id: string;
  quoteRequestId?: string;
  customerId?: string;

  to?: string;
  subject: string;
  body: string;

  status: "draft" | "reviewed" | "sent" | "discarded";
  priceNet?: number;
  priceGross?: number;

  createdAt: string;
  updatedAt: string;
  sentAt?: string;
};
```

### Neue Entität: FinancialSettings

```ts
type FinancialSettings = {
  id: string;

  defaultHourlyRateNet: number; // kalkulatorischer Stundenlohn / Verrechnungssatz
  internalLaborCostPerHour?: number; // interne Kosten, falls bekannt
  targetProfitMarginPercent: number;
  defaultRiskBufferPercent: number;

  monthlyFixedCostsNet: number;
  productiveHoursPerMonth: number;
  overheadAllocationMode: "per_hour" | "percentage" | "manual";

  vatRateDefault: number;

  createdAt: string;
  updatedAt: string;
};
```

### Neue Entität: FinancialTransactionSummary

Nicht als vollständige Buchhaltung verstehen. Es ist eine operative Management-Sicht.

```ts
type FinancialTransactionSummary = {
  id: string;
  orderId?: string;
  quoteRequestId?: string;

  revenueNet: number;
  materialCostNet: number;
  externalCostNet: number;
  estimatedLaborCostNet: number;
  allocatedFixedCostNet: number;
  variableCostNet: number;

  contributionMarginNet: number; // Umsatz - variable Kosten
  estimatedProfitNet: number; // Umsatz - variable Kosten - zugeordnete Fixkosten

  invoiceNumber?: string;
  invoiceDate?: string;
  paymentStatus?: "open" | "paid" | "overdue" | "cancelled";

  periodMonth: string; // YYYY-MM
  createdAt: string;
  updatedAt: string;
};
```

---

## Kalkulationslogik

### Grundformel

```text
Netto-Angebotspreis =
  Arbeitskosten laut Verrechnungssatz
+ Materialkosten
+ Fremdleistungen
+ anteilige Gemeinkosten
+ Risikopuffer
+ Zielgewinn
```

Wichtig: Der Verrechnungssatz darf nicht mit tatsächlichem Lohn verwechselt werden.

- `defaultHourlyRateNet`: Preisbasis für Kundenkalkulation.
- `internalLaborCostPerHour`: interne Kostenbasis für Gewinnschätzung.
- `monthlyFixedCostsNet / productiveHoursPerMonth`: Gemeinkosten pro produktiver Stunde.

### Beispiel: Gemeinkostensatz

```ts
function computeOverheadPerHour(monthlyFixedCostsNet: number, productiveHoursPerMonth: number) {
  if (productiveHoursPerMonth <= 0) return 0;
  return monthlyFixedCostsNet / productiveHoursPerMonth;
}
```

### Beispiel: Buttonlogik für Zusatzaufwand

Der Button darf nicht „verdoppeln“ im mathematischen Sinn, wenn die Anzeige 1x, 2x, 3x, 4x sein soll. Er soll **hochzählen**.

```ts
function incrementMultiplier(current: number, max = 6) {
  return Math.min((current || 1) + 1, max);
}

function resetMultiplier() {
  return 1;
}
```

UI-Text:

```text
Zusatzaufwand: 1x Standard
Tippen: 2x erhöhter Aufwand
Tippen: 3x stark erhöhter Aufwand
Tippen: 4x außergewöhnlicher Aufwand
```

### Beispiel: Entmetallisierung pauschal pro Teil

```ts
type DeplatingInput = {
  basePricePerItemNet: number;
  quantity: number;
  multiplier: number; // 1, 2, 3, 4 ...
};

function calculateDeplatingCost(input: DeplatingInput) {
  return input.basePricePerItemNet * input.quantity * input.multiplier;
}
```

### Beispiel: Reinigungs-/Verschmutzungslogik

```ts
type CleaningInput = {
  baseCleaningPriceNet: number;
  sizeFactor: number; // xs 0.5, s 0.8, m 1.0, l 1.5, xl 2.2
  dirtLevel: number; // 0-4
  oilGreaseLevel: number; // 0-4
  paintLacquerLevel: number; // 0-4
  geometryComplexity: number; // 1-5
};

function calculateCleaningCost(input: CleaningInput) {
  const dirtFactor = 1 + input.dirtLevel * 0.2;
  const oilFactor = 1 + input.oilGreaseLevel * 0.25;
  const paintFactor = 1 + input.paintLacquerLevel * 0.35;
  const geometryFactor = 1 + (input.geometryComplexity - 1) * 0.15;

  return input.baseCleaningPriceNet * input.sizeFactor * dirtFactor * oilFactor * paintFactor * geometryFactor;
}
```

### Beispiel: Schleif-/Polieraufwand

```ts
type SandingInput = {
  baseMinutes: number;
  rustPittingLevel: number; // 0-4
  dentsLevel: number; // 0-4
  holesOrCracksLevel: number; // 0-4
  badPreviousRestorationLevel: number; // 0-4
  straighteningNeeded: boolean;
};

function estimateSandingMinutes(input: SandingInput) {
  let minutes = input.baseMinutes;
  minutes *= 1 + input.rustPittingLevel * 0.25;
  minutes *= 1 + input.dentsLevel * 0.2;
  minutes *= 1 + input.holesOrCracksLevel * 0.35;
  minutes *= 1 + input.badPreviousRestorationLevel * 0.3;

  if (input.straighteningNeeded) minutes += 30;

  return Math.round(minutes);
}
```

### Beispiel: Gesamtpreisberechnung

```ts
type QuoteInput = {
  laborMinutes: number;
  hourlyRateNet: number;
  internalLaborCostPerHour?: number;
  materialCostNet: number;
  externalCostNet: number;
  overheadPerHour: number;
  riskBufferPercent: number;
  targetProfitMarginPercent: number;
};

function calculateQuote(input: QuoteInput) {
  const laborHours = input.laborMinutes / 60;
  const laborRevenueNet = laborHours * input.hourlyRateNet;
  const overheadNet = laborHours * input.overheadPerHour;

  const subtotalBeforeRisk = laborRevenueNet + input.materialCostNet + input.externalCostNet + overheadNet;
  const riskBufferNet = subtotalBeforeRisk * (input.riskBufferPercent / 100);
  const subtotalBeforeProfit = subtotalBeforeRisk + riskBufferNet;
  const targetProfitNet = subtotalBeforeProfit * (input.targetProfitMarginPercent / 100);

  const suggestedPriceNet = subtotalBeforeProfit + targetProfitNet;

  const internalLaborCostNet = input.internalLaborCostPerHour
    ? laborHours * input.internalLaborCostPerHour
    : 0;

  const variableCostNet = input.materialCostNet + input.externalCostNet + internalLaborCostNet;
  const contributionMarginNet = suggestedPriceNet - variableCostNet;
  const estimatedProfitNet = suggestedPriceNet - variableCostNet - overheadNet;

  return {
    suggestedPriceNet: Math.round(suggestedPriceNet * 100) / 100,
    laborRevenueNet,
    overheadNet,
    riskBufferNet,
    targetProfitNet,
    variableCostNet,
    contributionMarginNet,
    estimatedProfitNet,
  };
}
```

---

## Foto-/KI-Logik: realistische Umsetzung

### MVP: keine echte autonome KI erzwingen

Zunächst soll die App mit einem **prüfbaren Vorschlagssystem** arbeiten:

- Foto vorhanden?
- Beschreibung vorhanden?
- Oberfläche erkannt?
- Teilart erkannt?
- Kunde bekannt?
- ähnliche frühere Aufträge vorhanden?
- Zustand durch Mitarbeiter klassifiziert?

Aus diesen Informationen entsteht ein strukturierter Preisvorschlag.

### Spätere KI-Schicht

Später kann ein Vision-Modell vorgeschaltet werden, das Bildmerkmale vorschlägt:

- Rostnarben sichtbar.
- Öl/Fett/Schmutz sichtbar.
- Lackreste sichtbar.
- Gewinde/Vertiefungen sichtbar.
- Bauteil vermutlich Stoßstange/Beschlag/Leuchter/Motorradteil/Besteck.

Wichtig: KI-Ergebnisse immer als `ai_suggested` markieren und durch Mitarbeiter bestätigbar machen.

### Warum das wichtig ist

Ein falscher KI-Preis wäre gefährlich. Ein KI-Vorschlag mit transparenter Begründung ist nützlich.

---

## Ähnlichkeitslogik aus vergangenen Aufträgen

### MVP: regelbasierte Ähnlichkeit

Zunächst keine komplexe Vektor-Datenbank zwingend einbauen. Stattdessen eine einfache Scoring-Funktion:

```ts
type SimilarityInput = {
  requestedSurface?: string;
  itemName?: string;
  customerId?: string;
  sizeClass?: string;
  material?: string;
  tags?: string[];
};

function scoreSimilarOrder(input: SimilarityInput, historical: any) {
  let score = 0;

  if (input.customerId && input.customerId === historical.customerId) score += 20;
  if (input.requestedSurface && input.requestedSurface === historical.surfaceRequested) score += 25;
  if (input.sizeClass && input.sizeClass === historical.sizeClass) score += 15;
  if (input.material && input.material === historical.material) score += 10;

  const inputName = (input.itemName || "").toLowerCase();
  const historicalName = (historical.itemName || "").toLowerCase();
  if (inputName && historicalName && historicalName.includes(inputName)) score += 20;

  const tagOverlap = (input.tags || []).filter(tag => historical.tags?.includes(tag)).length;
  score += tagOverlap * 5;

  return score;
}
```

### Anzeige im UI

Im Angebotsassistenten:

```text
Ähnliche Aufträge gefunden

1. A-2025-0188 — Motorradteile BMW R75 verchromen
   Preis: 420 € netto
   Ist-Aufwand: 5,5 Std.
   Marge: 31 %
   Treffergrund: gleiche Oberfläche, ähnliche Teile, gleicher Zustand

2. A-2026-0021 — Stoßstange vernickeln
   Preis: 680 € netto
   Ist-Aufwand: 8,0 Std.
   Hinweis: starker Schleifaufwand wegen Rostnarben
```

### Später: Embeddings / Bildähnlichkeit

Erst nach ausreichender Datensammlung sinnvoll:

- Text-Embedding aus Beschreibung, Teilart, Oberfläche, Zustand.
- Bild-Embedding aus Fotos.
- Suche ähnlicher Fälle über Vektorindex.
- Weiterhin nur als Entscheidungshilfe, nicht als alleinige Preisquelle.

---

## Angebotsassistent für Website-Anfragen

### Ziel

Website-Anfragen mit Bildern sollen nicht in einem Mailchaos landen, sondern als strukturierte `QuoteRequest` in die App laufen.

### Minimaler Ablauf

1. Anfrage kommt von Website oder wird manuell erfasst.
2. App erzeugt `QuoteRequest`.
3. Fotos werden zugeordnet.
4. App sucht bestehenden Kunden anhand E-Mail, Telefonnummer, Name.
5. App sucht ähnliche Aufträge.
6. App erstellt WorkEffortProfile-Vorschlag.
7. App berechnet Preisvorschlag.
8. App erstellt Mailentwurf.
9. Mitarbeiter prüft Preis und Mail.
10. Mitarbeiter klickt „Angebot senden“ oder „Als Auftrag übernehmen“.

### Neue Seite: „Anfragen“

Wenn möglich, eine neue Seite ergänzen:

```text
Heute
Aufträge
Teile
Kunden
Scan (OCR)
Anfragen
Verzug & Engpässe
Performance
Einstellungen
```

Falls Navigation aktuell nicht erweitert werden soll: zuerst als Tab im bestehenden Bereich „Scan (OCR)“ oder „Aufträge“ integrieren.

### UI-Anforderungen

- Links: neue Anfragen nach Alter und Dringlichkeit.
- Mitte: Bilder, Beschreibung, erkannte Daten.
- Rechts: Kundenkontext, ähnliche Aufträge, Preisvorschlag, Mailentwurf.
- Preis immer bearbeitbar.
- Mail immer bearbeitbar.
- Button: „Entwurf übernehmen“, „Angebot senden“, „Als Auftrag anlegen“.

### Mailentwurf: Struktur

Die App soll keine beliebige Marketingmail formulieren, sondern eine fachlich saubere Antwort:

```text
Betreff: Kosteneinschätzung zu Ihrer Anfrage

Guten Tag [Name],

vielen Dank für Ihre Anfrage und die zugesendeten Bilder.

Auf Basis der Bilder und Ihrer Beschreibung schätzen wir den Aufwand aktuell wie folgt ein:

- Teil / Objekt: [Teil]
- gewünschte Oberfläche: [Oberfläche]
- sichtbarer Zustand: [Zustand]
- voraussichtlicher Preis: ca. [Preis] € netto / brutto

Hinweis: Die finale Einschätzung erfolgt nach Sichtprüfung in der Werkstatt, da unter alten Beschichtungen, Lacken oder Verschmutzungen zusätzlicher Aufwand sichtbar werden kann.

Wenn Sie möchten, können Sie die Teile vorbeibringen oder zusenden. Danach prüfen wir den Zustand verbindlich und stimmen die nächsten Schritte ab.

Mit freundlichen Grüßen
Galvanik Kreile
```

---

## Verbrauchsmaterial-Wareneingang per Foto

### Ziel

Verbrauchsmaterialien sollen ohne manuelles Abtippen in den Bestand und die Kostenbasis übernommen werden.

### Ablauf

1. Mitarbeiter klickt „Material scannen“.
2. Foto vom Etikett oder Lieferschein.
3. OCR erkennt Produktname, Menge, Einheit, Lieferant, Artikelnummer.
4. App schlägt vorhandenes Materialprodukt vor oder legt neues an.
5. Mitarbeiter prüft und bestätigt.
6. Bestand und Einkaufspreis werden aktualisiert.
7. `MaterialIntakeEvent` wird gespeichert.

### UI-Regel

Nicht mit einem langen Formular starten. Erst Foto, dann Vorschlag.

### Verbrauchslogik im Auftrag

Im Auftrag/Teil kann Materialverbrauch geschätzt oder pauschal gesetzt werden:

- Standardverbrauch pro Oberfläche.
- Verbrauch pro Größe/Oberfläche.
- Pauschale je Teil.
- Sonderverbrauch durch Zusatzaufwand.

Beispiel:

```text
Verbrauchsmaterial
- Entfetter pauschal: 2,50 €
- Schleifmittel: 4,00 €
- Badchemie anteilig: 7,80 €
- Verpackung: 3,20 €
= 17,50 € Materialkosten
```

---

## Finanzcontrolling

### Ziel

Die App soll nicht nur zeigen, ob Aufträge fertig sind, sondern ob das Unternehmen wirtschaftlich arbeitet.

### Neue Performance-KPIs

Die bestehende Performance-Seite soll ergänzt werden um:

| KPI | Bedeutung |
|---|---|
| Umsatz netto | Summe abgeschlossener oder fakturierter Aufträge |
| Angebotsvolumen | Summe offener Angebote |
| Erwarteter Umsatz | angenommene Wahrscheinlichkeit × Angebotswert |
| Variable Kosten | Material, Fremdleistung, direkt zurechenbare Kosten |
| Fixkostenanteil | anteilige Monatsfixkosten je produktiver Stunde oder Auftrag |
| Deckungsbeitrag | Umsatz - variable Kosten |
| geschätzter Gewinn | Umsatz - variable Kosten - zugeordnete Fixkosten |
| Ø Marge | Gewinn / Umsatz |
| Auslastung produktive Stunden | geplante/erfasste Stunden vs. Kapazität |
| Forecast Monatsende | hochgerechneter Umsatz/Gewinn bis Monatsende |

### Wichtig: Begriffe im UI verständlich machen

Beispielanzeigen:

```text
Deckungsbeitrag
Was nach Material und direkten Kosten übrig bleibt.
```

```text
Geschätzter Gewinn
Nach variablen Kosten und anteilig gerechneten Fixkosten.
```

### Forecast-Logik

Ein einfacher Forecast reicht zunächst:

```ts
function forecastMonthToDate(valueSoFar: number, dayOfMonth: number, daysInMonth: number) {
  if (dayOfMonth <= 0) return valueSoFar;
  return (valueSoFar / dayOfMonth) * daysInMonth;
}
```

Besser später:

- nur Arbeitstage rechnen,
- saisonale Muster speichern,
- offene Angebote mit Wahrscheinlichkeit gewichten,
- Auslastung der Stationen berücksichtigen.

### Angebotswahrscheinlichkeit

```ts
type QuoteProbability = "low" | "medium" | "high" | "accepted";

const quoteProbabilityFactor = {
  low: 0.25,
  medium: 0.5,
  high: 0.75,
  accepted: 1,
};
```

### Forecast aus offenen Angeboten

```ts
function computeExpectedRevenueFromQuotes(quotes: any[]) {
  return quotes.reduce((sum, quote) => {
    const factor = quoteProbabilityFactor[quote.probability || "medium"] || 0.5;
    return sum + (quote.priceNet || 0) * factor;
  }, 0);
}
```

---

## Export für Buchhaltung und Steuerberater

### MVP-Export

Zunächst keine direkte DATEV-Automatik. Stattdessen:

- CSV-Export Aufträge.
- CSV-Export Rechnungs-/Umsatzübersicht.
- CSV-Export Materialverbrauch.
- CSV-Export offene Angebote.
- CSV-Export Kostenübersicht je Monat.

### Exportfelder: Umsatzübersicht

```text
Monat
Auftragsnummer
Kundennummer
Kundenname
Leistung
Netto-Umsatz
MwSt.-Satz
Brutto-Umsatz
Materialkosten netto
Fremdleistungen netto
geschätzte Arbeitszeit
Deckungsbeitrag
geschätzter Gewinn
Rechnungsnummer
Zahlungsstatus
```

### Exportfelder: Kostenregeln / Material

```text
Datum
Materialname
Kategorie
Lieferant
Menge
Einheit
Einkaufspreis netto
Verbrauch Auftrag
Kostenstelle/Station
Notiz
```

### Spätere Integration

Vorbereiten, aber nicht im MVP erzwingen:

- Lexware-Importstruktur.
- DATEV-CSV-Struktur.
- Steuerberater-Monatsreport als PDF/Excel.
- Rechnungssystem-Anbindung.

---

## UI-Integration ohne Umbau

### Bestehende Seite „Performance“ erweitern

Neue Sektion:

```text
Finanzüberblick
- Umsatz diesen Monat
- geschätzter Gewinn
- variable Kosten
- Fixkostenanteil
- Angebotsvolumen offen
- Forecast Monatsende
```

Darunter:

```text
Wirtschaftliche Hinweise
- Schleifaufwand bei Stoßstangen überschreitet Kalkulation um 18 %.
- Materialkosten für Politur steigen diese Woche.
- 3 offene Angebote über 2.400 € warten auf Antwort.
- Deckungsbeitrag bei Kleinteilen mit Vernickelung stabil.
```

### Bestehende Seite „Aufträge“ erweitern

Im Detailpanel ergänzen:

- Kalkulation.
- Soll/Ist-Aufwand.
- Materialverbrauch.
- Preisvorschlag / finaler Preis.
- ähnliche frühere Aufträge.

### Bestehende Seite „Kunden“ erweitern

Kundenakte ergänzen:

- bisheriger Umsatz.
- durchschnittliche Marge.
- wiederkehrende Teile.
- Preisabsprachen.
- offene Angebote.
- Reklamationen und Nacharbeit.

### Bestehende Seite „Scan (OCR)“ erweitern

Zusätzlicher Modus:

```text
[Wareneingang Auftrag]
[Material scannen]
[Anfrage mit Bildern erfassen]
```

---

## Komponenten und Dateien

Antigravity soll zuerst prüfen, welche Struktur bereits existiert. Danach ergänzen:

```text
src/types/costing.ts
src/types/materials.ts
src/types/quotes.ts
src/types/finance.ts

src/data/mockCostRules.ts
src/data/mockMaterials.ts
src/data/mockQuoteRequests.ts
src/data/mockFinancials.ts

src/lib/costing/calculateQuote.ts
src/lib/costing/effortScoring.ts
src/lib/costing/similarity.ts
src/lib/finance/financialKpis.ts
src/lib/export/csvExport.ts
src/lib/quotes/emailDraft.ts

src/components/costing/CostBreakdownCard.tsx
src/components/costing/EffortMultiplierButton.tsx
src/components/costing/WorkEffortForm.tsx
src/components/costing/SimilarOrdersPanel.tsx

src/components/materials/MaterialIntakeScan.tsx
src/components/materials/MaterialStockCard.tsx

src/components/quotes/QuoteRequestList.tsx
src/components/quotes/QuoteRequestDetail.tsx
src/components/quotes/QuoteAssistantPanel.tsx
src/components/quotes/EmailDraftEditor.tsx

src/components/finance/FinanceKpiCard.tsx
src/components/finance/FinancialForecastPanel.tsx
src/components/finance/CostStructurePanel.tsx
src/components/export/ExportPanel.tsx
```

Falls das Projekt andere Ordnernamen nutzt, entsprechend anpassen. Keine bestehende Datei löschen.

---

## Schrittweise Umsetzung für Antigravity / Claude Code

### Schritt 0 — Bestand schützen

```text
Analysiere zuerst die aktuelle App-Struktur. Nenne mir kurz, welche Seiten, Komponenten, Mockdaten und Typdateien existieren. Lösche nichts. Erstelle keine neue App. Dieses Add-on ergänzt nur Kalkulation, Materialerfassung, Angebotsassistent und Finanzcontrolling.
```

### Schritt 1 — Typen ergänzen

```text
Ergänze neue TypeScript-Typen für MaterialProduct, MaterialIntakeEvent, CostRule, WorkEffortProfile, QuoteRequest, QuoteCalculation, EmailDraft und FinancialSettings. Lege diese möglichst in eigenen Dateien unter src/types an. Bestehende Typen nicht ersetzen, sondern optional erweitern.
```

### Schritt 2 — Mockdaten ergänzen

```text
Lege realistische Mockdaten für Kostenregeln, Verbrauchsmaterialien, Angebotsanfragen, Finanzsettings und historische Vergleichsaufträge an. Verwende Galvanik-Kreile-nahe Beispiele: Stoßstangen, Motorradteile, Besteck, Möbelbeschläge, Jugendstilleuchter, verschmutzte und schlecht restaurierte Teile.
```

### Schritt 3 — Kalkulationsfunktionen bauen

```text
Erstelle reine Utility-Funktionen für Kalkulation: Reinigungskosten, Entmetallisierungspauschale, Schleifzeit, Gemeinkosten pro Stunde, Angebotsgesamtpreis, Deckungsbeitrag und geschätzter Gewinn. Keine UI bauen, bevor die Funktionen typisiert und mit Mockdaten testbar sind.
```

### Schritt 4 — UI im Auftrag-Detail ergänzen

```text
Erweitere das bestehende Auftrag-/Teil-Detailpanel um eine Kalkulationskarte. Zeige Preisvorschlag, Kostenbestandteile, Zusatzaufwand-Multiplikator, Materialkosten, geschätzte Arbeitszeit, Marge und ähnliche frühere Aufträge. Alles bearbeitbar, aber kompakt.
```

### Schritt 5 — Scan/OCR um Materialmodus ergänzen

```text
Erweitere die bestehende Scan/OCR-Seite um einen Modus „Material scannen“. Zunächst reicht eine Demo mit simuliertem OCR-Ergebnis. Ziel: Etikettfoto -> erkannte Materialdaten -> vorhandenes Material zuordnen oder neues Material anlegen -> Bestand aktualisieren.
```

### Schritt 6 — Angebotsassistent ergänzen

```text
Erstelle eine Add-on-Seite oder einen Tab „Anfragen“. Zeige Website-/Mail-Anfragen mit Bildern, Kundenabgleich, ähnliche Aufträge, Aufwandsvorschlag, Preisvorschlag und bearbeitbaren Mailentwurf. Noch nicht automatisch versenden, nur Entwurf bestätigen/simulieren.
```

### Schritt 7 — Performance um Finanzcontrolling erweitern

```text
Erweitere die bestehende Performance-Seite um einen Finanzbereich: Umsatz netto, variable Kosten, Fixkostenanteil, Deckungsbeitrag, geschätzter Gewinn, offene Angebote, erwarteter Umsatz und Monatsforecast. Keine bestehende Heatmap oder operative Performance entfernen.
```

### Schritt 8 — Export vorbereiten

```text
Erstelle eine einfache CSV-Exportfunktion für Monatsübersicht, Auftragsumsatz, Kostenübersicht und Materialverbrauch. Noch keine direkte DATEV-/Lexware-API. Der Export muss später erweiterbar sein.
```

### Schritt 9 — Tests und Akzeptanz

```text
Teste: App startet fehlerfrei, Navigation bleibt erhalten, bestehende Seiten funktionieren, neue Add-on-Komponenten erscheinen nur ergänzend, Mockdaten werden angezeigt, Kalkulationsfunktionen liefern plausible Werte, keine TypeScript-Fehler.
```

---

## Token-sparende Arbeitsweise für Claude/Antigravity

Wichtig: Nicht alles in einem riesigen Schritt generieren lassen.

### Befehl 1: Nur Analyse

```text
Analysiere die bestehende Projektstruktur und nenne nur die Dateien, die für das Add-on Kalkulation/Finanzen/Anfragen relevant sind. Noch nichts ändern.
```

### Befehl 2: Nur Typen und Mockdaten

```text
Erstelle nur die TypeScript-Typen und Mockdaten für das Add-on. Keine UI. Keine bestehenden Seiten verändern. Danach TypeScript prüfen.
```

### Befehl 3: Nur Utility-Logik

```text
Erstelle nur die Kalkulations- und Finanzfunktionen unter src/lib. Verwende die Mockdaten. Keine UI. Gib mir danach die wichtigsten Funktionsnamen und Beispieloutputs.
```

### Befehl 4: Eine UI-Komponente nach der anderen

```text
Integriere jetzt nur die Kalkulationskarte im bestehenden Auftrag-Detailpanel. Keine neue Seite. Keine Navigation ändern.
```

### Befehl 5: Performance-Erweiterung

```text
Erweitere nur die Performance-Seite um Finanz-KPI-Karten und Forecast. Bestehende Performance-Komponenten beibehalten.
```

### Befehl 6: Angebotsassistent

```text
Erstelle den Angebotsassistenten als isolierte Add-on-Seite oder Tab. Nutze Mockdaten. Kein echter E-Mail-Versand.
```

### Befehl 7: Materialscan

```text
Erweitere Scan/OCR um Materialscan als Demo. Keine echte OCR-Anbindung erzwingen, sondern simulierte OCR-Daten bearbeitbar anzeigen.
```

---

## Akzeptanzkriterien für dieses Add-on

Die Umsetzung ist gut, wenn:

- bestehende App-Struktur erhalten bleibt,
- keine bestehende Seite funktionslos wird,
- Kalkulation pro Teil/Auftrag nachvollziehbar ist,
- Zusatzaufwand schnell per Button gesetzt werden kann,
- Verbrauchsmaterial per Foto/OCR-Flow vorbereitet ist,
- Website-Anfragen mit Bildern als strukturierte Angebotsanfragen erscheinen,
- ähnliche frühere Aufträge sichtbar sind,
- Preisvorschlag und Mailentwurf bearbeitbar sind,
- Performance-Seite Umsatz, Kosten, Deckungsbeitrag und Forecast zeigt,
- Exportdaten für Steuerberater/Buchhaltung vorbereitet sind,
- alle KI-Vorschläge prüfbar bleiben.

---

## Nicht umsetzen in dieser Phase

Noch nicht bauen:

- echtes automatisches E-Mail-Senden ohne Review,
- direkte DATEV-/Lexware-API,
- echte KI-Bilderkennung als Pflichtfunktion,
- automatisches Pricing ohne manuelle Freigabe,
- komplette Lagerwirtschaft mit Chargenpflicht,
- vollständige Finanzbuchhaltung,
- komplettes CRM-Neudesign,
- Austausch der bestehenden Navigation oder Seitenstruktur.

---

## Kurzprompt für direkte Umsetzung

```text
Implementiere dieses Dokument als Add-on zur bestehenden Kreile WerkstattCockpit App. Keine komplette Umstellung, keine funktionierenden Seiten löschen. Ergänze typisierte Datenmodelle, Mockdaten, Kalkulationslogik, Materialscan-Demo, Angebotsassistent, Finanz-KPIs und CSV-Export schrittweise. Preisvorschläge müssen nachvollziehbar und bearbeitbar sein. KI/OCR nur als prüfbarer Vorschlag, nicht als automatische Wahrheit. Umsatz, variable Kosten, Fixkostenanteil, Deckungsbeitrag, geschätzter Gewinn und Forecast sollen in Performance sichtbar werden. Arbeite modular und token-sparend: erst Typen, dann Mockdaten, dann Utility-Funktionen, dann einzelne UI-Komponenten.
```
