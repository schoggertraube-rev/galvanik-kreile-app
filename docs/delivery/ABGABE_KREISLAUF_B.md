# Kreislauf B — hohe/mittlere Regeln und AF19

**Draft, nicht mergefähig.** Paket `_review/pakete/AP-KREISLAUF-REGELN.md`, erlaubter Teil B. Eigener Branch frisch von main e8aff802; keine gestapelte Produktwahrheit. Restfälle des Pakets bleiben ausdrücklich offen.

## Aktueller Nachweis 08.11., 21:00

Produktkandidat d714885c4a6417b9edbec6b72d0ed431a55d0ea8, READY-Preview genau dieses SHA: https://galvanik-kreile-werkstatt-kbvyniyqv.vercel.app. #201 ist durch die Owner auf main ba6e0d94 gemergt und in B vollständig integriert. Umgeschriebene Remote-Historie wurde vermieden: die geprüfte Integration liegt als normale Folgecommits einschließlich main-Vorgänger vor; alle alten B-Fixcommits bleiben erhalten. Ein lokaler Sicherheitszweig bewahrt zusätzlich den Stand vor Integration. Alle 14 fremden Reviewdateien sind bytegleich zurückgesichert.

Echter aktueller Migrationsgleichstand: **Repo102 = Dev102**, keine weiteren Versionen; vorherige Angaben zur nur gemeinsamen A+B-Liste sind historische Zwischenstände. Abbruch-/Anwendungsbeleg zur neuen Migration und anschließender reiner Paritäts-Read getrennt erhalten. Alle zuvor vorhandenen Zeilen unverändert. 18 Integrationsfälle: 17 sofort grün; der eine U249-Gegenfall fand die neue Mail-Berechtigungsprüfung vor dem bisherigen NOT_FOUND-Vertrag. Ein gezielter Fix im Eingangs-Leseport stellt den Vertrag vor der Mailprüfung wieder her, unveränderter Test PASS5.59s. Keine neue Mailfreigabe, kein Assertionsabbau. Vier zusammengeführte AF3/4/5/18-Renderfälle PASS3.50s. H18:312/149/90/59, Scope/Typen/Lint/Diff grün.

Normaler bestehender Dev-Auftrag auf dieser echten Preview mit Rolf read-only bei1220 und390 geöffnet; gespeicherte Übergabe „Versand · DPD“ sichtbar, keinerlei Test-/Kundendaten verändert. Screenshots und proof.json außerhalb des Repos unter Temp/kreile-af19-sight-20261108. Keine erfundene Liveprüfung der Sonderzustände: die sind durch echte Replay-DB und gezielten Render belegt. Ein anschließender Darstellungsnachtrag nutzt für die Überschrift die bereits vorhandene kr-naechste-t-Klasse, keine neue Oberfläche.

Pflicht-CI läuft am Kandidaten; Ratchet und Vercel sind bereits grün, quality/agentur/Fresh/h16 zum Nachweiszeitpunkt noch offen. Deshalb bleibt #202 Draft; keine Merge-Bitte. Der abschließende exakte Git-Kopf und dessen Preview/Checkliste stehen im PR, sobald das reine Abgabefortschreiben und der Überschriftennachtrag gebaut sind. Nachfolgende Abschnitte sind zeitlich entstandene Einzelbelege, nicht zusätzliche Produktwahrheiten.

## AF-7: Termin aus dem KV

Der vorhandene Umwandlungs-Preflight weist einen abweichenden Clienttermin ab, bevor Reservierung, Auftrag oder Wareneingang geschrieben werden. Positiver Weg liest weiterhin denselben echten KV-Termin. Bestehender KV-07-Replayfall um die Gegenprobe erweitert: fremdes Datum → VALIDATION_ERROR, keine Reservierung/kein Auftrag; danach ursprünglicher positiver Waren-/Zusage-/Umwandlungsweg unverändert. Beide Varianten (versendet und vor Ort) PASS 7,03 s. Keine Assertion abgeschwächt, keine neue Terminlogik.

## AF-11: Gutschrift und Nacharbeit verschwinden beim Wiederöffnen nicht

Wiederöffnen behält Betrag und Nummer einer tatsächlich erteilten Gutschrift. Eine zweite Gutschrift bzw. deren erneute Vorbereitung wird mit konkreter Nummer abgewiesen. Eine spätere Ablehnung eines neuen Sachverhalts löscht den alten Betrag ebenfalls nicht. Der vorhandene Rework-Writer verhindert bereits eine zweite Nacharbeit; die alte Auftragsreferenz bleibt beim Wiederöffnen erhalten.

Neue additive Migration `20261108164501_complaint_reopen_history.sql` schreibt ausschließlich den bestehenden Trigger fort: Wiederöffnen verlangt unveränderte Gutschriftwerte; einmal erteilte Gutschriftwerte und bestehende Nacharbeitsreferenz sind danach auch gegen direkte SQL-Änderungen geschützt. Alle übrigen Tenant-/Identitäts-/Versions-/Übergangsprüfungen und geschlossenen Grants bleiben erhalten. Keine Tabelle oder Zeile gelöscht.

Echter bestehender Replayfall erweitert: tatsächlich gefertigter und übergebener Auftrag → Reklamation → Entscheidung/Gutschrift → Abschluss ohne Mail mit Vermerk → Wiederöffnen → alte 50,00 € / GS-TEST-REST sichtbar → zweite Vorbereitung und zweite Buchung abgewiesen → neue Ablehnung → alte Gutschrift unverändert → historischer Retry, ein ursprüngliches Ereignis, aktuelle Ansicht neu gelesen. PASS 5,77 s. Der bisherige SQL-Trigger verlangte das Löschen der Gutschrift; die neue Migration ersetzt genau diese widersprüchliche Bedingung und verstärkt den Bestandsschutz.

Die vorhandene Reklamationskarte zeigt die bestehende Nummer/Betrag und sperrt die zweite Gutschrift-Auswahl. Ein gezielter echter Renderfall PASS 3,20 s, kein neuer Dialog/keine Umgestaltung. Die Abbruchprobe der Trigger-Migration und lokale Anwendung sind belegt; Dev-Anwendung und strenger Migrationsgleichstand folgen erst mit den gemeinsamen Vorgängern auf main. Kein unzutreffender Dev-Gleichstand behauptet.

## Offen

AF-8/9/18 sowie die übrigen gebundenen mittleren Regeln, vollständige Sicht-/CI-/Planungsprüfung und Preview des abschließenden SHA. Dieser Teilstand ist kein vollständiger Kreislauf-PASS. Kein Merge/Production/Remote-Datenänderung in diesem Schritt.


## AF-17: abgesagten KV auch auf der SQL-Grenze sperren

Additive Migration `20261108165057_quote_decline_write_guard.sql` übernimmt die vorhandene `update_quote_v1` mit identischer Signatur und sämtlichen bestehenden Validierungen/Receipts/Terminregeln. Genau die Statusbedingung ist strenger: `abgesagt_am IS NOT NULL` verbietet neue Änderungen. Die vorhandene Definer-Eigenschaft/ACL wird weder erweitert noch neu eingeführt; kein neuer privilegierter Einstieg.

Abbruchprobe und lokale Anwendung PASS. Bestehender echter KV-04/05-Replayfall ergänzt: Versand → Zusage → neue Fassung → Absage → Versuch weiterer Termin-/Preisänderung → CONFLICT, Version 5/Betrag 1100 Cent/Absagegrund unverändert, kein Update-Receipt; View neu gelesen. PASS 4,69 s. Historische Wiederholungen bestehender Receipts bleiben nachvollziehbar. Eine kopierte Konsolenbeschriftung des lokalen Helfers nannte zunächst die Vorgängernummer; SQL-Datei und eingetragene Migrationsversion sind 20261108165057, Beschriftung korrigiert, kein zweites Anwenden.

## AF-12: berechneter KV mit dauerhaftem Reklamationsbezug

Der bestehende createQuoteAction/create_quote_v1 bleibt der einzige Anlageweg. Optionale sourceComplaintId ist an den Intent gebunden. Nur eine abgelehnte Reklamation desselben Kunden ist erlaubt. Der nullable Tenant-Fremdschluessel quelle_reklamation_id und unveraenderlicher Quellschutz werden mit dem Actor-Ereignis atomar geschrieben. Fehler rollen auch die Anlage zurueck. Ein positiver Preis ist Pflicht, kein kostenloser Ersatzauftrag. Bestehender Core-Port und exakte Leseregisterdeklarationen, kein Gate gelockert.

Migration 20261108170039_quote_complaint_source.sql lokal nach Abbruchprobe angewendet. Echter Replay: abgelehnte Reklamation / berechneter KV / Quellenzeile / Actor / Ansicht / identischer Retry / geaenderter Quellbezug abgewiesen / Nullpreis und anderer Kunde abgewiesen / genau ein KV. PASS 7,95 s. Alte Assertions erhalten. UI-Anschluss an die vorhandene KV-Karte und Dev-Paritaet bleiben offen.

## CI-Fixtures zur AF-7-Sperre

Alte Unit-/H18-Erfolgsfixtures sendeten einen anderen Termin als der gespeicherte KV. Nur diese synthetischen Eingaben angeglichen: Unit 20.10. auf input.dueDate (15.10.), H18 24.04.2027 auf gespeicherten 17.04.2027. Alle Erfolg-/Konflikt-/Hash-/DB-Assertions erhalten, echter negativer KV-07-Fall fuer fremden Termin ebenfalls erhalten. Sechs Unit-Faelle PASS; echter H18-Aktionslauf PASS 5,95 s. Fuer dessen strenge lokale Migrationsliste wurden die bereits angewandten zwei Vorgaengermigrationen bytegleich nur temporaer aus Git bereitgestellt und anschliessend entfernt; keine Migration erneut ausgefuehrt. Fresh-Storage-502 separat Infrastruktur, kein Produkt-PASS.

## AF-16: Nacharbeit bleibt ohne Rechnung, Ausgabe schliesst Reklamation

Vorhandene Writer erfuellen bereits den Vertrag: Rechnungsanlage lehnt payment_mode=keiner ab; der reale Warenausgang schliesst die zugehoerige Reklamation mit nacharbeit_raus. Kein zweiter Writer oder Produktumbau notwendig. Der bestehende echte Workshop-Replayfall wurde um den tatsaechlichen issueInvoiceAction-Aufruf nach Fertigung/Freeze erweitert: VALIDATION_ERROR, keine Rechnungszeile, kein Erfolgsereignis zu diesem Schluessel, Auftragskarte erneut gelesen. Danach unveraenderte positive Ausgabe-/Beschwerdeabschluss-Assertions. PASS 6,49 s, Typen/Lint/Diff sauber. Synthetische isolierte Fixtures, keine Echtdaten und keine gefaelschten Stationswechsel.

## AF-10: Foto beim Aufnehmen serverseitig Pflicht

Der eine bestehende ComplaintCommand-Vertrag verlangt mindestens ein Foto. Die unveraenderten Original-Leser pruefen weiterhin, ob alle angegebenen Foto-IDs wirklich zu diesem Auftrag bzw. dieser Quellnachricht und diesem Tenant gehoeren. Leere Liste wird vor irgendeinem Schreibvorgang abgewiesen. Keine neue Uploadstrecke, keine Anforderung von Fotos im Produkt vorweggenommen (Folgepaket AP-REKLA-MAIL).

Echter Aktions-Replay mit leerer Liste: VALIDATION_ERROR, keine Reklamationszeile/kein Erfolgsereignis; danach positives Foto-Aufnehmen, DB/Actor/Neulesen und AF11/12-Gesamtweg PASS 6,93 s. Die sechs bisherigen positiven Testeingaben ohne Foto besitzen nun explizite isolierte synthetische, persistierte Tenant-/Auftrags-Fotoreferenzen. Diese Fixture beweist keine Speicherung von Bildbytes oder Browser-Uploads, sondern die echte referenzpruefende Serveraktion. Keine Produktionsdaten simuliert, keine alte Assertion entfernt. Die fuenf betroffenen bestehenden Workshop-Faelle gezielt PASS 8,99 s. Typen/Lint sauber. Nach spaeterem Rebase von Teil A muss dessen zusaetzlicher AF2-Fall ebenfalls diese strengere Foto-Fixture nutzen.

AF-12 zusaetzliche echte Gegenprobe PASS 4,68 s: noch unentschiedene Reklamation darf keinen berechneten KV erzeugen; nach dem abgewiesenen echten createQuoteAction-Aufruf keine Quellenzeile, kein Erfolgsereignis und kein Create-Receipt, Reklamationsansicht unveraendert aufgenommen/Version 1. Das bestaetigt den vollstaendigen Transaktions-Rollback hinter der bestehenden SQL-Anlage.

## AF-6: alle Warenbelege in genau einen Auftrag

Der bestehende Mengen-Leseport summiert alle aktiven angenommenen Belege nach KV-Position. Der bestehende Bindewriter sperrt alle Belege in stabiler Reihenfolge, prueft die Gesamtmenge gegen die wirklich angelegten Auftragspositionen und bindet jede Originalquelle/jeden Beleg in derselben Transaktion. Kein zweiter Auftrag, kein zweiter Warenbestand. Zurueckgegebene Belege werden am unveraenderlichen Rueckgabeereignis ausgeschlossen. Jede einzelne Belegmenge bleibt erhalten, das Actorereignis beschreibt das ganze gebundene Buendel. Der bisherige Ein-Beleg-Readback bleibt kompatibel.

Echter Replay PASS 5,18 s: zwei getrennte Aufnahmen/Original-Fotometadaten/Warenwriter mit Mengen 2+3 zu KV-Menge 4, danach echte Zusage und Umwandlung: genau ein Auftrag mit 5, beide Belege und Originale beim Auftrag, Actorbeleg mit zwei Belegen, identischer Retry ohne Duplikat, KV neu gelesen. Gezielte bestehende KV-07-Faelle PASS 5,43 s und frische Waren-/Mengen-/Preisfaelle KV-06/U246 PASS 8,06 s, sechs Unit-Faelle PASS. Keine alte Assertion abgeschwaecht.

Zusaetzliche Gegenprobe PASS 4,57 s: zweiter Beleg beschaedigt, erster unauffaellig und als Hauptbeleg gewaehlt; trotzdem ganze Umwandlung abgewiesen. Kein Auftrag/keine Reservierung, beide Belege ungebunden, beide Originalquellen weiterhin beim KV, Ansicht ohne Auftrag. Die vorgelagerte Anzeige/Klaerung der Abweichung ist noch AF-5, nicht als erledigt ausgegeben.

## AF-5: abweichende Ware behalten, ausdruecklich klaeren

Der bestehende KV-Warenwriter speichert auch 2 von 3 Packstuecken oder belegten Schaden. Zustand, Zahlen, Gruende und Originalfotos bleiben unveraendert. Die gemeinsame View sperrt die Ware fuer den Auftrag, bis im selben Writer der explizite Befehl clarify mit Versionsbezug und Begruendung ausgefuehrt wurde. Klaerung schreibt einen unveraenderlichen Actorbeleg und erhoeht die Belegversion; sie setzt weder Schaden noch fehlende Packstuecke auf erfundene Gutwerte. Jeder wirklich aktive Login darf klaeren (U249), ohne dadurch Geld-/KV-Leserechte zu erhalten. Gleiches Kommando wiederholt sich genau einmal, veraenderter Grund mit gleicher Kennung ist Konflikt. Mitgeschickte geaenderte Pruefdaten werden ausdruecklich abgewiesen.

Additive View-Migrationen 20261108173258 und 20261108173803 jeweils lokal nach Abbruchprobe angewendet. Die Folge-Migration haelt den Klaerungsnachweis bei reiner Auftragsbindung sichtbar; erst geaenderte sachliche Pruefdaten entwerten ihn. Rueckgabe-Belegspalte und geschlossene Grants/security_invoker bleiben erhalten. Vorhandene Migrationen nicht editiert, keine alten Zeilen geloescht.

Zwei echte Aktionsfaelle PASS 5,67 s: Schaden mit Foto bzw. Teillieferung 2/3 werden als getrennte reale Aufnahme/Warenbelege gespeichert; trotz Zusage kein Auftrag. Login ohne Bereichsrechte klaert mit Grund, urspruengliche Zustands-/Packstueck-/Foto-/Mengenfakten bleiben, falsche geaenderte Pruefdaten abgewiesen, Retry und Konflikt, genau ein Actorereignis, finanzielle KV-Leserechte weiterhin FORBIDDEN. Danach derselbe Umwandlungswriter: ein Auftrag mit beiden Belegen und summierter Menge, Originale/Neulesen/Historie samt Klaerungsgrund erhalten. Ein enges Vergleichsproblem durch JSONB-Objektschluesselreihenfolge wurde einmal auf den fachlichen Foto-ID/Art-Vergleich korrigiert, keine Assertions geschwaecht.

Serverteil belegt; der sichtbare Klaerungsknopf an der einen KV-Karte folgt mit dem #200-Rebase. Dies ist noch kein UI-/Gesamt-Abnahmepass und kein Dev-Gleichstand.

## AF-9 vorbereitender Originalbeleg (noch kein AF-9-PASS)

In-Reply-To und References werden jetzt aus den unveraenderten MIME-Originalbytes abgeleitet und im bestehenden Anlageereignis mit Original-SHA gesichert. Keine zweite Mailquelle, kein geratener Titel-/Thread-/Fassungsabgleich und keine neue Graph-Schreibberechtigung. Gefaltete Kopfzeilen werden nur fuer das Lesen entfaltet, die gespeicherten Originalbytes bleiben unveraendert. Fehlende/ungueltige Angaben sind explizit markiert. Der vorhandene abgeschlossene Import-Readback liefert denselben Beleg auch ohne Outlook-Verbindung.

Bestehender echter Import-Aktionsfall erweitert: reale lokale Replay-DB und Storage, ausschliesslich Providergrenze synthetisch; gefalteter References-Kopf und In-Reply-To aus MIME, SHA identisch zum Original, genau ein Anlageereignis, gecachter Besitzer-Leseport liefert dieselben Referenzen. Alle alten Original-/Storage-/Wiederholungs-/Ausfall-/Zuordnungsassertions erhalten. PASS 6,10 s, Typen/Lint sauber. Der Versandidentitaets-/PDF-Abgleich und seine Durchsetzung an der Zusage sind noch offen; diese Vorbereitung wird ausdruecklich nicht als behobener Alt-Fassung-Fall ausgegeben.

## AF-9 Server: Antwort bezieht sich auf das tatsaechlich versendete PDF

Der bestehende Mail-Leseport findet die direkte In-Reply-To-Kennung ausschliesslich in den Sent Items desselben konfigurierten Postfachs. Genau ein Ergebnis, kein Entwurf, richtiger Absender und tatsaechlicher Empfaenger der Kundenantwort sind Pflicht. Die wirklich zurueckgelesenen PDF-Bytes werden gehasht und mit den vorhandenen erfolgreichen COMMUNICATION_DOCUMENT_SENT_V1-Belegen dieses Kunden/KV verglichen. Nur eine eindeutige belegte Fassung darf zur Zusage fuehren. Keine neuen Schreibrechte im Postfach, kein Draft, kein Anbieterwechsel, keine Betreff-/Conversation-Heuristik. Aufrufe sind begrenzt und besitzen Zeitlimits. Ein fehlender/mehrdeutiger Beleg bleibt eine sichtbare Fehlermeldung bei offenem Anliegen.

Der vorhandene Lifecycle-Writer vergleicht diese serverseitig bestimmte Fassung mit seiner aktuellen Fassung, nicht mit der Clientbehauptung. Der erfolgreiche Actorbeleg enthaelt Original-SHA, Antwortreferenz, echte Versand-Graphkennung und vorhandene Versandereignis-ID. Historischer Retry liest den vorhandenen Receipt und fragt Graph nicht erneut ab. Nicht-Mail-Zusagen bleiben im bestehenden Weg.

Fuenf gezielte Provider-Port-Faelle PASS: reale Kennung/Absender/Empfaenger/PDF-Bytes; mehrdeutig, fremder Absender, anderer Empfaenger oder fehlendes PDF werden abgewiesen; OData-Escaping und ausschliesslich lesende Mailaufrufe belegt. Das ist ein synthetischer Providergrenztest, kein Live-M365-Nachweis.

Echter Replay-Fall des bestehenden Sendewriters erweitert, PASS 5,13 s: echte KV-Fassung 1 als wirklich generiertes PDF ueber den Versandwriter und seinen Actor-/Dokumentbeleg, geaenderte Fassung 2 ebenfalls ueber denselben Writer. Antwort auf PDF 1 trotz Clientfassung 2 -> konkrete Meldung "Zusage galt Fassung 1 · Fassung 2 bestätigen lassen", keine Zusage/Versionsaenderung/Erfolgsereignis, Original-Anliegen unveraendert offen. Antwort auf wirklich gesendetes PDF 2 -> genau eine Zusage zu Fassung 2, Quellanliegen erledigt, vollstaendiger Herkunftsbeleg im Actorereignis, Readback und Retry ohne erneuten Provideraufruf. Quote/Sendewriter/DB sind echt; Graph und die isolierten eingehenden Mail-Metadaten sind explizite synthetische Randfixtures. Die unveraenderte MIME-/Storage-Importkette ist separat im echten Importtest belegt. Zwei mechanische Fixturefehler (fehlender Hash-Import, nicht kanonischer Test-Speicherpfad) behoben; keine Produkt-Reparaturschleife und keine Assertion entfernt.

Bestehender telefonischer Quell-/Zusage-/Vorbehalt-/Absageweg unveraendert im gezielten Replay PASS 4,50 s. Typen/Lint/W4/H18 sauber; Module nur der fremde Designpointer. Die Darstellung des bestaetigungsbeduerftigen Anliegens an der finalen einen KV-Karte ist weiterhin Teil des #200-Rebase/Sichtanschlusses. Kein Live-Provider-/Gesamt-UI-PASS behauptet.

## U249: operative Umwandlung ohne allgemeine Auftrags-/Geldfreigabe

convertQuoteOperationalAction ist ein enger Antwortadapter auf dieselbe bestehende Konvertierungsfunktion, denselben KV-Reservierungsbefehl und createOrderIntake. Es gibt keinen zweiten Anlagenwriter. Der bestehende Orderwriter prueft bei diesem internen Sonderfall in seiner Transaktion die echte kanonische Reservierung: Tenant, Actor, Clientkennung, zugesagter nicht abgesagter KV, Kunde und vollstaendige Order-Intent-SHA. Ein blosser Callback oder ein Flag ersetzt diese Pruefung nicht. Ohne exakte Reservierung bleiben allgemeine Rechtepruefungen unveraendert. Jeder nicht erfolgreiche Ausgang dieser gebundenen Transaktion rollt auch die vorherige Reservierung zurueck.

Der Adapter liefert ausschliesslich KV-/Auftrags-ID und Nummer sowie Ereignis-ID, keine finanziellen Quote-/Positionsdaten. Die Originalbindungen werden nur anhand des wirklich erzeugten KV-Auftrags ueber denselben Eingangs-Bindewriter uebernommen, ohne allgemeines Mail-/Eingangsrecht einzuraeumen.

Echter Replay PASS 4,57 s: Login wirklich ohne Bereiche, allgemeine direkte Auftragsanlage weiterhin FORBIDDEN; ein manipulierter Order-Intent trotz echter vorheriger KV-Reservierung wird abgewiesen, die Reservierung und alle Anlagen vollstaendig zurueckgerollt. Derselbe Login wandelt anschliessend den echten zugesagten KV mit zwei Warenbelegen 2+3 in genau einen Auftrag mit 5 um, beide Quellen bleiben gebunden, Actor ist der ausfuehrende Login, exakte erlaubte Antwortschluessel, Retry und Neulesen, finanzielle KV-Leseaktion weiterhin gesperrt. Zwei gezielte bestehende Rechte-/Geld-Unitfaelle PASS, bestehende echte Waren-/Zusage-Konvertierungswege separat weiter geprueft. Kein Session-/Rollenmodell geaendert.

## AF-8: belegte Mail-Zusage und vorhandene Ware in einer Transaktion

Die Mail-Fassung wird wie unter AF-9 tatsaechlich belegt. Bei vorhandenen Warenbelegen laeuft accept innerhalb derselben bestehenden createOrderIntake-Transaktion wie Reservierung, Auftrag, alle Waren-/Originalbindungen und Actorereignisse. Der Lifecycle-Writer kann dazu die aufrufende Transaktion nutzen; keine verschachtelte zweite Schreibtransaktion. Die enge Reservierungs-/Intent-Pruefung bleibt erhalten. Jeder nicht erfolgreiche Ausgang rollt auch Zusage und erledigtes Quellanliegen zurueck.

Uebergabe stammt aus dem bereits vorhandenen Kundenfeld handoverPreference; Zahlungsmodus kommt ausschliesslich aus intakePaymentContract und der gespeicherten Kundenbedingung. Beide werden in der Haupttransaktion erneut gelesen. Keine neue Einstellungs-/Datentabelle und kein hartcodierter Uebergabewert. Die kurzzeitig im BAULOG gestellte Quellenfrage wurde nach Fund dieses bestehenden Felds zurueckgezogen. Fehlen Angaben, bleibt das konkrete Mail-Anliegen offen.

Echter Replay PASS 6,96 s fuer die zwei Versand-/Antwortvarianten: ohne Ware der unveraenderte belegte Zusageweg, mit gesperrter Ware die Auftragsanlage ohne zweiten UI-Aufruf. Fehlende Uebergabe und unvollstaendige Kundenadresse werden davor bzw. in der Haupttransaktion abgewiesen; Zusage/Quoteversion, Mail-Anliegen, Reservierung, Auftrag und Erfolgsereignis bleiben unveraendert. Nach vollstaendiger isolierter Kundenkonfiguration erzeugt derselbe Request genau einen Auftrag mit der echten Kunden-Uebergabe/Zahlungsart und allen Originalen; SHA-/Reply-Provenienz plus automaticOrder stehen im echten Actorbeleg. Retry fragt Graph nicht neu ab. Nur der Provider und die isolierten Mail-Randfixtures sind synthetisch; kein Live-Graph-/UI-PASS behauptet.

#200 ist inzwischen nachweislich von der Owner gemergt (main 72671bf1). Als naechster Schritt werden die parallelen Erweiterungen auf diesen gemeinsamen Stand vereinigt: bestehende operative API/Telefon-Transaktion/Undo-Sperre aus #200 erhalten, neue Schattenschnittstellen zusammenfuehren, keine zweite Karte bauen. Bis dahin bleibt dieser PR Draft.

## Integration nach Owner-Merge #200

Basis main 72671bf1. Die zuvor beschriebene separate convertQuoteOperationalAction ist abgeloest: ausschliesslich der bereits auf main vorhandene convertQuoteToOrderAction bleibt oeffentlich; Telefon-Zusage, Mail-Zusage, Warenbindung und Ruecknahme nutzen dieselben vorhandenen Befehle. Die main-Redaktion ohne Geldrecht bleibt erhalten. Die engere kanonische Reservierungspruefung ersetzt das interne quoteConversion-Flag; allgemeine Auftragsrechte werden nicht erweitert. Automatische Mail-Umwandlung beachtet die bestehende Ruecknahme-Sperre automaticSuppressed.

Konfliktintegration gezielt gegen echte lokale Replay-DB: bestehende Telefon-/Ruecknahme-Faelle aus main bestanden beim ersten Lauf; AF6 und echte Mail/PDF-Zusage nach mechanischer UTF8-/Fixture-Anpassung 6/6 PASS in 13,20 s. Keine Assertion entfernt: die alte Adapter-Schluesselliste wird durch die bestehende main-Antwort plus explizit totalNetCents=null und alle Positionspreise/Steuersaetze=null ersetzt. Direkte unberechtigte Anlage, manipulierte Reservierung, Transaktionsrollback, beide Originale und Retry werden unveraendert geprueft.

Typpruefung und gezielter Lint PASS; W4 PASS39, H18 PASS310/147/88/59 ohne neue Ausnahmen; Scope PASS nach gemeinsamer main-Basis. Modul-Gate weiterhin ausschliesslich fremder DESIGN_POINTER_PAGE_BINDING. Die vorher protokollierte Scope-Behauptung vor Rebase war verfrueht: die inzwischen neue main-Migration erzeugte eine Abstammungsabweichung; nach Integration ist sie unveraendert enthalten und Scope tatsaechlich PASS.

Dies ist noch keine Gesamtfreigabe: sichtbare AF5/AF12/AF18-Anschluesse, Dev-Migrationsgleichstand, Sicht und PL-Pruefung stehen aus. Keine Owner-Merge-Bitte.

## Sichtbare Anschluesse AF6 / AF18

Die vorhandene Warenkarte zeigt alle gespeicherten KV-Pakete mit Lagerort; mehrere Belege sind kein Zuordnungsfehler mehr und nutzen denselben Umwandlungsaufruf. Automatik nur, wenn alle Belege entsperrt und die bestehende Ruecknahme-Sperre frei sind. Die vorhandene KV-Karte uebernimmt auch mehrere Belege atomar.

Vor einer neuen fachlichen Fassung nach Zusage stehen der konkrete Fassungshinweis und eine ausdrueckliche Bestaetigung. Reine Termin-Nachtraege bleiben ausgenommen. Alte belegte Zusagen bleiben im Verlauf sichtbar als ungueltig gekennzeichnet. Alle neuen Texte kommen aus dem bestehenden Situationskatalog. Zwei gezielte Render-Faelle PASS5,59s, vorhandener Telefon-/Termin-Renderfall bereits PASS. Mechanisch: der Test-Leseport musste nach erfolgreicher Aktualisierung den echten neuen Zustand liefern statt veraltet zurueckzusetzen. Typen/Lint/Scope/Diff PASS. Noch kein Browser-Sichtlauf/Gesamtabnahme.

## AF5 Klärung an der bestehenden KV-Karte

Jeder aktive Login sieht an der einen KV-Karte Packstück-/Schadensfakten und kann mit Grund die Abweichung klären. Der vorhandene saveGoodsReceiptAction nimmt dafür nur Identität, Versionen, Kennung und Grund; derselbe Warenwriter liest alle alten Prüfdaten selbst unter derselben Quote-dann-Beleg-Sperrfolge neu. Keine Client-Ersatzwerte, keine zweite Erfassung/Aktion/Tabelle. Der bisherige vollständige Prüfvertrag bleibt für alte Aufrufe und Manipulations-Gegenprobe erhalten.

Zwei echte Replayvarianten Schaden/Teillieferung über den schmalen tatsächlichen UI-Aufruf PASS7,91s: Actor, Originalfakten, keine vorgreifende Anlage, Retry/Konflikt, danach ein Auftrag samt beiden Belegen/Originalen/Neulesen. Ein gezielter Renderfall PASS3,08s: ohne Geld-/Editrecht, konkrete Fakten, Fehler im Dialog/Grund bleibt, gleiche Kennung bei Retry, neuer Stand gelesen. Typen/Lint/Scope PASS. Gesamtsicht/Dev-Gleichstand/PL weiterhin offen.

## AF12 sichtbarer Anschluss

Die abgelehnte Reklamation bietet mit echtem CreateQuote-Recht "KV aus Reklamation {nr}". Der vorhandene globale KV-Weg liest den gespeicherten Kunden, zeigt die Herkunft und sendet sourceComplaintId an denselben createQuoteAction; kein zweiter KV-/Auftragswriter, keine kostenlosen Ersatzpreise. Nach Erfolg oeffnet die vorhandene KV-Karte. Gezielte Renderpruefung beider Seiten belegt Kontext/Kunde/positiven Katalogpreis/keine Auftragsanlage; serverseitiger echter AF12-Proof steht oben.

CI-Befund an 8a317c9c konkret: quality und Ratchet scheiterten am zusaetzlichen direkten Quote-Lock im Eingangsmodul (naht4), nicht am Linter. Mechanisch auf den bereits bestehenden kanonischen readQuoteGoodsContext-Port mit identischer Quote-dann-Beleg-Lockfolge umgestellt. Keine Modulregel/Allowlist erweitert. Der lokale fremde Designpointer hatte die nachgelagerte Meldung zuvor verdeckt; deshalb nicht als vollstaendiges Modul-PASS ausgegeben.

## Dev-Schema und Kandidaten 08.11. 20:05

Dev syhaigjhsbpjmtnggqka: fuenf additive B-Migrationen angewandt nach erzwungener Abbruchprobe; Rollback und unveraenderte alte Zeilen in Quotes, Positionen, Warenbelegen, Aufgaben, Einstellungen, Auftraegen, Originalen, Eingangsereignissen, Events und Reklamationen belegt. Kein vorhandener Datensatz geaendert/geloescht. Beleg .git/kreile-kreislauf-b-dev-proof.json (ohne Zugangsdaten).

Ehrlicher Gleichstand: B-Branch 100 Migrationen, Dev 101. Die exakt eine weitere Dev-Migration ist der freigegebene offene A-Vorgaenger 20261108163051 mit SHA797151b3df906a002ebfe9e683c019bfe755f7fa9a9d65c98fb5177c89b50520; gespeicherter SQL-Text bytegleich mit Branch codex/kreislauf-kritisch nachgewiesen. Vereinigung beider geprueften Branch-Listen=Dev101/101, einzelner B-Branch ausdruecklich KEIN 100/100-Claim. Die vollstaendige Kandidaten-Paritaet ist nach dem Owner-Merge des Vorgaengers neu nachzuweisen.

Gepruefte Git-Preview READY fuer Produkt-SHA926643a15bf947b3a13e966bca078c2ab5e0d097: https://galvanik-kreile-werkstatt-k2n3kixol.vercel.app (Vercel API readyState plus exakte githubCommitSha, kein CLI-Deploy). Danach nur PL-Textkorrektur und diese Doku; neuen Kandidaten vor Abgabe separat pruefen.

Neu PL20:03/U252: Regel21/AF19 ist hinzugekommen und noch offen. orders.handover_mode ist bereits die gespeicherte Auftragswahrheit, daher kein neues Feld erforderlich. KundenhandoverPreference ist ausschliesslich Vorbelegung bei Anlage; keine bestehende Auftragsart wird aus einer spaeteren Kundenänderung neu berechnet. Der beauftragte Mail-Aenderungswriter mit Etikett/Uebergabe-Pruefung, Original-/Akteurbeleg und Telefon-Aufgabe ist noch zu integrieren; kein Vollstaendigkeitsclaim. PL-Satz zur aufgehobenen Zusage im vorhandenen Katalog auf konkrete Du-Form mit Kunde umgestellt.


## U252 / AF19 — Auftragsbezogene Übergabe

Der vorhandene changeOrderPickupNoticeAction/OrderContent-Writer verarbeitet Original-Mail-Anweisungen idempotent. Eine Kundenkarte ist ausschließlich initiale Vorbelegung; spätere Einzelmails ändern nur orders.handover_mode. Sender/Kunde, gesichertes MIME, Importabschluss, Version und Auftrag werden serverseitig geprüft. Mehrere offene Aufträge liefern eine ausdrückliche Auswahl. Versandetikett, Versand oder tatsächliche Übergabe verhindern die Änderung und erzeugen über persistTask eine normale Rückrufaufgabe samt Telefon. Kundenstandard nur bei ausdrücklichem Zukunftswortlaut. Ereignis ORDER_HANDOVER_MAIL_V1 enthält Mail-Akteur, Original-ID/SHA, Zeit und Versionsbezug.

Auftragskarte und bestehende Ausgabeprüfung zeigen denselben gespeicherten Modus und denselben Hinweis; Rückrufzustand wird aus der echten Aufgabe gelesen. Original-Mail und Aufgabe öffnen ihre vorhandenen Dialoge. Die Nachrichten-Anliegenauswahl „Übergabe eintragen“ ruft unmittelbar denselben Server-Befehl auf; bei mehreren Aufträgen explizite Auswahl mit Versionsprüfung, Fehler/Retry mit derselben Kennung. Die vollautomatische Anliegen-Erkennung beim Mailabruf gehört gemäß Regel21 zu AP-REKLA-MAIL und ist hier ausdrücklich kein erledigter Import-Automatismus.

Echte Replay-Nachweise: vier frühe/Etikett/Mehrfachauftrag/Zukunftsvarianten PASS5.29s mit Action, DB, Ereignis und Karten-/Aufgaben-Neulesen; zusätzlich echter Werkstatt-/Fertig-/Freeze-/Warenausgangslauf mit Sammelrechnungsabsprache PASS5.48s: danach keine Modusänderung, reale Rückrufaufgabe und sichtbarer Kartenbeleg. Keine Stationsfälschung. Import-Original/Etikett sind klar isolierte synthetische Provider-Voraussetzungen. Elf gezielte Client-/Erkennungsfälle PASS3.13s einschließlich Wahl statt Raten, gleicher Retry-Kennung, Negation/unklarer/quotierter Mail. Gemeinsames Karten-/Ausgabe-Panel Render PASS3.33s.

Der echte Replay-Lauf fand ORDER_CARD_INTAKE_RECEIPT_INVALID nach berechtigter Übergabeänderung: die alte Integritätsansicht verglich nur die unveränderliche Anlageart. Additive Migration 20261108192708 ersetzt ausschließlich diesen Vergleich durch den vollständig verknüpften Mail-/Eingangs-/Auftragsereignisbeleg; alle übrigen Integritätsprüfungen bleiben bestehen. Lokal und auf freigegebener Dev nach erzwungener Abbruchprobe angewandt; keine Altzeile geändert/gelöscht. SQL SHA256 0e4007c2b5d5c1fcf66ab7b23d39c693d826923c49e5420fc6bcf9902f957b1c. Dev102; vor Integration des inzwischen gemergten A gilt B101+A163051=Dev102. Echter Gleichstand und exakter SHA/READY-Link werden nach Integration und Git-Build nachgeführt.

B-h16: L10/L11/L13 benötigten das freigegebene Pflichtfoto. Der bestehende Browserharness lädt nun vor den unveränderten Fällen ein als SYNTHETISCH markiertes PNG über den echten UI-/Storageweg hoch; keine Fallassertion oder Foto-Pflicht abgeschwächt. CI-Bestätigung am nächsten Kandidaten ausstehend.
