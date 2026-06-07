# 34 — Beleg-Durchlauf: Foto → OCR → Verteilung → Suche

**Projekt:** Kreile WerkstattCockpit
**Version:** 1.0 · **Datum:** 2026-06-07 · **Status:** ausführungsfertig
**Zweck:** Ein fotografierter Kassenzettel wird erfasst, per OCR ausgelesen, automatisch kategorisiert und an alle relevanten Systeme verteilt — ohne manuelles Nachpflegen. Der Beleg bleibt als Foto + erkannte Daten jederzeit aufrufbar und durchsuchbar.
**Bindet ein:** Spec 13 (OCR-Entscheidung), Spec 15 (Datenmodell), Spec 30 (Formulare/Export), Live-Data-Policy, Datei 32/33 (Vernetzung)

---

## 0. Das Versprechen (messbares Akzeptanzkriterium)

> Ich fotografiere einen Tankbeleg von Aral, 65 Liter Diesel, 112,45 €, vom 15. März.
> 30 Sekunden später:
> - Der Beleg ist in `/buchhaltung/belege` als echter Datensatz mit Foto
> - Kraftstoff zeigt die Tankung (65 l, 112,45 €, Fahrzeug zugeordnet)
> - BWA hat sich um 112,45 € in der Zeile Kraftstoff/Kfz erhöht
> - Ausgaben-Kategorie "Kraftstoff" zeigt +112,45 €
> - UStVA-Vorsteuer hat sich um den USt-Anteil erhöht
> - In der Suche finde ich ihn mit "aral märz" oder "tankbeleg 112"
> - Im Beleg-Detail sehe ich das Foto links, erkannte Daten rechts, und "Wo verwendet?" unten

---

## 1. Erfassungs-Flow (3 Wege)

### 1.1 Kamera (Smartphone-PWA)
```
[Kamera-Button im Schnellstart oder Beleg-Cockpit]
  → Kamera öffnet (MediaDevices API / input type=file capture=camera)
  → Foto wird aufgenommen
  → Upload zu Supabase Storage (Bucket: belege, Pfad: /YYYY/MM/beleg_uuid.jpg)
  → OCR-Pipeline startet (§2)
  → Fortschrittsanzeige: "Wird erkannt…" → "Erkannt ✓" → Detail öffnet
```

### 1.2 Datei-Upload (Desktop)
```
[Drag & Drop oder Datei-Auswahl]
  → Akzeptiert: JPG, PNG, PDF (erste Seite), HEIC
  → Upload → OCR → Detail
```

### 1.3 E-Mail-Weiterleitung (Stufe 2)
Belege per Mail an beleg@kreile.app → automatisch erfasst. Spätere Stufe.

---

## 2. OCR-Pipeline

### 2.1 Provider-Architektur
```ts
interface OcrProvider {
  extractBeleg(imageUrl: string): Promise<OcrErgebnis>;
}

interface OcrErgebnis {
  lieferant: string | null;
  datum: string | null;         // ISO-Date
  brutto: number | null;
  netto: number | null;
  ustSatz: number | null;       // 19, 7, 0
  ustBetrag: number | null;
  positionen: OcrPosition[];    // einzelne Posten auf dem Beleg
  belegart: string | null;      // rechnung, quittung, tankbeleg, kassenbon
  zahlungsart: string | null;   // bar, karte, überweisung
  rechnungsnummer: string | null;
  confidence: number;           // 0..1
  rohtext: string;              // vollständiger OCR-Text für Suche
}

interface OcrPosition {
  beschreibung: string;
  menge: number | null;
  einzelpreis: number | null;
  betrag: number;
}
```

### 2.2 Provider-Stufen
| Stufe | Provider | Status |
|---|---|---|
| **1 (jetzt)** | **Klippa DocHorizon** (EU, DSGVO) | API-Key eintragen, Adapter bauen |
| Fallback | **Manuell** — Formular mit Pflichtfeldern, Foto bleibt gespeichert | immer verfügbar |
| 2 | Eagle Doc, Google Document AI | wenn Klippa ausfällt |

### 2.3 Ablauf
```
1. Foto in Supabase Storage hochladen
2. Beleg-Datensatz anlegen (status: 'wird_erkannt', storage_pfad)
3. OCR-Provider aufrufen (Server Action / Edge Function)
4. Ergebnis in Beleg-Felder schreiben (lieferant, datum, brutto, netto, ust_*, belegart)
5. OCR-Rohtext in beleg.ocr_rohtext speichern (für Volltext-Suche)
6. OCR-Positionen in beleg.ocr_positionen (JSONB) speichern
7. Confidence prüfen:
   ≥ 85%: status → 'erfasst' (auto-kontiert)
   < 85%: status → 'pruefen' (manuell nachprüfen)
8. Automatische Kategorisierung starten (§3)
9. Automatische Verteilung starten (§4)
```

---

## 3. Automatische Kategorisierung

### 3.1 Regeln (regelbasiert, kein LLM nötig)
```ts
function kategorisiere(ocr: OcrErgebnis): Kategorie {
  const text = ocr.rohtext.toLowerCase();
  
  if (text.includes('diesel') || text.includes('benzin') || text.includes('tankstelle') 
      || text.includes('aral') || text.includes('shell') || text.includes('jet'))
    return 'kraftstoff';
  if (text.includes('strom') || text.includes('mainova') || text.includes('kwh'))
    return 'energie';
  if (text.includes('nickel') || text.includes('chemie') || text.includes('galvanik'))
    return 'chemie';
  if (text.includes('büro') || text.includes('papier') || text.includes('toner'))
    return 'buero';
  if (text.includes('bewirtung') || text.includes('restaurant'))
    return 'bewirtung';
  // ... erweiterbar über Lieferanten-Mapping in Einstellungen
  
  return 'sonstig';
}
```

### 3.2 Lieferanten-Matching
```ts
// Prüfe ob Lieferant aus OCR in bestehendem Lieferantenstamm existiert
const match = await findLieferant(ocr.lieferant);
if (match) {
  beleg.lieferant_id = match.id;
  beleg.kategorie = match.default_kategorie; // Lieferant hat Default-Kategorie
}
```

### 3.3 Kraftstoff-Spezial
Wenn Kategorie = `kraftstoff`:
```ts
// Extrahiere Liter und Kraftstoffart aus OCR-Positionen
const liter = extractLiter(ocr.positionen);
const kraftstoffart = extractKraftstoffart(ocr.rohtext); // diesel|benzin|super
const fahrzeug = await getDefaultFahrzeug(); // oder aus OCR (Kennzeichen)

await createKraftstoffDetail({
  belegId: beleg.id,
  liter,
  preisProLiter: beleg.brutto / liter,
  kraftstoffart,
  fahrzeugId: fahrzeug?.id,
  tankstelle: ocr.lieferant,
  ort: extractOrt(ocr.rohtext),
});
```

---

## 4. Automatische Verteilung (das Herzstück)

Nach Kategorisierung verteilt der Beleg seine Daten automatisch an alle relevanten Systeme. **Der Beleg verschwindet nicht — er bleibt als Quelle aufrufbar, und jedes System verweist zurück auf ihn.**

### 4.1 Verteilungsmatrix
| System | Was es bekommt | Wie |
|---|---|---|
| **Beleg-Liste** | neuer Eintrag mit Foto, Status, Kategorie | direkt (Haupttabelle) |
| **Kraftstoff** | Tankung mit Liter, Preis, Fahrzeug | `kraftstoff_detail` (1:1 zu beleg) |
| **BWA** | Ausgaben-Zeile (Kategorie → BWA-Position) | Berechnung aus `beleg` (Spec 30 §5.1) |
| **Ausgaben/Kategorie** | Summe in der Kategorie steigt | Berechnung aus `beleg` GROUP BY kategorie |
| **UStVA** | Vorsteuer erhöht sich um `ust_betrag` | Berechnung aus `beleg` (Spec 30 §5.2) |
| **Fixkosten/Variable** | wenn `kostenposten` zugeordnet | `kostenposten.beleg_id` |
| **Sparzähler** | auto-kontierter Beleg zählt zur Ersparnis | `confidence ≥ Schwelle` |
| **ROI** | Return erhöht sich um Ersparnis | über Sparzähler |
| **Lager** | wenn Chemie-Beleg: Bestandserhöhung | `lager_artikel.menge += gelieferte_menge` |
| **Lieferant** | neue Belegzeile in Lieferant-Detail | `beleg.lieferant_id` |
| **DATEV-Export** | nach Festschreibung im nächsten Stapel | `status = 'festgeschrieben'` |
| **Suche** | `ocr_rohtext` + alle Felder indexiert | Volltextsuche (§5) |

### 4.2 Verteilungs-Implementierung
```ts
async function verteilBeleg(belegId: string) {
  const beleg = await getBeleg(belegId);
  
  // 1. Kraftstoff-Detail (wenn Tankbeleg)
  if (beleg.kategorie === 'kraftstoff') {
    await createKraftstoffDetail(belegId, beleg.ocr_positionen);
  }
  
  // 2. Lager-Bestand (wenn Chemie-Lieferung)
  if (beleg.kategorie === 'chemie' && beleg.lieferant_id) {
    await updateLagerBestand(beleg.lieferant_id, beleg.ocr_positionen);
  }
  
  // 3. Kostenposten-Zuordnung (wenn Lieferant einen Default-Kostenposten hat)
  const kp = await findKostenpostenByLieferant(beleg.lieferant_id);
  if (kp) {
    await linkBelegToKostenposten(belegId, kp.id);
  }
  
  // 4. Audit-Log
  await createAuditLog('beleg_verteilt', belegId, {
    kategorie: beleg.kategorie,
    verteilt_an: ['kraftstoff', 'bwa', 'ustva', 'lager'].filter(Boolean)
  });
  
  // BWA, UStVA, Ausgaben, Sparzähler = Berechnungen, keine separate Verteilung nötig.
  // Sie berechnen sich automatisch aus der beleg-Tabelle (Spec 30).
}
```

---

## 5. Beleg-Detail: Split-View (§4 aus Datei 33, erweitert)

### 5.1 Layout `/buchhaltung/belege/[id]`
```
┌─────────────────────────────┬─────────────────────────────────┐
│                             │  ERKANNTE DATEN                 │
│    BELEGBILD                │  Lieferant: Aral Frankfurt      │
│    (Supabase Storage)       │  Datum: 15.03.2026              │
│    Zoom + Vollbild          │  Brutto: 112,45 €               │
│                             │  Netto: 94,50 €                 │
│                             │  USt (19%): 17,95 €             │
│                             │  Belegart: Tankbeleg            │
│                             │  Kategorie: Kraftstoff ✏️       │
│                             │  Konfidenz: 94% ✓               │
│                             │                                 │
│                             │  POSITIONEN                     │
│                             │  · 65 l Diesel × 1,73 €/l       │
│                             │                                 │
│                             │  [Korrigieren] [Festschreiben]  │
├─────────────────────────────┴─────────────────────────────────┤
│  WO WURDE DIESER BELEG VERWENDET?                             │
│  ✓ Buchhaltung: Ausgaben → Kraftstoff (BWA Zeile 3)    →     │
│  ✓ Kraftstoff: Fahrzeug F-GK 101, 65 l Diesel          →     │
│  ✓ UStVA: Vorsteuer +17,95 € (Periode 03/2026)         →     │
│  ✓ Lieferant: Aral (3. Beleg dieses Lieferanten)       →     │
│  ✗ DATEV-Export: noch nicht festgeschrieben                   │
│  ✗ Lager: nicht relevant (kein Chemie-Beleg)                  │
├───────────────────────────────────────────────────────────────┤
│  VERKNÜPFTE BEREICHE                                          │
│  [BWA] [Kraftstoff] [Lieferant Aral] [UStVA 03/2026]         │
│  [Ausgaben Kraftstoff] [Export]                               │
└───────────────────────────────────────────────────────────────┘
```

### 5.2 Interaktionen
- **Belegbild**: Klick → Vollbild-Ansicht, Pinch-Zoom auf Mobile
- **Erkannte Daten**: jedes Feld editierbar (✏️). Änderung → Audit-Log + Neuberechnung
- **Kategoriewechsel**: Dropdown → Verteilungsmatrix aktualisiert sich
- **Festschreiben**: GoBD-konform, danach nur noch Storno (Gegenbuchung)
- **"Wo verwendet?"**: jeder Eintrag klickbar → springt zum Ziel-Modul
- **Verknüpfte Bereiche**: Chips → Zielseiten mit echten Daten

---

## 6. Datenmodell-Erweiterung (Beleg)

Felder die auf `beleg` ergänzt werden (falls noch nicht vorhanden):

```ts
ocr_rohtext: text('ocr_rohtext'),              // Volltext für Suche
ocr_positionen: jsonb('ocr_positionen'),        // [{beschreibung, menge, einzelpreis, betrag}]
ocr_confidence: numeric('ocr_confidence'),      // 0..1
ocr_provider: text('ocr_provider'),             // klippa | manuell | eagle_doc
original_datei: text('original_datei'),         // Storage-Pfad zum Foto
belegart: text('belegart'),                     // rechnung | quittung | tankbeleg | kassenbon
zahlungsart: text('zahlungsart'),               // bar | karte | ueberweisung
rechnungsnummer_extern: text('rechnungsnummer_extern'),
```

---

## 7. Suche (Vorbereitung für Spec 35)

### 7.1 Sofort (in diesem Spec)
- `ocr_rohtext` wird bei jedem Beleg gespeichert
- Einfache LIKE-Suche: `WHERE ocr_rohtext ILIKE '%aral%' AND ocr_rohtext ILIKE '%märz%'`
- Ergebnis: Beleg-Karte mit Vorschau (Foto-Thumbnail, Lieferant, Betrag, Datum)

### 7.2 Spec 35 (danach)
- Volltext-Index (pg_trgm oder tsvector) über alle Entitäten
- Natürlichsprachliche Fragen → KI-generierte Antworten + Berichte
- Suche über Aufträge, Kunden, Belege, Rechnungen gleichzeitig

---

## 8. Antigravity-Bauauftrag

```text
Lies Spec 34, Live-Data-Policy, Datei 32/33.
Kein Mock. Kein "falls möglich". Alles wird gebaut.

F-BELEG-01: Datenmodell erweitern (§6)
  Felder ocr_rohtext, ocr_positionen, ocr_confidence, ocr_provider, 
  original_datei, belegart, zahlungsart auf beleg-Tabelle.
  Migration → Supabase verifizieren.

F-BELEG-02: Foto-Upload (§1)
  Kamera-Button im Schnellstart + Beleg-Cockpit.
  Upload zu Supabase Storage (Bucket: belege).
  Fortschrittsanzeige.

F-BELEG-03: OCR-Adapter (§2)
  OcrProvider-Interface implementieren.
  KlippaProvider als primärer Adapter (API-Key aus Einstellungen).
  ManualProvider als Fallback (Formular mit Pflichtfeldern).
  Rohtext + Positionen + Confidence speichern.

F-BELEG-04: Kategorisierung + Lieferanten-Matching (§3)
  Regelbasiert. Kraftstoff-Spezialbehandlung.
  Lieferanten-Mapping aus bestehendem Stamm.

F-BELEG-05: Verteilung (§4)
  verteilBeleg()-Funktion. Kraftstoff-Detail, Lager-Bestand,
  Kostenposten-Zuordnung, Audit-Log.

F-BELEG-06: Split-View Beleg-Detail (§5)
  Foto links, erkannte Daten rechts, "Wo verwendet?" unten,
  verknüpfte Bereiche. Editierbar, festschreibbar, stornierbar.

F-BELEG-07: Basis-Suche (§7.1)
  Suchfeld in oberer Leiste: ILIKE-Suche über ocr_rohtext + 
  lieferant + kategorie + datum. Ergebnis: Beleg-Karten.

F-BELEG-08: End-to-End-Test
  Foto eines echten Kassenzettels hochladen.
  Prüfen: Beleg in Liste, Kraftstoff aktualisiert, BWA aktualisiert,
  UStVA aktualisiert, Ausgaben aktualisiert, Suche findet ihn,
  Detail-View zeigt Foto + erkannte Daten + "Wo verwendet?".

Reihenfolge: 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08.
Nach JEDEM Schritt: Nachweis. Einmal-Skripte löschen.
```

---

## 9. Akzeptanzkriterien

- [ ] Foto per Kamera/Upload hochladbar, landet in Supabase Storage.
- [ ] OCR extrahiert Lieferant, Datum, Betrag, USt, Positionen, Rohtext.
- [ ] Beleg wird automatisch kategorisiert (Kraftstoff, Energie, Chemie, …).
- [ ] Kraftstoff-Detail wird bei Tankbelegen automatisch angelegt.
- [ ] BWA, UStVA, Ausgaben berechnen sich korrekt mit dem neuen Beleg.
- [ ] Beleg-Detail zeigt Split-View: Foto + erkannte Daten + "Wo verwendet?".
- [ ] Jedes Feld im Detail editierbar, Änderung protokolliert.
- [ ] Festschreiben + Storno GoBD-konform.
- [ ] Suche "aral märz" findet den Beleg.
- [ ] Kein Mock, kein "falls möglich", kein erfundener Wert.

---

## 10. Klippa-Anbindung (konkret)

```ts
// src/lib/ocr/KlippaProvider.ts
export class KlippaProvider implements OcrProvider {
  async extractBeleg(imageUrl: string): Promise<OcrErgebnis> {
    const response = await fetch('https://custom-ocr.klippa.com/api/v1/parseDocument', {
      method: 'POST',
      headers: {
        'X-Auth-Key': process.env.KLIPPA_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: imageUrl,
        template: 'financial_document',
        pdf_text_extraction: 'fast',
      }),
    });
    const data = await response.json();
    return mapKlippaToOcrErgebnis(data);
  }
}
```

Klippa API-Key muss als Umgebungsvariable (`KLIPPA_API_KEY`) eingetragen werden. Kein "falls möglich" — wenn der Key nicht da ist, fällt das System auf ManualProvider zurück und zeigt "OCR nicht konfiguriert — bitte API-Key in Einstellungen eintragen".

---

## 11. Annahmen (nicht blockierend)

- Supabase Storage Bucket `belege` wird manuell angelegt (Pflicht-Workflow).
- Klippa API-Key wird vom Nutzer bereitgestellt; bis dahin ManualProvider aktiv.
- Fahrzeug-Zuordnung bei Kraftstoff: Default-Fahrzeug aus Einstellungen, Dropdown zum Wechseln.
- E-Mail-Belegerfassung (§1.3) ist Stufe 2 und blockiert diesen Bauabschnitt nicht.
