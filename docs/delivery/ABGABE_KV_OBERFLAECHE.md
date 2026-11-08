# KV → Ware → Auftrag — laufender Bau

**Unfertiger Draft. Keine Merge-Bitte.** Quelle: eingefrorenes Durchstich_KV_2026-11-08.html, SHA-256 93e211498d85e392fdb0746a0d4bad7fa544f6623dcb549b13915b1bf9a12910. U-248 und nachträgliche PL-Regeln/U-250 werden innerhalb dieses Pakets berücksichtigt. Keine Vorschau-Testdaten im Produkt.

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
