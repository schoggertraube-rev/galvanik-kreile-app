# KV → Ware → Auftrag — laufender Bau

**Unfertiger Draft. Keine Merge-Bitte.** Aktuelle Quelle nach PL 12:40: Durchstich_KV_2026-11-08b.html, SHA-256 8074f7457033a194fdd16aff062f02970b930d230f32c4f806084cfc3a50eef9. Erster Bau nach der inzwischen ersetzten Quelle 93e21149; U-250/U-251 werden nachgeführt. U-248 und nachträgliche PL-Regeln/U-250 werden innerhalb dieses Pakets berücksichtigt. Keine Vorschau-Testdaten im Produkt.

## Schritt 1: eine KV-Karte im bestehenden Overlay-Stack

Öffnen über `kreile:oeffne` mit `ziel: kv` oder `quote`, echte KV-ID. Ein neuer erlaubter Overlay-Typ `quote` im vorhandenen Store, kein zweiter Stack. Bestehender Kunden-/Auftragsweg bleibt verknüpft.

Persistierte Werte: Kunde, Teile, Stunden, Preis, Datum, Inhaltsfassung, Wünsche und bestehende Nachweise. Versendeter/zugesagter KV zunächst ohne editierbare Felder; expliziter Knopf öffnet den Textänderungsweg über vorhandene Erkennung/Update. Zusage und Absage verwenden den bestehenden Lifecycle-Writer, UUID bei Wiederholung unverändert; Fehler stehen im Dialog. Die Editierfreigabe kommt aus der tatsächlichen Serverautorisierung. PDF-Druck öffnet den bestehenden authentifizierten Dokumentweg.

Echter Browser mit isolierter Replay-DB: KV über reale Action angelegt und als ausgegeben vermerkt; echte KV-Karte gelesen; Telefon-Zusage geklickt; DB-Version 3, Fassung 1/Zusage 1, genau ein Annahmeereignis, noch kein Auftrag; sichtbarer Stand nachgelesen. **PASS, 23,1 s.** Desktop-/Handyaufnahmen außerhalb des Repos. Drei gezielte Komponentenfälle (feste Fassung, fehlendes Recht, Dialogfehler/Doppelklick/gleicher Retry) PASS. Typen/Lint PASS; Modulprüfung nur bekannte fremde DESIGN_POINTER_PAGE_BINDING.

## Noch im selben Paket offen

KV-Versand und Originalfassung; Warenannahme/Situation nach U-250 mit bestehenden Original-/Warenports und einem Transaktionswriter; Werkstatt-Kachel/Filter; KV-06/07/07b/12 über echte Browseraktionen; abschließender Bildvergleich 1220/390. Nachgelagerte Kreislaufregeln nur soweit für die genannten laufenden Knöpfe ausdrücklich gebunden. Kein Beleg-Autobau oder Reklamations-Mails in diesem Paket.

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
