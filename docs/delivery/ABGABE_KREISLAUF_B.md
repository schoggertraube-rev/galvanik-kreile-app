# Kreislauf B — hohe/mittlere Serverregeln, laufender Bau

**Draft, nicht mergefähig.** Paket `_review/pakete/AP-KREISLAUF-REGELN.md`, erlaubter Teil B. Eigener Branch frisch von main e8aff802; keine gestapelte Produktwahrheit. Restfälle des Pakets bleiben ausdrücklich offen.

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
