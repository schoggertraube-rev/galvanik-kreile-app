# AP-REKLA-MAIL – Arbeitsstand, noch keine Abnahme

## Aktueller Nachtrag 09.11., RM07 und RM15

Weiterhin kein fertiger PR: #204 und #205 belegen die beiden PR-Plätze. Der universelle Mailwriter versieht neue Mails mit einer eigenen Versandkennung, reserviert den tatsächlichen Inhalt als Hash im vorhandenen Ereignisjournal und sendet bei 503/Timeout niemals blind erneut. Vor fünf Minuten erfolgt kein SentItems-Aufruf. Danach wird nur ein vollständiger, eindeutiger und zu Absender/Empfänger passender Treffer bestätigt; ein vollständiges leeres Ergebnis belegt „nicht gesendet“. Unvollständige, mehrdeutige oder fehlerhafte Providerantworten bleiben ungeklärt. Ein bestätigter Fehlversand behält seine Kennung; erst die erneute Nutzeraktion erhält eine neue Kennung. Bestätigte alte Fehlversuche sperren Fotoanfragen und Antworten nicht dauerhaft. Alte unbestätigte Versuche werden dadurch nicht freigegeben.

Der normale Maildialog und „Fotos anfordern“ führen den Abgleich bei geöffnetem Bildschirm anhand des serverseitigen Zeitpunkts automatisch aus. Währenddessen gibt es keinen Senden-Knopf. Text und Kennung bleiben erhalten; nach bestätigter Nichtzustellung kann mit neuer Kennung erneut gesendet werden. Texte kommen aus dem Katalog, keine rohen Providerdetails. Für KVs liest der Wiederholungsweg die tatsächlich vorbereitete PDF-Fassung aus ihrem unveränderlichen Versandbeleg; keine zweite PDF-Erzeugung und kein zweiter Provider-Send.

Echte lokale Action/DB-Belege: 503 → vor Frist kein Abgleich → nach Frist gefunden/nicht gefunden, inklusive JSONB-Entwurf neu lesen, Mail-/Akteurereignis und erneut gelesener Versandquittung (2 Fälle PASS4,74s). Fotoanfrage mit bestätigtem Fehlversuch → neue Kennung → genau ein erfolgreicher Quellenbeleg → echte Nachrichtenansicht „wartet“ (PASS im Dreierlauf). KV-Action → vorbereitete PDF → 503 → derselbe PDF-Beleg bestätigt → KV-SentEdition nachgelesen (PASS4,53s). Microsoft-HTTP ist ausschließlich die isolierte synthetische Testgrenze; kein echter Microsoft-Versand behauptet. Sechs Transportgrenzfälle PASS1,70s; tatsächlicher Maildialog mit automatischem Abgleich PASS2,39s, Fotooberfläche PASS3,60s. Die bisherige Rohtext-Assertion im RM01-Renderfall wurde durch den Katalogtext ersetzt; Gleichheit der Wiederholungskennung und das Neulesen bleiben unverändert geprüft.

RM13/RM15: fehlendes Recht erzeugt weder Reklamation noch Erfolgsereignis; der anschließende berechtigte Vorgang verknüpft die Originalfotos und lässt die vollständige bereits abgeholte Auftragszeile unverändert (PASS4,92s). Kein Auftrag wird wieder geöffnet.

Fotoanfragen nehmen den Abgleich nach erneutem Öffnen aus ihrem echten Serverjournal wieder auf: ursprüngliche Kennung, Version und Zeitpunkt, ausschließlich für den ursprünglichen Login und unveränderten Ursprung. Andere Logins erhalten keine fremde Versandkennung. Bestätigte Fehlversuche bleiben sichtbar und bieten den neuen Versuch an. Echte Foto-Action und Nachrichtenprojektion inklusive beider Zustände PASS4,82s; erneut geöffnete Oberfläche für gefunden/nicht gefunden zwei PASS2,79s. Der Antwortentwurf verwendet denselben bestehenden Entwurfsspeicher und dieselbe ursprüngliche Kennung; der gespeicherte Abgleichzeitpunkt wird beim Öffnen wieder aufgenommen. Vier Renderfälle einschließlich gefunden/nicht gefunden und beider bestehenden Entwurfs-/Retry-Fälle PASS2,32s. Keine zusätzliche Draft-Schreibaktion nur für das Abfragen. Die bisherige Assertion auf eine rohe Servermeldung verwendet nun den Situationskatalog; Eingaben- und Kennungsgleichheit bleiben geprüft.

**Offen, daher nicht abnahmefähig:** bestätigter Versand bei zwischenzeitlich fachlich geändertem Ursprung (einmalige PL-Frage im BAULOG05:13), generischer Maildialog nach vollständigem Schließen sowie übrige Fachdialoge, neue unabhängige Diffprüfung und Pflicht-CI/Preview. Kein Vollständigkeits- oder Livefähigkeitsanspruch.

Branch `codex/reklamation-mail`. Frühere Abschnitte dokumentieren den jeweiligen damaligen Teilstand. Kein Merge.

## Gebaut

- RM04: vorhandener Reklamationswriter lehnt fehlende Foto-Originale mit `Fotos fehlen · Fotos anfordern` ab. Echter Replay-Aufruf, keine Reklamations-/Ereigniszeile, Ansicht erneut gelesen: PASS.
- Bestehende Notizerkennung erkennt Reklamationshinweise; Übergabehinweise ausschließlich aus Mail über den vorhandenen konservativen Parser. Echter Import-Command und erneutes Capture-Lesen: PASS; vollständiger Storage-Import ausdrücklich nicht belegt.
- RM01: vorhandene `sendCustomerMailAction` / `sendCommunicationMail` antwortet auf die belegte Original-Mail. Zweck bindet Quelle, Kunde, Original-SHA, Version und bearbeitbare Vorlage; keine freie Empfängerüberschreibung, kein neuer Versandweg.
- Vor dem Provideraufruf reserviert ein bestehendes intake_event unter Quellsperre den Versand. Gleichzeitige andere Kennung sendet nicht erneut. Derselbe erfolgreiche Schlüssel liefert den gespeicherten Beleg zurück; unklarer Versand bleibt gesperrt und meldet den ungeklärten Stand.
- Versandbeleg, Intake-Ereignis und Akteur-Ereignis werden gemeinsam bestätigt. Das Anliegen bleibt offen; „Wartet auf Fotos von {Kunde}“ stammt aus tatsächlich gespeichertem Versandbeleg, nicht lokalem Flag.
- Nachrichten: Hauptaktion „Fotos anfordern“ bei fehlenden gesicherten Bildern; Fehler im sichtbaren Bereich mit gleicher Wiederholungskennung, anschließend echtes Neulesen. Keine Aufnahme ohne Foto als alternative Hauptaktion.
- Neuer Text ausschließlich im Situationskatalog. Vorlage in vorhandenen `email_templates`, in Einstellungen bearbeitbar.

## Schlanke Nachweise

- `complaint_goods_reminder.integration.test.ts`, Fall `RM01 real source reply Action persists mail, event and waiting view exactly once`: echte lokale Replay-DB, echte Sitzung, Action, DB, Ereignis, Nachrichtenansicht; Microsoft-HTTP allein ist eine ausdrücklich synthetische TEST-Grenze. Kein realer Mailversand behauptet.
- Derselbe Fall umfasst fehlende Provider-Konfiguration, parallele fremde Kennung während des ersten HTTP-Aufrufs, erfolgreichen Versandbeleg, Wiederholung und weiteren fremden Schlüssel. PASS (4,86 s).
- `IntakeConcernsPanel.realRender.test.tsx`: vier Fälle PASS, darunter Fehler → gleiche Kennung → Neulesen → Warten erst nach persistiertem Ergebnis.
- Typprüfung / gezielter ESLint: PASS. Modulprüfung: Produktgrenzen PASS, weiterhin fremde offene `DESIGN_POINTER_PAGE_BINDING`; nicht als Gesamtgrün ausgegeben.

## Migration

`20261108222500_complaint_photo_request_template.sql`, SHA-256 `b2fde7e9230804392223d7c2485b36b1ef23bd12e15798078d1a7823111ca71a`.
Additiv, ON CONFLICT DO NOTHING; bestehende Vorlagen bleiben byteinhaltlich unverändert. Abbruchprobe lokal und Dev PASS, Repo = Dev = 104 Migrationen, eine neue Vorlage auf Dev, geprüft 08.11.2026 22:21:29 UTC. Keine bestehenden Test-/Echtdaten verändert oder gelöscht.

## Noch offen

RM02/RM03: Originalantwort mit Fotos am bestehenden Anliegen, Aufnahme/Rückantwort vollständig verbinden. RM05 vollständiger Aufnahme-Doppelklicknachweis. Echte Preview-Sicht, exakter Produkt-SHA/READY-Preview, vollständige Pflicht-CI und Planungs-Diffprüfung fehlen. Kein fertig-/mergefähig-Siegel.


## RM02 – nur vorbereiteter Server-Leser, 08.11. 23:38

Der Eingang-Besitzerport `readComplaintPhotoReplyRelations` findet eine Antwort nur aus gesicherter MIME-Referenz zum Original, identischem bestätigtem Kunden und tatsächlich gespeicherter Fotoanfrage. MIME-SHA und Foto-SHAs müssen zu Original-Ereignissen passen und im vollständigen Importbeleg stehen. Fremder Kunde, ungesicherte Header und mehrere mögliche Wurzeln erzeugen keine geratene Verbindung. Alle Originale bleiben an ihren bisherigen Eingängen; keine Kopie, keine neue Relationstabelle und kein Schreibbefehl.

Echter lokaler Replay-Test ergänzt: bestehende Fotoanfrage → Antwort mit zwei isolierten TEST-Fotooriginalen → öffentlicher Besitzer-Leser liefert exakt beide Original-IDs; fehlende Kundenzuordnung oder abweichender MIME-SHA liefert keine Verbindung. PASS 5,41s, Typen/Lint grün. TEST-Metadaten belegen die Datenbank-Leseregel, ausdrücklich keinen echten Graph-/Storage-Import. RM02-Aufnahme/Root-Abschluss und RM03-Antwort-Oberfläche noch nicht gebaut; weiterhin keine Paket-Vollabnahme.

## RM02/RM03/RM05 – Umsetzung 09.11.

- Neue Fotoantwort erbt Kontext nur aus exakt belegtem MIME-Thread, bestätigtem Kunden und gespeicherter Fotoanfrage. Original und Antwort bleiben eigene erreichbare Originale; der Leser zeigt sie am selben Anliegen, ohne zweite Relationstabelle.
- Aufnahme verwendet unverändert den vorhandenen Reklamationswriter. Dessen Transaktion schließt das Reklamationsanliegen am Ursprung und an der Antwort gemeinsam; andere Anliegen bleiben offen. Tatsächliche Foto-Original-IDs werden übernommen, kein Kopiermodell.
- „Keine Reklamation · antworten“ verwendet den bestehenden CommunicationPanel-Editor, sendCustomerMailAction und sendCommunicationMail/Graph-Reply. Expliziter Grund, Betreff und Nachricht; keine complaints-Zeile. Versandbeleg, Akteurbeleg und Abschluss beider Eingänge werden gemeinsam bestätigt. Vorabreservierung verhindert weitere Versandkennungen; Wiederholung nutzt denselben Intent.
- Vor Versand wird der vorhandene private Actor-Entwurf gespeichert. Schließen sichert denselben Entwurf ohne Versand; Wiederaufnahme über Der Tag führt in denselben Nachrichten-Editor. Bei unklarem Ergebnis bleiben Inhalt und Kennung erhalten. Bestehender Entwurfs-Abschluss wird erst nach bestätigtem Versand aufgerufen; keine Original-/Geschäftszeile gelöscht.
- „Foto-Original öffnen“ öffnet tatsächlich das bestehende Original, statt nur dieselbe Nachrichtengruppe auszuwählen. Neuer Text liegt im zentralen Situationskatalog.

Nachweise: RM02/RM05 und RM03 echte lokale Replay-DB mit Sitzung→Action→Zeile/Ereignis→Ansicht PASS 6,84s; zwei Dialogfälle für Öffnen/Validierung/Doppelklick/identischen Retry/gesichertes Schließen PASS 3,78s. RM01 nach gemeinsamer Quellenleser-Extraktion erneut gezielt PASS 9,04s. Ausschließlich Microsoft-HTTP ist im Versandtest eine synthetische TEST-Grenze; Foto/MIME-Metadaten sind isolierte TEST-Fixtures. Kein echter externer Versand und kein kompletter Graph-/Storage-Import behauptet.

Typen und gezielter ESLint nach mechanischer Typ-/Renderkorrektur grün. H18 PASS inventory312/writes149/tested90/overrides59; vorhandene Versandaktion um echten RM03-Testbeleg ergänzt, keine Ausnahme hinzugefügt. Modulprüfung meldet ausschließlich fremde offene DESIGN_POINTER_PAGE_BINDING, keine neue Produktgrenzenverletzung.

Dev-Migrationsnachtrag: eigener RM-Stand104, zusätzlich genehmigte SA-Rechtemigration ergibt Union105=Dev105; keine Einzelbranch-Parität104=Dev mehr behauptet. Keine weitere Migration dieses Schritts.

Noch offen vor Paket-Abgabe: exakte Git-Preview, einmalige Sicht, Pflicht-CI und PL-Diffprüfung. Maximal zwei offene PRs: dieser Produktstand wird nur auf eigenem Zweig gepusht, kein dritter PR. RM03-Editor und Entwurfswiederaufnahme sind gebaut; vollständige Paket-Abnahme wird erst mit den offenen Nachweisen gemeldet.

## RM02 – tatsächlicher Originalimport und Storage-Rückweg

Neuer gezielter Fall in ein34_mail_import.integration.test.ts: echte Kunden-Action → echter MIME-Import → manuelle tatsächliche Kundenzuordnung → echte Fotoanfrage mit Versandbeleg → tatsächlicher Import der Antwort mit zwei Fotooriginalen → ursprüngliches Anliegen samt geerbtem bestätigtem Kunden erneut gelesen. MIME-Header und alle drei Antwortdateien werden über echte lokale Storage-Uploads gesichert und anschließend als echte Bytes heruntergeladen; SHA256 jeder Datei stimmt, MIME-Bytes bleiben exakt. Eine Fotoanfrage, eine Antwortquelle, drei Originaldateien, gleiche Importkennung ohne neuen Provideraufruf/Datei. PASS6,38s.

Nur der Microsoft-HTTP-Rand verwendet ausdrücklich synthetische TEST-Nachrichten/Foto-Bytes. Datenbank, Sitzungen, sämtliche genannten Actions, Import-Writer, Storage und erneuter Nachrichtenleser sind echt. Keine Behauptung echten Microsoft-Versands oder Hardwarekamera. Ursprünglicher Fixture-Fehler „confirm“ ohne Kandidatenbeleg wurde auf den tatsächlichen UI-Weg „manual“ geändert; keine Produktregel oder bestehende Assertion gelockert. Alle älteren Testfälle unverändert.

Damit ist die zuvor nur aus TEST-Metadaten geprüfte Thread-Verbindung zusätzlich über den vollständigen tatsächlichen Originalimport belegt. Weiter offen: exakte Preview/Sicht/Pflicht-CI und PL-Abnahme, PR erst nach freiem Slot.

## RM-12: echter Entwurf vor Versand und Retry

RM03 speichert den tatsächlichen Antwort-Command über `saveIntakeDraftAction`, liest den bestehenden `rekla-response`-Entwurf über `getIntakeDraftsAction` neu und sendet dessen tatsächlich JSONB-umsortierten Request. Der zweite Aufruf verwendet ebenfalls den neu gelesenen Request: genau eine Versandbestätigung, beide Anliegen abgeschlossen mit Grund und echtem Login, keine Reklamationszeile, Nachrichtenansicht erneut gelesen. PASS5,48s. Nur Microsoft-HTTP bleibt isolierte TEST-Grenze; keine echte Mail nach außen behauptet. Alle bisherigen fachlichen Assertions bleiben erhalten. Keine Änderung am Writer nötig, kein zusätzlicher PR.
