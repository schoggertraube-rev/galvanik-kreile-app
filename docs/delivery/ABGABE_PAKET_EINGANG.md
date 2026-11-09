# AP-PAKET-EINGANG — laufender Bau, keine Merge-Abgabe

## Review-Korrektur 09.11., Nachträge 1–8

Produkt-SHA: `3eeda23b` (einschließlich Registerkorrektur `c142afbd`). Typen, gezielter Lint, Scope, H18 und Whitespace-Prüfung des Produktdiffs sind grün. Der abschließende Dokumentations-Commit und die neue exakte READY-Preview werden nach dem Git-Build getrennt nachgewiesen.

**Noch keine Merge-Bitte:** Alle acht PL-Nachträge einschließlich der Präzisierung PL05:05 sind lokal umgesetzt. Die neue unabhängige Prüfung und die Pflicht-CI am neuen Kandidaten stehen aus.

Punkt7 nutzt denselben offenen KV-Leser mit optionalem Kundenfilter vor dem Limit. Bei zugeordnetem Kunden werden ausschließlich dessen KVs geladen, ohne Zuordnung die globale Liste nur für Ware. Der Erfassungsdialog liest Paket-Erwartungen einmal je Version; der Datei-Abfragezyklus fordert ausschließlich den Erfassungsstand ohne KV-Abfrage an. Das pro Dialog gehaltene Ergebnis wird nur derselben unveränderten Version wieder zugeordnet. Keine zweite Tabelle und kein weiterer KV-Leser.

Neue echte Replay-Prüfung des Kundenfilters sowie die unveränderten PE04/PE06-Fälle: drei PASS5,21s. Tatsächlicher Erfassungsdialog mit Datei-Abfragezyklus und Zuordnungsereignis: genau eine Erwartungsabfrage je Version, weitere Leseaufrufe ohne KV-Abfrage (PASS3,08s). Der erste SQL-Versuch zeigte den tatsächlichen text-Typ der bestehenden customer_id-Projektion; Parameter auf denselben Typ korrigiert. Die unveränderten Kernfälle sind danach grün. Der neue Render-Test initialisiert erst den lokalen Capture-Scope und verwaltet beide vorhandenen Intervall-Callbacks, keine Produktumgehung.

Der neue Phasenleser ist im bestehenden Capability-Register nachgetragen. Dies behebt den einzigen quality-Befund am vorherigen Kandidaten (`EXPORTED_FN_NOT_IN_REGISTRY`); no-fake lokal grün, kein Checker geändert.

- Eine gemeinsame `GoodsInspectionForm` und kanonische Abweichungsgründe einschließlich Gefahr. Keine eigene Zustandsauswahl im Paketeditor. Fotoaktionen öffnen den bestehenden Originalweg.
- `canReadQuoteForGoods` vereinheitlicht die beiden Warenleser. Der U249-Zweck erlaubt weiter aktiven Logins die bestehenden operativen Entscheidungen ohne Geldzugriff; finanzielle Leser bleiben getrennt.
- Browser und OrderIntake importieren den reinen Zahlungs-Vertrag direkt. Der Server-Re-Export entfällt.
- Erwartete Aufträge kommen aus `v_intake_expected_goods_v1`; die additive Migration ergänzt Grund und Stornokennzeichen.
- Teilphasen heißen `QUOTE_ONSITE_PHASE_V04`, der Root behält seinen Ereignistyp. „Stand neu lesen“ liest tatsächliche, loginbezogene Phasenbelege und den Entwurf. Bereits gebuchte Fakten bleiben gesperrt; lokale ungebuchte Mengen bleiben erhalten.

Neun echte Replay-Fälle für Vor-Ort-Rundweg, Phasenlesen, Rechte und Paketmehrdeutigkeit: PASS13,12s. Neue gemeinsame Gefahr-/Konflikt-Renderfälle PASS3,76s; Mengenbestätigung und Bearbeitung im gemeinsamen Formular PASS3,55s. Die bestehende Assertion „Angenommene Menge · TEST Teil“ verwendet jetzt das gemeinsame Formular: „Inhalt“ öffnen → „geliefert“. Ihre Prüfungen auf Bearbeitbarkeit und den tatsächlichen Wert1 bleiben erhalten. Keine übrige fachliche Assertion entfernt. Typen, gezielter Lint, Scope und H18 sind grün; die neue Lese-Action ist mit echtem DB-Test klassifiziert, keine zusätzliche Ausnahme.

Migration `20261109042000`: SHA256 `2b44ed2b0b8ad62ffb0715ba50d81c8d83ffdf8cc3b83ba20b218cb93ff29469`. Lokal und auf der freigegebenen Dev mit Abbruchprobe angewandt. Acht Domänentabellen blieben unverändert. Seit der nachfolgenden freigegebenen BA-Migration hat Dev108 Migrationen, gleich der freigegebenen Union; dieser Zweig hat105, die drei weiteren gehören RM, R2 und BA. Kein falscher Branch-Gleichstand behauptet.

Lokales Modul-Gate ist ausschließlich wegen33 vorhandener ignorierter Referenzbilder zusätzlich zu den162 Sollbildern rot (`DESIGN_POINTER_PAGE_BINDING`). Diese fremden Dateien und der Checker bleiben unverändert; der normale Gitbaum wird in CI geprüft. Noch keine CI-/READY-Behauptung für diesen neuen Kopf. Der früher geprüfte READY-Stand b0854515 ist ein Vergleichsstand und keine Vorschau dieser Korrektur.

Frisch von Owner-main d25a35aa, Branch codex/paket-eingang. Nur der freigegebene Paket-Durchstich, kein Umbau des allgemeinen roten Plus. Seitenhoheit bindet Durchstich_KV_2026-11-08b; der ältere Dateiname im Paketkopf ist im BAULOG gemeldet.

## Fertiger Schritt PE-04 und Anschluss PE-02

Echte historische Auftragspositionen und offene KVs liefern höchstens drei Kunden als Vorschläge bei unbekanntem Absender. Ganze Wortbestandteile, keine geratenen Zuordnungen; Kunden- und Auftragsrecht erforderlich. Fachliche Daten bleiben ausschließlich in bestehenden Kunden/Aufträgen/KV/Eingangszeilen. Der Klick nutzt den vorhandenen assignIntakeCustomerAction, stabile Kennung und Version, danach getIntakeCaptureAction. Doppelklick gesperrt, Wiederholung erzeugt kein zweites Ereignis. Der bestehende Fallback „Ablegen · Absender klären“ bleibt.

Die offene-KV-Abfrage im Client entfällt: dieselbe Capture-Antwort enthält eine Serverprojektion der echten KV-Fassung/Zusage und erwarteter Aufträge. Besitzerports werden nur in der vorhandenen App-Action orchestriert, nicht quer zwischen Modulen importiert. Keine neue Server-Action, Tabelle oder Migration. Bei Lesefehlern bleibt das Original erreichbar und der Fehler sichtbar; „nichts erwartet“ wird daraus nicht erfunden. Rechteeinschränkung: ohne Geldrecht keine KV-Finanzleser; die vorhandenen Auftragsleser bleiben maßgeblich.

Nach einer frischen Warenannahme zum noch nicht zugesagten KV öffnet sich direkt der vorhandene KV-Mailentwurf mit bestehender PDF-Anbindung. Kein automatischer Mailversand. Derselbe QuoteCard-/CommunicationPanel-Weg und derselbe Versandwriter; ohne echtes KV-Bearbeitungsrecht kein Entwurf. Ein bestehender Source-Suffix bleibt von dem engen #send-Navigationsintent getrennt.

## Nachweise

PE-04: echter Replay-DB-Test legt über den vorhandenen OrderIntake-Writer einen TEST-Auftrag an, erfasst ein Paket über saveIntakeNoteAction, liest unverbindliche Kundenvorschläge und NULL-Zuordnung aus DB; wählt den Kunden über bestehende Action, prüft DB und genau ein Login-Ereignis, wiederholt dieselbe Kennung und liest Capture samt Kunde neu. PASS5.53s nach Grenzkorrektur. Eine mechanische falsche Action-Bezeichnung wurde berichtigt, keine Assertion abgeschwächt. Isolierter TEST-Tenant, keine Dev-Altzeilen geändert.

Sechs gezielte IntakeSituation-Renderfälle grün, einschließlich expliziter Historienauswahl/Fallback und sichtbarem Lesefehler; zwei PE-02-Renderfälle grün: Entwurf öffnet und sendet nicht selbst, ohne Recht kein Composer. Typprüfung zuletzt grün; Lint/Scope/H18 und CI werden am Kandidaten dokumentiert. H18 unverändert 149 Schreibwege/90 getestet/59 Ausnahmen, keine neue Ausnahme.

## Noch offen

PE-01/03/05/06 vollständige Paketabnahme und UI-Anschluss des bereits vorhandenen receiveOnsiteQuoteAction, Nacharbeit-Rücksendung, tatsächlicher Foto-/Datei-Sichtlauf und exakte READY-Preview. Quote-Leser liefert aktuell die bestehenden bis 100 offenen KVs: keine Zusicherung vollständiger Archivsuche. Ungeklärter Foto-Wortlaut: Paket nennt Zustandfoto optional, vorhandener GoodsContract fordert Etikett/Inhalt/Packstückprüfung. Vorschlag beim PL: Zustandszusatzfoto optional, vorhandene Pflichtbelege nicht abschwächen. Keine Änderung dieser Pflicht implementiert.

Modul-Gate meldet lokal nur die fremde uncommittete Designbindung DESIGN_POINTER_PAGE_BINDING, eigene Grenze korrigiert und nicht gelockert. Fremde Planungsdateien werden nicht gestaged. Draft, keine Owner-Merge-Bitte, keine vollständige Paket- oder Livefähigkeitsbehauptung.

## Fortschreibung 08.11.22:34

Historische KV-Kunden stammen jetzt aus einem engen, betragsfreien Besitzerport mit echter, integritätsgeprüfter KV-Historie einschließlich geschlossener KVs. Keine Begrenzung auf die 100 offenen KVs für die Historienvorschläge. Im echten PE-04-Fall zusätzlich einen KV angelegt und abgelehnt: sein Kunde bleibt als unverbindlicher historischer Vorschlag erhalten, während der Auftrag-Kunde ebenfalls korrekt angeboten wird; endgültiger Fall PASS5.90s.

PE-06 Kandidaten-/Rechtenachweis: zwei echte KVs angelegt, tatsächlichen Druckversand und jeweilige aktuelle Zusage gespeichert; derselbe Paketleser liefert beide als mehrdeutig und legt keinen Auftrag an. Capture-Login mit ausschließlich Eingang erhält weder fremde erwartete Aufträge noch Kunden/KV-Kandidaten. PASS6.85s. Ein Testfixture wurde mechanisch um die fachlich nötige vorausgehende Versandhandlung ergänzt; keine produktive Annahmevoraussetzung gelockert. Dies ist PE-06 aus der Fallliste (mehrere KVs), noch nicht der NEW-Onsite-UI-Anschluss aus Weg 6/PE-05.

Die bestehenden neuen Renderfälle und echte DB-Zuordnung bleiben getrennt vom noch offenen vollständigen Foto-/Datei-Sichtlauf. Keine Abnahme durch bloße gemockte UI-Writer behauptet.

## Fortschreibung 08.11.22:37

Betragsfreie operative KV-Kandidaten verwenden jetzt denselben bestehenden Werkstatt-Lesezweck (Aufträge/Leitstand) statt Finanzleserecht. Der echte PE-06-Test prüft zusätzlich den Werkstattlogin ohne Geld: beide zugesagten KVs sichtbar, keine Preisfelder; der Login nur mit Eingang sieht weiter keine Kandidaten. PASS6.99s. Kein neues Rollen-/Sessionmodell.

CI fand W4_READ_PORT_CONTRACT: neuer SQL-Standort quoteReads.ts war nicht als View-Lesestelle registriert. Ein Fix: wie die dort bereits reexportierten vorhandenen Leser liegt die Implementierung nun beim vorhandenen registrierten Quote-Owner quoteCommands.ts; quoteReads bleibt die öffentliche Lesegrenze. Kein Gate/Inventar erweitert oder abgeschwächt. Lokaler W4-Vertrag grün (683 Dateien/39 Leseports), Typprüfung und gezielter Lint geprüft. Die Änderung verändert weder SQL noch Leserecht.

## Fortschreibung 08.11.22:46

Erwartete Rücksendung zur Nacharbeit wird aus dem vorhandenen kanonischen Auftragsursprung als solche bezeichnet. Der gebündelte Core-Leser fragt dieselben gespeicherten Waren-/Kunden-/Auftragsfakten und entfernt zurückgenommene Aufträge vor der Begrenzung. Keine neue Erwartungsablage. Der vorhandene echte Nacharbeit-/Rücknahmefall wurde um Capture-Neulesen ergänzt: Nacharbeit erscheint als rework, nach der echten protokollierten Rücknahme nicht mehr als erwartete Ware (PASS6.36s); sämtliche bisherigen Assertions bleiben erhalten. Die Nacharbeits-/Auftragshistorie wird dadurch nicht gelöscht.


## Fortschreibung 08.11. 23:29

Der optionale Knopf „Ware fotografieren · Zustand bei Annahme“ benutzt dieselbe vorhandene Inhaltskamera bzw. denselben PC→Handy-Fotoweg. Kein zusätzlicher Uploadwriter, keine zweite Fotoablage; Etikett/Inhalt/Packstückprüfung bleiben unverändert Pflicht. Fünf gezielte QuoteGoods-Renderfälle PASS; optionaler Kameraaufruf speichert oder konvertiert für sich keinen Vorgang. Texte aus QUOTE_PHOTO_COPY.

Am bisherigen Kandidaten 116a4013 waren alle acht GitHub-Checks grün. Der neue optische Schritt benötigt neue CI/Preview; nicht als fertiges Paket ausgegeben. PE05-Ergänzungsebene für noch fehlende Neukunden-/KV-Angaben ist beim PL mit Wiederverwendungs-Vorschlag gebündelt, kein selbst erfundenes Plus-Formular.

Gemeinsam genutzte Dev-DB: inzwischen 104 Migrationen durch die ausdrücklich additive RM01-Vorlage auf dem vorbereiteten Branch codex/reklamation-mail. Dieser PE-Branch hat weiterhin 103, keine eigene Migration; Differenz genau 20261108222500_complaint_photo_request_template.sql. Für diesen SHA wird deshalb KEIN Repo=Dev-Gleichstand behauptet. Bestehende Vorlagen/Daten unverändert, RM-Abbruchprobe/Gleichstand auf seinem Branch belegt. Vor einer abschließenden Merge-Abgabe muss die gemeinsame Abhängigkeit sauber eingebunden werden.


## Ein gezielter Sicht-Fix 08.11. 23:42

Echter read-only Preview-Lauf ae48af4b, Rolf, 1220/390: zwei bestehende Kamerafelder, Quelle/KV-Version unverändert und kein Warenbeleg entstanden. Die neue zusätzliche Kamera-Schaltfläche war optisch doppelt. Ein Fix: zusätzlichen Knopf entfernt; dieselbe vorhandene Inhaltskachel bietet nach dem ersten gesicherten Inhaltsfoto das zusätzliche optionale Zustandsfoto an. Vorher bleibt der Pflicht-Inhaltsbeleg eindeutig. Fünf gezielte Renderfälle PASS einschließlich vorhandener Originalauswahl, genau zwei Kamera-Inputs, kein Save/Convert. Ein mechanischer Testselektor wurde an den bestehenden Katalogtext angeglichen, keine Assertion abgeschwächt.

Bildpaar des Vor-Fix-Kandidaten außerhalb Repo: `%TEMP%/kreile-pe-readonly-ae48af4b/quote-goods-{1220,390}.png`; ausdrücklich kein finales Bildpaar des neuen SHA. Vollständiger Foto-Upload/PE05 weiterhin offen. Keine erneute Gesamtsicht-Schleife.


## PE05 nach PL-Freigabe 09.11. 00:01 gebaut

Im selben Capture erscheint bei nicht zugeordnetem Paket ohne angekündigten Vorgang die freigegebene Ergänzungsebene. KundeFormular wird wiederverwendet; der unveränderte vorhandene KV-Positionseditor ist in eine gemeinsame Komponente extrahiert und wird von beiden bisherigen/neuen Stellen genutzt. Kein separat gespeicherter Kunde, keine zweite Auftragsanlage. Tatsächliche Kunde-/Dublettensuche, explizite Zusage, Kundenzahlung über denselben paymentContract, zwei gesicherte Fotooriginale mit getrennten Rollen, Lager/Packstücke und bestätigter Termin sind vor Buchung erforderlich. Neue Angaben bleiben leer bis erfasst/erkannt; keine erfundenen Beträge/Arbeitszeiten.

Vor dem ersten Geschäftsschritt liegt der vollständige Root-Request im bestehenden privaten Entwurfsspeicher. Danach genau ein Aufruf receiveOnsiteQuoteAction; Doppelklick gesperrt, unklarer Ausgang behält denselben unveränderten Request. Schließen eines begonnenen Versuchs lässt den gespeicherten Entwurf auf Der Tag; „Weiter bearbeiten“ stellt Capture und denselben Root wieder her. Erfolg öffnet den tatsächlichen Auftrag; bestehender Entwurfsabschluss bleibt mit Ereignis nachvollziehbar. Originale bleiben an ihrem Eingang.

Zwei echte Replay-Fälle (bestehender/neuer Kunde) ergänzt um tatsächliche Draft-Action und Wiederlesen, danach ursprüngliche Kunde/KV/Ware/Auftrag/Idempotenz/DB/Karten-Assertions unverändert und Draft-Abschluss mit tatsächlicher gespeicherter Version: PASS9,95s. Ein mechanischer Fixturefehler nahm Draft-Version1 an; durch die tatsächliche Serverversion ersetzt, keine Assertion abgeschwächt. Zwei neue Renderfälle PASS: Öffnen/fehlende Angaben erzeugt keine Kunden-/Geschäftszeile; gespeicherter Request über Fehler/Doppelklick/Retry identisch, Erfolg öffnet exakten Auftrag. Bestehende89 GlobalCreate-Renderfälle PASS; ein unhandled Timer stammte aus fehlender Promise im neuen Test-Doppel, mechanisch korrigiert und neue Fälle danach fehlerfrei. Kein weiterer lokaler Gesamtlauf.

Die frühere PE05-Rückfrage ist durch PL00:01 erledigt. Neuer Kandidat wird gepusht und erhält neue CI/READY-Preview; vollständige Abnahme/Sicht am neuen SHA und Planungs-Diffprüfung noch erforderlich. Kein Merge.

## Unabhängiger Prüfer: Korrekturen in Arbeit

Punkt 1: gemeinsamer browsergeeigneter Canonical-JSON-Helfer für die Vor-Ort-Kennung und den vorhandenen Entwurfsvergleich. Echter Replay speichert den Entwurf als JSONB, liest ihn neu und wiederholt die Buchung mit diesem tatsächlich umsortierten Objekt (EXISTING und NEW). Dabei zusätzlich reale zweite Ursache gefunden: die Kalkulationsnormalisierung verbreitete die ursprüngliche Schlüsselreihenfolge per Spread in den alten KV-Fingerprint. Jetzt explizite, feste Kalkulationsfelder; bisherige normale Feldreihenfolge bleibt erhalten. Beide echten Fälle grün (7,12s), geänderter Inhalt bleibt CONFLICT.

Punkte 4/5/6/9: NaN-/Ganzzahl-Preisprüfung im Paketeditor; dieselbe vorhandene KV-Rechteableitung aus den App-Actions extrahiert und auch für die Erwartung genutzt; reine Zahlungsregel über öffentlichen Domainpfad (alter Serverpfad re-exportiert, keine zweite Regel); gemeinsame Teile-Wortauswahl im Domainhelfer, keine Rückabhängigkeit vom KV-Modul zum Auftragsleser. Typprüfung grün; erster Lint fand einen unzulässigen Typ-Tiefimport, durch strukturelle Rückgabetypinferenz ohne zweiten Vertrag behoben. Restliche Prüferpunkte sind noch offen, keine Abnahme.

### Weitere Fehlerauswege und Darstellung (noch Draft)

- Validierungsablehnung entsperrt die vorhandenen Eingaben; erneute Erkennung darf diese beim Entsperren nicht überschreiben. Unklarer Ausgang hält die Kennung fest. Der eigene Entwurf kann mit einem Grund über denselben Entwurfswriter verworfen werden; Grund und echter Login stehen im vorhandenen Ereignis, Original bleibt erhalten. Reale Draft/DB/Ereignis/Neulesen-Probe mit JSONB-Wiederaufnahme vor der ersten Buchung und nach Abschluss: beide Kundenarten PASS6,68s. UI: Validierung bearbeitbar, kein roher Servertext, Verwerfen nur mit Grund; gezielter Fall PASS3,52s.
- Abweichung ist im Paketeditor auswählbar; Gründe und zusätzliches gesichertes Abweichungsfoto gehen in den vorhandenen Warenvertrag. Die notwendige Klärung einer Warenabweichung wird nicht übersprungen. Der vollständige Fortsetzungsweg bei bereits angelegtem Kunde/KV und späterer Ablehnung ist beim PL angefragt; Punkte 2/3 deshalb ausdrücklich noch nicht vollständig abgenommen.
- Versandabsicht und Quell-Eingang sind getrennte Parameter. Bestehende Links bleiben lesbar; beim Öffnen des KV-Versands bleibt der echte Quell-Eingang erhalten. Gezielter Parameter-/Kompatibilitätstest grün.
- Positionstexte und berührte Zuordnungsfehler liegen im zentralen Situationskatalog. Vorhandene Tests behalten ihre fachlichen Aussagen; die frühere Rohfehler-Assertion ist ersetzt durch die nutzerlesbare Katalogmeldung plus expliziten Ausschluss der internen Meldung.

Keine Merge-Reife: offene PL-Entscheidung zu Teilzuständen nach Ablehnung, unabhängiges Review, CI und neue exakte Preview/Sicht fehlen noch. Es wurde kein neuer Kunde/Schreibweg als Ersatz für die Wiederaufnahme eingebaut.

## Phasenfortsetzung nach verbindlicher PL-Entscheidung 09.11. 03:05

Die Root-Kennung bleibt stabil. Bereits gebuchte Kunden-, KV- und Waren-/Auftragsphasen haben eigene kanonische Inhaltsbelege im vorhandenen Ereignisjournal. Inhaltsänderungen einer gebuchten Phase ergeben CONFLICT; ungebuchte Folgeschritte können korrigiert werden. Wiederaufnahme verwendet die vorhandenen Kunden-/KV-Belege und deren IDs, ohne neue Datensätze anzulegen. Warenannahme und tatsächliche Auftragskonvertierung besitzen getrennte Belege, damit eine bereits gespeicherte Warenannahme beim späteren Zahlungsfehler nicht still verändert wird.

Der bestehende Entwurf hält die tatsächlichen Kunden-/KV-IDs und den bestätigten Phasenstand. Nach Wiederaufnahme bleiben Kunde/KV gesperrt; der vorgeschriebene Du-Satz nennt den echten Kunden und die KV-Nummer. Kundenkarte und KV sind über die vorhandenen Wege erreichbar. Nur noch ungebuchte Warenmengen und ihre Abweichungsgründe bleiben änderbar; bereits gebuchte Warenfelder sind gesperrt. Ein Validierungsfehler erzeugt keine neue Root-Kennung. Verwerfen mit Grund entfernt nur den eigenen Entwurf; Kunde und offener KV bleiben erhalten.

Echter EXISTING/NEW-Replay: gespeicherter JSONB-Entwurf -> Ablehnung nach Kunden-/KV-Anlage wegen unvollständiger Mengenabweichung -> IDs/Anfrage erneut als Entwurf speichern und lesen -> Menge korrigieren -> zweite echte Ablehnung nach Warenannahme wegen unzulässiger Zahlungsart -> richtige Zahlungsart unter gleicher Root-Kennung -> Erfolg und Retry. NEW ausdrücklich genau ein Kunde, ein KV und ein Auftrag; kein Löschen/keine neuen Ersatzobjekte. Zusätzlicher Renderfall zeigt gesperrten gebuchten KV, bearbeitbare angenommene Menge und tatsächlichen Kundenkarten-Link. Typprüfung und gezielter Lint grün. Neue CI/Preview und unabhängiges PL-Review werden exakt am neuen Kopf geprüft; kein Merge.
