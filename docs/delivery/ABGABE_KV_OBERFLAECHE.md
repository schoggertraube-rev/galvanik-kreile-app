# KV → Ware → Auftrag — laufender Bau

**Unfertiger Draft. Keine Merge-Bitte.** Quelle: eingefrorenes Durchstich_KV_2026-11-08.html, SHA-256 93e211498d85e392fdb0746a0d4bad7fa544f6623dcb549b13915b1bf9a12910. U-248 und nachträgliche PL-Regeln/U-250 werden innerhalb dieses Pakets berücksichtigt. Keine Vorschau-Testdaten im Produkt.

## Schritt 1: eine KV-Karte im bestehenden Overlay-Stack

Öffnen über `kreile:oeffne` mit `ziel: kv` oder `quote`, echte KV-ID. Ein neuer erlaubter Overlay-Typ `quote` im vorhandenen Store, kein zweiter Stack. Bestehender Kunden-/Auftragsweg bleibt verknüpft.

Persistierte Werte: Kunde, Teile, Stunden, Preis, Datum, Inhaltsfassung, Wünsche und bestehende Nachweise. Versendeter/zugesagter KV zunächst ohne editierbare Felder; expliziter Knopf öffnet den Textänderungsweg über vorhandene Erkennung/Update. Zusage und Absage verwenden den bestehenden Lifecycle-Writer, UUID bei Wiederholung unverändert; Fehler stehen im Dialog. Die Editierfreigabe kommt aus der tatsächlichen Serverautorisierung. PDF-Druck öffnet den bestehenden authentifizierten Dokumentweg.

Echter Browser mit isolierter Replay-DB: KV über reale Action angelegt und als ausgegeben vermerkt; echte KV-Karte gelesen; Telefon-Zusage geklickt; DB-Version 3, Fassung 1/Zusage 1, genau ein Annahmeereignis, noch kein Auftrag; sichtbarer Stand nachgelesen. **PASS, 23,1 s.** Desktop-/Handyaufnahmen außerhalb des Repos. Drei gezielte Komponentenfälle (feste Fassung, fehlendes Recht, Dialogfehler/Doppelklick/gleicher Retry) PASS. Typen/Lint PASS; Modulprüfung nur bekannte fremde DESIGN_POINTER_PAGE_BINDING.

## Noch im selben Paket offen

Nachrichten-Reiter mit KV-Anliegen aus derselben Quelle; KV-Versand und Originalfassung; Warenannahme/Situation nach U-250 mit bestehenden Original-/Warenports und einem Transaktionswriter; Werkstatt-Kachel/Filter; KV-06/07/07b/12 über echte Browseraktionen; abschließender Bildvergleich 1220/390. Nachgelagerte Kreislaufregeln nur soweit für die genannten laufenden Knöpfe ausdrücklich gebunden. Kein Beleg-Autobau oder Reklamations-Mails in diesem Paket.

CI/READY und PL-Abnahme werden erst am vollständigen Kandidaten gebunden. Kein Merge durch Codex.
