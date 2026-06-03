# 13 — Beleg-OCR: Entscheidungsmatrix & Festlegung

**Projekt:** Kreile WerkstattCockpit
**Modul:** Buchhaltung & Finanzen → Beleg-Erfassung
**Version:** 1.0
**Datum:** 2026-06-02
**Status:** entschieden, baubar
**Sprache:** Deutsch

---

## 1. Aufgabe

Belege (Fotos, PDFs, E-Rechnungs-XML) automatisch auslesen: Lieferant, Datum, Brutto/Netto, USt-Satz, USt-Betrag, Belegart, bei Tankbelegen zusätzlich Sorte/Liter/€-pro-Liter/Tankstelle. Kein Eigenbau eines OCR-Stacks (Nutzerentscheidung: spezialisierter **Dienst**).

## 2. Bewertungskriterien (gewichtet nach `00_PRIORITY_RULES_KREILE.md`)

| Kriterium | Gewicht |
|---|---:|
| Genauigkeit DE-Belege (Tankstelle, Bewirtung, Handwerk) | 25 % |
| Umsetzungsgeschwindigkeit (REST-API, JSON, klare Felder) | 20 % |
| Zuverlässigkeit / Wartbarkeit | 20 % |
| Performance (Antwortzeit pro Beleg) | 15 % |
| Kosten (Pay-per-Doc, Einstieg ohne Enterprise-Vertrag) | 10 % |
| Datenschutz (EU-Hosting, DSGVO, „no retention"-Option) | 10 % |

## 3. Matrix (Stand 2026-06, verifiziert)

| Anbieter | Stärke | Schwäche | DSGVO/EU | Einschätzung |
|---|---|---|---|---|
| **Klippa DocHorizon** | Beleg-/Rechnungs-OCR, Multi-Sprache/Währung, Betrugserkennung, REST-API+SDK, ISO 27001/SOC 2/DSGVO | etwas höherpreisig | EU-Hosting möglich, DSGVO-konform | **stark, Top-Kandidat** |
| **Eagle Doc** | spezialisierte Beleg-+Rechnungs-API, >95 % ab Tag 1, mehrere USt-Sätze pro Beleg, „no retention" default | kleinerer Anbieter, geringere Bekanntheit | DSGVO-konform, keine Speicherung ohne Zustimmung | **stark, günstiger Einstieg** |
| **Mindee** | Receipt/Invoice-API, gute Felderkennung, EU (FR) | Kategorisierung teils generisch | EU, DSGVO | gut |
| **Parseur** | E-Mail-Parsing für Eingangsrechnungen, EU-Hosting, DSGVO+SOC 2, großzügiger Free-Tier | keine Freigabe-/AP-Workflows, eher Parsing als Klassifikation | EU, DSGVO | gut für E-Rechnungs-Ingest |
| **Google Document AI / Azure Document Intelligence** | sehr robust, Expense/Invoice-Parser | US-Konzern; EU-Region wählbar, aber AVV-Aufwand | EU-Region konfigurierbar | solide, aber mehr Setup |
| Veryfi | exzellente Beleg-OCR | US-Datenhaltung | schwächer für DE-DSGVO | nachrangig |

## 4. Festlegung

**Primär: Klippa DocHorizon** (Receipt + Invoice, EU-Hosting, fertige Felder + Kategorisierung).
**Fallback/Alternative: Eagle Doc** (günstiger Einstieg, „no retention", >95 %).

Begründung: höchste Punktzahl bei Genauigkeit DE-Belege + Umsetzungsgeschwindigkeit + DSGVO. Beide liefern strukturiertes JSON direkt; kein Template-Training nötig.

## 5. Architektur-Konsequenz (Pflicht)

Anbindung **hinter einem Adapter-Interface**, damit der Dienst austauschbar bleibt:

```ts
interface OcrProvider {
  extract(file: BelegFile): Promise<OcrResult>;   // Lieferant, Datum, Beträge, USt, Felder, confidence
}
// Implementierungen: KlippaProvider, EagleDocProvider, MockOcrProvider (Demo)
```

- Kein direkter SDK-Call in UI-Komponenten (siehe Data-Provider-Pattern, `03_DATENMODELL...`).
- API-Key serverseitig, nie im Client.
- E-Rechnungs-XML (XRechnung/ZUGFeRD) wird **nicht** durch OCR geschickt, sondern direkt geparst (Feldzugriff aus dem strukturierten XML).

## 6. Datenschutz-Maßnahmen

- AVV mit OCR-Anbieter abschließen (vor Go-Live).
- „No retention"-/EU-Region-Option aktivieren.
- Belegfoto im EU-Objektspeicher (Supabase Storage, EU-Region), OCR nur transient.
- Verarbeitungsverzeichnis-Eintrag (Art. 30 DSGVO) ergänzen.

## 7. Akzeptanzkriterien

- [ ] `OcrProvider`-Interface existiert, mind. `KlippaProvider` + `MockOcrProvider` implementiert.
- [ ] Tankbeleg liefert Sorte, Liter, €/l, Tankstelle in strukturierten Feldern.
- [ ] Confidence pro Feld vorhanden; < Schwelle → Beleg-Status `pruefen`.
- [ ] API-Key serverseitig, kein Key im Frontend-Bundle.
- [ ] Anbieterwechsel erfordert nur neue Adapter-Implementierung, keine UI-Änderung.
