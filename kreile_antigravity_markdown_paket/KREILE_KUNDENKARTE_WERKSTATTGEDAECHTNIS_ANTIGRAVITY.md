# Kreile WerkstattCockpit — Kundenkarte als intelligentes Werkstattgedächtnis

## Zweck dieser Markdown-Datei

Diese Datei ist eine direkte Bau- und Umsetzungsanweisung für Antigravity / Claude Code.

Ziel ist die Erweiterung der bestehenden Kreile WerkstattCockpit App um eine hochwertige, operative **Kundenkarte / Kundenakte**, die weit mehr leistet als ein normales Adressbuch.

Die Kundenkarte soll zu einem **Werkstattgedächtnis** werden:

- frühere Aufträge sichtbar machen,
- wiederkehrende Teile erkennen,
- Preisreferenzen sichern,
- Reklamationen und Nacharbeiten nachvollziehbar machen,
- Kommunikations- und Freigabebesonderheiten speichern,
- ähnliche frühere Aufträge vorschlagen,
- Mitarbeiter vor Fehlern, Preisabweichungen und unnötigen Rückfragen schützen.

---

## Grundsatz

Die bestehende App darf nicht neu gebaut oder ersetzt werden.

Antigravity soll:

1. die aktuelle Kunden-Seite analysieren,
2. vorhandene Komponenten und Datenstrukturen wiederverwenden,
3. die bestehende Navigation erhalten,
4. vorhandene Funktionen nicht entfernen,
5. die Kundenkarte modular erweitern,
6. Mockdaten realistisch ausbauen,
7. späteren Anschluss an Supabase / PostgreSQL ermöglichen.

Die Erweiterung muss zum bestehenden WerkstattCockpit passen:

- Tablet-first,
- klares Kartenlayout,
- schnelle Erfassbarkeit,
- keine Tabellenwüste,
- keine überladenen CRM-Masken,
- keine dekorativen Daten ohne operativen Nutzen.

---

# 1. Zielbild der Kundenkarte

Wenn ein Mitarbeiter einen Kunden öffnet, soll er innerhalb weniger Sekunden erkennen:

1. Wer ist der Kunde?
2. Welche offenen Aufträge gibt es?
3. Welche früheren Arbeiten wurden gemacht?
4. Welche Teile, Oberflächen und Materialien kommen wiederholt vor?
5. Welche Preise wurden früher genommen?
6. Gab es Reklamationen, Nacharbeit oder Diskussionen?
7. Welche Fotos und Referenzbilder existieren?
8. Wie kommuniziert dieser Kunde am besten?
9. Gibt es Zahlungs-, Freigabe- oder Verpackungsbesonderheiten?
10. Welche nächste Aktion ist sinnvoll?

Die Kundenkarte soll nicht nur Daten speichern, sondern aktiv helfen.

---

# 2. Zentrale Idee: „Werkstattgedächtnis“

Die Kundenkarte erhält einen prominenten Bereich namens:

```text
Werkstattgedächtnis
```

Dieser Bereich zeigt automatisch relevante Hinweise aus der Kundenhistorie.

## Beispiele für Hinweise

```text
Ähnlicher Auftrag gefunden
A-2025-0188 — Motorradteile BMW R75 verchromen
Preis: 420 € netto · Durchlaufzeit: 6 Tage
Hinweis: Kunde wünschte Hochglanzpolitur.
```

```text
Preisreferenz vorhanden
Stoßstangen vernickeln wurden zuletzt für 780 € netto bearbeitet.
Damals 2,5 Stunden Zusatzaufwand wegen tiefer Kratzer.
Empfehlung: Bei ähnlichem Zustand nicht unter 820 € anbieten.
```

```text
Freigabehinweis
Dieser Kunde benötigt meist 3–5 Tage für Angebotsfreigaben.
Bei Terminaufträgen früh schriftlich nachfassen.
```

```text
Dokumentationshinweis
Bei diesem Kunden gab es bereits Diskussionen über Eingangszustand.
Vorher-Fotos bei neuen Teilen verpflichtend markieren.
```

```text
Technischer Hinweis
Wiederkehrende Oberfläche: seidenmatt vernickelt.
Kunde reagiert empfindlich auf sichtbare Polierspuren.
```

---

# 3. Informationsarchitektur

Die Kundenkarte soll in klaren Bereichen oder Tabs aufgebaut werden.

## Empfohlene Tabs

1. **Übersicht**
2. **Aufträge**
3. **Teile & Fotos**
4. **Preise**
5. **Reklamationen**
6. **Kommunikation**
7. **Notizen & Besonderheiten**

---

# 4. Kundenliste links

Die bestehende Kundenliste soll erhalten, aber optisch und funktional verbessert werden.

## Jede Kundenkarte in der Liste zeigt

- Kundenname / Firma
- Kundennummer
- Kundentyp
- Stadt
- offene Aufträge
- kritische Aufträge
- letzte Aktivität
- Statusbadge

## Kundentypen

```ts
type CustomerType = "private" | "business" | "institution";
```

## Kundenstatus

```ts
type CustomerStatus =
  | "new"
  | "regular"
  | "vip"
  | "watch"
  | "sensitive"
  | "inactive";
```

## Beispielkarten

```text
Museum Lenzburg
Institution · Stammkunde
3 offene Aufträge · 1 kritisch
Letzte Aktivität: vor 2 Tagen
```

```text
Privatkunde Lenz
Privatkunde · Beobachten
1 Auftrag wartet auf Freigabe
Letzte Aktivität: heute
```

---

# 5. Kundenakte Header

Der Header der Detailansicht muss sofort Orientierung geben.

## Inhalt

- Name / Firma
- Kundennummer
- Kundentyp
- Kundenstatus
- Ort
- Kontaktperson
- bevorzugter Kontaktweg
- letzte Aktivität
- offene Aufträge
- kritische Aufträge
- offene Freigaben
- Zahlungsstatus, falls relevant

## Beispiel

```text
Museum Lenzburg
K-2026-0018 · Institution · Stammkunde

3 offene Aufträge · 1 kritisch · 1 Freigabe offen
Bevorzugt: E-Mail · Freigabe schriftlich
Letzte Aktivität: vor 2 Tagen
```

## Direktaktionen im Header

- Neuer Auftrag
- Kunde kontaktieren
- Notiz hinzufügen
- Preisreferenzen öffnen
- Auftragshistorie öffnen

Diese Buttons müssen groß genug für Tablet-Bedienung sein.

---

# 6. Tab „Übersicht“

Die Übersicht ist keine Datensammlung, sondern eine operative Zusammenfassung.

## Karten in der Übersicht

### 6.1 Stammdaten

- Name / Firma
- Kundennummer
- Adresse
- Stadt
- Kontaktperson
- E-Mail
- Telefon
- Kundentyp
- bevorzugter Kontaktweg

### 6.2 Aktueller Stand

- offene Aufträge
- kritische Aufträge
- wartet auf Freigabe
- wartet auf Material
- fertig zur Abholung / Versand
- letzter Auftrag
- nächster zugesagter Termin

### 6.3 Kundenprofil

- Neukunde / Stammkunde / VIP / Beobachten / Sensibel
- Qualitätsanspruch
- Preissensibilität
- Kommunikationsstil
- typische Antwortzeit
- Freigabelogik
- Zahlungsprofil

### 6.4 Technisches Profil

- häufige Materialien
- häufige Oberflächen
- wiederkehrende Teile
- Verpackungswünsche
- technische Hinweise
- Bearbeitungsrisiken

---

# 7. Tab „Aufträge“

Dieser Tab zeigt offene und historische Aufträge des Kunden.

## Standard-Sortierung

1. Kritische offene Aufträge
2. Offene Aufträge
3. Wartet auf Freigabe
4. Fertig zur Abholung / Versand
5. Zuletzt abgeschlossene Aufträge
6. ältere Historie

## Filterchips

- Alle
- Offen
- Kritisch
- Wartet auf Freigabe
- Abgeschlossen
- Nacharbeit / Reklamation
- Dieses Jahr

## Auftragskarte

Jede Auftragskarte zeigt:

- Auftragsnummer
- Titel / Hauptarbeit
- Status
- aktuelle Station
- Frist / zugesagter Termin
- Anzahl Teile
- Preis, falls vorhanden
- Durchlaufzeit
- Nacharbeit/Reklamation ja/nein
- nächste Aktion
- Button „Details öffnen“

## Beispiel

```text
A-2026-0042 — Stoßstangen vernickeln
Status: Kritisch
Station: Schleiferei / Politur
Fällig: heute
Teile: 2
Nächste Aktion: Express-Schaltung prüfen
```

---

# 8. Tab „Teile & Fotos“

Dieser Bereich erzeugt einen starken Wow-Effekt, weil Mitarbeiter frühere Teile visuell wiedererkennen.

## Inhalte

- wiederkehrende Teile
- Fotos je Teil
- Eingangszustand
- Schadstellen
- Endzustand
- Verpackung
- Oberfläche
- Material
- Preisreferenz
- Durchlaufzeit
- Hinweise aus früherer Bearbeitung

## Wiederkehrende-Teile-Karte

```text
Stoßstangen vorne/hinten
3x bearbeitet
Ø Preis: 740 € netto
Ø Durchlaufzeit: 8 Tage
Letzte Oberfläche: Vernickeln
Hinweis: häufiger Zusatzaufwand in der Politur
```

## Fotohistorie

Fotos als hochwertige Mini-Galerie darstellen:

- Vorher
- Detail
- Prozess
- Nachher
- Verpackung

Jede Fotogruppe ist einem Auftrag und Teil zugeordnet.

## Ziel

Bei neuen ähnlichen Teilen soll der Mitarbeiter sofort erkennen:

- Hatten wir das schon einmal?
- Wie sah es vorher aus?
- Wie sah das Ergebnis aus?
- Was wurde berechnet?
- Gab es Probleme?
- Wie lange hat es gedauert?

---

# 9. Tab „Preise“

Ziel: Preiswissen sichern und uneinheitliche Angebote vermeiden.

## Inhalte

- frühere Preise
- Preisabsprachen
- Sonderkonditionen
- Durchschnittspreise je Teiltyp
- Zusatzaufwand aus alten Aufträgen
- Preisentwicklung über Zeit
- interne Preisnotizen

## Preisreferenz-Karte

```text
Preisreferenz
Stoßstangen vernickeln

Letzter Preis: 780 € netto
Auftrag: A-2025-0191
Abgeschlossen in: 7 Tagen
Zusatzaufwand: 2,5 Std. Politur
Hinweis: tiefe Kratzer im Eingangszustand

Vorschlag intern:
Bei ähnlichem Zustand nicht unter 820 € netto anbieten.
```

## Wichtig

Preisvorschläge sind interne Hinweise.

Sie dürfen nicht als verbindliches Angebot erscheinen.

Nutze Formulierungen wie:

- „Vorschlag intern“
- „Preisreferenz“
- „Letzter vergleichbarer Auftrag“
- „Nicht automatisch als Angebot verwenden“

---

# 10. Tab „Reklamationen“

Ziel: Reklamationen, Nacharbeiten und Ursachen systematisch sichtbar machen.

## Inhalte

- Anzahl Reklamationen
- Anzahl Nacharbeiten
- letzte Reklamation
- betroffenes Teil
- betroffene Station
- Ursache
- Fotos
- Zusatzaufwand
- ob Kunde betroffen war
- ob Kulanz gewährt wurde
- Ergebnis der Nacharbeit

## Kategorien

```ts
type ComplaintCause =
  | "insufficient_preparation"
  | "material_issue"
  | "wrong_surface"
  | "communication_error"
  | "transport_damage"
  | "unclear_expectation"
  | "technical_edge_case"
  | "other";
```

## Reklamationskarte

```text
Nacharbeit — A-2025-0142
Teil: Jugendstilleuchter
Ursache: Oberfläche ungleichmäßig
Station: Galvanik
Zusatzaufwand: 1,5 Std.
Ergebnis: Nacharbeit abgeschlossen, Kunde zufrieden.
```

## Automatischer Hinweis

Wenn ein Kunde wiederholt Reklamationen, Erwartungsprobleme oder Diskussionen hatte:

```text
Hinweis
Bei diesem Kunden vor Arbeitsbeginn Oberfläche und Glanzgrad schriftlich bestätigen lassen.
```

---

# 11. Tab „Kommunikation“

Ziel: Rückfragen, Freigaben und Kontaktverhalten nachvollziehbar machen.

## Inhalte

- bevorzugter Kontaktweg
- Kontaktperson
- letzte Kontaktaufnahme
- offene Rückfragen
- offene Freigaben
- typische Antwortzeit
- wichtige Gesprächsnotizen
- Kommunikationshistorie

## Kommunikationskarte

```text
Freigabe offen
Angebot gesendet: 22.05.2026
Offen seit: 4 Tagen
Typische Antwortzeit: 3–5 Tage
Empfohlene Aktion: heute nachfassen
```

## Zukunftsfähigkeit

Struktur so bauen, dass später angebunden werden können:

- Outlook
- E-Mail
- Resend / Brevo
- WhatsApp Business
- Kundenportal

Aktuell reicht Mock-/Demo-Logik.

---

# 12. Tab „Notizen & Besonderheiten“

Dieser Bereich enthält interne Hinweise.

## Beispiele

- Kunde möchte nur per E-Mail kontaktiert werden.
- Vorher-Fotos immer vollständig machen.
- Freigabe nur durch Herrn Schmid.
- Bei Oldtimerteilen sehr detailverliebt.
- Verpackung besonders sorgfältig.
- Kunde akzeptiert längere Dauer, wenn Qualität sehr hoch ist.
- Zahlung erst nach schriftlicher Rechnung.
- Vorkasse erforderlich.
- Keine internen Notizen im späteren Kundenportal anzeigen.

## Wichtig

Interne Hinweise immer deutlich markieren:

```text
Intern — nicht für Kunden sichtbar
```

---

# 13. Datenmodell-Vorschlag

Die Erweiterung soll migrationsfähig bleiben.

## Customer erweitern

```ts
type Customer = {
  id: string;
  customerNumber: string;
  name: string;
  type: "private" | "business" | "institution";

  city?: string;
  address?: string;
  email?: string;
  phone?: string;
  contactPerson?: string;

  communicationPreference?: "phone" | "email" | "whatsapp" | "post" | "unknown";

  customerStatus?: "new" | "regular" | "vip" | "watch" | "sensitive" | "inactive";
  trustLevel?: "unknown" | "stable" | "very_reliable" | "needs_attention";

  paymentProfile?: PaymentProfile;
  approvalProfile?: ApprovalProfile;
  expectationProfile?: ExpectationProfile;
  technicalProfile?: TechnicalProfile;

  priceMemory?: PriceMemoryEntry[];
  recurringItems?: RecurringItemProfile[];
  complaintSummary?: ComplaintSummary;
  relationshipInsights?: CustomerInsight[];

  notes?: string;
  internalWarning?: string;

  createdAt: string;
  updatedAt: string;
};
```

## PaymentProfile

```ts
type PaymentProfile = {
  defaultPaymentMethod?: "invoice" | "cash" | "card" | "bank_transfer" | "unknown";
  paymentBehavior?: "unknown" | "on_time" | "slow" | "prepayment_required";
  invoiceNotes?: string;
  requiresPurchaseOrder?: boolean;
  vatId?: string;
};
```

## ApprovalProfile

```ts
type ApprovalProfile = {
  needsWrittenApproval?: boolean;
  usualApprovalTimeDays?: number;
  decisionMaker?: string;
  approvalNotes?: string;
};
```

## ExpectationProfile

```ts
type ExpectationProfile = {
  qualityExpectation?: "standard" | "high" | "show_quality" | "museum_quality" | "unclear";
  priceSensitivity?: "low" | "medium" | "high" | "unknown";
  communicationStyle?: "brief" | "detailed" | "needs_guidance" | "technical";
  riskNotes?: string;
};
```

## TechnicalProfile

```ts
type TechnicalProfile = {
  commonMaterials?: string[];
  commonSurfaces?: string[];
  recurringObjectTypes?: string[];
  packagingPreference?: string;
  handlingNotes?: string;
  specialTechnicalNotes?: string;
};
```

## PriceMemoryEntry

```ts
type PriceMemoryEntry = {
  id: string;
  customerId: string;
  orderId?: string;
  itemId?: string;

  title: string;
  surface?: string;
  material?: string;
  quantity?: number;

  priceNet?: number;
  priceGross?: number;
  currency: "EUR";

  year: number;
  reason?: string;
  marginNote?: string;
  wasSpecialAgreement?: boolean;

  createdAt: string;
};
```

## RecurringItemProfile

```ts
type RecurringItemProfile = {
  id: string;
  customerId: string;

  name: string;
  usualSurface?: string;
  usualMaterial?: string;
  averagePriceNet?: number;
  averageDurationDays?: number;

  lastOrderId?: string;
  lastSeenAt?: string;

  photoIds?: string[];
  notes?: string;
};
```

## ComplaintSummary

```ts
type ComplaintSummary = {
  totalComplaints: number;
  totalReworks: number;
  lastComplaintAt?: string;
  mainCauses?: string[];
  riskLevel: "low" | "medium" | "high" | "unknown";
};
```

## CustomerInsight

```ts
type CustomerInsight = {
  id: string;
  customerId: string;

  type:
    | "similar_order_found"
    | "price_reference"
    | "communication_hint"
    | "risk_hint"
    | "opportunity_hint"
    | "documentation_hint"
    | "payment_hint"
    | "approval_hint";

  title: string;
  description: string;
  severity: "info" | "positive" | "watch" | "critical";
  relatedOrderId?: string;
  relatedItemId?: string;
  createdAt: string;
};
```

---

# 14. Komponenten-Vorschlag

Antigravity soll prüfen, ob vergleichbare Komponenten bereits existieren. Wenn ja: erweitern statt doppelt anlegen.

## Empfohlene Komponenten

```text
src/components/customers/CustomerListCard.tsx
src/components/customers/CustomerProfilePanel.tsx
src/components/customers/CustomerMemoryCard.tsx
src/components/customers/CustomerInsightCard.tsx
src/components/customers/CustomerOrderHistory.tsx
src/components/customers/CustomerRecurringItems.tsx
src/components/customers/CustomerPhotoTimeline.tsx
src/components/customers/CustomerPriceMemory.tsx
src/components/customers/CustomerComplaintHistory.tsx
src/components/customers/CustomerCommunicationPanel.tsx
src/components/customers/CustomerInternalNotes.tsx
```

## Hilfslogik

```text
src/lib/customerInsights.ts
src/lib/customerSimilarity.ts
src/lib/customerPriceMemory.ts
```

---

# 15. Automatische Insight-Logik

Zunächst mit einfacher Mock-/Client-Logik umsetzen.

## Funktion: ähnliche Aufträge finden

Kriterien:

- gleicher Kunde
- ähnliche Teilebezeichnung
- gleiche Oberfläche
- gleiches Material
- ähnliche Menge
- gleicher Auftragstyp

## Beispiel-Funktion

```ts
function findSimilarOrders(currentOrder, customerOrders) {
  return customerOrders.filter(order => {
    const sameSurface = order.surfaceRequested === currentOrder.surfaceRequested;
    const similarTitle = order.title
      .toLowerCase()
      .includes(currentOrder.title.toLowerCase().slice(0, 6));

    return sameSurface || similarTitle;
  });
}
```

## Funktion: Preisreferenz erzeugen

Wenn ähnliche Aufträge vorhanden sind:

- letzten Preis anzeigen
- Durchschnittspreis anzeigen
- Zusatzaufwand anzeigen
- Warnhinweis, falls Reklamation/Nacharbeit vorhanden war

## Funktion: Kommunikationshinweis erzeugen

Wenn `usualApprovalTimeDays > 3`:

```text
Freigabe dauert bei diesem Kunden meist länger. Früh nachfassen.
```

## Funktion: Dokumentationshinweis erzeugen

Wenn `complaintSummary.riskLevel` medium oder high:

```text
Vorher-Fotos und Erwartungsklärung vor Arbeitsbeginn empfohlen.
```

---

# 16. Mockdaten erweitern

Die Kundenkarte muss mit realistischen Daten lebendig wirken.

## Beispielkunden

- Museum Lenzburg
- Atelier Schmid
- Kirche St. Martin
- Privatkunde Lenz
- Antik Galerie Main

## Je Kunde ergänzen

Mindestens:

- 2–5 historische Aufträge
- 1 offener Auftrag
- 2–4 wiederkehrende Teile
- 2–5 Preisreferenzen
- 3–8 Foto-Platzhalter
- Kommunikationspräferenz
- Freigabeprofil
- Zahlungsprofil
- technische Besonderheiten
- interne Notizen

## Spezielle Fälle

Mindestens ein Kunde mit:

- Reklamation / Nacharbeit
- besonderer Freigabelogik
- Zahlungsbesonderheit
- hoher Qualitätsanforderung
- sehr positiver Historie
- empfindlicher Erwartungshaltung

---

# 17. UI-Regeln

## Stil

- hochwertig
- ruhig
- klar
- handwerklich
- keine Tabellenwüste
- keine CRM-Überladung
- keine grellen Flächen
- keine Gold-/Luxusspielerei
- keine unnötigen Animationen

## Statusfarben

- Rot: echtes Problem
- Orange: Risiko / Beobachten
- Gelb: frühe Warnung
- Grün: stabil / zuverlässig
- Blau/Grau: neutral / wartend / dokumentarisch

## Kartenlogik

Wichtige Karten größer darstellen:

- offene kritische Aufträge
- Preisreferenzen
- Reklamationshinweise
- ähnliche frühere Aufträge
- offene Freigaben

Ruhige Karten kleiner darstellen:

- Stammdaten
- alte abgeschlossene Aufträge
- neutrale Notizen

---

# 18. Responsive Verhalten

## Desktop

- Kundenliste links
- Kundenakte rechts
- Tabs innerhalb der Kundenakte
- optional Detailpanel für Auftrag/Teil

## Tablet quer

- Liste links kompakter
- Kundenakte rechts groß
- Tabs als breite Touchflächen

## Tablet hoch / Smartphone

- Kundenliste als Karten
- Kundenakte öffnet als Drawer oder eigene Seite
- keine kleinen Tabellen
- große Touchflächen

---

# 19. Akzeptanzkriterien

Die Umsetzung ist erfolgreich, wenn:

1. Die Kundenkarte nicht mehr wie ein einfaches Adressbuch wirkt.
2. Frühere Aufträge und Teile sofort sichtbar sind.
3. Preisreferenzen klar und intern nutzbar dargestellt werden.
4. Fotos und wiederkehrende Teile einen echten Wiedererkennungseffekt erzeugen.
5. Reklamationen und Nacharbeiten strukturiert auffindbar sind.
6. Kommunikations- und Freigabebesonderheiten sichtbar sind.
7. Das Werkstattgedächtnis automatisch nützliche Hinweise erzeugt.
8. Die UI auf Tablet gut bedienbar ist.
9. Bestehende App-Funktionen erhalten bleiben.
10. Datenstruktur später backendfähig bleibt.

---

# 20. Nicht machen

- Keine komplette App neu bauen.
- Keine bestehende Navigation entfernen.
- Keine funktionierenden Seiten löschen.
- Keine harten Supabase-Migrationen erzwingen, falls die App aktuell noch mit Mockdaten läuft.
- Keine überladenen Tabellen.
- Keine dekorativen Scores ohne Nutzen.
- Keine Kundendaten mit unnötigen CRM-Feldern überfrachten.
- Keine internen Notizen für ein späteres Kundenportal sichtbar machen.
- Keine Preisvorschläge als verbindliche Angebote formulieren.
- Keine Warnfarben inflationär verwenden.

---

# 21. Empfohlene Umsetzungsreihenfolge

1. Bestehende Kundenseite analysieren.
2. Customer-, Order-, Item-, Photo- und StatusEvent-Strukturen prüfen.
3. Bestehende Mockdaten prüfen.
4. Customer-Datenmodell modular erweitern.
5. Mockdaten für Kundenhistorie, Preise, Fotos, Reklamationen und Kommunikation ergänzen.
6. CustomerListCard verbessern.
7. CustomerProfilePanel bauen oder erweitern.
8. Werkstattgedächtnis-Bereich mit CustomerMemoryCard bauen.
9. Tabs für Übersicht, Aufträge, Teile & Fotos, Preise, Reklamationen, Kommunikation und Notizen bauen.
10. Insight-Logik als einfache Hilfsfunktionen implementieren.
11. Responsive Darstellung für Tablet prüfen.
12. App starten, Fehler beheben, Navigation testen.
13. Bestehende Funktionen gegenprüfen.

---

# 22. Kurzer Ausführungsprompt für Antigravity

```text
Analysiere die bestehende Kreile WerkstattCockpit App und erweitere die Seite „Kunden“ zu einer intelligenten Kundenakte / Kundenkarte. Erhalte die vorhandene Struktur, Navigation, Datenlogik und Funktionen. Baue die Kundenkarte als Werkstattgedächtnis mit Stammdaten, offenen und historischen Aufträgen, wiederkehrenden Teilen, Fotohistorie, Preisreferenzen, Reklamationen, Kommunikations- und Freigabebesonderheiten, Zahlungsprofil, internen Notizen und automatischen Insights wie „ähnlicher Auftrag gefunden“, „Preisreferenz vorhanden“ oder „Vorher-Fotos empfohlen“. Arbeite modular, tablet-first, mit realistischen Mockdaten und migrationsfähiger Datenstruktur. Keine komplette App neu bauen, keine funktionierenden Seiten löschen, keine überladenen Tabellen. Ziel: Mitarbeiter sollen beim Öffnen eines Kunden sofort sehen, was früher gemacht wurde, was es gekostet hat, welche Risiken bestehen und welche nächste Aktion sinnvoll ist.
```

---

# 23. Erweiterter Ausführungsprompt für Antigravity

```text
Du arbeitest im bestehenden Projekt Kreile WerkstattCockpit. Baue keine neue App, sondern erweitere kontrolliert die vorhandene Kunden-Seite. Prüfe zuerst Routing, Komponentenstruktur, Mockdaten, Customer-/Order-/Item-/Photo-/StatusEvent-Typen und bestehende UI-Komponenten. Danach erweitere die Kundenansicht zu einer professionellen Kundenakte.

Die Kundenakte soll als Werkstattgedächtnis funktionieren. Sie muss pro Kunde Stammdaten, Kundentyp, Kundenstatus, offene Aufträge, historische Aufträge, wiederkehrende Teile, Preisreferenzen, Fotos, Reklamationen, Nacharbeiten, Kommunikationspräferenz, Freigabeprofil, Zahlungsprofil, technische Besonderheiten und interne Hinweise anzeigen. Baue zusätzlich einen prominenten Bereich „Werkstattgedächtnis“, der automatisch 2–4 nützliche Hinweise erzeugt, zum Beispiel ähnliche frühere Aufträge, alte Preise, Freigabehinweise, Dokumentationsrisiken oder technische Besonderheiten.

Erweitere das Datenmodell migrationsfähig. Nutze keine chaotischen Freitextfelder, sondern strukturierte Profile: paymentProfile, approvalProfile, expectationProfile, technicalProfile, priceMemory, recurringItems, complaintSummary und relationshipInsights. Ergänze realistische Mockdaten für Museum Lenzburg, Atelier Schmid, Kirche St. Martin, Privatkunde Lenz und Antik Galerie Main.

Die UI soll tablet-first, hochwertig, ruhig und schnell erfassbar sein. Keine Tabellenwüste, keine CRM-Überladung, keine Gold-/Luxusspielerei. Nutze Karten, Tabs, klare Statusbadges, dezente Farblogik und große Touchflächen. Kritische Hinweise orange/rot, normale Stammdaten ruhig und neutral. Interne Notizen müssen klar als „Intern — nicht für Kunden sichtbar“ markiert werden.

Erstelle oder erweitere passende Komponenten wie CustomerListCard, CustomerProfilePanel, CustomerMemoryCard, CustomerInsightCard, CustomerOrderHistory, CustomerRecurringItems, CustomerPhotoTimeline, CustomerPriceMemory, CustomerComplaintHistory, CustomerCommunicationPanel und CustomerInternalNotes. Wenn vergleichbare Komponenten bereits existieren, erweitere diese statt neue Duplikate zu bauen.

Implementiere zunächst einfache Mock-/Client-Logik für automatische Insights: ähnliche Aufträge erkennen, Preisreferenzen anzeigen, Dokumentationshinweise bei Reklamationsrisiko erzeugen, Freigabehinweise bei langsamen Kunden anzeigen und Zahlungs-/Bestellhinweise sichtbar machen. Die Logik soll später backendfähig bleiben.

Teste abschließend, ob die App startet, die Navigation funktioniert, bestehende Kundendaten weiterhin sichtbar sind, die neue Kundenakte auf Desktop und Tablet sinnvoll aussieht und keine vorhandenen Funktionen beschädigt wurden.
```
