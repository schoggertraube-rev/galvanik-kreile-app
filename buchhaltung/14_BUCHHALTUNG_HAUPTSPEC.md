# 14 — Hauptspezifikation: Modul Buchhaltung & Finanzen

**Projekt:** Kreile WerkstattCockpit
**Version:** 1.0 · **Datum:** 2026-06-02 · **Status:** baubar
**Stack:** React PWA + TypeScript, Data-Provider-Pattern, Supabase (Postgres + Storage + Auth + RLS), Drizzle ORM
**Bindet ein:** 00_PRIORITY_RULES_KREILE, SPEC_LICENSE_FEATURE_TOGGLES_v1, 12 (Constraints), 13 (OCR)

---

## 1. Ziel

Buchhaltung, Ausgaben, Einnahmen, Steuern und Exporte in einem ruhigen, banking-artigen Cockpit. Inhaber erfasst Belege per Foto, alles wird automatisch erkannt, kategorisiert, GoBD-sicher archiviert und ist filterbar. KI gibt verifizierte, rechtlich korrekte Hinweise zu Absetzbarkeit und Vollständigkeit. Stufe 1 bereitet alles bis zum Ein-Klick-Export an Steuerberater/Finanzamt vor; Direktanbindungen folgen in Stufe 2.

## 2. Nutzerrollen (an bestehendes Rollenmodell andocken)

| Rolle | Rechte im Buchhaltungsmodul |
|---|---|
| `OWNER` (Inhaber) | alles: erfassen, freigeben, exportieren, Voreinstellungen, KI-Hinweise |
| `ACCOUNTING` (optional MA) | erfassen, prüfen, Status, Export — keine Voreinstellungen/Zertifikate |
| `EMPLOYEE` | nur Beleg fotografieren/hochladen (Eingangskorb), kein Finanzeinblick |
| `READ_ONLY_AUDIT` | lesend für Steuer/Revision nach Freigabe |

Plan-Sichtbarkeit folgt `SPEC_LICENSE_FEATURE_TOGGLES_v1.md` (Auswertung/Export sind Pro-Features).

## 3. Funktionsumfang (Bestand zusammengeführt + neu)

Legende: **B** = Bestand (aus vorhandener Seite), **N** = neu, **Z** = Zusammenführung/Dopplung bereinigt.

### Abschnitt 01 — Belege & Ausgaben (N)
| Funktion | Quelle | Stufe |
|---|---|---|
| Beleg fotografieren/hochladen + OCR-Erkennung | N | 1 |
| KI-Kategorisierung + Kontierung (SKR03/04) | N | 1 |
| Kraftstoff-Auswertung (Sorte/Liter/Ort/Zeitraum) | N | 1 |
| Ausgaben gesamt nach Kategorie | N | 1 |
| KI-Hinweise Absetzbarkeit/Plausibilität | N | 1 |
| Banking-artige Filter (Kategorie, Zeitraum, Lieferant, Ort, Status) | N | 1 |

### Abschnitt 02 — Einnahmen, Rechnungen & Zahlung
| Funktion | Quelle | Stufe |
|---|---|---|
| Offene Posten + Mahnstufen | B | 1 |
| Rechnungsübersicht & Statistik (Ausgangsrechnungen) | B | 1 |
| Ausgangsrechnung schreiben + E-Rechnung (ZUGFeRD) | N | 1 (Empfang)/2 (Versand-Pflicht ab 2027) |
| Zahlungsdienstleister (Checkout/Karte) | B | 2 (in Vorbereitung) |
| Zahlungslink & QR-Code | B | 2 |
| Vor-Ort-Zahlung (Terminal/Tap-to-Pay) | B | 2 |
| Zahlungsmoral & Zahlungsarten (Auswertung) | B | 1 (Auswertung)/2 (Live-Daten) |

### Abschnitt 03 — Auswertung & Steuerprofil
| Funktion | Quelle | Stufe |
|---|---|---|
| BWA / Monatsübersicht | B | 1 |
| Fixkosten | B | 1 |
| Variable Kosten | B | 1 |
| Steuerprofil (USt 19/7/0, KU-Status, Rhythmus) | B | 1 |
| USt-Voranmeldung berechnen (Werte + Export) | N | 1 |

### Abschnitt 04 — Export & Steuerberater
| Funktion | Quelle | Stufe |
|---|---|---|
| DATEV-Export (EXTF-Buchungsstapel + Belege) | B/Z | 1 |
| Lexware/Excel CSV-Export | B | 1 |
| Fristen & Pflichten (UStVA, GewSt, Rundfunkbeitrag) | N | 1 |
| Steuerberater-Paket (ZIP-Aktenordner) | B/Z, Premium | 1 |
| ELSTER-Direktversand (ERiC) | N | 2 |

## 4. Routen

```text
/buchhaltung                      Cockpit (Hauptseite, alle Abschnitte als Karten)
/buchhaltung/belege               Belege-Liste + Filter + Foto-Upload
/buchhaltung/belege/[id]          Beleg-Detail (OCR-Felder prüfen/korrigieren)
/buchhaltung/kraftstoff           Kraftstoff-Auswertung
/buchhaltung/ausgaben             Ausgaben nach Kategorie + KI-Hinweise
/buchhaltung/rechnungen           Ausgangsrechnungen + offene Posten
/buchhaltung/zahlung              Zahlungsbereich (Stufe 2, „in Vorbereitung")
/buchhaltung/bwa                  BWA / Monatsübersicht
/buchhaltung/kosten               Fix- & variable Kosten
/buchhaltung/steuerprofil         Steuerprofil & USt-Voranmeldung
/buchhaltung/export               DATEV / Lexware / Steuerberater-Paket
/buchhaltung/fristen              Fristenkalender
/buchhaltung/einstellungen        Voreinstellungen/Regeln (Onboarding, danach im Hintergrund)
```

## 5. Kern-Workflows

### 5.1 Beleg erfassen
```
Foto/Upload → Original in Storage (unveränderbar) → OcrProvider.extract()
→ KI-Kategorisierung + SKR-Konto + Absetzbarkeit + Confidence
→ confidence ≥ Schwelle ? Status = erfasst : Status = pruefen
→ Bankumsatz-Matching (Stufe 2) → Festschreibung (GoBD: nur Storno korrigiert)
```

### 5.2 Monatsabschluss / Übergabe
```
Belege vollständig? → USt-Werte berechnen → Prüfen & freigeben
→ Export wählen: DATEV-Stapel | Lexware-CSV | Steuerberater-ZIP | ELSTER (Stufe 2)
→ Übergabe protokollieren (Audit-Log)
```

### 5.3 Voreinstellungen (einmalig)
```
Bankzugang, ELSTER-Zertifikat, Lieferanten-→Konten-Mapping, Kategorie-Regeln,
USt-Profil, Confidence-Schwelle, Fristen → gespeichert → Menüpunkt tritt in Hintergrund (Zahnrad)
```

## 6. UI-Prinzipien (verbindlich)

- Rahmen unverändert: linke Leiste (Buchhaltung als fixer 8. Punkt), obere Suchzeile.
- Cockpit: ein Hero (zeitkritischste Pflicht, i. d. R. UStVA) + Sparzähler, darunter Abschnitte 01–04 als Kartenraster.
- Statusfarben mit fachlicher Bedeutung: grün = erledigt/stabil, gelb = beobachten/prüfen, rot = Handlungsbedarf.
- „In Vorbereitung"-Badge für Stufe-2-Karten — sichtbar, aber nicht tot: führt zu Info/Voreinstellung.
- Touch-tauglich (Tablet), responsiv bis Smartphone. Keine Tabellenoptik als Hauptdesign.
- Hell/Dunkel über bestehenden Schalter.
- Referenz-Mockups: `kreile_buchhaltung_v2.html` (Cockpit), `kreile_belege.html` (Belege-Liste).

## 7. Analytics (Chef-Dashboard-relevant)

- Ausgaben/Einnahmen je Periode & Kategorie, Saldo, Deckungsbeitrag (verknüpft mit bestehendem Finanzcontrolling).
- Ersparnis-Zähler (Belege automatisch verarbeitet × geschätzte Bearbeitungszeit × Berater-Stundensatz) — Formel in Datei 16.
- Zahlungsmoral je Kunde (Tage bis Zahlung), meistgenutzte Zahlungsart.
- Kennzahl je Ausgabenkategorie als % vom Umsatz (Plausibilität).

## 8. Datenschutz

EU-Region (Supabase EU). Belege = personenbezogen → Zugriff rollenbasiert, RLS. AVV mit OCR-Anbieter. Aufbewahrung 8 J. (Buchungsbelege), Löschen nur via Storno. Verarbeitungsverzeichnis ergänzen. Kamera-Consent mobil. Details in Datei 17.

## 9. Akzeptanzkriterien (Modul gesamt)

- [ ] Alle Bestandsfunktionen aus den Screenshots sind vorhanden (Abgleich §3) — keine verloren.
- [ ] Keine Dopplung: DATEV-Export und Steuerberater-Paket existieren je genau einmal.
- [ ] Beleg-Foto → in ≤ 2 Taps erfasst, OCR füllt Felder, Original unveränderbar archiviert.
- [ ] Filter funktionieren wie Banking-App; Kraftstoff-Auswertung zeigt Sorte/Liter/Ort/Zeitraum.
- [ ] DATEV-EXTF und Lexware-CSV erzeugen valide Dateien (Prüfung gegen Format, Datei 15/16).
- [ ] USt-Voranmeldungswerte werden korrekt aus festgeschriebenen Belegen berechnet.
- [ ] Stufe-2-Funktionen sind als „in Vorbereitung" gekennzeichnet, nicht tot.
- [ ] Rahmen unverändert, „Buchhaltung" als fixer Menüpunkt.
- [ ] Antwort auf die 3-Sekunden-Frage: Inhaber sieht sofort, was fällig ist und was er sparen kann.

## 10. Annahmen

- Confidence-Schwelle Start 85 %, in Voreinstellungen änderbar.
- Umsatzdaten kommen aus bestehendem Auftrags-/Finanzmodul (read-only Referenz).
- Kontenrahmen SKR03 default, SKR04 umschaltbar.

## 11. Offene Fragen (nicht blockierend für Stufe 1)

1. PSD2-Aggregator-Wahl (finAPI / GoCardless / Tink) — für Live-Bank Stufe 2; Onboarding-Vorlauf einplanen.
2. Zahlungsdienstleister-Wahl (Stripe / Mollie / SumUp für Vor-Ort) — Stufe 2.
3. ELSTER-Hersteller-ID + Organisationszertifikat: Antrag jetzt starten (Vorlauf), damit Stufe 2 zeitnah scharf geschaltet werden kann.
