# Galvanik-Kreile WerkstattCockpit — autoritativer Projektstand

Stand: 06.07.2026
Tenant: `galvanik-kreile`
Projektpfad: `C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\02_app`

## Aktuelle Wahrheit

- `K` QG-01-V ist mit `VERDICT: ACCEPT` geschlossen.
- `K` Prüf-HEAD: `5e8b3994bd1b4f8daf54f1441ea8bbf3375580ac`.
- `K` Nachweise: `TSC_EXIT=0`, `UNIT_EXIT=0` mit 63/63 Tests, `BUILD_EXIT=0` mit 77/77 Routen.
- `R` QG-01-V beweist nur dieses Gate, nicht die autonome Zuverlässigkeit der gesamten Cowork-Produktfirma.
- `K` Der V1-Implementierungsvertrag wurde erstellt; sein `CONTRACT_VERDICT: PASS` wurde nicht anerkannt (`X`); V1 ist durch V2.4 abgelöst.
- `K` Der Slice-1-Implementierungsvertrag **V2.4** ist unabhängig geprüft und akzeptiert: Erstprüfung V2.3 `FAIL` (Fund F-38-01), Korrektur V2.4, Nachprüfung `CONTRACT_VERDICT_V24: PASS` (2026-07-06).
- `K` Autoritative Kopie: `00_AUTORITATIV/05_SLICE1_IMPLEMENTATION_CONTRACT_V2_4.md` (byte-identisch zur akzeptierten Fassung im Agentur-Twin). Evidenzkette: `KREILE_PROJEKT_DOKUMENTATION/M6_EVIDENZ/` (36_ Fremdprüfung V2.2, 37_ Korrekturdirektive, 38_ finale Prüfung inkl. Nachprüfungs-PASS).
- `R` Der V2.4-Vertrag bindet die Baumissionen B1–B7. Benannte Kategorie-2-Restpunkte: F-38-04 (`status_events.customer_id`-Divergenz) → B1; F-38-03-Rest (COALESCE-Kunden-Join gegen Testdaten) → B4-AK3.
- `R` Entstanden im Agentur-Twin `_agentur_lab/kreile-agentur-twin-20260703-233807` (dort ist `_agentur_reports/` gitignoriert — die Kopien hier sind die versionierte Wahrheit).
- `R` Noch keine App-Implementierung, Migration oder UI-Änderung für Slice 1 vor dem Claude-Design-Gate und expliziter B1-Missionsfreigabe.

## Aktiver Produktfokus

`Foto/Beleg`
→ `unverändertes Original sicher speichern`
→ `Offline/Outbox`
→ `OCR/KI`
→ `Kunde/Auftrag/Teilgruppe`
→ `Review nur bei Unsicherheit`
→ `fachlicher Wareneingang`
→ `routebasierte erste reale Produktionskarte`

## Bekannte Kernprobleme

- `K` Mehrere aktive Capture-/Schreibpfade bestehen im Code fort — jetzt vollständig inventarisiert als **I-1…I-6** in V2.4 §2a (u.a. `scan-upload/route.ts`, `convertScanToOrder`, `scan-analyze`, `/scan`-CameraCapture-Kette, `uploadOrderPhotoRecord`). Vertraglich je „ersetzen/härten" mit Zielmission; **technisch offen bis zur jeweiligen Baumission**.
- `X` ~~Ein kanonischer Capture-Vertrag ist noch nicht abschließend akzeptiert~~ — erledigt: V2.4 akzeptiert (PASS 2026-07-06).
- `K` Mindestens ein CameraCapture-Pfad verliert das Original bei Refresh/Crash (I-5, `CameraCapture.tsx:73` — Original nur im React-State). Behebung: B2.
- `K` Vor-Auftrags-Ereignisse sind vertraglich geklärt (V2.4 §3.2/§4.5: `events.order_id` → NULLABLE in Drizzle UND Remote); **technisch offen bis B1** (`schema.ts:159` ist noch `NOT NULL`).
- `X` ~~SQL-View-, Tenant-, RLS-, Storage- und Transaktionsvertrag noch nicht akzeptiert~~ — erledigt: in V2.4 §§4–8 akzeptiert (Umsetzung + Remote-Beweise = B1 ff., SSG-00).
- `K` Die erste Produktionsstation darf nicht pauschal als Galvanik festgelegt werden (V2.4 §4.4, B4).
- `K` Unsynchronisierte Originale dürfen nach 48 Stunden nicht automatisch gelöscht werden (V2.4 §5, B5).
- `K` Last-Writer-Wins für den gesamten Capture-Datensatz ist unzulässig — Schutz ist feldbezogen (V2.4 §6).
- `X` ~~Der V1-Vertrag ist für eine einzelne Baumission zu groß~~ — erledigt: V2.4 teilt in sieben sequenzielle Missionen B1–B7.

## Aktiver nächster Schritt

Claude Design erhält ausschließlich die akzeptierten Verträge (01_ Produkt/Slice + 05_ Implementierung V2.4), die User Twins (Rolf, Philipp, Michael) und bestehende CI-/Designreferenzen und erstellt den UI-/Interaktionsvertrag (Details: 04_CURRENT_GATE_AND_DESIGN_SEQUENCE.md).
Design entscheidet keine Tabellen, RLS, Transaktionen oder Storage-Policies.
Erst danach beginnt Baumission B1 (Daten-/Storage-/Sicherheitsfundament) — einzeln freigegeben, mit Evidenzpflicht nach V2.4-Akzeptanzkriterien.
