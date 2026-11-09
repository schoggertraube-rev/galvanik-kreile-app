# Eingang V04 – E1, Prüfstand

Status: **Draft, keine Merge-Bitte und keine Selbstabnahme.**

Quelle: AP-EINGANG-V04, E1, U-261/U-262/U-263. Eingefrorene HTML-Quelle:
`_review/quellen/freigegeben/Eingang_V04_2026-11-09.html`, SHA-256
`92d2ec60ce33f81d39827fc06b820390850776933e571de18dc771512fa328f7`.

## Vorheriger grüner Produktstand (keine Abnahme des neuen Kopfes)

Produkt-SHA: `054d77251c409fa4b3f4f3f2f38c257846f1ebb5`.
READY genau dieses SHA: https://galvanik-kreile-werkstatt-1unkwbgsf.vercel.app
(Vercel `dpl_BS8Go8RoghivuwGKwckmqEVCi8ea`, GitHub-Deployment 7654158514).
Alle acht Checks dieses Produktstandes sind grün: quality, agentur-gate, h16-schema, Fresh Supabase replay, ratchet, berlin-clock, Vercel und Preview Comments. Die folgende PL-Korrekturrunde ändert Produktcode; der aktuelle PR-Kopf muss vollständig grün und seine eigene Preview READY sein. Kein Merge durch Codex, unabhängiger PL-PASS noch offen.

Echter Zwei-Sitzungs-Lauf auf Dev: Desktop 1220 und Touch-Browser 390, beide vorhandenes Konto Rolf. Die synthetische TEST-Notiz bleibt derselbe Eingang. Am Desktop erscheint das Foto vor Abschluss; die Situationsansicht bleibt bis „Fotos übernehmen“ am Handy geschlossen und öffnet anschließend mit demselben Original. Browser-Geräteemulation und echte Server-/Storage-Aufrufe, **kein physischer Handy-Kameratest**. Fehlerfälle GW01–08 sind damit nicht pauschal abgenommen.

Nur lesender DB-Nachweis dieses echten Laufs:

- `intake_item.id`: `87d64301-de57-4970-8394-fe5229d751ac`, Kanal notiz, kein Auftrag als Nebenwirkung.
- `intake_file.id`: `fc501a7e-5e76-481d-bd13-550e0d5710cf`, gleiche item_id, Datei `TEST-GW-zwei-Sitzungen-20261109.png`.
- Genau ein `original_gespeichert` mit `befehl_id = intake_file.id`. Das zusätzliche Notiz-Original hat seine eigene Textstand-Kennung und ist keine Datei-Dublette. Erkennung und Geräteereignisse vorhanden.
- Sicht-/Rundwegbelege außerhalb des Repos: `C:/Users/Traube/AppData/Local/Temp/kreile-gw-054d7725/`; endgültige Startbilder 1220/768/390: `C:/Users/Traube/AppData/Local/Temp/kreile-e1-054d7725/`.

Sichtgrenzen: Sprechen fehlt ausdrücklich nach PL-Freigabe. Bestehende manuelle Einstiege bleiben sichtbar. Die neue vollständige Ergebnisdarstellung gehört E2; kein vollständiger V04-/M1-PASS behauptet. Der alte R53-Sichtvertrag ist wegen der gebundenen V04-Quellenablösung gelb, kein grüner Vertragsvergleich behauptet.

## Umgesetzt

- Text + Enter/Lesen speichert über `saveIntakeNoteAction`; ohne gesichertes Original öffnet sich keine Foto-Situationsansicht.
- Die Text-Hauptaktion und ihre Alternativen speichern auch zwischenzeitlich bearbeiteten Text, bevor sie den vorhandenen Folgeeditor öffnen. Doppelklick sendet keine zweite Übergabe.
- Eine ursprüngliche Notiz erhält weder einen Auftrag noch einen KV als Nebenwirkung. Die bestehende fachliche Anlage bleibt im Folgeeditor.
- Ein gesichertes Bild bietet „Text ändern“ nur bei nicht verworfenem `DOCUMENT_TEXT` genau dieses Bildes.
- Die bisher verschwundenen Foto-Auswege, Dateiliste und serverseitig gelesenen Warenkandidaten sind wieder erreichbar. Der Ergebnisblock wird einmal verwendet.
- Kamera-Verweigerung bietet Galerie und eine Anleitung zur Browser-Freigabe.
- Rechnungstext ohne Original fordert Foto/Datei an. Eine tatsächlich erkannte Rechnungsnummer steht im Knopf; ohne Nummer erscheint ein gelber Fehlhinweis.
- Die vorhandene Geräteübergabe zeigt QR, Link, echte Ablaufzeit und Fotozahl. Der Desktop wartet mit der Situationsansicht auf das Ende der Handy-Anfrage. Keine neue Geräte- oder Erfassungsstrecke.
- Feste und dynamische Erfassungstexte kommen aus `src/ui/situationCatalog.ts`; rohe Serverablehnungen werden über Codes dargestellt.
- Der gemeinsame Klassifikator erkennt auch die ausdrücklich ausgeschriebenen Wörter KV/Kostenvoranschlag. Eine gespeicherte manuelle Art bleibt vorrangig.

## Lokale Nachweise

| Prüfung | Ergebnis |
|---|---|
| Unveränderte Browserfälle F02, F03, F05, F06, F07, F11, F12 | 7/7 grün, 54,5 s; dieselben DB-/Toast-/Retry-Assertions, keine Rotlistenänderung |
| Erfassungs-Komponente einschließlich Fehler/Original/Kamera/Geräte-Ende | 21 Fälle grün |
| Gemeinsamer Klassifikator | 18 Fälle grün |
| Echte Notiz-Action → DB-Zeile/Ereignis → Lese-Action → Retry aus neu gelesenem JSONB | Grüne lokale Replay-Prüfung; Anfrage und KV werden getrennt geprüft |
| Typen, gezieltes Lint, Scope, H18, `git diff --check origin/main` | Lokale Einzelprüfungen; exakter Endstand zusätzlich im PR |

Echter lokaler Browserlauf am sauberen Produktstand
`d8125d837fb35cc35e38708c4cccb06e45fe60ef`:
`intake_item.id=b72765f2-12d2-46b0-9fbe-f03d7461ec02`, kein verknüpfter Vorgang,
ein `angelegt`- und ein `original_gespeichert`-Ereignis. Text bleibt bei 1220/768/390 erhalten;
genau ein grüner Knopf in der Vorschlagszeile, keine Foto-Situation.
Artefakte außerhalb des Repositorys:
`C:/Users/Traube/AppData/Local/Temp/kreile-e1-d8125d83/`.
`proof.json` kennzeichnet ausdrücklich lokale Testdaten und keinen externen Provider-Nachweis.
Der danach ergänzte reine Klassifikator ist noch nicht in diesen Bildern enthalten.

Keine Migration für E1. Der oben genannte Dev-Lauf erzeugte ausdrücklich synthetische TEST-Daten; vorhandene Daten wurden nicht geändert. Die Tests verwenden die echte lokale
Replay-Datenbank und ausdrücklich synthetische Daten; sie behaupten keine Provider-Verbindung.

## Assertions alt → neu

- Bild ohne OCR: früher wurde „Text ändern“ stets verlangt → jetzt muss es fehlen; zusätzlich positiver gesicherter OCR-Fall sowie verworfener/ungesicherter/nur getippter Text geprüft.
- Bestehende Rollen-Abfragen im Test: ungültige Option `exact` entfernt; die vollständigen zugänglichen Namen bleiben unverändert geprüft.
- Die sieben generierten Browserfälle wurden **nicht** verändert.

## Historischer Zwischenstand vor dem oben dokumentierten Schlusslauf

- PL 12:00 hat beide Punkte entschieden: persönlicher Titel, kompakte echte Foto/Datei-Werkzeuge und Textfeld im selben E1; die einzelne S13-Zeile ersetzt die alte Box. Diese Korrektur ist umgesetzt und wird als ein gemeinsamer Kopf geprüft.
- Abschließender Sichtabgleich dieser Entscheidung; vorhandene Bilder belegen Funktion und zeigen die Layoutabweichungen ausdrücklich.
- Vorheriger Kopf `3f689bb0` hat alle acht Checks grün und READY; diese Ergebnisse ersetzen die Prüfung des neuen gemeinsamen Kopfes mit Startaufbau nicht. Dessen Pflicht-CI, exakte READY-Preview, Sicht und unabhängiger PL-PASS stehen aus.
- Der echte Zwei-Sitzungs-Nachweis des gesamten Gerätewechsels gehört nach Paket zu E3; hier wird kein vollständiger GW-PASS behauptet.

E2 ersetzt anschließend das gemeinsame Ergebnismuster, E3 vervollständigt Ware. E5 übernimmt den vorhandenen Reklamationszweig. E4 und der Belegzweig sind nach U-269 bis nach Livegang geparkt.


## Startaufbau nach PL 12:00

Der vorhandene Dialog bleibt verantwortlich für Escape, Hintergrundklick und den einen Schließ-/Speicherweg. Im selben Capture ersetzt sein bestehender Kartenmodus den alten breiten Kopf: ein persönlicher Titel, Textfeld, kompakte Foto-/Dateiwerkzeuge und die eine S13-Zeile. Die manuellen Auftrag-/Kunden-Einstiege bleiben erhalten. Alte getrennte ERKANNT-Box und deren frühe Entfernungsknöpfe entfallen gemäß ausdrücklicher PL-Entscheidung; lokale ausgeschlossene Anliegen und gespeicherter Text bleiben erhalten.

23 gezielte Komponentenfälle sind grün. Neue Fälle prüfen den einzelnen persönlichen Kopf, vorhandene echte Werkzeuge und die erhaltenen ausgeschlossenen Anliegen eines alten lokalen Entwurfs. Alte Kamera-Assertion: automatischer Start beim allgemeinen Öffnen → jetzt kein Kamerazugriff vor dem bewussten Foto-Klick; danach bleiben die bisherigen Video-/Auslöser-/Schließ-Assertions vollständig erhalten. Bei übernommener Handy-Fotoanfrage öffnet die vorhandene Kamera weiterhin unmittelbar.

Bewusst offen: **Sprechen** wird nach ausdrücklichem PL-Entscheid nicht als Knopf gezeigt und nicht simuliert; ein Transkriptions-Port fehlt. PL informiert die Owner. Die Beispiel-/Vernetzungs-Demos des HTML-Referenzwerkzeugs werden nicht als Produktfunktionen eingebaut.

Lokale Datenbank war beim letzten geprüften Stand nach einem begrenzten Wiederanlaufversuch nicht erreichbar; keine neuen DB-Schleifen. Die bereits nachgewiesenen Server-Schreibwege bleiben unverändert. Der letzte tatsächliche Git-Preview-Sichtlauf und der Dev-Zweisitzungs-Rundweg stehen oben; unabhängige Abnahme bleibt erforderlich.

## Nachführung des bestehenden globalen Fluss-Tests

Die Modus-Aufnahme erwartet nach dem freigegebenen gemeinsamen Kopf „Neuer Eingang“ statt „Zettel lesen · für die Erfassung“. Alle Prüfungen zu Datei-Werkzeug, zwei Ebenen, Escape-Rückkehr und getrenntem Mailweg bleiben erhalten. Dieser konkrete RealRender-Fall ist lokal grün (1,05 s). Der einmalige Lauf der ganzen Datei bestand 88 von 89 Fällen; ein unberührter PositionZeile-Fall erreichte bei belastetem Rechner das unveränderte 5-Sekunden-Limit. Keine Timeout-Erhöhung und keine Assertion entfernt.

## CI-Befund F01 nach Startaufbau

Am Kandidaten 77306434 sind quality, Fresh-Replay, agentur und Ratchet grün; h16 meldet genau F01 rot, 280 andere Browserfälle grün. Ursache: Beim Ersetzen der großen Datei-Kachel entfiel der sichtbare Ziehen-Hinweis, obwohl derselbe Drop-Handler erhalten blieb. Der vorhandene Katalogtext wird jetzt kompakt neben Datei angezeigt. Kein generierter Fall, keine Rotliste und keine Assertion wird abgeschwächt. Der gezielte Startaufbau-Test prüft den Hinweis zusätzlich.

## Gerätewechsel: Ursache vor der Datenbank

Ein echter Zwei-Sitzungs-Vorlauf auf Dev (synthetische TEST-Notiz, noch kein Foto übertragen) zeigte: Ein Desktopfenster mit 1220 px wurde durch `(max-width: 1279px)` als Kameragerät behandelt. Damit öffnete Foto die lokale Kamera statt der vorgesehenen Handy-Übergabe. Die bestehende Geräteerkennung nutzt jetzt das tatsächliche grobe Eingabegerät (`pointer: coarse`) statt die Fensterbreite. Ein gezielter Komponentenfall belegt einen schmalen Desktop mit bestehendem Gerätewechsel-Port. Kein neuer Anbieter oder Kamerapfad. Der oben dokumentierte erfolgreiche Nachlauf ersetzt diesen Vorlauf. Die übrigen Gerätefehlerfälle bleiben E3; keine physische Handy-Kamera behauptet.

## Eine Korrekturrunde nach PL 13:55 (neuer Kandidat)

Der neue Produkt-SHA ist der Commit, der diesen Abschnitt zusammen mit den vier unten beschriebenen Produkt-/Testdateien einführt. Seine CI und READY-Preview sind nach dem einzigen Push noch gesondert zu prüfen; die frühere grüne Preview ist kein Nachweis dieses Kandidaten. PR bleibt Draft, bis die unabhängige Prüfung abgeschlossen ist.

| PL-Punkt | Umsetzung und gezielter Nachweis |
|---|---|
| 1 | Textvorschlag für Ware mit genau einem erwarteten Auftrag ist grün; der Klick verwendet denselben vorhandenen Warenweg. Komponentenfall grün. |
| 2 | Zweiter Zuordnungsknopf im Text-Fuß entfernt; Vorschlag und Anders bleiben. Derselbe Komponentenfall prüft die fehlende zweite Zuordnung. |
| 3 | Rechnung ohne Nummer zeigt weiter gelb „Fehlt noch: Rechnungsnummer“; Knopf jetzt exakt „Rechnungsnummer eintragen“. Beide Nummernfälle grün. |
| 4 | Büro-Bestätigung und lokaler Sicherungsfehler entsprechen dem vorgegebenen Wortlaut; „Erneut speichern“ nutzt denselben Speicherhandler. Test: ein Server-Speichern, zwei lokale Bestätigungsversuche, Text bleibt. „geprüft“ aus Uploadtext entfernt. |
| 5 | Die sechs benannten Katalogschlüssel hatten keine Aufrufer und sind entfernt; keine benutzten Kamerawege entfernt. |
| 6 | Tatsächlicher Folgeeditor mit resumeSourceId geöffnet, zurückgekehrt, erneut gelesen und nach Textänderung gespeichert. Vor dem Fix wurde das ausgeschlossene Anliegen erneut gesendet. Ursache: serverseitige dismissedConcerns wurden nicht in die lokale Auswahl übernommen; Wiederaufnahme wählte zudem fremde lokale Entwürfe. Jetzt kanonische Ausschlüsse erhalten und Wiederaufnahme auf dieselbe Eingangskennung begrenzt. Test gegen echte React-Komponenten grün; kein neuer Server-Schreibweg. |
| 7 | Bestehender RealRender prüft zusätzlich zum neuen Kopf wieder den sichtbaren Modus „Zettel lesen · für die Erfassung“. Vorhandene Datei-/Ebenen-/Escape-/Mail-Assertions bleiben. Dieser Fall grün. |
| 8 | Vollständiger vorheriger h16-Lauf: [281 bestandene Browserfälle](https://github.com/schoggertraube-rev/galvanik-kreile-app/actions/runs/42613436205). F01–F12 einschließlich F04, F08, F09 und F10 vollständig grün, keiner dieser Fälle auf der Rotliste. Der spätere Dokumentationskopf f4b1c262 hatte einen unberührten O01-Fehler; kein grüner Endstand dafür behauptet. Der neue gemeinsame Kandidat benötigt eigene grüne CI. |

Gezielter Nachweis dieser Runde: fünf Komponentenfälle sowie der eine bestehende globale RealRender-Fall grün; Typprüfung und gezieltes Lint grün. Keine neue Gesamttestrunde und keine Testabschwächung. Die neuen Retry-/Wiederaufnahmefälle verwenden echte Komponenten mit isolierten Test-Ports; sie ersetzen nicht den oben dokumentierten echten Server-/DB-Rundweg der unveränderten Actions.

Aktuelle Bildpaare gemäß BAUREGELN P liegen ausschließlich in `_review/shots/`: E1-Start und Textvorschlag, jeweils lokale App mit TEST-Daten gegen dieselbe Situation der eingefrorenen Quelle bei 1220, zusätzlich lokale Handyansicht 390. Das ist eine Zwischenkontrolle, kein selbst erteilter Sicht-PASS. Sprechen entfällt gemäß PL 12:00; E2-Ergebnisumbau bleibt ein eigener Schritt.
