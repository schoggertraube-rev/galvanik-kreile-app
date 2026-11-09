# AP-BELEG-AUTO - Arbeitsstand, noch keine Abnahme

## Massgeblicher Stand 09.11., 08:58

Produktstand vor dieser Fortschreibung: e212310e auf codex/beleg-auto-main, frisch von main 0e85c86a. Eigene BA-Commits wurden uebernommen; Main-Akteur-Leser, Felder und Anzeigen bleiben erhalten. Altzweig gesichert. Scope und Typpruefung PASS. Die folgenden aelteren Abschnitte sind historische Teilnachweise, keine aktuelle Fertigmeldung.

Umgesetzt: sichere automatische Ablage im vorhandenen Rechnungswriter, Ruecknahme/Neuablage derselben Zeile, eindeutige identische Originale anhaengen, Nachrichten-Hauptaktion/Erkennungsausloesung, optionale Bemerkung/Person/Fahrzeug mit bestehenden Listen, JSONB-Retry und bearbeitbare Ablehnung. Keine automatische Zahlung.

BA08: Client und Server erlauben ausdruecklich bezahlt ohne erfundene Faelligkeit. Offen/automatisch brauchen sie weiterhin. Neue Migration 20261109074500_supplier_paid_without_due.sql aendert nur diese Fallunterscheidung; weitere Pflichtfelder/Zahlungsdatum/Originalschutz bleiben. Lokale Abbruchprobe und unveraenderte bestehende Zeilen belegt. Nach Main-Nachzug echter Action->DB->Ansicht->JSONB-Retry 4,40s PASS; SQL offen-ohne-Faelligkeit/bezahlt-ohne-Nummer weiter abgewiesen. Sieben Editorfaelle 0,879s PASS. Dev-Anwendung siehe Nachweis unten; lokale DB ist genehmigte Branch-Union113.

BA14: Nachweis-Vorbereitung/-Fertigstellung und geworfener Uebertragungsfehler bleiben im Dialog, gleiche Datei/Kennung und Eingaben erhalten. Fehler einschliesslich Suche/Rueckkehr/Oeffnen nutzen vorhandenen Situationskatalog, technische Ursachen bleiben im Log. Drei gezielte Nachweis-Retryfaelle 0,687s PASS. Keine Assertion entfernt, Netzwerkfall ergaenzt.

Offen, NICHT mergefaehig: BA09 Zahlungsart-Hinweis/Datum, BA10 unsichere Dublette anderer Aussteller, BA11 neues Foto am selben Eingang (gesammelte Produktfrage08:49 an PL). BA12 kein vorhandener Export-/Abschlussstatus; kein neuer Export gebaut. Ausserdem finaler Sichtlauf, exakte READY-Preview, Pflicht-CI, unabhaengiges PL-PASS. Zwei andere PRs offen, kein neuer PR. Keine echte OCR/Provider/Kamera als getestet ausgegeben, isolierte TEST-Fixtures.

## Dev-Migrationsnachweis 09.11., 09:19

Auf dem nach BAUREGELN Abschnitt4 ausdruecklich freigegebenen Dev-Testsystem wurde ausschliesslich die bereits lokal gepruefte, committed-bytegleiche neue Nachfolgemigration74500 angewandt. Vorher Abbruchprobe; danach vorhandene Rechnungen/Auftraege/KVs/Eingaenge/Ereignisse/Firmendaten/Reklamationen im selben Repeatable-Read-Lauf unveraendert. Kein Produktionszugriff und keine vorhandenen Daten geaendert/geloescht.

Dieser Branch hat106 Migrationen, Dev109. Keine fehlt. Die3 zusaetzlichen Dev-Migrationen sind bereits angewandte andere freigegebene Pakete: RM-Fotovorlage8222500, Ausgangsfristen9003000 und Paket-Warenhinweis9042000. Nur diese explizite angewandte Union ist gleich Dev; weder Einzelbranch-Paritaet noch die Anwendung anderer lokaler Reserve-Migrationen wird behauptet.

```json
{
  "devOnly": true,
  "version": "20261109074500",
  "sha256": "60b8ad884f20c0a51fb88b3c23bfe2e515133bf6bb68f62efcd83ec6f5caa3d2",
  "abortProbe": "PASS",
  "existingDomainUnchanged": true,
  "counts": {
    "public.supplier_invoice": 0,
    "public.orders": 15,
    "private.quotes": 2,
    "public.intake_item": 37,
    "public.intake_event": 122,
    "public.events": 497,
    "public.company_settings": 1,
    "public.complaints": 0
  },
  "repoCount": 106,
  "devCount": 109,
  "repoEqualsDev": false,
  "devOnlyVersions": [
    "20261108222500",
    "20261109003000",
    "20261109042000"
  ],
  "missingRepoVersions": [],
  "qualifiedAppliedUnionEqualsDev": true,
  "unappliedOtherBranchMigrationsNotClaimed": true
}
```

## Historische Teilnachweise

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

Mechanischer Nachzug am selben Schritt: erfolgreiche Direktablage räumt den bestehenden Rechnungs-Hash weg und nutzt den aktuellen Refresh-Callback ohne erneutes Öffnen durch einen Eltern-Render. Netzwerkfehler erhalten den Versuchsschlüssel; sichtbarer Erneut-Knopf ruft denselben Ablauf auf. Gezielt um Eltern-Render ergänzt, keine bestehende Assertion entfernt.

## BA02 – Rückgängig und erneute Ablage

Der bestehende Statuswriter erhält die expliziten Befehle undo/rebook. Rücknahme nur für offene unbezahlte Ablage, mit Grund und Version; gleicher Schlüssel liefert denselben Beleg. Bestehende supplier_invoice bleibt als ungültige, neutrale Buchung erhalten; intake_event enthält vollständiges Vorher/Nachher und tatsächlichen Akteur, Original bleibt unverändert. Das Rechnungsanliegen wird wieder offen. Erst nach diesem nachgewiesenen Rücknahmeereignis sind Ergänzungen und erneute Ablage zulässig, auf derselben kanonischen Rechnungszeile mit neuer Version und erneutem vollständigem Ereignis. Kein Delete, keine zweite Rechnung und kein Schattenstatus.

Direkt nach automatischer Ablage bietet der bestehende Erfolgstoast Rückgängig. Danach wird die Quelle erneut gelesen und derselbe Rechnungseditor zur Ergänzung geöffnet. Auch die gespeicherte offene Rechnung hat den expliziten Rücknahmeweg mit Grund. Unveränderte erkannte Kerndaten sind vor Rücknahme schreibgeschützt.

Echter BA02 Replay PASS4,58s: Anlage→Rücknahme→offenes Quellanliegen→Original/Ansicht→Ergänzung→erneut offen gebucht, eine Rechnungszeile, beide historischen vollständigen Vorher/Nachher-Belege, tatsächlicher Akteur, beide Wiederholungen ohne weitere Zeile. Erste Abweichung war nur Testunterschied zwischen fehlendem und explizit falschem canRebook; Vertrag jetzt einheitlich boolean, keine Prüfung abgeschwächt. Zwei UI-Fälle einschließlich doppeltem Rückgängig-Klick und tatsächlichem Neulesen PASS. Typen/gezielter Lint grün. Weiterhin kein voller Paket-PASS vor Dubletten/Erkennungsauslösung/Preview/CI/Planungsprüfung.

## BA04 – Original an vorhandenem Beleg

Der vorhandene saveIncomingInvoiceAction verwendet für die neue Dublettenstrecke attachOriginal:true. Sicher erkannte Aussteller-/Nummeridentität (ohne Nummer: Datum und Brutto), bestätigter kanonischer Lieferant, eindeutiger vorhandener Beleg und Original-SHA-Beleg werden serverseitig erneut geprüft. Mehrdeutige Treffer bleiben sichtbar ungeklärt. Keine zweite supplier_invoice-Zeile: nur ein Originalverweis im bestehenden intake_event, bestehende Rechnung bekommt die nächste Version; Beträge/Zahlstatus bleiben unverändert. Historische Verträge bleiben kompatibel, die neue Oberfläche nutzt ausschließlich die neue Verknüpfung für Dubletten.

Der Rechnungsleser folgt dem vorhandenen Vorgangsverweis und zeigt Originale aus beiden Quellen. Jedes Original enthält seine tatsächliche itemId und wird mit genau diesem Besitzer geöffnet; kein Verschieben oder Kopieren unveränderlicher Originale. Quellanliegen ist nachvollziehbar abgeschlossen, Wiederholung liefert denselben Verknüpfungsbeleg. Direktablage sagt „Liegt schon · Original am vorhandenen Beleg.“ und bietet ausdrücklich keine Rücknahme der alten Rechnung als irreführendes Zurücknehmen des neuen Fotos an.

Echter BA04-Replay PASS5,10s: eine Rechnung, zwei Originale mit unveränderten Besitzern, Akteur-/Zuordnungsereignis, gleicher Schlüssel ohne zweiten Verweis, erneutes Lesen über Rechnungs-ID und neue Eingangs-ID. Zusätzlich fehlende Nummer: eindeutiger Aussteller/Datum/Brutto-Treffer verweist auf dieselbe eine Rechnung. Neuer UI-Fall PASS2,07s: vorhandener Writer mit attachOriginal, kein zweites Buchen/kein Zwischeneditor/kein falsches Rechnungs-Rückgängig. Typen/Lint grün; Modul-Gate nur fremde DESIGN_POINTER_PAGE_BINDING. Neue Rückgängig-Aktion ist am bestehenden H18-Statuswriter mit echtem BA-Test belegt, keine Ausnahme erweitert.

Noch offen: Erkennungsauslösung, optionale Listen/Zusatzangaben, echte Sicht/Preview/CI/Planungsprüfung. Keine Vollabnahme behauptet.

## Erkennungsauslösung und Nachrichten-Hauptaktion

Im bestehenden Capture löst eine vollständig gesicherte, fertig erkannte Rechnung mit Recht Geld die bereits gebaute einzige Rechnungsroute automatisch aus. Kein Klick auf die Erfassung nötig. Kein Wechsel bei ungesichertem/laufendem Original, Gerätetransfer, nicht gespeichertem Text, fehlendem Recht oder ausdrücklich anderem Erfassungsmodus. Pro Quellversion ein Versuch, keine Schleife. Die Route prüft erneut tatsächliche Server-Readiness; nur dann automatische Buchung, sonst vorhandene Ergänzung.

Nachrichten zeigen „Rechnung {nr} ablegen“, mit sicherem tatsächlichem Nummern-Beleg aus Original/Suggestion. Ohne Nummer nur „Rechnung ablegen“, keine Ersatznummer. Dynamische Texte im zentralen Katalog, bestehender rechnungein-Zielvertrag unverändert.

Zwei neue gezielte Capture-Renderfälle PASS3,38s (Recht Geld/ohne Recht, genau eine bestehende Route, Original bleibt). Echter BA05-Lesetest PASS4,38s (Original→persistierte sichere Nummer→Nachrichtenansicht, keine Schreibnebenwirkung); eigener Modul-Unitfall PASS für dynamische Nummer/fehlende Nummer und denselben Zielvertrag. Bestehende Assertions nicht verändert oder entfernt; nur Fälle ergänzt. Typen/gezielter Lint grün. Kein unbeaufsichtigter Mail-Cron behauptet: die vorhandene Erkennungs-/Erfassungskette ist angebunden.

Offen vor Vollabgabe: optionale Bemerkung/Mitarbeiter/Fahrzeug (gebündelter Vorschlag im BAULOG01:07), endgültige Preview/Sicht/Pflicht-CI/PL-Prüfung. Maximal zwei PRs bleiben eingehalten, kein Merge.

## BA-13: tatsächliche JSONB-Wiederaufnahme

Die bestehenden positiven Wiederholungsprüfungen wurden verschärft: Anlegen, Rückgängig und Neuablage senden nicht mehr dasselbe JS-Objekt erneut, sondern lesen den tatsächlich gespeicherten Command aus `intake_event.nachher.intent` als JSONB und rufen damit erneut die echten Server-Actions auf. Die umsortierte Schlüsselreihenfolge wird explizit nachgewiesen. Beide realen Fälle PASS5,48s, die Ein-Zeilen-/Ereignis-/Ansichtsprüfungen bleiben erhalten. Vorhandene Produktlogik vergleicht strukturierte JSON-Inhalte, keine unsortierten JSON-Zeichenketten; keine Produkt-/Regeländerung nötig. Kein weiterer PR bei zwei offenen Korrektur-PRs.
