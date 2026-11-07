# AP-KV-V04 – KV schnell anlegen, versenden, zusagen, umwandeln (Planungschat, 07.11.2026)

**Vorgabe für die Optik:** `_review/quellen/minimodule_v04/Kreile_MiniModule_04_Vernetzung.html` (Owner, U-244) – Funktionen `newQuote`, `openQuote`, `netQuoteFooter`, `quoteAddInfo`, `copyComparison`, `quoteMail`/`quote-send`, `quote-followup`, `conversion`, `receiveOrder`. Aussehen, Texte und Reihenfolge exakt so; die Werte kommen aus der echten Datenbank, nie aus `D`/localStorage/Testsätzen. Testkarten der Vorschau nicht übernehmen – Kunden-/Auftragskarten über `openOrder/openCustomer`.

**Owner-Ziel (07.11.):** Ein KV ist schnell da, aus Eingang, Mail oder Nachricht vorbefüllt und ohne Gewurschtel. Bei Zusage wird er mit einem Klick (oder einer kleinen Korrektur) zum Auftrag, beim Wareneingang zum echten Auftrag mit Ware im Regal. Nichts davon ist Mock – alles hängt an Kunde, Nachricht, Original, Auftrag.

## 1. Bestand (main) – weiterverwenden, nicht neu bauen
`private.quotes` + Positionen, `createQuoteAction`, `updateQuoteAction` (Sperrzähler `version`), `convertQuoteToOrderAction` (`quotes.actions.ts:54,97,168`, erzeugt genau einen Auftrag + Auftragseingang), `readQuotePdfAction`, `sendCustomerMailAction` (hängt KV-PDF an), Wareneingang `saveGoodsReceiptAction`, Erkennung `recognizeIntakeNoteAction`, Mail-Auswahl `mailSelectionContract` (nach 3.4 kommen Mails als `intake_item`).

## 2. Datenmodell (nur additiv, eine Migration)
An `private.quotes`: `fassung int` (Inhaltsfassung, +1 bei jeder inhaltlichen Änderung nach dem ersten Versand; getrennt vom Sperrzähler `version`), `kalk_stunden numeric`, `stundensatz_cents`, `ruest_cents`, `material_cents` (Vorbelegung aus den Einstellungen – **konfigurierbar**, nie im Code), `lieferzeit_wochen int`, `gesendet_fassung int null`, `gesendet_am`, `gesendet_kanal` (`mail|druck`), `zugesagt_fassung int null`, `zugesagt_am`, `zusage_nachweis` (Nachricht-ID oder Wortlaut/Gesprächsvermerk), `abgesagt_am`, `absage_grund`, `nachfass_am date null`, `quelle_intake_item_id`, `quelle_nachricht_id`, `sonderwuensche text`. Status wird **abgeleitet**, nicht gespeichert: Entwurf → versendet (gesendet_fassung = fassung) → geändert seit Versand (fassung > gesendet_fassung) → zugesagt (zugesagt_fassung = fassung) → umgewandelt (`linked_order_id`) | abgesagt | abgelaufen (`valid_until < heute`). Einstellungen: Stundensatz, Rüst-, Materialansatz, Nachfass-Frist (Tage), Gültigkeit (Tage).

## 3. Wege (jeder mit echtem Befehl, Receipt, Nachlesen)
1. **KV anlegen aus Eingang** (rotes Plus, Text/Foto/Datei): Erkennung liefert Kunde (Treffer mit Grund), Positionen (Anzahl, Bauteil, Bearbeitung), Ausschlüsse, Wunschtermin/Lieferzeit; Hauptknopf „KV für {Kunde} vorbereiten“ → `createQuoteAction` mit `quelle_intake_item_id`, Original bleibt am KV. Kein Kunde erkannt → zuerst zuordnen oder anlegen (vorhandener Weg), dann weiter ohne Neueingabe.
2. **KV aus Mail/Nachricht** (Reiter Anliegen → „KV aus Nachricht öffnen“): wie 1, `quelle_nachricht_id`, Anhänge/Fotos als Originale, bestätigte Kundenhinweise aus der Kundenkarte (z. B. „Originalteile erhalten“) gehen als `sonderwuensche` mit – sichtbar und änderbar, nie still.
3. **„Wie beim letzten Mal“**: vorhandenen KV/Auftrag des Kunden kopieren; Ist-Stunden des letzten Auftrags neben dem Ansatz zeigen (`copyComparison`), übernehmen per Klick.
4. **Kalkulation:** Preis = Stunden × Stundensatz + Rüst + Material (Ansätze aus Einstellungen, je KV änderbar); Fertigtermin aus Lieferzeit-Wochen (2/3/4) oder Datum; Fokus und Cursor bleiben beim Tippen.
5. **Versenden/Drucken:** PDF der **aktuellen Fassung**; Mail über `sendCustomerMailAction` (Ziel KV, Thread-Bezug zur Ursprungsnachricht) setzt `gesendet_fassung/_am/_kanal` erst nach Versandbeleg; Druck setzt `kanal=druck`. Vor Go-live ohne echtes Postfach: „Als versendet vermerken“ mit Kanal.
6. **Ändern nach Versand:** neue Fassung; Kopf, Statusmarke, Begleittext und Knopf zeigen „Geänderte Fassung {n} senden“; eine frühere Zusage gilt **nicht** für die neue Fassung.
7. **Zusage:** aus der Antwort-Mail/Nachricht („Freigabe & Wareneingang übernehmen“) oder an der KV-Karte mit Wortlaut/Gesprächsvermerk → `zugesagt_fassung` = aktuelle Fassung; Anliegen der Nachricht in derselben Transaktion erledigt.
8. **Umwandeln mit einem Klick** (`conversion`): Dialog zeigt Kunde, Umfang, Preis, Fassung, Freigabe-Nachweis; vorbelegt: Fertigtermin neu gerechnet ab heute, Übergabeart aus Kundenkarte, Zahlungsart aus Einstellungen/Kunde. Ist die Ware schon da: angekommene Stückzahl, Kiste/Regal, Etikett- und Inhaltsfoto, „Menge und Inhalt stimmen“ → **ein** Befehl: `convertQuoteToOrderAction` + `saveGoodsReceiptAction` in einer Transaktion (Auftrag mit Ware im Regal, Station Wareneingang). Ware noch nicht da: Auftrag mit Ware erwartet; der spätere Wareneingang (Etikett/Eingang) findet den Auftrag über Kunde + Auftragsnummer und bucht dorthin. Ohne Zusage zur aktuellen Fassung: gesperrt mit Knopf „Aktuellen KV senden“ bzw. „Direktauftrag mit Nachweis“.
9. **Absage:** aus Nachricht oder Karte, Grund wählbar → abgesagt, kein Auftrag; Anliegen erledigt.
10. **Nachfass:** versendet ohne Antwort nach Frist → Aufgabe auf Der Tag „Bei {Kunde} wegen KV {nr} nachfragen“ (vorhandene Aufgaben); abgelaufen → nicht mehr auf Der Tag, an der Karte sichtbar.
11. **Doppelklick/Wiederholung** erzeugt nie zweiten KV, Versand, Auftrag oder Wareneingang (clientEventId/Receipt wie im Bestand).

## 4. Abnahmefälle (Codex baut sie als echte Replay-DB-Tests; Assertions nicht ändern)
- KV-01 Eingangstext „Schmidt, 4 Weber-Trompeten verchromen, KV, in zwei Wochen“ → KV-Entwurf: Kunde Schmidt (Treffer), 1 Position 4 × Weber-Trompeten · Verchromen, Lieferzeit 2 Wochen, `quelle_intake_item_id` gesetzt, Original verknüpft.
- KV-02 Mail mit Anhangfoto „… die alten Halter bitte erhalten“ → KV mit `quelle_nachricht_id`, Foto als Original, `sonderwuensche` enthält den Halter-Hinweis.
- KV-03 Stunden 8, Satz/Rüst/Material aus Einstellungen → Preis exakt = Formel; Änderung des Stundensatzes in den Einstellungen wirkt auf neue KVs, nicht auf versendete.
- KV-04 Versand → `gesendet_fassung=1`; Änderung danach → `fassung=2`, Status „geändert seit Versand“, Knopf „Geänderte Fassung 2 senden“.
- KV-05 Zusage zu Fassung 1, aktuelle Fassung 2 → Umwandeln gesperrt mit konkretem Knopf.
- KV-06 Zusage aus Antwort-Mail zu aktueller Fassung → Umwandeln mit Ware (4 Stück, Regal E1, 2 Fotos) → genau 1 Auftrag, 1 Wareneingang, Ware im Regal E1, KV `linked_order_id`, Nachricht-Anliegen erledigt; Auftrag erscheint in der Werkstatt unter „Wartet bei Annahme“.
- KV-07 Umwandeln ohne Ware → Auftrag „Ware erwartet“; späterer Wareneingang über Etikett bucht auf diesen Auftrag, kein zweiter Auftrag.
- KV-08 Absage → abgesagt, kein Auftrag, Anliegen erledigt.
- KV-09 Nachfass-Frist überschritten → genau eine Aufgabe auf Der Tag; nach Zusage verschwindet sie.
- KV-10 Doppelklick „Umwandeln“ → 1 Auftrag, 1 Wareneingang.
- KV-11 „Wie beim letzten Mal“ → Positionen kopiert, Ist-Stunden des Vorauftrags angezeigt.

## 5. Fertig heißt
Pflicht-Checks grün, KV-01…11 grün gegen Replay-DB, Sicht der berührten Seiten (Eingang, Nachrichten-Reiter KV, KV-Karte, Umwandeln) im V04-Aussehen. Merge-Bitte mit Preview genau des SHA. Danach prüft der Planungschat den Hauptweg KV-06 selbst auf der Preview mit Testlogin und vergleicht jede Ansicht mit der V04-Vorschau (gleiche Fenstergröße).
