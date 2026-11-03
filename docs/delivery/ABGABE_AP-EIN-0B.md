# AP-EIN Teil 0b – gemeinsames UI-Fundament, Runde 52

Draft-PR #169, gestapelt auf Teil 0. Der Runde-52-Produkt-SHA und seine exakte READY-Preview werden nach dem Git-Push im PR und im nachfolgenden Sichtnachweis angegeben. Die frühere Runde-51-Preview ist keine aktuelle Abnahme. Der Seitenumbau ist noch nicht abgeschlossen.

## Sichtbare Änderungen

- `src/app/layout.tsx` importiert direkt das unveränderte `docs/project/endversion/ui/endversion_design.css`. Die lokalen Schriftdateien liefern die tatsächlichen Familiennamen für dessen Schriftvariablen.
- `src/app/globals.css` bindet vorhandene Framework-Namen an diese Tokens. Die separate alte V1.1-Komponentenschicht entfällt.
- Die drei abgelösten Stylesheets unter `src/styles/mock/` und ihre Importe sind entfernt. Es bleibt eine visuelle Quelle.
- `src/styles/tokens.css` und `src/styles/ci-tokens.css` enthalten nur Anschlüsse an die eine Farb-/Größenquelle.
- `src/ui/kr/AppShell.tsx` setzt je Gerät die gelieferten Größenregeln: Desktop `v11`, Tablet `dicht`, Handy `v8`. Die Gerätegrenzen sind <768 / 768–1279 / ≥1280 px und hängen nicht mehr von einem Touch-Zeiger ab. Auch die Erfassung befindet sich innerhalb desselben Größenkontexts.
- `src/ui/kr/tastatur.ts` führt Enter durch die sichtbaren Eingabefelder der obersten Ebene. Die letzte Pflichtangabe nutzt denselben gegateten Hauptknopf wie der Klick. Gemäß `verhalten_appweit.tastatur_enter` bleibt Enter in Mehrzeilenfeldern ein Zeilenumbruch; laufende Zeicheneingabe und bereits behandelte Tastendrücke bleiben erhalten. Die seitenbezogenen Pflichtangaben und die Tablet-Prüfliste werden in den jeweiligen Seitenteilen gebunden.
- `Formular.tsx` markiert Formular-Auswahlen mit dem vorhandenen `data-fwseg`; Erfolg-Grün und Auswahlhaken kommen aus dem Originalbündel.
- `docs/project/endversion/ui/routen.json` benennt alle 27 Paket-Seiten-/Modus-Schlüssel und die zusätzlichen Seiten des Sichtvertrags: insgesamt 37 Routenschlüssel. Vorhandene Aufrufe verwenden echte UI-Klicks. Fehlende zukünftige Aufrufe sind ausdrücklich als solche gekennzeichnet; es gibt keine Ersatzroute.

## Unveränderte Quellen

| Quelle | SHA-256 |
|---|---|
| BAUPLAN | DF3E1AFEC7B6C3DED6DA51F22FDAADF8CFAB780DA9A4F619EDB42D3C2D6AC5C4 |
| CSS-Bündel | 35146E45B96F84D7CB30D38F403F1DC0AE9D9232B7F1F7B4C5ED8D950B4537AB |
| Sichtvertrag | B1A53EA675F52B999CD034C5C5D6D0F4D4B1CC131AB40E818DF3BDD138B6EB4C |
| Sichtprüfer | FDA7C59C0E3EF9FEC0C0F81B98975F712D8438DE7236D75D0B8D03897F6A052C |
| Design-Referenz | 1509BE93E71B486728A49D1786CD60826943C6CBE954FC7BFF2EE1D3120A8FCE |

## Frühere Runde-51-Nachweise (kein Runde-52-Abnahmeclaim)

- Produktions-Build mit lokalem Replay-Ziel: PASS.
- Aus dem Import-/Alias-Abgleich: sämtliche verwendeten Zielvariablen sind im Originalbündel vorhanden.
- Keine Server-Action, kein Befehl, keine Tabelle und kein Daten-Schreibweg geändert. Keine Dev-Migration.
- Reale Preview-Anmeldung der bestehenden Rollen Meister und Werkstatt für die Vorbereitung des Sichtlaufs: PASS. Zugangsdaten werden ausschließlich im Lauf verwendet.
- Gezielter Auswahl-Fall E32 gegen die echte Replay-App einschließlich Erfolg-Grün: PASS. Keine Assertion geändert und kein neuer Rotlisten-Eintrag.
- A11 PASS; normaler Commit-Hook ohne Umgehung: 133 Unit-Dateien und 1088 Tests PASS (323,50 s).
- Sicht-Ausgangsbericht: alle 117 Vertragseinträge mit unverändertem Prüfer 03F4E0AA auf der exakten READY-Preview ausgeführt. Ergebnis: **0 grün / 78 gelb / 39 rot**. Beide Originalberichte bleiben unverändert erhalten; die gemeinsame Tabelle enthält nur Einträge der jeweils tatsächlich angemeldeten Rolle.
- UI-Produktstand ist noch nicht fertig: 15 rote Einträge betreffen die erst folgenden Kunden-/Erfassungslayouts (Teile 1/2); 24 rote Einträge betreffen weitere bestehende Seiten. Gelb markiert die noch fehlenden expliziten Aufrufe. Dieser Ausgangsbericht wird nicht als grüne Abnahme ausgegeben.
- CI am Produkt-SHA: Vercel und Preview Comments PASS; quality rot am Paket-Scope gegen main wegen der noch ungemergten Ankerpfade (#165); ratchet rot am noch nicht freigegebenen ESLint-Vertragswechsel. agentur-gate, h16-schema und Fresh Supabase replay laufen zum Zeitpunkt dieser Nachführung noch. Alle Ergebnisse bleiben im PR einsehbar.

## Abgrenzung der sichtbaren Abgabe

Dieser Teil stellt die gemeinsame Stilschicht um. Die einzelnen Seitenlayouts werden anschließend in den Teilen 1–6 ersetzt: Kunde in Teil 1; rotes Plus, Auftrag/KV erfassen, Rückfrage und Anliegenwahl in Teil 2. Die alten Reiter der Erfassung gehören zu diesem folgenden Seitenumbau.

Der Ausgangsbericht führt alle 117 Vertragseinträge. Fehlende Aufrufe späterer Teile werden mit ihrer Teil-Zuordnung gelb ausgewiesen; Abweichungen vorhandener Seiten bleiben sichtbar. Vor dem jeweiligen Seiten-Merge muss dessen eigener Sichtlauf grün sein.

## Sicht-Ausgangsbericht je Seite

| Seite | Grün | Gelb | Rot |
|---|---:|---:|---:|
| tag | 0 | 0 | 6 |
| auftraege | 0 | 0 | 3 |
| kunden | 0 | 0 | 3 |
| rein | 0 | 15 | 3 |
| eingang | 0 | 0 | 3 |
| kundeneu | 0 | 3 | 3 |
| kundebearbeiten | 0 | 0 | 3 |
| entwurf | 0 | 0 | 3 |
| ware | 0 | 3 | 0 |
| mailein | 0 | 9 | 0 |
| rechnungein | 0 | 6 | 0 |
| original | 0 | 3 | 0 |
| nachrichten | 0 | 3 | 0 |
| aufgabe | 0 | 15 | 0 |
| anliegenwahl | 0 | 3 | 0 |
| reklamation | 0 | 6 | 0 |
| auftrag | 0 | 0 | 6 |
| rauspruefen | 0 | 3 | 0 |
| kunde | 0 | 0 | 3 |
| werkstatt | 0 | 0 | 3 |
| teil | 0 | 3 | 0 |
| fertig | 0 | 3 | 0 |
| mehrarbeit | 0 | 3 | 0 |

Originalberichte lokal: `.git/kreile-sicht-0c88c457/meister.raw.json`, `werkstatt.raw.json`; gemeinsame Zuordnung: `gesamt.json` und `gesamt.md`. Modus-Bildpaare der App liegen unter `bilder/`. Die temporären Login-Routenkopien außerhalb des Repos wurden nach beiden Läufen gelöscht. Keine Geheimnisse im Repository.
