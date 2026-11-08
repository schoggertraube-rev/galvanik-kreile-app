# AP-BELEG-AUTO – vorbereitete Server-Lesestelle

Branch codex/beleg-auto, frisch von main d25a35aa. Kein PR (zwei andere PRs offen); keine Auto-Buchung oder Oberfläche gebaut.

Der bestehende getIncomingInvoiceAction/readIncomingInvoice-Leser liefert zusätzlich `view.automation`: `ready`, `incomplete`, `duplicate` oder `stored` mit konkreten fehlenden Belegen. `ready` bedeutet nur fachlich bereit, niemals gebucht. Supplier-Invoice und unveränderte bestehende Writer bleiben die einzige Datenquelle.

Vorbedingungen: gesichertes Original mit identischem SHA-256 im Originalereignis, bestätigte kanonische Lieferantenzuordnung, vollständiger bestehender Invoice-Vertrag einschließlich Fälligkeit, persistierte sichere/bestätigte und widerspruchsfreie Nummer/Datum/Beträge, Netto + MwSt exakt Brutto. Leere Suggestion-Liste wird nicht durch uncertain=0 als sicher ausgegeben. Ein gespeicherter oder doppelter Beleg wird niemals als neuer Buchungskandidat bezeichnet.

Drei gezielte Unitfälle PASS (vollständig/fehlend, widersprüchlich/unsicher/Betrag, gespeichert/doppelt), Typen und ESLint PASS. Modulgrenzen PASS bis auf fremde uncommittete DESIGN_POINTER_PAGE_BINDING. Scope PASS. Kein Schreibweg geändert, kein Replay-Schreibnachweis beansprucht.

Offen: automatischer Aufruf des bestehenden Writers, echte Action→DB→Ansicht-Fälle, Rückgängig/Storno, Originalanhang an Dublette, Nachrichten-Direktablage, Sicht/CI/Preview/PL-Abnahme. Keine neue Migration; gemeinsame Dev-DB enthält zusätzlich die separat dokumentierte RM01-Vorlage (104 statt diesem Main-Stand103). Kein Gleichstand dieses Kandidaten behauptet.


## Echter Lese-Nachweis 08.11. 23:48

`beleg_auto_readiness.integration.test.ts`: echte lokale Replay-DB, tatsächliche Sitzung, bestehende getIncomingInvoiceAction → gespeicherte sichere Felder/Original-SHA/Lieferant → automation ready mit kanonischem Zahlungsziel. Keine supplier_invoice- oder Buchungs-Ereigniszeile entsteht. Zweite widersprechende Nummer und fehlendes Original bleiben unvollständig. Original-Unveränderlichkeit wird ausdrücklich gegen versuchte TEST-Mutation geprüft und bleibt erhalten. PASS5,62s. Vorherige zwei Fehlversuche waren reine Fixturefehler (Lieferanten-Constraint, absichtlich unveränderliches Original); keine Produktlockerung, keine Assertion abgeschwächt. Isolierte TEST-Originalmetadaten belegen die DB-Regel, nicht echte OCR/Storage/Kamera.

## Automatische Ablage im vorhandenen Writer, 09.11.

`saveIncomingInvoiceAction` bleibt der einzige Rechnungs-Schreibweg. Optionales `automatic:true` wird im vorhandenen Besitzer-Writer nach Quellsperre und Wiederholungsbeleg geprüft: tatsächliches kanonisches Original, bestätigter Lieferant, sichere widerspruchsfreie Vorschläge, exakte Beträge, vorhandene Fälligkeitsregel. Der Lesevertrag wurde dafür intern wiederverwendet, nicht dupliziert. Eingereichte Felder müssen exakt dem serverseitigen Lesen entsprechen. Keine automatische Zahlung und keine automatische Lieferanten-/IBAN-Änderung.

Nachrichten-Direktablage über bestehenden rechnungein-Aufruf: bereiter Beleg wird ohne Rechnungs-Editor über denselben Writer gespeichert, anschließend tatsächlich erneut gelesen; erst danach „Erkannt, abgelegt und verbucht.“. Ein gemeinsames laufendes Promise und derselbe Schlüssel verhindern Doppelaufrufe. Unsichere/unvollständige Belege bleiben beim bisherigen Ergänzungsdialog. Keine neue Route, Tabelle oder öffentliche Action.

Echter lokaler BA01/03/06-Replay PASS6,72s: manipulierte Beträge abgewiesen/keine Zeile, danach eine tatsächliche supplier_invoice plus Akteur-Ereignis, identischer Replay ohne zweite Zeile, Original und gespeicherter Beleg erneut gelesen; ohne Geld keine Zeile, widersprüchlicher Betrag keine Buchung. Ein gezielter Renderfall PASS2,27s: direkter Nachrichten-Aufruf, genau ein vorhandener Writer, echtes Neulesen vor Erfolg, kein Zwischen-Editor. Typen und gezielter Lint grün. H18 unverändert90 getestet/59 Ausnahmen, zusätzlicher echter Test zur vorhandenen Aktion, keine neue Ausnahme.

Keine Behauptung vollständiger BA-Abnahme: automatische Auslösung direkt nach Datei-/Foto-/Mail-Erkennung, Rückgängig/Storno, Original-Zuordnung an Dublette, Zusatzlisten, Preview/Sicht/Pflicht-CI/PL-Diffprüfung bleiben offen. Metadaten des Tests sind isolierte TEST-Fixtures, kein echter OCR-/Storage-Erfolg. Keine zusätzliche Migration und keine Einzelbranch-Dev-Parität behauptet (103 Basis, genehmigte fremde RM/SA ergeben Dev105).
