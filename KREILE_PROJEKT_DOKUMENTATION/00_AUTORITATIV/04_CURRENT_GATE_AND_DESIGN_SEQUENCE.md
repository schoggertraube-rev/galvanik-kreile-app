# Galvanik-Kreile WerkstattCockpit — aktuelles Gate und Designfolge

## Aktives Gate

Der V1-Implementierungsvertrag ist:

`CONTRACT_VERDICT: REJECTED_FOR_REVISION`

Noch keine Slice-1-Implementierung.

## Nächste Mission

Eine V2 des Implementierungsvertrags erstellen und unabhängig prüfen.

## Danach

Erst nach akzeptierter V2:

1. Claude Design erhält ausschließlich:
   - akzeptierten Produkt-/Slice-Vertrag,
   - akzeptierten Implementierungsvertrag V2,
   - User Twins Rolf, Philipp, Michael,
   - bestehende CI-/Designreferenzen.
2. Claude Design erstellt den UI-/Interaktionsvertrag für:
   - Capture online/offline,
   - Review nur bei Unsicherheit,
   - Wareneingangsabschluss,
   - routebasierte erste Produktionskarte,
   - Fehler, Retry, Konflikt, Korrektur und Rückkehr.
3. Design entscheidet keine Tabellen, RLS, Transaktionen oder Storage-Policies.
4. Erst danach beginnt die erste kleine Baumission.

## Spätere Baumissionen

1. Daten-/Storage-/Sicherheitsfundament
2. Online-Capture und Review
3. transaktionale Auftragserstellung
4. routebasierter Produktionsübergang
5. Offline-Outbox und Reconnect
6. Korrektur und Undo
7. unabhängiger E2E-Verifier
