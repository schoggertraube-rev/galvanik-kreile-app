# KV → Ware → Auftrag — laufender Bau

**Unfertiger Draft. Keine Merge-Bitte.** Aktuelle Quelle nach PL 12:40: Durchstich_KV_2026-11-08b.html, SHA-256 8074f7457033a194fdd16aff062f02970b930d230f32c4f806084cfc3a50eef9. Erster Bau nach der inzwischen ersetzten Quelle 93e21149; U-250/U-251 werden nachgeführt. U-248 und nachträgliche PL-Regeln/U-250 werden innerhalb dieses Pakets berücksichtigt. Keine Vorschau-Testdaten im Produkt.

## Schritt 1: eine KV-Karte im bestehenden Overlay-Stack

Öffnen über `kreile:oeffne` mit `ziel: kv` oder `quote`, echte KV-ID. Ein neuer erlaubter Overlay-Typ `quote` im vorhandenen Store, kein zweiter Stack. Bestehender Kunden-/Auftragsweg bleibt verknüpft.

Persistierte Werte: Kunde, Teile, Stunden, Preis, Datum, Inhaltsfassung, Wünsche und bestehende Nachweise. Versendeter/zugesagter KV zunächst ohne editierbare Felder; expliziter Knopf öffnet den Textänderungsweg über vorhandene Erkennung/Update. Zusage und Absage verwenden den bestehenden Lifecycle-Writer, UUID bei Wiederholung unverändert; Fehler stehen im Dialog. Die Editierfreigabe kommt aus der tatsächlichen Serverautorisierung. PDF-Druck öffnet den bestehenden authentifizierten Dokumentweg.

Echter Browser mit isolierter Replay-DB: KV über reale Action angelegt und als ausgegeben vermerkt; echte KV-Karte gelesen; Telefon-Zusage geklickt; DB-Version 3, Fassung 1/Zusage 1, genau ein Annahmeereignis, noch kein Auftrag; sichtbarer Stand nachgelesen. **PASS, 23,1 s.** Desktop-/Handyaufnahmen außerhalb des Repos. Drei gezielte Komponentenfälle (feste Fassung, fehlendes Recht, Dialogfehler/Doppelklick/gleicher Retry) PASS. Typen/Lint PASS; Modulprüfung nur bekannte fremde DESIGN_POINTER_PAGE_BINDING.

## Noch im selben Paket offen

U-249: zweckgebundene Schreibrechte für alle angemeldeten Personen, ohne Finanzfreigabe oder zweiten Writer; U-250: tatsächlich sichere automatische Erledigung mit realer Rücknahme; KV-Vorbereitung/Kopie und vollständige Änderungs-/Originalfassungswege in der gebundenen Oberfläche; offener Mailentwurf-Browserfall; abschließende Hauptweg-/Sichtabnahme 1220/390. Warenannahme, Mengenpreis, atomare Telefon-Zusage mit neuen/vorhandenen Belegen, Werkstatt-KV-Kacheln und bestehender Galvanik-Anschluss sind unten mit gezielten Nachweisen beschrieben, damit ist das Gesamtpaket noch nicht abgenommen. Nachgelagerte Kreislaufregeln nur soweit für die genannten laufenden Knöpfe ausdrücklich gebunden. Kein Beleg-Autobau oder Reklamations-Mails in diesem Paket.

CI/READY und PL-Abnahme werden erst am vollständigen Kandidaten gebunden. Kein Merge durch Codex.

## Schritt 2: Anliegen und Mailansicht

Beide Reiter lesen dieselbe Intake-Liste. Kategorien und Zähler stammen aus realen Datensätzen, KV-Verknüpfungen öffnen die gespeicherte KV-Karte. Andere Anliegen öffnen die bestehende Originalnachricht. Ein noch nicht verknüpfter KV nutzt vorerst die bestehende Erfassung; der vollständige Vorbereitungsweg ist noch offen.

Echter Browser: Nachricht über Server-Action erfasst, Anliegen KV gewählt, KV mit Quellenbindung angelegt, über Anliegen geöffnet und telefonisch zugesagt; DB/Event/Ansicht geprüft: PASS 18,7 s. Zwei gezielte Panel-Tests PASS; Typprüfung und Lint PASS. Keine Änderungen an Assertions bestehender Tests.

## Schritt 3: Situation nach der Aufnahme (U-250, noch Teilstand)

Nach ausdrücklich gelesenem Text oder Foto/Datei zeigt derselbe Erfassungsdialog die Situation: keine sichtbare Eingabezeile/Aufnahmekacheln, ein Hauptschritt und die bisherigen Zuordnungs-/Artwege unter „Anders zuordnen“. Mehrdeutige Ware zeigt höchstens drei echte Auftragskandidaten. Ware ohne Bezug löst keine geratenen Auftragsanlage mehr aus. Das Original bleibt über seinen echten Leser erreichbar. Noch offen: kleines echtes Vorschaubild statt Originalsymbol, KV-Kandidaten samt atomarer Warenbuchung und tatsächlicher Gegenbuchung; keine automatische Erledigung behauptet.

Echter Browser → Notiz-Action → intake_item und intake_event mit angemeldeter Person → Situationsansicht: PASS 16,7 s; Desktop/Handy außerhalb des Repos. Zwei gezielte Situationsfälle PASS. Initialer Klick vor lokaler Vorbereitung war ohne Wirkung: Lesen wartet jetzt auf die vorhandene Sicherungsbereitschaft. Mechanische Testkorrektur: intake_event.von ist Text, keine UUID-Spalte. Kein Mock im Browserlauf.

Geänderte bestehende Assertions (U-250):
- P63 unbekanntes Original: Artknöpfe sofort sichtbar → dieselben vier Artknöpfe unter „Anders zuordnen“ sichtbar und klickbar; jede gespeicherte Auswahl weiterhin mit derselben Capture-ID/Version belegt.
- „Wem gehört das? / Später zuordnen / Original ansehen“ als gleichzeitig sichtbare Fußaktionen → Zuordnung/Textänderung im Alternativenbereich, echtes Original als benannter Originalknopf, keine sichtbare Notizzeile. Schließen bleibt im Fuß.
- Ware ohne passenden Auftrag ruft automatisch onOrder auf → ausdrücklich kein Aufruf, konkrete Zuordnungsaktion sichtbar. Anfrage/Dokument/Rechnung behalten ihre ursprünglichen Wege.
- EntityOverlayStack: keine vorhandene Assertion geändert; KV-Adapter wird wie Kunden-/Auftragsadapter im isolierten Stacktest ersetzt, zusätzlicher KV→Kunde→Zurück-Fall. Echter KV-Writer bereits im Browser geprüft. Behebt CI-Import einer echten DB im reinen Stacktest.

## PL-Korrektur 12:45 (in Arbeit)

Nicht erkannter Text ohne Datei bleibt in der Startansicht. Titel „Neuer Eingang“, Begrüßung aus dem echten Login-Namen; keine Null-/Offen-Chips, kein „Wem gehört das?“. „Anders zuordnen“ ist ein Knopf; Kandidaten sind echte Server-Ergebnisse. Die frühere generische Situationsformulierung wurde zurückgenommen. Für nicht vorhandene konkrete Textfälle und den Task-gebundenen Ablegen-Fallback folgt die Präzisierung im BAULOG; keine automatische Erledigung oder Folgetask ohne Nachweis behauptet. U-251 noch offen: Die KV-Daten allein beweisen weder aktuellen Warenstand nach Warenausgang noch Galvanikfreigabe; deshalb keine geschätzte grüne Freigabe aus einer bloßen Auftragsbindung bauen.

Korrektur PL 12:45 gezielt geprüft: acht Komponentenfälle, Typen/Lint/Diff PASS; echter Browser einschließlich gesicherter Datei → Situation PASS 17,6 s. Vergleich mit eingefrorener 8074f745 bei identischer Fenstergröße vor Push ausgeführt: generischer Notizfall übernimmt nun den wörtlichen Aufgaben-Vorschlag samt vorhandener Aufgabenansicht; keine Status-Chips. Weiter offene Abweichungen: echtes Thumbnail, taskgebundener Ablegen-Fallback, vollständige KV-Situation/Kreislauf und U-251. Kein vollständiger Sicht-PASS und keine Merge-Bitte.

## Atomare Telefon-Zusage mit Warenbuchung

Der vorhandene `convertQuoteToOrderAction(input, newGoods, telephoneAcceptance)` komponiert jetzt die beiden vorhandenen Writer in der Transaktion des unveränderten `createOrderIntake`. Der vorbereitende Leser darf ausschließlich einen noch nicht geschriebenen Zusageschritt vorplanen; ohne echte Zusage wird keine Konvertierung geschrieben. Neue Ware wird innerhalb derselben Transaktion vor der Zusage geprüft und gespeichert, danach Zusage, Konvertierung und Warenbindung. Bereits gesperrte Ware verwendet denselben Weg ohne zweiten Beleg. Frühe Kunden-/Zahlungsfehler schreiben keine Zusage; späte fachliche Fehler rollen auch Zusage, Ware, Auftrag und Journal zurück.

Zwei gezielte echte Replay-Fälle PASS (5,26 s): neuer und bereits gespeicherter Warenbeleg; negativer Fall mit tatsächlich beschädigter Ware scheitert nach der Zusage beim bestehenden Bindungsbefehl und hinterlässt weder Zusage noch Auftrag/Beleg/Konvertierungsanfrage. Korrigierte Wiederholung mit gleichen Kennungen erzeugt genau einen Auftrag; weiterer Retry liest denselben Auftrag, anderer Zusagewortlaut kollidiert. DB, Ereignis mit Person und tatsächlicher KV-Readback geprüft; kein Mock und kein produktiver Datenbankeingriff. Noch nicht behauptet: automatische Mail-Zusage, U-249-Zweckrechte für alle Logins oder eine vollständig verdrahtete Paket-Oberfläche.

## Warenkarte und Situationskatalog (weiterhin Draft)

KV-Karte → „Paket kommt an“ öffnet den KV-Zweig des bestehenden Objekt-Stacks. Mengen und Lagerplatz stammen aus diesem Eingabestand; KV, Fassung, Preisbasis und Termin aus dem echten KV-Leser. Etikett/Inhalt laufen über vorhandene signierte Uploads, Original-Leser und bestätigte Dateien. Unbestätigte Übertragungen behalten ihre Kennungen/Dateien. Unauffällig/1 von 1 werden erst nach der tatsächlich zugewiesenen Etikettaufnahme vorbelegt und sind sichtbar änderbar. Beim Buchen prüft der bestehende Writer erneut alle Quellen.

Übergabe und Zahlungsmodus werden aus dem echten Kundenprofil über den bestehenden Zahlungs-Vertrag gelesen, keine hartcodierte Versand-/Zahlungsvorgabe. Kundenkarte als Ebene darüber; Rückkehr liest diese Vorgaben neu und erhält die Erfassung. Mengenpreise berechnet der Server mit derselben Mengenfunktion wie die Auftragskarte; auch alte KVs ohne Kalkulationsansatz verwenden diese gemeinsame Funktion. Im UI keine lokale Preis-/Stundenrechnung oder Nullpreis-Ersatzanzeige. Telefon-Zusage auf vorhandener Ware nutzt ebenfalls die atomare Umwandlung, keine zwei Client-Schreibaufrufe.

Echter Browser, lokale Replay-DB und Storage: zwei echte Fotos → 3 statt 4 Teile → serverseitig 48,75 EUR/3 Stunden → Telefon-Zusage → genau ein Auftrag mit Ware=da/geprüft, zwei aufrufbaren Originalen und Actor-Ereignis. Server-Leser der Auftragskarte zeigt 48,75 EUR/3 Teile; bestehende Auftrags-Oberfläche zeigt diese Summe derzeit nicht, deshalb keine erfundene Preis-Anzeige behauptet. KV- und Warenhauptweg nach Kataloganschluss zusammen PASS (35,3 s). Acht Preisfälle und vier KV-Kartenfälle PASS. Modul-Gate nur bekannte fremde DESIGN_POINTER_PAGE_BINDING; Typen/Lint/Diff PASS.

PL 12:55 ersetzt die feste Abschrift durch einen zentralen, datengetriebenen Katalog: `src/ui/situationCatalog.ts`. Neun verlangte Situationsfamilien plus Start/Abschluss sind als reine Leser-Projektionen mit Hauptbefehl, Textvorlage, maximal drei begründeten Kandidaten und Fallback erfasst; elf gezielte Katalogfälle PASS. Die laufenden Aufnahme-/KV-/Waren-Bauteile nutzen diesen gemeinsamen Katalog. Katalogeinträge allein bedeuten **keine** gebaute Beleg-Automatik oder Reklamations-Mailfunktion; diese nachgelagerten Writer-Anschlüsse bleiben außerhalb dieses PR.

Bestehende Assertion-Anpassung durch den Katalog: „Zuordnung öffnen“ → datenunabhängige Katalog-Vorlage „Anderen Kunden oder Vorgang wählen“, gleicher vorhandener Zuordnungsweg. Neue Browser-Prüfung präzisiert: Preis in der Warenkarte und im echten Auftrags-Leser, danach Auftragskarte samt beiden Originalen sichtbar; kein erwarteter Preistext in einer vorhandenen Ansicht, die diesen bisher nicht rendert. Keine vorgeschriebenen Akzeptanztests geändert.

Weiter offen vor Merge-Reife: erwartete KV-Kandidaten im roten Plus, vollständiges Vorbereiten/Versenden aus Anliegen, U-251 mit echtem Freigabe-/Stationsweg, Werkstatt-Kachel/Filter, automatische eindeutige Erledigung mit echtem Gegenbefehl, Desktop-Geräteübergabe und abschließender Sichtvertrag. Kein Merge und keine Production-Änderung.

## U-251: Stand und Galvanik-Anschluss

KV-Karte liest den vorhandenen Warenbeleg-/Auftragsport. Grün setzt aktuelle Zusage, angelegten Auftrag, Ware da/teilweise, angenommene Prüfung ohne offene Punkte und Station/Status angenommen voraus. Das Recht allein erzeugt keine Freigabe. Der Knopf verwendet ausschließlich `transitionWareneingangToGalvanikAction` mit aktueller Version und wiederverwendeter Anfrage-ID; Fehler bleiben im Dialog, nach Erfolg wird der Stand neu gelesen. Kein erneuter Entwurf des angenommenen Warenbelegs.

Echter Browser → vorhandene Station-Action → Replay-DB: PASS 18,9 s, genau ein ORDER_STATION_MOVED_V1 nach Doppelklick, Station galvanik, Version erhöht, neu gelesene Haken-Liste zeigt „In der Galvanik“, Startknopf entfällt. Gezielte Katalog-/Kartenfälle 16 PASS. Anfangs nur die Textsuche des Browsertests falsch (✓ gehört zum Listenelement); mechanisch auf Listenelement umgestellt, kein Produktfehler verschwiegen.

CI am vorherigen fbd6c5c0: quality/agentur rot ausschließlich vier alte Render-Erwartungen auf Dialog-/Überschrift „Neu erfassen“. Fünf Selektoren (einschließlich negativer Rechte-Erwartung) auf den gebundenen Namen „Neuer Eingang“ umgestellt; Knopf-/Rechte-/Schreibassertions bleiben bestehen. Die vier betroffenen Fälle lokal PASS, 84 andere nicht wiederholt. Die Fixture-Umbenennungen sind die einzigen Assertionsänderungen dieses Schritts. Der Gate-FAIL im No-Fake-Selbsttest ist dessen absichtlich negatives Fixture; der eigentliche Produkt-Gate meldet PASS.

## Plus → KV-Ware: derselbe Weg

Bei tatsächlich zugeordnetem Kunden und erkanntem Wareneingang liest das Plus den vorhandenen offenen KV-Port, beschränkt auf genau diesen Kunden und unkonvertierte KVs. KVs und wartende Aufträge erscheinen gemeinsam mit echten IDs/Begründungen, höchstens drei. Bei einem KV führt der Katalogknopf in dieselbe `kvware`-Karte mit der gesicherten Quell-ID; kein zweiter Erfassungs-/Auftragswriter. Kein Kunde aus bloßem Namensvorschlag wird still gesetzt. Ein Kundenwechsel verwirft die vorherigen Kandidaten; Lesefehler stehen im Dialog. Automatische Auftragserstellung und Rückgängig sind damit noch nicht als fertig behauptet.

Echter Browserfall erweitert: vorhandenen Kunden aus der KV-Karte öffnen → Plus → DHL-Absender als Notiz → tatsächliche Notiz-Action/Erkennung → offener KV desselben Kunden → derselbe Warenkartenknopf → Fotos → atomare Buchung → DB/Auftragskarte → Galvanik. PASS 22,4 s. Neun gezielte Situation-/Capturefälle PASS; Typen/Lint PASS.

## Desktop → Handy: bestehende Foto-Anfrage

Warenkachel am Desktop öffnet die vorhandene gebundene Geräteübergabe am selben Eingang, mit QR/Fotos-für-PC-Link und Dateialternative. Auf dem Handy bleibt die echte Kamera/Dateiaufnahme im vorhandenen Capture-Modul. PC liest denselben Eingang nach, Originale erhalten explizite Rollen. Übernehmen/Beenden schließt die Sammlung über den vorhandenen Gerätebefehl; Schließen verwirft keine Originale. Kurzlebiger Link nur im Komponenten-Zustand.

Echter Browser mit zweiter angemeldeter Seite: QR-Anfrage → tatsächliches Annehmen → zwei Fotos über den vorhandenen Upload/Storage → PC-Zähler 2 → Übernehmen → weitere zwei Originale → Auftrag. Replay-DB: device_request beendet/ein angenommenes Gerät, mindestens zwei Fotos, Warenbeleg und Auftrag mit vier gesicherten Originalen; anschließend echte Galvanik-Action/Einzelevent/Neulesen. PASS 28,1 s.

Gefundener Fehler: Dateiauswahl war beim noch nicht angenommenen Handy-Link möglich und konnte die ursprüngliche statt gebundene Eingangs-ID verwenden. Empfangs-Dateieingabe bleibt nun bis zur tatsächlichen Annahme gesperrt, auch Paste/Drop werden vor diesem Zeitpunkt abgefangen. Keine Änderung des Upload-/Gerätewriters. Test wartet auf die reale Annahme statt allein auf das sichtbare Dialogfenster. Die zunächst erwogene Änderung der Fotoherkunft wurde verworfen, da sie nicht ursächlich war.

PL 14:01 bestätigt strenge Foto-Pflicht. Fehlender Inhalt nennt den bestehenden KV als Herkunft des noch nicht angelegten Auftrags; eine zukünftige Auftragsnummer wird nicht erfunden.

## KV-Mail aus der festen Karte

Die Karte verbindet den vorhandenen CommunicationPanel-Editor mit demselben `sendCustomerMailAction` und dem tatsächlichen KV als PDF-Anhang. Kein zusätzlicher Versandwriter, kein manuelles „gesendet“ nach Klick: erst die bestätigte Versandantwort löst das Neulesen der KV-Karte aus. Doppelklick gesperrt, unklarer Versand hält Kennung und kompletten Text fest; erneuter Versuch verwendet dieselbe Anfrage. Bei ungeklärtem Versand kann die Karte nicht unbemerkt geschlossen werden. Unsende Entwürfe fragen vor dem Verwerfen.

Fünf gezielte Kartenfälle PASS, darunter Portvertrag für Kunden-/KV-ID, Nachricht, dieselbe Retry-ID und Neulesen erst nach bestätigter Antwort. Externer Mailversand ist hiermit nicht als erfolgreich geprüft behauptet; die Provider-/Versandbelege des vorhandenen Mailwriters bleiben Voraussetzung der vollständigen Abnahme.

## Werkstatt: KV-Ware aus derselben Quelle

Eigene KV-Waren-Kacheln zeigen erwartete Ware, gesperrte Ware mit Ort/Grund und bereits vorhandene Ware vor der Auftragserzeugung. Die drei Filter teilen die tatsächlich gelesenen KV-Zeilen auf; „Alle“ ist deren Summe. Öffnen geht zur einen festen KV-Karte. Bestehende Auftrags-/WIP-Zähler bleiben aus ihrem bisherigen kanonischen Leser. Lesefehler werden angezeigt; bei der bestehenden Listenobergrenze wird die Begrenzung genannt.

Der operational beschränkte Leser liefert keinerlei Preis-/Kalkulations-/PDF-Felder und braucht nur das vorhandene Werkstatt-Leserecht. Echte Replay-Action: nicht finanzberechtigter Login kann die erwartete Ware lesen, Voll-KV-Leser bleibt FORBIDDEN, DB-Version/Zusage/Auftragsreferenz unverändert; PASS 5,58 s. H18 erfasst den neuen Leser mit diesem echten Test, keine Ausnahme hinzugefügt.

Gefundener Fehler: `listOpenQuotesCommand` dekodierte die KV-Zeilen ohne zugehörige Warenbelege, während der Einzel-KV-Leser diese bereits ergänzte. Dadurch verschwand gesperrte KV-Ware aus der neuen Werkstattprojektion. Derselbe kanonische Warenlese-Port ergänzt die gesamte Liste jetzt in genau einer Sammelabfrage (keine Abfrage je KV). Alte KV-Zeilen ohne Lifecycle verursachen keine unnötige Warenabfrage.

Echter Browser: erwartete KV-Ware nach Zusage sichtbar; separater Warenweg mit gesperrtem Ablegen → Werkstattfilter/Ort/Grund → KV-Karte → Telefon-Zusage plus genau ein Auftrag aus vorhandenem Beleg → Auftragskarte/Galvanik. Gesperrter Hauptweg PASS 35,3 s. Drei gezielte Werkstatt-Renderfälle PASS. Keine automatische Mail-Zusage oder U-249-Schreibrechte als erledigt behauptet.

## Konsistenz nach Umwandlung

Ein direkt geöffneter Warenweg zu einem bereits umgewandelten KV zeigt keine zweite Erfassung mehr. Er öffnet den tatsächlich verknüpften Auftrag auch ohne Editierrecht. Gezielter Renderfall PASS: keine Mengen-/Dateifelder, kein Waren-/Umwandlungsaufruf, Navigation exakt auf gespeicherte Auftrags-ID. Kein Schattenentwurf.

CI-Nachtrag: Der neue öffentliche Editor-DTO fehlte im bestehenden Modulmanifest. Ausschließlich den tatsächlich exportierten Typ QuoteMailDraft nachgetragen; Checker, Schema und Baseline unverändert. Die beiden neuen CI-Modulverletzungen sind lokal beseitigt; übrig bleibt allein der bekannte fremde DESIGN_POINTER_PAGE_BINDING des Planungs-Arbeitsbaums.

## Letzte Nachführung

- Werkstatt hört auf das bestehende Änderungsereignis und liest nach der Buchung neu. Echter Browser PASS 37,6 s: nach Umwandlung verschwindet die alte gesperrte KV-Kachel auch im Hintergrund ohne manuelles Neuladen; der Auftrag bleibt über seine Karte erreichbar.
- Der einzige neue F1-Registry-Abgleich ist der tatsächliche exportierte Warenleser in der bestehenden Quotes-Gruppe. No-Fake und Scope lokal PASS; keine Status-/Erfolgsfreigabe oder Ausnahme geändert.
- Statische Unterstützungs-Knopftexte des Capture-Dialogs liegen jetzt ebenfalls im gemeinsamen Katalog. Verhalten und sichtbare Texte unverändert. Mailbetreff verwendet die tatsächliche KV-Nummer einmal; gezielter Retry-Vertrag PASS.
- Der neue echte Mailentwurf-Browserfall ist ausdrücklich offen und auf der Rot-Liste: erster Lauf zeigte den erhaltenen Text, die exakte Labelsuche scheiterte; danach Timeout bereits vor dem bisherigen Anliegen-KV-Knopf. Keine weiteren Wiederholungsschleifen und kein externer Versand-PASS. Ein versehentlicher zweiter Browserstart wurde am belegten Port abgewiesen, keine zweite laufende Anwendung gestartet.
- Lokale Next-Dev-Typdateien enthielten überlappende Generatorreste. Nach beendeten Browserprozessen mit den aktuellen generierten Routentypen repariert; Produktdateien, tsconfig und Gates unverändert. Danach Typprüfung PASS. Keine weiteren Browserläufe in diesem Schritt.

Die Listenbegrenzung bleibt auch dann sichtbar, wenn unter den geladenen 100 KVs kein Warenkandidat liegt. Gezielter Leer-/Begrenzungsfall PASS; kein falscher vollständiger Leerzustand.

## U-249: Telefon-Zusage und vorhandene KV-Ware ohne Geld-/Anlagerecht

Bestehende KV-Karte/Warenkarte lesen dieselben Daten über eine zweckgebundene Projektion. Ohne Finanzrecht werden Summen, Einzel-/Zeilenpreise und Kalkulation serverseitig entfernt (null, keine Ersatzpreise); Stunden bleiben als Arbeitsinformation sichtbar. Neue KV-Fassungen, Versand und Preisbearbeitung erhalten dadurch keine Freigabe. Die normale vollständige KV-Ansicht bleibt ohne Geldrecht gesperrt.

Telefon-Zusage verwendet die bestehende Lifecycle-Action mit einem engen Entscheidungsgrant; kein globales createQuote/Editrecht. Umwandeln bereits geprüfter KV-Ware verwendet dieselbe Conversion-Action und denselben createOrderIntake-Writer. Nur dessen intern erzeugte, transaktional nachgelesene KV-Bindung darf den kanonischen Auftrag für diesen Zweck anlegen. Normale Direktanlage bleibt gesperrt. Neue Warenannahme erfordert weiterhin Eingang; Freigabe/Umwandlung eines vorhandenen KV-Belegs ist der U-249-Zweck.

Zwei zusätzliche Sicherungen aus den echten Tests: (1) Eine durch die Zusage erledigte automatische Nachfassaufgabe wird auch beim anderen Mitarbeiter sauber abgeschlossen – nur der tatsächlich zugesagte KV derselben Fassung und die berechneten automatischen Task-Schlüssel erlauben das. Andere Aufgabenrechte bleiben bestehen. (2) Übertragen fremd erfasster Warenoriginale verwendet den bereits vorhandenen Nachweis der gespeicherten KV→Auftrags-Umwandlung; kein Mails-/Eingangsrecht wird vorgetäuscht.

Nachweise gegen echte Replay-DB:
- Werkstatt-Login nur mit Aufträge, ohne Geld/Eingang: fremd erfassten gesperrten Beleg telefonisch bestätigen und genau einmal umwandeln, reale Actor-ID im Ereignis, automatische Aufgabe erledigt durch diesen Actor, Warenbeleg/Originale beim Auftrag, gleicher Retry genau ein Auftrag, geänderter Wortlaut Konflikt. Direkte Auftragsanlage bleibt FORBIDDEN, vollständiger KV-Leser bleibt FORBIDDEN, Rückgabe/Readback enthält keine Finanzwerte. PASS 4,70 s.
- Werkstatt-Login ohne zusätzliche Fachrechte: operativ lesen, Telefon-Zusage mit echtem Wortlaut/Actor in DB/Event, Ansicht neu lesen, kein Geldbetrag; allgemeine KV-Absage bleibt ohne Editrecht FORBIDDEN. PASS 4,32 s.
- Sieben gezielte Kartenfälle einschließlich operativer Ansicht ohne Preis/Edit/Versand PASS; Typen/Lint PASS. Modulprüfung nur fremder Planungs-Pointer. Gültigkeit verlängern/Rückgabe folgen dem dafür vorgesehenen Kreislauf-Paket; kein solcher noch fehlender Befehl wird hier als fertig behauptet.

Echter U-249-Browserlauf zusätzlich PASS 35,1 s: Rolf erfasst/legt Ware gesperrt ab; anderer tatsächlicher PIN-Login Werkstatt öffnet denselben KV, sieht weder Betrag noch Fassungs-/Versandknopf, bestätigt telefonisch und erzeugt aus dem vorhandenen Beleg einen Auftrag. DB-Ereignis trägt die zweite Login-ID, alle vier Originale bleiben beim Auftrag. Auftragskarte liefert ohne Geldrecht keine commercialQuote-Finanzdaten; der Mitarbeiter kann anschließend über den bestehenden Befehl in die Galvanik übergeben. Die beiden bisherigen Browserfälle bleiben unverändert zusätzlich vorhanden.


## KV-Vorlage und Vorbereitung aus einem Original

Die feste KV-Karte verwendet für „Diesen KV als Vorlage“ die vorhandenen `prepareQuoteCopyAction` und `duplicateQuoteAction`. Der neue Fertigtermin bleibt bis zur bewussten Wahl leer. Bei unklarem Ergebnis bleiben Kennung und Nutzlast gleich, Datumswechsel und andere Schreibhandlungen sind gesperrt. Nach bestätigter Anlage öffnet dieselbe KV-Karte den neuen Datensatz. Echter Browser PASS 14,3 s: genau eine Kopie, 6100 Cent aus der tatsächlichen Vorlage, neuer Termin, Ursprungsfassung unverändert, danach tatsächlicher Server-Readback. Gezielter Unsicherheits-/Doppelklickfall PASS.

KV-Anliegen ruft jetzt ausdrücklich den vorhandenen QUOTE-Weg statt des allgemeinen Direkt-Auftragsformulars auf. Vorher wird `prepareQuoteFromIntakeAction` tatsächlich gelesen. Bereits gebundener Kunde, erkannte Teile/Menge/Oberfläche, Originaltext und bestätigte Sonderwünsche stammen daraus; keine vorgeschlagenen Kunden werden still übernommen. Fehlender Preis und fehlender Termin bleiben leer. Das vorhandene KV-Formular und `createQuoteAction` bleiben der eine Schreibweg. Quelle/Version, Sonderwünsche und erkannte Lieferwochen werden mitgespeichert. Originaldateien bleiben über den bestehenden Original-Dialog erreichbar. Erfolg öffnet direkt die feste KV-Karte; kein paralleler neuer Datensatztyp.

Echter Browser PASS 19,1 s: synthetisches Original mit gebundenem Kunden und vier Haltern → echte Vorbereitung → Preis/Termin bewusst ergänzen → genau ein KV mit Quelle und Sonderwunsch → Server-Readback/Karte, kein Auftrag. Gefundener Clientfehler: Erkennung liefert den Anzeigenamen „Verchromen“, das Auswahlfeld braucht den kanonischen Oberflächenschlüssel. Vorbelegung nutzt jetzt denselben vorhandenen Normalisierer; keine Erkennungslogik umgangen. Mechanische Testkorrekturen betrafen zulässige Anliegenauswahl, explizites Mengenformat, leeres DOM-Preisfeld und DB-Bigint.

Die Anliegen-Überschrift, Kategorien, Situationssätze und Knopftexte kommen aus demselben zentralen Situationskatalog; keine Frage-Überschrift im Bauteil. Neun gezielte Renderfälle, Typen/Lint/Diff PASS. Modulprüfung enthält allein den fremden Planungs-Pointer `DESIGN_POINTER_PAGE_BINDING`; kein Checker geändert.

Weiterhin Draft: automatische sichere KV-Warenzuordnung samt tatsächlicher Rücknahme ist noch nicht als umgesetzt behauptet (Produktpräzisierung im BAULOG angefragt). Formale abschließende Sicht und übrige vollständige Browser-Abnahme bleiben offen. Keine Merge-Reife, kein externer Mailversandnachweis.


## Reine Terminänderung an der zugesagten KV-Karte

Die echte Vorschau nennt jetzt die tatsächlichen Vorher-/Nachher-Werte für Termin, geänderte Menge und Gesamtpreis, soweit der Server sie liefert. Ein reiner Terminwechsel bestätigt ausdrücklich den Erhalt der Fassung; eine gültige Zusage wird nur dann genannt, wenn sie tatsächlich zur Fassung vorliegt. Erfolgstext richtet sich zusätzlich nach der zurückgegebenen Fassung, nicht nach einer angenommenen Wirkung.

Gefundener fachlicher Fehler im echten Browser: Bei einem KV ohne ausdrücklich gespeicherte Zeilensumme ergänzte die Vorbereitung für den bloßen Terminwechsel eine rechnerisch gleiche ausdrückliche Zeilensumme. Der bestehende SQL-Inhaltsvergleich wertete diesen Formwechsel als Preisänderung und erzeugte fälschlich Fassung 2. Der bestehende Kopier-Leseport liefert jetzt zusätzlich die tatsächliche ursprüngliche Speicherform; nur der reine Termin-Vorschlag erhält sie unverändert. Kein neuer Schreibweg, keine Migration, kein gelockerter Inhaltsvergleich. Geänderte Mengen/Preise behalten die ausdrücklichen exakten Summen.

Echter Browser PASS 12,5 s: Zusage zu Fassung 1 → Text „Termin 18.12.2026“ → tatsächlicher Vorschlag → ein Update → DB-Version 4, Fassung 1, Zusage 1, 6100 Cent unverändert; genau ein QUOTE_UPDATED_V1 mit der tatsächlichen Login-ID; erneuter Server-Readback und Karte. Zwei gezielte Replayfälle für Textänderungen/Kopie PASS 5,86 s, acht Kartenfälle einschließlich echter Datumsanzeige/fehlender Zusage PASS, sechs Befehlsfälle PASS, Typen/Lint/Diff/Scope PASS. Generierte Next-Typcache-Reste wurden neu erzeugt, ohne Produkt-/tsconfig-/Gateänderung.


CI-Nachtrag zur offenen Mailprüfung: Die generierte Rot-Liste akzeptiert ausschließlich IDs aus dem gebundenen Bauplan. Die selbst angelegte ID KV-UI-MAIL-DRAFT war dort ungültig und blockierte h16 nach erfolgreichem Build (FLOW_EXPECTED_RED_CASE_UNKNOWN). Diesen ungültigen Eintrag entfernt, ohne Generator/Gate zu lockern oder den echten Browsertest zu löschen/überspringen. Der nicht bestandene individuelle Mailentwurf-Fall bleibt in dieser Abgabe und im BAULOG ausdrücklich offen; keine Abnahmefreigabe daraus. Die 60 h16-Replaytests davor waren grün.


Gegenprobe Mengenänderung im echten Browser PASS 17,2 s: zugesagte vier Halter → Text „3 Halter statt 4“ → sichtbarer Vorher-/Nachher-Vorschlag 4→3 und 61,00→48,75 Euro → vorhandener Update-Befehl → DB-Fassung 2, alte Zusage weiterhin historisch Fassung 1, kein Auftrag; Server-Readback bestätigt drei Teile/4875 Cent und geaendert_seit_versand. Telefon-Zusage für die noch nicht versendete neue Fassung wird nicht angeboten. Dieser Inhaltswechsel wird ausdrücklich anders behandelt als der reine Terminwechsel.


## Antworten bleiben beim tatsächlichen KV

KV-Annahme/Absage aus der Nachrichtenansicht öffnen jetzt dieselbe KV-Karte mit der Quell-ID, statt eine KV-ID als Auftrags-ID zu öffnen oder einen unverdrahteten Absageempfänger aufzurufen. Der vorhandene Zuordnungsleser liefert die bereits abgefragten offenen Anliegen zusätzlich zurück. Keine zweite Liste/Abfrage/Datenhaltung. Die Karte liest Wortlaut, Version und ursprüngliche Dateien erneut aus dieser Quelle; fremder Kunde oder gesperrter Nachrichteninhalt verweigert den Kontext.

Der Handlungskatalog bietet die passende Übernahme an: Zusage, Absage oder Vorbehalt (beispielsweise „einverstanden, aber nicht für den Preis“). Es ist eine bewusste Übernahme des tatsächlichen Wortlauts, keine unbewiesene automatische Mailentscheidung. `changeQuoteLifecycleAction` bindet genau diese Quell-Version in derselben Transaktion. Kein Auftrag ohne Ware. Nach Vorbehalt bleibt die Ware gesperrt, und das offene Anliegen wird „aenderung“; die Karte bietet dieselbe vorhandene Textänderung an. Ein echter Änderungsvorschlag übernimmt dessen Quelle ebenfalls in den vorhandenen Update-Befehl.

Drei echte Browserfälle PASS 27,5 s: synthetischer bereits importierter und zugeordneter Mail-Ausgangszustand → Anliegen → KV-Karte → bewusste Zusage/Vorbehalt/Absage → DB genau ein Lifecycle-Ereignis mit realer Login-ID, Quelle samt offenen Restanliegen und intake_event, KV neu gelesen, kein Auftrag. Mobile-Bilder außerhalb des Repos gesichert. Graph-Transport/automatische erstmalige Zuordnung einer ungebundenen Antwort sind mit dieser Fixture ausdrücklich nicht bewiesen. 13 gezielte Renderfälle PASS, einschließlich Quelle/Version/Wortlaut, Konfliktanzeige und Doppelklick. Die übrige vollständige Abnahme bleibt offen.

Zusätzlicher echter KV-12-Mail-Browserfall PASS 14,5 s: gespeicherte importierte Änderungsnachricht → gebundene KV-Karte → Wortlaut im vorhandenen Texteditor → Termin-Vorschlag → gleicher Update-Befehl mit Quell-Version → KV-Version 4/Fassung 1/Zusage 1 und Datum 18.12.; Anliegen aenderung atomar erledigt, andere Aufgabe bleibt offen, genau ein intake_event mit echter Actor-ID, Karte und Server nachgelesen.
