# AP-EIN Teil 0b – UI-Fundament Runde 52

Produkt-SHA: `bf9b1364b52d4f99f2120d726c7121726b4f8c98`. READY-Preview genau dieses SHA: https://galvanik-kreile-werkstatt-otvtt1aw5.vercel.app. Draft #169, kein Merge. Dies ist die Ausgangsmessung vor dem Umbau der einzelnen Seiten; keine grüne UI-Abnahme.

## Gemeinsame Umsetzung

- Direkter Import des unveränderten endversion_design.css; abgelöste V1.1-Komponentenschicht und drei alte Mock-Stylesheets entfernt. Token-Anschlüsse enthalten keine kopierte Komponentenschicht.
- Gerät allein nach Breite: Handy <768 px, Tablet 768–1279 px, Desktop ≥1280 px. Größenwerte v8 / dicht / v11 aus dem Originalbündel. Erfassung und darüberliegende Ebenen gehören zum selben Größenkontext.
- Enter führt in Input/Select durch die sichtbaren Felder der obersten Ebene; letzte Pflichtangabe nutzt die vorhandene Hauptaktion samt Tor. Mehrzeilenfelder behalten Enter als Zeilenumbruch. Seitenbezogene Pflichtfelder und Tablet-Prüflisten folgen im jeweiligen Seitenteil.
- routen.json enthält nur reale Aufrufe oder ausdrücklich fehlende Zukunftsrouten, keine PINs.
- Keine Server-Action, Tabelle, Migration oder Daten-Schreibregel verändert.

## Quellen und Prüfung

P50: Auf den Teil-0-Kopf `47051a69` neu aufgesetzt. Die Rotliste dieses älteren Produktstands enthält E09 mit Grund `Endversion-Angleich U-240` sowie TA14 mit Ziel AP-EIN-2; T05c und E32 bestehen hier und haben keinen Marker. Keine erzeugte Fall-Assertion und keine Produktdatei wurde dafür geändert. Der neue komplette CI-Lauf entscheidet über die Merge-Reife; der Sichtbericht unten bleibt die offengelegte Ausgangsmessung vor den Seitenteilen.

BAUPLAN DF3E1AFE (ee64f8882bb7), CSS 35146E45, Sichtvertrag B1A53EA6, unveränderter Prüfer FDA7C59C, Referenz 1509BE93. Bytebindung im Anker #165.

A11: 22/22 PASS, Typprüfung, vollständiges Lint, Scope und git diff --check origin/main eingeschlossen. Volltests laufen nach Owner-Freigabe in CI. Der eine Enter-Korrekturversuch wurde gezielt gelintet.
Sichtlauf: 117/117 Einträge, **0 grün / 78 gelb / 39 rot**. Meister und Werkstatt wurden durch den unveränderten Originalprüfer tatsächlich angemeldet. Kein Speichern durch den Sichtlauf.

Originalbericht: [JSON](C:/Users/Traube/.codex/visualizations/2026/11/03/01a1a122-06c4-7570-a4d3-dc1eedb311aa/sicht-bf9b1364/pruefbericht.json), [Befunde](C:/Users/Traube/.codex/visualizations/2026/11/03/01a1a122-06c4-7570-a4d3-dc1eedb311aa/sicht-bf9b1364/pruefbericht.md), [SHA-Nachweis](C:/Users/Traube/.codex/visualizations/2026/11/03/01a1a122-06c4-7570-a4d3-dc1eedb311aa/sicht-bf9b1364/nachweis.json). App-Screenshots: C:/Users/Traube/.codex/visualizations/2026/11/03/01a1a122-06c4-7570-a4d3-dc1eedb311aa/sicht-bf9b1364/bilder/. Sämtliche Ausgaben außerhalb des Repositorys. Die temporäre Zugangskopie wurde gelöscht; Projekt-/Schutzeinstellungen unverändert.

| Seite | Folgeteil | Grün | Gelb | Rot |
|---|---|---:|---:|---:|
| tag | außerhalb der 13 Paket-Seiten; nur benannte Korrekturen in Teil 6 | 0 | 0 | 6 |
| werkstatt | außerhalb der 13 Paket-Seiten; nur benannte Korrekturen in Teil 6 | 0 | 0 | 3 |
| auftraege | außerhalb der 13 Paket-Seiten; nur benannte Korrekturen in Teil 6 | 0 | 0 | 3 |
| kunden | außerhalb der 13 Paket-Seiten; nur benannte Korrekturen in Teil 6 | 0 | 0 | 3 |
| rein | 2 | 0 | 15 | 3 |
| eingang | 2 | 0 | 0 | 3 |
| kundeneu | 1 | 0 | 3 | 3 |
| kundebearbeiten | 1 | 0 | 0 | 3 |
| entwurf | 2 | 0 | 0 | 3 |
| ware | 3 | 0 | 3 | 0 |
| mailein | 4 | 0 | 9 | 0 |
| rechnungein | 5 | 0 | 6 | 0 |
| original | 3 | 0 | 3 | 0 |
| nachrichten | 4 | 0 | 3 | 0 |
| aufgabe | 4 | 0 | 15 | 0 |
| anliegenwahl | 2 | 0 | 3 | 0 |
| reklamation | 4 | 0 | 6 | 0 |
| auftrag | außerhalb der 13 Paket-Seiten; nur benannte Korrekturen in Teil 6 | 0 | 0 | 6 |
| teil | außerhalb der 13 Paket-Seiten; nur benannte Korrekturen in Teil 6 | 0 | 3 | 0 |
| fertig | außerhalb der 13 Paket-Seiten; nur benannte Korrekturen in Teil 6 | 0 | 3 | 0 |
| mehrarbeit | außerhalb der 13 Paket-Seiten; nur benannte Korrekturen in Teil 6 | 0 | 3 | 0 |
| rauspruefen | außerhalb der 13 Paket-Seiten; nur benannte Korrekturen in Teil 6 | 0 | 3 | 0 |
| kunde | außerhalb der 13 Paket-Seiten; nur benannte Korrekturen in Teil 6 | 0 | 0 | 3 |

Gelb benennt fehlende Aufrufe späterer Teile ausdrücklich. Rot bleibt als tatsächliche Abweichung erhalten; die zugeordneten Seiten werden in ihren Teilen ersetzt. Seiten außerhalb des Missionsumfangs werden nicht im Vorbeigehen umgebaut.

## Owner-Klickweg

Preview oben → Anmeldung → Fensterbreite Desktop/Tablet/Handy ändern → rotes Plus bzw. Kunde anlegen. Größen und gemeinsame Komponenten sind umgestellt; Erfassungsseiten folgen in Teil 2, Kundenoberfläche in Teil 1.

## CI

Der genaue aktuelle Check-Stand wird mit gh pr checks im PR/NACHTLAUF C ausgewiesen. P42 ist im übergeordneten Anker #165 umgesetzt. Dort verbleibt im Ratchet der tatsächliche Vergleich gegen den alten Main-Authority-Hash; die weiteren neuen Checks werden vollständig ausgewertet. Diese Abgabe behauptet keine grüne CI und keine Mergefreigabe.
