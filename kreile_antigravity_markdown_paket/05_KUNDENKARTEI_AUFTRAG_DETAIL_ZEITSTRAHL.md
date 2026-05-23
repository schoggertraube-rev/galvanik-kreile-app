# Kreile WerkstattCockpit — Kundenkartei, Auftragdetail und Zeitstrahl

## Ziel

Die Kundenkartei wird zum Werkstattgedächtnis.

Sie soll nicht nur Kontaktdaten zeigen, sondern Wissen speichern, das für Preisfindung, Reklamationsvermeidung, Wiederholaufträge und Kommunikation wichtig ist.

## Leitgedanke

Wenn ein Kunde nach Monaten wiederkommt, soll die App sofort zeigen:

- was früher gemacht wurde,
- welche Teile ähnlich waren,
- welche Preise vereinbart wurden,
- welche Fotos existieren,
- ob es Reklamationen gab,
- wie der Kunde kommuniziert,
- welche technischen Besonderheiten wichtig sind.

## Kundenprofil-Struktur

```text
Kundenprofil
├── Kopfbereich
│   ├── Name / Firma
│   ├── Kundentyp
│   ├── Kontakt
│   ├── Kommunikationspräferenz
│   └── Schnellaktionen
├── Aktive Aufträge
├── Zeitstrahl
├── Preisabsprachen
├── Wiederkehrende Teile
├── Reklamationen / Nacharbeit
├── Fotos / Referenzen
├── Notizen
└── Kommunikationshistorie
```

## Kundenkopf

Beispiel:

```text
Museum Lenzburg
Institution · Stammkunde
Kontakt: Frau Keller
E-Mail · Telefon · Adresse

[Neuer Auftrag] [Anrufen] [E-Mail] [Vergangene Arbeiten]
```

## Zeitstrahl

Der Zeitstrahl ist der zentrale Bereich.

Er scrollt vertikal nach unten und zeigt:

- Auftrag angelegt,
- Dokument gescannt,
- Fotos aufgenommen,
- Angebot versendet,
- Freigabe erhalten,
- Station gestartet,
- Station abgeschlossen,
- Material gebucht,
- Bad verwendet,
- Qualitätsprüfung,
- Versand,
- Reklamation,
- Nacharbeit,
- Notiz.

### Beispiel

```text
19.05.2026 · Auftrag A-2026-0035 angelegt
Jugendstilleuchter brünieren · 1 Teil

19.05.2026 · Wareneingang
Dokument gescannt · 3 Fotos · OCR erkannt: Kirche St. Martin

20.05.2026 · Wartet auf Material/KV
Nächste Aktion: Freigabe klären

22.05.2026 · Kundenfreigabe offen
Maßnahme: Rückfrage vorbereiten
```

## Timeline-Datenstruktur

```ts
type TimelineEntry = {
  id: string;
  customerId: string;
  orderId?: string;
  itemId?: string;
  type:
    | "order"
    | "status"
    | "photo"
    | "document"
    | "communication"
    | "price"
    | "complaint"
    | "stock"
    | "bath"
    | "note";
  title: string;
  subtitle?: string;
  timestamp: string;
  severity?: "neutral" | "good" | "watch" | "critical";
  relatedIds?: string[];
};
```

## Ähnliche Aufträge

Beim Wareneingang und im Kundenprofil soll die App ähnliche frühere Aufträge vorschlagen.

Vergleichskriterien:

- Kunde,
- Teilname,
- Oberfläche,
- Material,
- Größe/Anzahl,
- Stationen,
- Preis,
- Durchlaufzeit,
- Reklamation/Nacharbeit.

### Beispielkarte

```text
Ähnlicher Auftrag gefunden
A-2025-0188 · Motorradteile BMW R75 verchromen
Preis: 420 €
Durchlaufzeit: 6 Tage
Hinweis: Hochglanzpolitur gewünscht

[Öffnen] [Als Referenz übernehmen]
```

## Auftragdetail

Beim Klick auf einen Auftrag öffnet sich ein Detailpanel oder eine Detailseite.

### Pflichtbereiche

```text
Auftragdetail
├── Kopfbereich
├── Status / Station / Frist
├── Nächste Aktion
├── Teileliste
├── Fotos / Dokumente
├── StatusEvents / Zeitstrahl
├── Material- und Zeitbuchung
├── offene Blocker
├── Kundenkommunikation
├── interne Notizen
└── Schnellaktionen
```

## Auftragkopf

```text
A-2026-0042
Stoßstangen vernickeln (Opel Rekord C)
Museum Lenzburg
Station: Schleiferei
Überfällig seit: 3 Stunden

Nächste Aktion: Express-Schaltung prüfen
```

## Schnellaktionen

Buttons im Auftragdetail:

```text
Station starten
Station abschließen
Foto ergänzen
Verbrauch hinzufügen
Arbeitszeit buchen
Kunde kontaktieren
Freigabe erhalten
Material erhalten
Nacharbeit starten
Versand vorbereiten
```

Diese Buttons müssen groß genug sein und dürfen nicht alle gleichzeitig dominant wirken.

Empfehlung:

- Primäre Aktion groß.
- Sekundäre Aktionen als Kacheln.
- Weitere Aktionen im Menü „Mehr“.

## Material- und Zeitbuchung

### Button

```text
Verbrauch hinzufügen
```

### Drawer

```text
Verbrauch hinzufügen

Auftrag: A-2026-0042
Station: Schleiferei

Arbeitszeit
[ - ] 45 Minuten [ + ]

Verbrauchsmaterial
[Schleifpapier P240] 3 Stück
[Polierscheibe] 1 Stück
[Bürste Messing] 1 Stück

[Speichern]
```

## Kundenkommunikation

Zunächst keine echte E-Mail-Automation nötig, aber vorbereiten:

- Kommunikationsnotiz speichern,
- Kontaktversuch speichern,
- Freigabeanfrage markieren,
- Rückruf erforderlich markieren.

Später:

- Outlook-Integration,
- E-Mail-Vorlagen,
- automatische Statusupdates.

## Preisabsprachen

Preisabsprachen müssen strukturiert sein.

```ts
type PriceAgreement = {
  id: string;
  customerId: string;
  title: string;
  description?: string;
  surfaceType?: string;
  itemPattern?: string;
  price?: number;
  currency: "EUR";
  validFrom?: string;
  validUntil?: string;
  note?: string;
};
```

## Reklamationen

Reklamationen dürfen nicht nur als Freitext existieren.

```ts
type Complaint = {
  id: string;
  customerId: string;
  orderId: string;
  itemId?: string;
  reason:
    | "surface_quality"
    | "wrong_surface"
    | "damage"
    | "delay"
    | "communication"
    | "customer_expectation"
    | "transport"
    | "other";
  stationId?: string;
  description: string;
  photoIds: string[];
  createdAt: string;
  resolvedAt?: string;
  resolution?: string;
};
```

## UI-Komponenten

```text
src/components/customers/CustomerList.tsx
src/components/customers/CustomerProfile.tsx
src/components/customers/CustomerTimeline.tsx
src/components/customers/SimilarOrdersPanel.tsx
src/components/customers/PriceAgreementPanel.tsx
src/components/customers/ComplaintPanel.tsx
src/components/orders/OrderDetailPanel.tsx
src/components/orders/OrderActionGrid.tsx
src/components/orders/OrderTimeline.tsx
src/components/orders/OrderMaterialTimePanel.tsx
src/components/orders/OrderPhotosPanel.tsx
```

## Akzeptanzkriterien

- Kundenprofil zeigt mehr als Kontaktdaten.
- Vertikaler Zeitstrahl ist vorhanden.
- Frühere Aufträge sind schnell erreichbar.
- Ähnliche Aufträge werden angezeigt oder als Demo vorbereitet.
- Auftragdetail hat echte Aktionen, keine toten Buttons.
- Verbrauch und Arbeitszeit können aus dem Auftrag gebucht werden.
- Reklamationen und Preisabsprachen sind strukturiert sichtbar.
