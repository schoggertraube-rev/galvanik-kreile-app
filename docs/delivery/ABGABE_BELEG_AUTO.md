# AP-BELEG-AUTO – vorbereitete Server-Lesestelle

Branch codex/beleg-auto, frisch von main d25a35aa. Kein PR (zwei andere PRs offen); keine Auto-Buchung oder Oberfläche gebaut.

Der bestehende getIncomingInvoiceAction/readIncomingInvoice-Leser liefert zusätzlich `view.automation`: `ready`, `incomplete`, `duplicate` oder `stored` mit konkreten fehlenden Belegen. `ready` bedeutet nur fachlich bereit, niemals gebucht. Supplier-Invoice und unveränderte bestehende Writer bleiben die einzige Datenquelle.

Vorbedingungen: gesichertes Original mit identischem SHA-256 im Originalereignis, bestätigte kanonische Lieferantenzuordnung, vollständiger bestehender Invoice-Vertrag einschließlich Fälligkeit, persistierte sichere/bestätigte und widerspruchsfreie Nummer/Datum/Beträge, Netto + MwSt exakt Brutto. Leere Suggestion-Liste wird nicht durch uncertain=0 als sicher ausgegeben. Ein gespeicherter oder doppelter Beleg wird niemals als neuer Buchungskandidat bezeichnet.

Drei gezielte Unitfälle PASS (vollständig/fehlend, widersprüchlich/unsicher/Betrag, gespeichert/doppelt), Typen und ESLint PASS. Modulgrenzen PASS bis auf fremde uncommittete DESIGN_POINTER_PAGE_BINDING. Scope PASS. Kein Schreibweg geändert, kein Replay-Schreibnachweis beansprucht.

Offen: automatischer Aufruf des bestehenden Writers, echte Action→DB→Ansicht-Fälle, Rückgängig/Storno, Originalanhang an Dublette, Nachrichten-Direktablage, Sicht/CI/Preview/PL-Abnahme. Keine neue Migration; gemeinsame Dev-DB enthält zusätzlich die separat dokumentierte RM01-Vorlage (104 statt diesem Main-Stand103). Kein Gleichstand dieses Kandidaten behauptet.
