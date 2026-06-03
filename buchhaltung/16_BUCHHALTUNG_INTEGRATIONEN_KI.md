# 16 — Integrationen & KI-Logik: Modul Buchhaltung

**Version:** 1.0 · **Datum:** 2026-06-02
**Bindet ein:** 13 (OCR), 14 (Hauptspec), 15 (Datenmodell)
**Grundsatz:** alle externen Dienste hinter Adapter-Interfaces; Keys serverseitig; EU/DSGVO; klare Stufen-Trennung.

---

## 1. DATEV-Export (Stufe 1)

**Format:** DATEV-Format / EXTF-Buchungsstapel (CSV, `EXTF_Buchungsstapel.csv`, Datenkategorie 21) + optional Belegbilder.
**Pflichtfelder Kopfzeile:** Berater-Nr, Mandanten-Nr, WJ-Beginn, Sachkontenrahmen (SKR03/04), Sachkonten-Länge.
**Pflicht je Buchungssatz:** Umsatz, Soll/Haben-Kennzeichen, Gegenkonto, Konto, Belegdatum, Belegfeld, Buchungstext, USt-Schlüssel.
**Validierung:** gegen DATEV-Formatbeschreibung (Developer Portal). Festschreibung-Flag setzen.
**Adapter:**
```ts
interface ExportAdapter { build(zeitraum: Zeitraum, belege: Beleg[]): ExportDatei; }
class DatevExtfAdapter implements ExportAdapter {}
```
**Akzeptanz:** erzeugte Datei wird vom DATEV-Prüfprogramm akzeptiert; Berater kann ohne Nachbearbeitung importieren.

## 2. Lexware / Excel CSV (Stufe 1)

Einfacher CSV-Export (Spalten: Datum, Lieferant, Konto, Betrag, USt-Satz, USt-Betrag, Belegnummer, Kategorie, Belegpfad). UTF-8, Semikolon-getrennt, deutsche Zahlenformatierung. `class LexwareCsvAdapter implements ExportAdapter`.

## 3. Steuerberater-Paket (Stufe 1, Premium)

ZIP-Aktenordner: `EXTF_Buchungsstapel.csv` + `/belege/*` (Originaldateien) + `BWA_<Monat>.pdf` + `USt-Voranmeldung_<Monat>.pdf` + `index.csv`. Ein-Klick-Erzeugung, Übergabe protokolliert (`audit_log`, Aktion `export`).

## 4. E-Rechnung (Empfang Stufe 1, Versand Stufe 2)

- **Empfang/Verarbeitung Pflicht seit 1.1.2025:** XRechnung (XML) + ZUGFeRD (PDF/A-3 + XML) annehmen, **XML direkt parsen** (kein OCR), gegen EN 16931 validieren (Schematron/KoSIT- oder Mustang-Validator), Original-XML archivieren.
- **Versand:** ZUGFeRD/XRechnung erzeugen — als Funktion bauen, Pflicht ab 2027 (>800k €) bzw. 2028 (alle).
- **Adapter:** `interface ERechnungParser { parse(xml): RechnungDaten }`, `interface ERechnungBuilder { build(rechnung): ZugferdPdf }`.

## 5. Bank-Anbindung (Stufe 2, „volles Programm" vorbereitet)

- **Weg:** PSD2/XS2A über lizenzierten Aggregator (finAPI / Tink / GoCardless), FinTS als Fallback für Konten ohne XS2A.
- **Adapter:** `interface BankProvider { listUmsaetze(zeitraum): Umsatz[] }`, Implementierungen je Aggregator + `MockBankProvider`.
- **Matching:** Umsatz↔Beleg über Betrag/Datum/Referenz; Vorschlag bei belegfreien Wiederholzahlungen.
- **Onboarding-Risiko:** Aggregator-Vertrag/BaFin-Abdeckung hat Vorlauf → Code baubar jetzt, Aktivierung per Feature-Flag, sobald Zugang steht. **Keine Zahlungsauslösung** im MVP (nur lesen).

## 6. ELSTER / ERiC (Stufe 2)

- **Was Stufe 1 macht:** UStVA-Werte berechnen + als Export/PDF für manuellen ELSTER-Upload bereitstellen.
- **Was Stufe 2 macht:** Direktübermittlung via ERiC-Bibliothek (serverseitig), Authentifizierung per ELSTER-Organisationszertifikat (.pfx + PIN).
- **Voraussetzung:** ERiC-Hersteller-ID + Organisationszertifikat (Antrag mit Vorlauf jetzt starten). ERiC-Lizenzbedingungen für SaaS/Server vor Architekturfreigabe prüfen.
- **Adapter:** `interface SteuerUebermittlung { sendeUstva(werte, zertifikat): Quittung }` — `MockUebermittlung` in Stufe 1.

## 7. KI-Hinweis-Logik (Stufe 1, verifiziert)

**Grundsatz:** Die KI nennt nur **rechtlich feststehende Regeln** und **Vollständigkeitslücken**. Sie rät **nie**, Ausgaben künstlich zu erhöhen oder etwas an der Prüfung „vorbeizubringen". Jeder Hinweis trägt Regel/Quelle + konkreten Betrag.

| Regel | Logik | Anzeige |
|---|---|---|
| Bewirtung 70 % | Kategorie=Bewirtung → `absetzbar_prozent=70`, Vorsteuer voll; Anlass+Teilnehmer Pflichtfelder | „70 % absetzbar (§ 4 Abs. 5 Nr. 2 EStG); Anlass/Teilnehmer ergänzen" |
| Geschenke 50 € | Summe Geschenke je Empfänger/Jahr > 50 € → nicht absetzbar markieren | „über 50 €/Person/Jahr → nicht anerkannt (§ 4 Abs. 5 Nr. 1)" |
| Kfz/Privatanteil | bei privat genutztem Kfz Hinweis auf 1 %-Regelung / Fahrtenbuch | Hinweis + Verweis auf Voreinstellung |
| Plausibilität | Kategorie-Summe als % vom Umsatz + Lückenerkennung im Zeitstrahl | „X % vom Umsatz, im üblichen Rahmen" / „Beleg fehlt vermutlich (Zeitraum)" |
| Vollständigkeit | Bankumsatz ohne Beleg / Beleg ohne Umsatz (Stufe 2) | „offene Zuordnung" |
| Fristen | Datum nahende Pflicht (UStVA 10., GewSt, Rundfunkbeitrag) | rechtzeitige Erinnerung |

**Sparzähler-Formel:** `ersparnis = anzahl_auto_belege × minuten_pro_beleg × (berater_stundensatz/60)`. Parameter (minuten_pro_beleg Default 4, Stundensatz aus Voreinstellung) konfigurierbar; Anzeige als „Gespart 2026".

**Implementierung:** Regelwerk als reine Funktionen (`lib/buchhaltung/regeln.ts`), keine Freitext-LLM-Entscheidung für Absetzbarkeit. Optionaler LLM-Aufruf nur für Formulierung des Hinweistextes, nie für die Rechtsfolge.

## 8. Akzeptanzkriterien

- [ ] DATEV-EXTF besteht DATEV-Prüfprogramm; Lexware-CSV öffnet sauber.
- [ ] Steuerberater-ZIP enthält Stapel + Belege + BWA-PDF + UStVA-PDF + index.
- [ ] E-Rechnung-XML wird geparst (nicht OCR) und EN-16931-validiert.
- [ ] Bank- und ELSTER-Adapter existieren mit Mock; echte Aktivierung per Feature-Flag.
- [ ] KI-Hinweise tragen Regel/Paragraf + Betrag; keine Hinweise zur Ausgaben-Erhöhung.
- [ ] Alle externen Keys serverseitig; kein Key im Client-Bundle.
