# Galvanik-Kreile WerkstattCockpit — autoritativer Projektstand

Stand: 24.06.2026
Tenant: `galvanik-kreile`
Projektpfad: `C:\Antygravityprojekte\04_Kundenprojekte\galvanik_kreile\02_app`

## Aktuelle Wahrheit

- `K` QG-01-V ist mit `VERDICT: ACCEPT` geschlossen.
- `K` Prüf-HEAD: `5e8b3994bd1b4f8daf54f1441ea8bbf3375580ac`.
- `K` Nachweise: `TSC_EXIT=0`, `UNIT_EXIT=0` mit 63/63 Tests, `BUILD_EXIT=0` mit 77/77 Routen.
- `R` QG-01-V beweist nur dieses Gate, nicht die autonome Zuverlässigkeit der gesamten Cowork-Produktfirma.
- `K` Phase-0-Audit und Verifikation lieferten verwertbare Repository-Funde.
- `X` Deren Gesamturteile `AUDIT_VERDICT: COMPLETE` und `VERIFICATION_VERDICT: PASS` wurden nicht als Implementierungsfreigabe anerkannt.
- `K` Der V1-Implementierungsvertrag `KREILE_PHASE1_SLICE1_IMPLEMENTATION_CONTRACT.md` wurde erstellt.
- `X` Dessen `CONTRACT_VERDICT: PASS` ist nicht anerkannt.
- `R` V1 bleibt als abgelehnter Entwurf erhalten und wird gezielt revidiert.
- `R` Noch keine App-Implementierung, Migration oder UI-Änderung für Slice 1 starten.

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

- `K` Mindestens zwei aktive Capture-Pfade bestehen.
- `U` Ein kanonischer Capture-Vertrag ist noch nicht abschließend akzeptiert.
- `K` Mindestens ein CameraCapture-Pfad verliert das Original bei Refresh/Crash.
- `U` Vor-Auftrags-Ereignisse sind im bestehenden Ereignismodell noch nicht belastbar geklärt.
- `U` SQL-View-, Tenant-, RLS-, Storage- und Transaktionsvertrag für den Slice sind noch nicht akzeptiert.
- `K` Die erste Produktionsstation darf nicht pauschal als Galvanik festgelegt werden.
- `K` Unsynchronisierte Originale dürfen nach 48 Stunden nicht automatisch gelöscht werden.
- `K` Last-Writer-Wins für den gesamten Capture-Datensatz ist unzulässig.
- `K` Der V1-Vertrag ist für eine einzelne Baumission zu groß.

## Aktiver nächster Schritt

Ein starkes Architektur-/Coding-Modell erstellt eine V2 des Slice-1-Vertrags.
Ein wirklich unabhängiger Prüfer bewertet V2 gegen TRUTH und REDTEAM.
Der schreibende Agent korrigiert selbstständig bis PASS, FAIL oder echtem externen Blocker.
Danach wird Claude Design für den UI-/Interaktionsvertrag eingeschaltet, bevor UI-Code gebaut wird.
