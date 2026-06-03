# 18 — Build-, Test- & Go-Live-Plan: Modul Buchhaltung

**Version:** 1.0 · **Datum:** 2026-06-02 · **Ziel:** funktionierendes Stufe-1-System, Livegang in Tagen.
**Bindet ein:** 12–17. Reihenfolge ist verbindlich.

---

## 1. Realitätscheck Livegang (verbindlich kommuniziert)

| Funktion | Stufe 1 (Tage) | Stufe 2 (Wochen+) |
|---|:-:|:-:|
| Beleg-Foto + OCR + Kategorisierung | ✓ | |
| Banking-Filter, Kraftstoff-Auswertung | ✓ | |
| Ausgaben, Offene Posten, Rechnungsübersicht, BWA, Fix/Variable, Steuerprofil | ✓ | |
| KI-Hinweise (Regelwerk) | ✓ | |
| DATEV-EXTF, Lexware-CSV, Steuerberater-ZIP | ✓ | |
| E-Rechnung Empfang/Parsen | ✓ | |
| USt-Voranmeldung berechnen + Export für ELSTER-Upload | ✓ | |
| ELSTER-Direktversand (ERiC + Zertifikat) | | ✓ |
| Live-Bank (PSD2-Aggregator) | | ✓ |
| E-Rechnung Versand-Pflicht (2027/2028) | | ✓ |
| Zahlungsdienstleister / Vor-Ort / QR | | ✓ |
| Lohn-SV-Direktmeldung (ITSG-Zertifizierung) | | ✗ (Auslagerung/Vorerfassung) |

Grund: ELSTER-Hersteller-ID + Organisationszertifikat, PSD2-Aggregator-Onboarding und ITSG-Zertifizierung haben Vorlauf. Stufe 1 ist „perfekt vorbereiten"; Direktanbindung wird per Feature-Flag scharfgeschaltet.

## 2. Build-Reihenfolge (Architektur-first)

1. **Snapshot & Bestandsanalyse** — Git sauber, Commit, bestehende Buchhaltungs-Routen/Komponenten auflisten, gegen Funktionsliste (Datei 14 §3) abgleichen (ersetzen/ergänzen).
2. **Datenmodell** — Drizzle-Schema + Trigger (Datei 15), Migration, auf Supabase pushen + verifizieren.
3. **Provider-Layer** — `BuchhaltungDataProvider` mit `MockProvider` zuerst (Demo-Daten), UI darauf bauen.
4. **Cockpit-Seite** `/buchhaltung` — Rahmen + Abschnitte 01–04 (Referenz `kreile_buchhaltung_v2.html`).
5. **Belege** — Foto-Upload, `OcrProvider` (Mock → Klippa), Detail/Prüfen, Filter, Kraftstoff (Referenz `kreile_belege.html`).
6. **Auswertung** — Ausgaben/Kategorie, BWA, Fix/Variable, Steuerprofil, KI-Regelwerk.
7. **Einnahmen** — Offene Posten, Rechnungsübersicht, E-Rechnung-Empfang.
8. **Export** — DATEV-EXTF, Lexware-CSV, Steuerberater-ZIP, UStVA-Berechnung.
9. **ApiProvider** — Supabase scharf, Mock→Api umschalten.
10. **Stufe-2-Adapter** als Mock + Feature-Flag (Bank, ELSTER, Zahlung).

Ein Commit pro Schritt: `F-BH-01 …` bis `F-BH-10 …`.

## 3. Initialer Antigravity-Bauprompt (Schritt 1–4)

```text
Lies zuerst die Dateien 12–17 des Buchhaltungs-Spec-Pakets sowie 00_PRIORITY_RULES_KREILE
und SPEC_LICENSE_FEATURE_TOGGLES_v1. Halte dich strikt an die AGENTS-Constraints (Datei 12),
besonders die STOPP-Bedingungen und Anti-Drift-Regeln.

Aufgabe (nur diese, nichts darüber hinaus):
1. Prüfe git status. Wenn nicht sauber: STOPP, melde dich.
2. Lege Commit-Snapshot an: "F-BH-00 snapshot vor Buchhaltungsmodul".
3. Liste die bestehenden Buchhaltungs-/Finanzen-Routen und -Komponenten auf und gleiche sie
   gegen die Funktionsliste in Datei 14 §3 ab. Markiere je Funktion: ersetzen / ergänzen / erhalten.
   Bei Unklarheit ersetzen-vs-ergänzen: STOPP, frage.
4. Implementiere das Drizzle-Datenmodell aus Datei 15 inkl. append-only-/Storno-Trigger.
   Schreibe die Migration, zeige sie mir, warte auf Freigabe, bevor du sie auf Supabase pushst.

Baue noch KEINE UI in diesem Schritt. Keine Stufe-2-Funktion. Keine Direktanbindung.
Antworte mit: Bestandsabgleich-Tabelle + Migrations-Vorschau.
```

## 4. Test-Plan

**Unit:** Absetzbarkeits-Regeln (Bewirtung 70 %, Geschenke 50 €), USt-Berechnung je Satz, Sparzähler-Formel, DATEV-Feldmapping, Confidence-Schwelle.
**Integration:** Foto→OCR(Mock)→Beleg, Storno erzeugt Gegenbeleg + Audit, DATEV-Export gegen Formatprüfung, E-Rechnung-XML-Parsing + EN-16931-Validierung, RLS (EMPLOYEE ohne Beträge).
**E2E:** Beleg in ≤2 Taps erfassen; Kraftstoff-Filter zeigt Auswertung; Monatsübergabe erzeugt ZIP; UStVA-Werte stimmen mit Belegsumme; Stufe-2-Karte zeigt „in Vorbereitung", kein Crash.
**GoBD:** UPDATE/DELETE auf festgeschriebenem Beleg schlägt fehl; Z3-Export erzeugt CSV + Beschreibung.

## 5. Go-Live-Checkliste

- [ ] Bestandsfunktionen vollständig übernommen, keine Dopplung (DATEV/Steuerberater je 1×).
- [ ] Migration verifiziert auf Supabase (nicht nur lokal). Bei CLI-Fehler: SQL im Dashboard, Buckets manuell, dann `NOTIFY pgrst, 'reload schema'`.
- [ ] Demo-/Mockdaten sauber löschbar für Kundenpräsentation.
- [ ] AVV mit OCR-Anbieter + Supabase EU-Region aktiv.
- [ ] Keys/Zertifikate serverseitig.
- [ ] Stufe-1-Exporte (DATEV, Lexware, ZIP) erzeugen valide Dateien.
- [ ] Stufe-2 als Feature-Flag aus; Karten als „in Vorbereitung".
- [ ] 3-Sekunden-Frage erfüllt (Cockpit zeigt sofort Fälliges + Ersparnis).

## 6. Pflicht-Workflow nach Supabase-Migration

```
npx supabase login
npx supabase link --project-ref <REF>
npx supabase db push
# bei CLI-Fehler: SQL manuell im Dashboard SQL-Editor, Storage-Buckets manuell anlegen,
# danach: NOTIFY pgrst, 'reload schema';
# IMMER verifizieren, dass die Migration wirklich auf Supabase liegt — nicht nur lokal.
```

## 7. Sofort parallel starten (Vorlauf für Stufe 2)

- ELSTER-Hersteller-ID + Organisationszertifikat beantragen.
- PSD2-Aggregator auswählen (finAPI/Tink/GoCardless) + Onboarding anstoßen.
- AVV-Vorlagen mit OCR-Anbieter klären.

## 8. Dateiübersicht des Pakets

| Datei | Inhalt |
|---|---|
| 12_BUCHHALTUNG_AGENTS_CONSTRAINTS.md | STOPP, Anti-Drift, Tabuzonen, ersetzen/ergänzen |
| 13_BUCHHALTUNG_OCR_ENTSCHEIDUNG.md | OCR-Matrix + Festlegung Klippa/Eagle Doc |
| 14_BUCHHALTUNG_HAUPTSPEC.md | Funktionsumfang, Routen, Rollen, Workflows, UI |
| 15_BUCHHALTUNG_DATENMODELL.md | Drizzle-Schema, GoBD-Trigger, Provider |
| 16_BUCHHALTUNG_INTEGRATIONEN_KI.md | DATEV/Lexware/E-Rechnung/Bank/ELSTER + KI-Regeln |
| 17_BUCHHALTUNG_DATENSCHUTZ_GOBD.md | DSGVO, GoBD, Rollen, Platzhalter-Politik |
| 18_BUCHHALTUNG_BUILD_GOLIVE.md | Reihenfolge, Bauprompt, Tests, Go-Live |
