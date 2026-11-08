# AP-REKLA-MAIL – Arbeitsstand, noch keine Abnahme

Branch `codex/reklamation-mail`, Basis main `d25a35aa`. Noch kein PR: maximal zwei offene PRs (#203/#204). Kein Merge.

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
