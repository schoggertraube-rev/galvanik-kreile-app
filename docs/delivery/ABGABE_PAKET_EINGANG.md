# AP-PAKET-EINGANG — laufender Bau, keine Merge-Abgabe

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
