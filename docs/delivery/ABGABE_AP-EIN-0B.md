# AP-EIN Teil 0b – UI-Fundament Runde 52

Runtime-Produkt-SHA: `f1973dac7b9fa8e7c47f3db552e3aa0e611504b9`. READY-Preview genau dieses SHA: https://galvanik-kreile-werkstatt-j7y6owafu.vercel.app (Vercel `dpl_DCAd6pb1B7FH4XqGLmytHXr9jzcv`, Metadaten-SHA geprüft). #166 ist durch den Owner gemergt; #169 ist frisch auf main `f82a7b48e7e89f0552bd091fd095bbad2c846a86` neu aufgesetzt. Gegenüber dem genannten Preview-SHA sind sämtliche Runtime-Dateien bytegleich; hinzu kommen der streng angeschlossene JSON-Importtest und die freigegebenen Anker-/Abgabendateien. Merge-Ziel wird main. Die neue vollständige CI einschließlich Quality/Fresh wird auf diesem Kandidaten belegt. Kein Merge durch Codex.

## Gemeinsame Umsetzung

- Direkter Import des unveränderten endversion_design.css; abgelöste V1.1-Komponentenschicht und drei alte Mock-Stylesheets entfernt. Token-Anschlüsse enthalten keine kopierte Komponentenschicht.
- Gerät allein nach Breite: Handy <768 px, Tablet 768–1279 px, Desktop ≥1280 px. Größenwerte v8 / dicht / v11 aus dem Originalbündel. Erfassung und darüberliegende Ebenen gehören zum selben Größenkontext.
- Enter führt in Input/Select durch die sichtbaren Felder der obersten Ebene; letzte Pflichtangabe nutzt die vorhandene Hauptaktion samt Tor. Mehrzeilenfelder behalten Enter als Zeilenumbruch. Seitenbezogene Pflichtfelder und Tablet-Prüflisten folgen im jeweiligen Seitenteil.
- routen.json enthält nur reale Aufrufe oder ausdrücklich fehlende Zukunftsrouten, keine PINs.
- Keine Server-Action, Tabelle, Migration oder Daten-Schreibregel verändert.
- P52 aus #166 übernommen: „Was ist neu“ im gemeinsamen Kopf. Einzige Inhaltsquelle `src/content/was-ist-neu.json`, einschließlich Eintrag für #169. Der Lesestand bleibt je Login im Browser; die Änderungsliste verwendet den vorhandenen App-Root und vorhandene Navigation, ohne eigenen Datenweg.
- Echte READY-Preview am Runtime-SHA: vorhandene Anmeldung Phillip, Änderungsliste bei Desktop/Tablet/Handy im Viewport, neueste Einträge zuerst und Lesemarker PASS. Nachweis/Bilder außerhalb Repo: `C:/Users/Traube/.codex/visualizations/2026/11/03/01a1a122-06c4-7570-a4d3-dc1eedb311aa/ap-neu-f1973dac/`. Kein Geschäfts-Schreibknopf betätigt, keine Secrets gespeichert.

## Quellen und Prüfung

P50-Zuordnung unverändert auf den vollständigen Teil-0-Kopf `f4d88b8e` neu aufgesetzt. Die Rotliste dieses älteren Produktstands enthält E09 mit Grund `Endversion-Angleich U-240` sowie TA14 mit Ziel AP-EIN-2; T05c und E32 bestehen hier und haben keinen Marker. Keine erzeugte Fall-Assertion wurde umgeschrieben. Die bestehende, PIN-freie routen.json ist bytegleich zum bisherigen #169-Stand (Git-Blob `1a684e82e3ad2520dafcc14f95bbb23ad2d91b15`); offene Owner-Planungsänderungen bleiben unberührt. Der neue komplette CI-Lauf entscheidet über die Merge-Reife; der Sichtbericht unten bleibt die offengelegte historische Ausgangsmessung vor den Seitenteilen.

BAUPLAN DF3E1AFE (ee64f8882bb7), CSS 35146E45, Sichtvertrag B1A53EA6, unveränderter Prüfer FDA7C59C, Referenz 1509BE93. Bytebindung im Anker #165.

A11 auf neuem Stapel: 22/22 PASS, Typprüfung, vollständiges Lint und leeres git diff --check origin/main eingeschlossen. Vollständige 39-Pfade-Probe mit dem Checker des Folge-Ankers #174: PASS. Auf altem main fehlen ausschließlich die sechs P52-Freigaben. Volltests laufen nach Owner-Freigabe in CI. Der eine Enter-Korrekturversuch wurde gezielt gelintet.
Historischer Sichtlauf am unten genannten bf9b1364: 117/117 Einträge, **0 grün / 78 gelb / 39 rot**. Meister und Werkstatt wurden durch den unveränderten Originalprüfer tatsächlich angemeldet. Kein Speichern durch den Sichtlauf. Diese Messung wird nicht als neuer grüner Sichtlauf des aktuellen SHA ausgegeben.

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

Der genaue aktuelle Check-Stand wird mit gh pr checks einschließlich aller Jobs/Schritte im PR/NACHTLAUF C ausgewiesen. #165/#172/#174/#166 sind Owner-gemergt. Der vorherige Stapelstand c018e873 hatte alle dort vorhandenen Jobs/Schritte grün; diese ersetzen nicht die nach dem Retarget auf main erforderlichen Quality-/Fresh-Nachweise. A11 und reale Scope-Prüfung gegen frisches main bestehen. Die neue CI bekommt ihren eigenen SHA-/READY-Nachweis im PR und Protokoll, ohne Übertragung alter Grün-Claims.
