# AP-EIN Teil 0b – gemeinsames UI-Fundament, Runde 51

Status: gebauter Arbeitsstand zur Prüfung, kein Merge. Produkt-SHA, READY-Git-Preview und Sicht-Ausgangsbericht werden nach dem Git-Build ergänzt; diese Zwischenfassung ist kein Fertig-Claim.

## Sichtbare Änderungen

- `src/app/layout.tsx` importiert direkt das unveränderte `docs/project/endversion/ui/endversion_design.css`. Die lokalen Schriftdateien liefern die tatsächlichen Familiennamen für dessen Schriftvariablen.
- `src/app/globals.css` bindet vorhandene Framework-Namen an diese Tokens. Die separate alte V1.1-Komponentenschicht entfällt.
- Die drei abgelösten Stylesheets unter `src/styles/mock/` und ihre Importe sind entfernt. Es bleibt eine visuelle Quelle.
- `src/styles/tokens.css` und `src/styles/ci-tokens.css` enthalten nur Anschlüsse an die eine Farb-/Größenquelle.
- `src/ui/kr/AppShell.tsx` aktiviert die gelieferten V8-Regeln. `Formular.tsx` markiert Formular-Auswahlen mit dem vorhandenen `data-fwseg`; Erfolg-Grün und Auswahlhaken kommen aus dem Originalbündel.
- `docs/project/endversion/ui/routen.json` benennt alle 27 Paket-Seiten-/Modus-Schlüssel und die zusätzlichen Seiten des Sichtvertrags: insgesamt 37 Routenschlüssel. Vorhandene Aufrufe verwenden echte UI-Klicks. Fehlende zukünftige Aufrufe sind ausdrücklich als solche gekennzeichnet; es gibt keine Ersatzroute.

## Unveränderte Quellen

| Quelle | SHA-256 |
|---|---|
| BAUPLAN | 888114C6247B711CC02D8C78BB9429ADCF9C494CFBC2E066F5202C6E966BB0D8 |
| CSS-Bündel | 061AF6F380A94B58A626B57D2C2C8E63DC8CE71C76184C3C23677842232B7A24 |
| Sichtvertrag | 509BE267819D9DECB002A14B0360B096BCB3AB2E91DEE425929FAF920FD96FB4 |
| Sichtprüfer | 03F4E0AA23D58C2CBB1F30F136B68767A54A2F9D1A0B2DCC936D7AB05E6013DA |
| Design-Referenz | DE0FC7654A9686FE7AE0E3664786A47B1B7F804F88B92243FAFC90EB9975DDFD |

## Nachweise

- Produktions-Build mit lokalem Replay-Ziel: PASS.
- Aus dem Import-/Alias-Abgleich: sämtliche verwendeten Zielvariablen sind im Originalbündel vorhanden.
- Keine Server-Action, kein Befehl, keine Tabelle und kein Daten-Schreibweg geändert. Keine Dev-Migration.
- Reale Preview-Anmeldung der bestehenden Rollen Meister und Werkstatt für die Vorbereitung des Sichtlaufs: PASS. Zugangsdaten werden ausschließlich im Lauf verwendet.
- Gezielter Auswahl-Fall E32 gegen die echte Replay-App einschließlich Erfolg-Grün: PASS. Keine Assertion geändert und kein neuer Rotlisten-Eintrag.
- A11, CI und Sicht-Ausgangsbericht: Ergebnis folgt im nachgeführten Prüfstand.

## Abgrenzung der sichtbaren Abgabe

Dieser Teil stellt die gemeinsame Stilschicht um. Die einzelnen Seitenlayouts werden anschließend in den Teilen 1–6 ersetzt: Kunde in Teil 1; rotes Plus, Auftrag/KV erfassen, Rückfrage und Anliegenwahl in Teil 2. Die alten Reiter der Erfassung gehören zu diesem folgenden Seitenumbau.

Der Ausgangsbericht führt alle 117 Vertragseinträge. Fehlende Aufrufe späterer Teile werden mit ihrer Teil-Zuordnung gelb ausgewiesen; Abweichungen vorhandener Seiten bleiben sichtbar. Vor dem jeweiligen Seiten-Merge muss dessen eigener Sichtlauf grün sein.
