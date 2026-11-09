# Eingang V04 – E1, Prüfstand

Status: **Draft, keine Merge-Bitte und keine Selbstabnahme.**

Quelle: AP-EINGANG-V04, E1, U-261/U-262/U-263. Eingefrorene HTML-Quelle:
`_review/quellen/freigegeben/Eingang_V04_2026-11-09.html`, SHA-256
`92d2ec60ce33f81d39827fc06b820390850776933e571de18dc771512fa328f7`.

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

Keine Migration und keine Dev-Datenänderung für E1. Die Tests verwenden die echte lokale
Replay-Datenbank und ausdrücklich synthetische Daten; sie behaupten keine Provider-Verbindung.

## Assertions alt → neu

- Bild ohne OCR: früher wurde „Text ändern“ stets verlangt → jetzt muss es fehlen; zusätzlich positiver gesicherter OCR-Fall sowie verworfener/ungesicherter/nur getippter Text geprüft.
- Bestehende Rollen-Abfragen im Test: ungültige Option `exact` entfernt; die vollständigen zugänglichen Namen bleiben unverändert geprüft.
- Die sieben generierten Browserfälle wurden **nicht** verändert.

## Noch offen vor Abnahme

- PL 12:00 hat beide Punkte entschieden: persönlicher Titel, kompakte echte Foto/Datei-Werkzeuge und Textfeld im selben E1; die einzelne S13-Zeile ersetzt die alte Box. Diese Korrektur ist umgesetzt und wird als ein gemeinsamer Kopf geprüft.
- Abschließender Sichtabgleich dieser Entscheidung; vorhandene Bilder belegen Funktion und zeigen die Layoutabweichungen ausdrücklich.
- Vorheriger Kopf `3f689bb0` hat alle acht Checks grün und READY; diese Ergebnisse ersetzen die Prüfung des neuen gemeinsamen Kopfes mit Startaufbau nicht. Dessen Pflicht-CI, exakte READY-Preview, Sicht und unabhängiger PL-PASS stehen aus.
- Der echte Zwei-Sitzungs-Nachweis des gesamten Gerätewechsels gehört nach Paket zu E3; hier wird kein vollständiger GW-PASS behauptet.

E2 ersetzt anschließend das gemeinsame Ergebnismuster, E3 vervollständigt Ware. E5 übernimmt den vorhandenen Reklamationszweig. E4 und der Belegzweig sind nach U-269 bis nach Livegang geparkt.


## Startaufbau nach PL 12:00

Der vorhandene Dialog bleibt verantwortlich für Escape, Hintergrundklick und den einen Schließ-/Speicherweg. Im selben Capture ersetzt sein bestehender Kartenmodus den alten breiten Kopf: ein persönlicher Titel, Textfeld, kompakte Foto-/Dateiwerkzeuge und die eine S13-Zeile. Die manuellen Auftrag-/Kunden-Einstiege bleiben erhalten. Alte getrennte ERKANNT-Box und deren frühe Entfernungsknöpfe entfallen gemäß ausdrücklicher PL-Entscheidung; lokale ausgeschlossene Anliegen und gespeicherter Text bleiben erhalten.

23 gezielte Komponentenfälle sind grün. Neue Fälle prüfen den einzelnen persönlichen Kopf, vorhandene echte Werkzeuge und die erhaltenen ausgeschlossenen Anliegen eines alten lokalen Entwurfs. Alte Kamera-Assertion: automatischer Start beim allgemeinen Öffnen → jetzt kein Kamerazugriff vor dem bewussten Foto-Klick; danach bleiben die bisherigen Video-/Auslöser-/Schließ-Assertions vollständig erhalten. Bei übernommener Handy-Fotoanfrage öffnet die vorhandene Kamera weiterhin unmittelbar.

Bewusst offen: **Sprechen** wird nach ausdrücklichem PL-Entscheid nicht als Knopf gezeigt und nicht simuliert; ein Transkriptions-Port fehlt. PL informiert die Owner. Die Beispiel-/Vernetzungs-Demos des HTML-Referenzwerkzeugs werden nicht als Produktfunktionen eingebaut.

Lokale Datenbank weiterhin nicht erreichbar nach einem begrenzten Wiederanlaufversuch; keine neuen DB-Schleifen. Die bereits nachgewiesenen Server-Schreibwege bleiben unverändert. Ein neuer Sichtlauf erfolgt gegen die tatsächliche Git-Preview; ohne diesen Nachweis keine fertige Abnahme.

## Nachführung des bestehenden globalen Fluss-Tests

Die Modus-Aufnahme erwartet nach dem freigegebenen gemeinsamen Kopf „Neuer Eingang“ statt „Zettel lesen · für die Erfassung“. Alle Prüfungen zu Datei-Werkzeug, zwei Ebenen, Escape-Rückkehr und getrenntem Mailweg bleiben erhalten. Dieser konkrete RealRender-Fall ist lokal grün (1,05 s). Der einmalige Lauf der ganzen Datei bestand 88 von 89 Fällen; ein unberührter PositionZeile-Fall erreichte bei belastetem Rechner das unveränderte 5-Sekunden-Limit. Keine Timeout-Erhöhung und keine Assertion entfernt.
