# AP-REKLA-MAIL — aktueller Teilstand, noch keine Merge-Abgabe

Produktstand `199d2408` (09.11.2026). Fertig im lokalen Teilstand: bestätigter Versand trotz Fremdänderung einschließlich Parent-Version; Ergebnis-/Begleitschein-Abgleich; Foto-Wiederaufnahme aus ursprünglicher Kennung/Version/Empfänger; Wiederaufnahme des allgemeinen Mailformulars und Ergebnis-/Begleitscheins nach vollständigem Schließen aus dem tatsächlichen Versandjournal; explizite Auftragswahl aus einer direkten Foto-Mail mit erhaltenem Originalbezug; ursprünglicher Empfänger und Akteur auch nach geänderter Kundenadresse; zwei nullable Arbeitstagsfristen mit echtem Settings-Rundweg; ausdrückliches Schließen eines foto-losen Anliegens mit Pflichtgrund über den bestehenden Lifecycle-Writer. Die Nachweise stehen unten.

Weiter offen: Altbelege ohne ursprünglichen Inhalt bleiben sicher gesperrt, ihre manuelle Klärung ist noch kein vollständiger Wiederaufnahmeweg; RM08 automatischer Erinnerungs-/Anrufpfad mit vorhandenem R2-Kalender/Rückhaltefenster und ergänzter Mailvorlage; RM09 sowie die fachlichen Anschlussentscheidungen für RM11/14 (Sammelfrage im BAULOG 07:54). Die Fristfelder und der Abschlussknopf sind echte Funktionen; eine funktionierende Automatik wird ausdrücklich noch nicht behauptet. Keine neue PR wegen der Grenze von zwei offenen PRs. Kein unabhängiges RM-PASS, keine exakte RM-CI/READY-Abgabe, kein Merge.

Die folgenden Einträge sind chronologische Bau-Nachweise. Ihre früheren Offenlisten werden durch diesen aktuellen Stand ersetzt und sind keine weiteren Aufträge.

## RM07 — PL-Entscheidung 09.11. 06:05 umgesetzt, Teilstand

Die tatsächlich bestätigte Mail und ihr Originalbezug bleiben jetzt erhalten, wenn die Quellversion inzwischen geändert wurde. Die fachliche Eingangsfortschreibung läuft hinter einem Datenbank-Savepoint; bekannte Quellkonflikte nehmen nur diesen fachlichen Teil zurück und hinterlassen genau einen unveränderlichen `COMMUNICATION_SOURCE_CHANGED_V1`-Beleg. Andere Datenbankfehler werden diagnostiziert und bleiben unbestätigt, statt als Erfolg zu gelten. Der alte Eingang wird dabei nicht auf „wartet“ gesetzt.

Wiederaufnahme nach 503 liest den ursprünglichen, an Login/Anfrage/Inhalt gebundenen Vorbereitungs-Snapshot aus dem vorhandenen Journal. Sie erfindet keinen neuen Empfänger und verändert weder Vorlage noch Originalbezug. Derselbe Request wird aus einem tatsächlich gespeicherten JSONB-Entwurf neu gelesen; bei inzwischen geänderter Quelle wird nur der bestätigte Versand abgeglichen, niemals blind erneut gesendet. Nach erneutem Lesen zeigt die Foto-Karte den tatsächlichen Konflikt mit „Neu laden“; Antwortdialog und allgemeines Mailformular haben denselben Katalogtext. Keine neue Tabelle oder zweite Versandstrecke.

Zwei echte Action/Replay-DB-Fälle: unmittelbare Providerbestätigung nach Fremdänderung und 503 → Fremdänderung → bestätigter Ausgangstreffer; je genau ein Mailbeleg, Original-ID/Version im Journal, fremder Text/Version/Anliegen unverändert, Wiederholung ohne erneuten Provideraufruf. Provider ausschließlich isoliert im Test ersetzt; kein tatsächlicher Microsoft-Versand behauptet. Gesamter gezielter RM07-Lauf fünf PASS6,96s. Antwortdialog und allgemeines Mailformular zehn Renderfälle PASS1,78s.

KV-Fremdänderung: Der vorhandene Lifecycle-Writer verändert den inzwischen neuen KV-Stand nicht mehr. Bestehende Assertion alt „Version3, Fassung2, gesendet Fassung1“ → neu „Version2, Fassung2, keine gesendete Fassung“; Betrag6000, tatsächliches PDF und genau ein Versand bleiben geprüft. Alte Hinweis-Assertion → `sourceChanged:true`; Zusageversuch nutzt die tatsächlich unveränderte Version2 und bleibt abgelehnt. Echter KV-Fall PASS4,96s.

**Noch kein fertiger RM-PR:** Ergebnis-/Begleitschein-Dialoge, allgemeine Wiederaufnahme nach vollständigem Schließen und zugehörige Quellkonflikte/Parent-Versionsbindung sind noch durchzuarbeiten. Neue CI/READY-Preview und unabhängiges PL-PASS fehlen. Dieser Abschnitt ersetzt ältere Aussagen, wonach die PL-Entscheidung noch offen sei.

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

Parent-Bindung ergänzt: Der Antwort-Snapshot hält den tatsächlichen Ursprung und dessen Version. Ändert ein anderer Vorgang den Ursprung während des Versands, bleiben sowohl Ursprung als auch Fotoantwort offen; genau der bereits bestätigte Mailbeleg bleibt gespeichert. Bestehender RM03-Erfolgsfall und neuer echter Parent-Konfliktfall PASS5,55s; dessen aus dem Erfolgsfall übernommene Ansichts-Assertion auf die ausdrücklich geforderte offene Lage berichtigt, kein Erfolgsfall abgeschwächt. Historische Snapshots behalten ihre bisherige Hashform, wenn das Parent-Feld noch fehlt. Zusätzlich verhindert der tatsächliche allgemeine Mail-Formularhandler nach Quellkonflikt auch erneutes Submit per Tastatur (nicht nur Knopf ausblenden); Renderfall PASS0,30s. Ergebnis-/Begleitschein-Anschluss und allgemeine Schließwiederaufnahme bleiben noch offen.


Ergebnis-/Begleitschein-Protokoll ergänzt: Die bestehende Ergebnis-Action reicht Abgleichzustand/Zeitpunkt durch. Ein tatsächlicher Versand nach fremdem Abschluss führt zu genau einem Mailbeleg, aber keinem erneuten fachlichen Abschluss. Drei echte Ergebnisfälle (normal,202mitFremdabschluss,503mitFremdabschluss+Abgleich) PASS6,41s, jeweils neu gelesener JSONB-Entwurf und tatsächliche Reklamationsansicht; einmaliger Versand und fremde Abschlussart/Notiz bleiben erhalten. Der bestehende Begleitschein-Leser wertet Quellkonflikt-Belege nicht als neue Erinnerungspause. Auch Warenankunft ohne neue Reklamationsversion wird vor der fachlichen Wirkung erkannt. Normaler Versand plus zwei entsprechende Konfliktläufe PASS5,39s; nur isolierter Providerersatz, keine Microsoft-Sendung behauptet.

Beide Maildialoge zeigen während Abgleich nur den Katalogtext und prüfen automatisch unter derselben Kennung; bei belegter Abwesenheit werden die Eingaben freigegeben und erst der ausdrückliche Klick nutzt eine neue Kennung. Bei bestätigtem Quellkonflikt steht „Neu laden“. Der bisherige zusätzliche Fehler-Knopf musste ebenfalls für diese Zustände gesperrt werden (ein gezielter Fix); drei Renderfälle einschließlich vorhandener manueller Retry-Variante PASS0,75s.

Foto-Wiederaufnahme nach fremder Version/Kundenzuordnung nutzt für den originalen Login die tatsächliche alte Versandkennung samt ursprünglicher Version und Empfänger-ID. Die heutige Zuordnung wird nicht umgeschrieben. Nach Abgleich wird die Konfliktkarte erneut vom Server gelesen. Echter Zwischenstand vor Abgleich sowie beide bestätigten Versandfälle PASS5,45s; tatsächlicher Wiederöffnungs-Renderfall PASS0,30s, keine dauerhafte lokale Ersatzwahrheit.

Offen bleiben vollständige Schließ-/Wiederaufnahme für allgemeines Mailformular und Ergebnis-/Begleitschein, RM08-Automatik gemäß neuer PL07:05-Entscheidung sowie die übrigen noch nicht vollständig abgenommenen RM-Fehlerwege. Kein fertiger RM-PR und keine Merge-Reife.


RM08-Einstellungen nach PL07:05: zwei explizite nullable Fristen in vorhandenen Firmeneinstellungen, Arbeitstage, leer deaktiviert die betreffende Stufe. Vorhandene `saveCompanySettingsAction` und Settings-Ansicht sind die einzige Schreib-/Lesestrecke; eigener interner Zweig im bestehenden Firmen-Writer mit Recht Einstellungen, aktuellem Versionsstand und stabiler Belegkennung. UI nennt fehlende Fristen, behält Eingaben bei Konflikt/Neu-Lesen, blockiert Doppelklick und zeigt die Speicherbestätigung. Rechte-Seite ohne Firmendatenrecht bekommt diese Metadaten nicht im DTO. Echte Action → zwei DB-Spalten → Akteurereignis → Ansicht → Beleg neu lesen → Retry PASS1,56s, einschließlich fremdem Zugriff, falschem Schlüssel-Inhalt, alter Version, negativer Frist, Ausschalten und Ablehnung eines alten Retries nach späterer Änderung. Ein Komponentenfall für konkrete Leerzustände/Konflikt/Neu-Lesen ohne Eingabeverlust PASS0,25s. Synthetische Tenant-ID auf vorhandene50Zeichen-Grenze gekürzt und kanonische Tenant-Feature-Fixture vollständig gesetzt; keine Produktregel gelockert.

Additive Migration61000 lokal nach erfolgreicher Abbruchprobe angewandt; kein Dev-Lauf und kein behaupteter Repo-/Dev-Gleichstand. Sie legt auch den geforderten Vorlagen-Datensatz „Reklamation · Fotos erinnern“ an, vorhandene Vorlagen unverändert. Der Textkörper bleibt ausdrücklich unvollständig und über den bestehenden Vorlageneditor zu ergänzen; es wird kein nicht freigegebener Kundentext erfunden oder automatisch versendet. Noch kein automatischer Versand/Anrufauftrag: der Betriebskalender und das Rückhaltefenster liegen derzeit in der R2-Reserve, nicht auf diesem Branch. Der weitere Anschluss bleibt offen und wird nicht als funktionierende Automatik ausgegeben. Kein neuer Cron-Dienst, kein Kostenanfall, kein Provideraufruf.

RM08 „Ohne Fotos schließen“ läuft jetzt als ausdrücklicher Zweck durch die vorhandene Lifecycle-Action; der allgemeine Info/Erledigt-Schutz für Geschäftsentscheidungen bleibt erhalten. Pflichtgrund und bestehendes Reklamationsrecht werden serverseitig erzwungen, vorhandene gesicherte Fotos verhindern diesen Zweck. Nur das Reklamationsanliegen wird geschlossen; weitere Anliegen, Originale, Auftrag und alle complaints-Zeilen bleiben erhalten. Zwei echte DB-Rundwege (mit/ohne weiteres Anliegen)5,85s: Grund-/Rechte-/Fotoablehnung, gespeicherten JSONB-Request neu lesen, Akteurereignis und Snapshot prüfen, Retry genau einmal, Auftrag vollständig unverändert. Die Fixture benötigt für den vorbereitenden ausgelieferten Auftrag ihre bisherigen Geld-/Kassierrechte; kein neues Abschlussrecht erfunden. Ein tatsächlicher Dialogfall0,38s bestätigt Pflichtgrund, bearbeitbare Ablehnung, gleiche Kennung und zentralen Text ohne internen Fehler; Primäraktion im Dialogfooter statt Header-× angesprochen. Stand-Neulesen bleibt gegen paralleles Speichern gesperrt und erhält den Grund. Automatik/Anrufauftrag und vollständige Mail-Schließwiederaufnahme bleiben offen, kein fertiger RM-PR.


## RM06/RM07 — Wiederaufnahme und explizite Auswahl (09.11. 07:58)

- `966c522f`: allgemeiner Maildialog liest den ursprünglichen Request über die bestehende Status-Action; vollständiger Komponenten-Neustart behält Kennung und Nachricht. Zwei echte Action-/JSONB-/Ansichts-/Retry-Fälle (4,59 s), zwei gezielte Renderfälle (0,38 s). Altbeleg ohne ursprünglichen Inhalt zeigt eine ehrliche Sperre mit Neu-Laden, keinen blinden neuen Versand.
- `a153d432`: Ergebnis und Begleitschein lesen eigenen offenen Versand aus dem bestehenden Journal. Drei echte Ergebnisfälle (6,57 s), zwei Begleitscheinfälle (4,97 s), zwei Dialog-Neuöffnungsfälle (0,48 s). Auch nach fremdem Abschluss/Wareneingang werden Originalversion und -inhalt verwendet; fremder Fachstand bleibt erhalten.
- `502368cc`: direkte Foto-Mail öffnet bei vorhandenem Auftrag den bestehenden Dialog, sonst dessen explizite Kundenvorgangswahl. Ein echter Weg Auswahl → Originalfotos → Action → DB → Ansicht → gespeicherter Request/Retry (5,14 s), drei Renderfälle (0,75 s). Die Auswahl allein ändert keine Zuordnung.
- `199d2408`: beide echten 503-Abgleichfälle zusätzlich mit später geänderter Kundenadresse und fremdem Akteur (4,81 s). Empfänger kommt aus dem Originalbeleg, fremder Akteur wird abgelehnt, keine erneute Provider-Sendung.

Geänderte bestehende Assertion: Kundenvorgangswahl zeigt bei Lesefehler statt `TEST Lesen unterbrochen` den zentralen Satz `Du lädst die Aufträge erneut. Deine Nachricht bleibt unverändert.`; zusätzlich wird Rohtext-Abwesenheit geprüft. Der vorhandene Auswahltest erwartet zusätzlich die mitgeführte ursprüngliche Intake-ID. Bestehende Nachweise zu DB-Zeile, Einmalwirkung und fremdem Fachstand bleiben erhalten.

Keine Dev-Migration dieses Bauabschnitts, kein echter Microsoft-Versand, kein unabhängiges RM-PASS. Lokale Typprüfung, gezieltes Lint, H18, Scope und Whitespace grün; Modul-Gate weiterhin ausschließlich durch fremde Bildquellen blockiert. Kein neuer PR wegen zwei offenen PRs.
