# AP-EIN Teil 2 · Erfassung, Runde 52

## Einordnung nach P59

### P63 · neue Owner-Befunde, 05.11. · noch nicht abgenommen

- Kamera auf Tablet/Handy wird unmittelbar angefordert. Der eine Auslöser „Foto“ steht in der festen Dialogfußzeile; Tastatur und Mehrseitenaufnahme verwenden denselben Upload. Original, SHA-256 und Kennungen bleiben auf dem vorhandenen Dateischreibweg.
- Ursache der falschen Anzeige „unklar“: Die bisherige Ergebniszeile prüfte nur den Notiztext. Gleichzeitig verwarf der Azure-Adapter gelesenen Dokumenttext, sobald keine Schlüssel-Wert-Paare vorhanden waren, und lehnte HEIC vor dem Provideraufruf ab. Der Adapter bewahrt den tatsächlichen Text als `DOCUMENT_TEXT` in den vorhandenen Vorschlägen. Der erneute Capture-Leser leitet die Anzeige aus diesen gespeicherten Quellen ab. XML wird nicht an OCR geschickt; der strukturierte Parser gehört zum vorhandenen Rechnungsweg in Teil 5.
- Eine erkannte Rechnung erhält das offene Anliegen `rechnung` im selben bestehenden Eingang. Der echte Replay-Test ruft Prepare/Finish wie die Oberfläche auf, überträgt ein Original in den lokalen Storage, prüft Vorschlag, Anliegen, erneuten Leser und genau ein Original-/Erkennungsereignis auch nach Wiederholung. Synthetische Daten ausschließlich im isolierten Replay; die Providergrenze ist dort wie vorgesehen ersetzt.
- Die Ergebnisaktionen verwenden den bestehenden Navigationsbus. Ihre Zielansichten und die atomare Kundenanlage mit Original werden aus den vorhandenen Teilen 3/4/5 übernommen, ohne zweite Ansicht oder zweiten Writer. Diese Anbindung ist noch nicht abgenommen; ohne tatsächlichen Empfänger bleibt der Eingang mit sichtbarem Fehler offen. Eine Kundenanlage aus einem Original darf nicht über den gewöhnlichen Kundenaufruf ohne Originalbindung erfolgen.
- Erwartete Ware kommt mandantengebunden aus den vorhandenen Aufträgen (`ware = erwartet | teilweise`), ohne Ersatzdaten. Die Annahmeansicht bleibt dieselbe aus Teil 3.
- F02 und F05 bestanden im unveränderten 13-Fälle-Lauf tatsächlich und wurden als veraltete erwartete Fehler entfernt (P50/Regel 20b). F07 bleibt offen bis zur angebundenen Annahmeansicht. Der Lauf meldete dadurch zwei XPASS und elf durch den Runner akzeptierte Ergebnisse; dies ist kein Nachweis aller Funktionen.
- Bestehende Assertion alt → neu: „Was ist neu“ erwartete den Eintrag #173 zuerst; nach dem ausdrücklich verlangten neuen P63-Eintrag vom 05.11. wird #168 zuerst erwartet. Sortierung nach neuestem Datum und Reihenfolgeprüfung bleiben erhalten. Keine generierte Fall-Assertion geändert.

### P64/U-241 · vier Wege am selben Original

- Bei tatsächlich unklarer Art stehen „Auftrag/KV“, „Ware“, „Eingangsrechnung“ und „Dokument/Notiz zum Kunden“ zur Wahl. Die Wahl wird mit Version und wiederverwendeter Befehlskennung am vorhandenen Eingang gespeichert: ein manueller Art-Vorschlag und ein Ereignis; keine neue Originalzeile oder Kundenanlage. Gelesene Teilangaben bleiben unbestätigt.
- „Original ansehen“ steht am Ergebnis in der Dialogfußzeile. „Original gesichert“ verlangt ein tatsächlich gespeichertes `original_gespeichert`-Ereignis; ein lediglich vorbereiteter oder fehlgeschlagener Upload genügt nicht.
- Der Rechnungs-Schutz `intakeInvoiceReviewRequired` wird unverändert aus dem vorhandenen Teil 4 vorgezogen und dort anschließend wiederverwendet. Eine Art-Wahl kann eine bereits erkannte Rechnung nicht in eine unverbindliche Notiz umwandeln.
- Gezielt lokal geprüft: zehn RealRender-/Klassifikationsfälle, einschließlich aller vier Auswahlwege. Drei echte Action-/Replay-Fälle bestehen: Art-Wahl mit Wiederholschutz und Rechteprüfung, erwartete Ware aus realen Aufträgen sowie gespeicherter Rechnungstext mit erneutem Lesen. Jeder Fall verwendet echte Actions, lokale Datenbank und Storage; nur die Providergrenze ist ersetzt. Die Verbindungen zu den vorhandenen Ansichten werden gesondert belegt; dies ist keine unabhängige Abnahme.
- Tablet und Handy-QR lokal: zwei echte Uploads am selben Eingang, SHA-256 und je genau ein Originalereignis. Bilder/DB-Auszüge außerhalb des Repos unter `C:/Users/Traube/.codex/visualizations/2026/11/04/01a1a6e4-4199-7bb0-80cf-d86e82e8c3cb/p63-local-camera/`. Kamera und Providergrenze sind ausschließlich im isolierten Replay synthetisch; kein behaupteter Hardware- oder Azure-Preview-Nachweis.
- Neue additive Leseprojektion: `20261105095422_ein2_erwartete_ware.sql`, SHA-256 `F5B1C864413C6B693FD72CF0DBC4D2DC3EC42F5E7AA900F15DFC131814C5A319`. Sie liest bestehende Aufträge und Kunden, ohne zweite Waren-Datenwahrheit. Dev-Anwendung und Gleichstand stehen noch aus.
- P65/U-242 gelesen: Die geplante app-weite Textkorrektur wird erst mit gebundener Runde 53 umgesetzt; R52-Sichtvertrag und Werkzeuge bleiben unverändert.
- Echter Browser gegen den lokalen Server: Datei hochgeladen → vier Kacheln und drei Ergebniswege sichtbar → „Auftrag/KV“ speichert die Art und öffnet die vorhandene Erfassung mit demselben Original-SHA. Belege `desktop-file.png` und `desktop-u241-same-original-order.png` im genannten externen Verzeichnis. Build erfolgreich. A11 sammelte zwei mechanische Befunde (neue Action fehlte im Registry-Inventar, vorhandene Schutzfunktion war noch nicht aus Teil 4 vorgezogen); beide behoben und einzeln erneut grün geprüft, ebenso Typprüfung und Lint. Keine Prüfregel oder generierte Assertion geändert.

Neuer Kandidaten-SHA, exakte READY-Preview, CI und Browserbelege folgen nach dem abgeschlossenen P63-Schritt im PR und NACHTLAUF C. Der frühere grüne Stand `5d3d347e` ersetzt diese Prüfung nicht. **#168 bleibt Draft.**

05.11.: Nach dem verifizierten Owner-Merge von #177 wird dieser Kandidat auf `main` `780c0bc43dd45e6032e3c36ea767dfef32f2d623` übertragen. Gegenüber dem zuvor geprüften Produktstand `1de97584` werden ausschließlich der gemergte Anker und diese Abgabe übernommen; Produktcode und Fall-Assertions bleiben bytegleich. Die bisherigen roten Scope-Checks werden durch neue CI am übertragenen SHA geprüft. Aktueller SHA, exakte Git-Preview und vollständige Check-Liste folgen im PR und im NACHTLAUF C; keine vorweggenommene Merge- oder Sichtfreigabe.

KV (E38, Q01, C07, TA11) ist aus diesem Schritt herausgenommen und für `AP-EIN-2b` nach Teil 6 auf der Erwartungsliste. Die übrigen hier dokumentierten offenen Fälle und der Sichtnachweis sind damit nicht automatisch erledigt. Der tatsächliche aktuelle PR-Kopf, seine Git-Preview und die Prüfergebnisse stehen im NACHTLAUF Abschnitt C; frühere SHA- und DB-Belege unten gelten jeweils nur für den dort benannten Stand.

P61: Sichtbare Login- und Navigationsknöpfe sind bis zur Hydration kurz gesperrt; damit gehen frühe Klicks bei verzögert geladenem JavaScript nicht verloren. Rechte, Sitzungen und Daten bleiben unverändert. Bei künstlich verzögerten lokalen JavaScript-Dateien blieb der Einstellungsklick zuvor auf `/` und führte mit der Korrektur zu `/settings`. Der unveränderte V5-Shell-CI-Befehl bestand anschließend einmal lokal gegen den frischen isolierten Replay mit beiden Rollen und allen drei Größen. Die konkrete CI-Prüfung und Preview des neuen Commits bleiben gesondert nachzuweisen.

E40: Die Warnung zum fehlenden Eingangsfoto steht bei vorhandener Ware zusätzlich in der Prüfliste und nennt ausdrücklich „sperrt nicht“. Telefonanfragen zeigen weder diese Warnung noch die Warenprüfung. Der unveränderte E40-Ablauf bestand lokal gegen die Replay-Datenbank; der veraltete Rotmarker wurde nach dem belegten XPASS entfernt. Ein gezielter RealRender-Test prüft beide Zustände.

**Zwischenstand, Draft #168, nicht abgenommen und nicht mergefähig.** Nach dem Owner-Merge von #167 wurde Teil 2 auf main `7c475a72a582b412a95d73224e5a94581aa7b377` übertragen. Der übertragene Produktstand `a908baf8bf7b0f474c63dfb3985cfbd3d53816b7` hat diese [READY-Preview](https://galvanik-kreile-werkstatt-4wnpzx2jv.vercel.app). Der jeweils aktuelle PR-Kopf und seine Git-Preview stehen im PR; offene Fälle und Sicht sind nicht abgenommen. Keine weitere Dev- oder Produktionsänderung bei der Übertragung.

Die folgenden älteren Produkt-SHAs, Previews, CI-Läufe und Dev-Zahlen sind historische Nachweise zu den jeweils genannten Ständen. Insbesondere waren TA02/TA07/TA12 nach der Tabelle unten bereits mit `c58d4200` im echten Replay grün; ein aktueller Gesamtzähler wird erst nach einem neuen vollständigen Lauf behauptet. Der KV-Fall E38 ist weiterhin erwartungsgemäß rot: Auswahl und kanonische Speicherung von Aufwand/Einheit sind noch offen. In „Was ist neu“ wird KV deshalb nicht als fertiger Weg angekündigt.

## Aktuelle Korrektur nach P56

C03: Bei fehlender Übergabe wird eine Kundenbedingung nur vorgewählt, wenn der gemeinsame Zahlungsvertrag für Abholung und Versand denselben zulässigen Modus liefert. Die Herkunft „aus Kundenkarte“ ist sichtbar; die Auswahl bleibt bis zur Übergabe gesperrt. Der vorgegebene C03-Browserfall bestand gegen die lokale Replay-Datenbank. C02 und C03 wurden nach bestandenen Fällen aus der Erwartungsliste entfernt; ihre generierten Testinhalte blieben unverändert.

Bestehender RealRender-Test, Assertion alt → neu: vor Übergabewahl statt leer `vorkasse`; zusätzlich werden sichtbare Kundenkarten-Herkunft und gesperrte Auswahl geprüft. Der Testfall bestand gezielt. C06/C08/C09 bleiben offen: Das synthetische Quellauftrags-Fixture besitzt derzeit keinen gültigen Eingangsschreibbeleg. Die aktuelle SHA, Git-Preview und CI stehen im PR und NACHTLAUF C; Dev-Migration, KV und Fotoherkunft sind offen.

## Sichtbares Delta

P50: Auf den neuen Teil-1-Kopf `4536940c` gestapelt; Laufzeitcode, feste Akzeptanzdateien und alle 306 erzeugten Fall-Assertions sind bytegleich zum Vorgänger `684db073`. Der vollständige CI-Lauf `41790449275` bestand Replay, H12, H18 und Acceptance; einzig M08b schlug als `Expected to fail, but passed` fehl. Sein veralteter Marker ist entfernt (146 → 145); K22 ist wie E09 mit `Endversion-Angleich U-240` eingeordnet. Die aktuelle CI wird über alle Jobs und Schritte im laufenden Protokoll ausgewiesen. Der oben gebundene READY-Produktstand ist dadurch funktional unverändert; es gibt weiterhin keinen Sicht-Grünclaim.

- P44 (1–3): „Aufnehmen“ und „Aus Mail“ kompakt nebeneinander, Dublettenkarte oben rechts, „Neukunde anlegen“ im Kopf von Abschnitt 1. P44 (4) gehört zu Teil 1, Commit c613ff3d. Eigener Original-Sichtlauf am Vorgänger 477f0543: 2 grün / 22 gelb / 3 rot; kein aktueller Sicht-Grünclaim.
- M6-Servergrundlage: Auswahl setzt genau das gewählte Anliegen plus übrige offene ohne lesen, beendet den Eingang jedoch nicht. Info/Erledigt schreibt mehrere Eingänge atomar; Wiederöffnen braucht Mails und Grund. Version, Quellrechte und Idempotenz werden serverseitig geprüft; erkannte Rechnung bleibt vor Rechnungsprüfung offen. Noch keine neue M6-Oberfläche oder weitere Erfassungsstrecke.
- Inline-Neukunde beziehungsweise Ergänzung eines Bestandskunden in derselben Erfassung. Dieselben Kunden-RPCs und dieselbe Auftrags-Transaktion; kein Kunden-Schreibaufruf vor Buchen. Das alte zweite Inline-Kunden-Popup ist entfernt.
- „Nur als Interessent speichern“ schreibt Kunde, Originalnotiz und X12-Entwurf atomar. Ein verlorener Antwortweg lässt sich mit demselben Schlüssel wiederholen beziehungsweise mit demselben Kunden buchen; kein zweiter Kunde, ein Auftrag, ein Auftragsereignis, Entwurf entfernt.
- E33: Eine manuelle Änderung bestätigt nur das geänderte erkannte Feld; die übrigen Angaben bleiben prüfpflichtig. RT04: Anliegen-Chips verwenden denselben Erkenner wie der Server. Abwählen bleibt in intake_item.anliegen_abgewaehlt und im Entwurf erhalten, auch nach Wiederöffnen.
- „Duplizieren“ liest den vorhandenen Auftrag über getLiveOrderCardAction. Kunde und alle Positionen einschließlich Ausführung/Einheit/Preis werden übernommen; Fotos, Dokumente, Liefertermin und Prüfhaken werden nicht übernommen. Eingangsart mit tatsächlicher Herkunft. Kundenwahl über die vorhandene Eingangssuche; kein zusätzlicher Kundenstamm-Zugriff nötig.
- Ohne Recht Geld entfernt derselbe Auftragsleser Preise, Steuerwerte, Mehrarbeitsbeträge und Freeze-Beträge vor der Server-Antwort. Die DB-Werte bleiben erhalten. Mail-Inhalte sind ohne Mails auch bei bekannter Eingangs-ID weder lesbar noch als Notiz überschreibbar.
- Auftragsbestätigung wird dauerhaft in der vorhandenen Outbox angelegt und nach der Response über den bestehenden Versandweg verarbeitet. Fehler bleiben sichtbar und protokolliert; kein automatischer Wiederholungsversand bei unklarem Provider-Ausgang.
- Versand bei gewähltem Bar setzt den erlaubten Modus auf Vorkasse und zeigt „angepasst: Versand“. Eine fehlende Kundenbedingung bleibt leer; „Jetzt ergänzen“ fokussiert sie. Erst eine ausdrückliche Auswahl bestimmt den Modus. Ein erlaubter bewusst gewählter Modus bleibt erhalten.
- E26: Die gemeinsame Kundenauswahl zeigte bei einem nicht freigeschalteten Altwert Rechnung bisher still die erste HTML-Option Vorkasse. Sie zeigt nun „Bitte wählen“ und bewahrt den ursprünglichen Datenwert bis zur Benutzereingabe. Vorhandene echte Rechnungsfreischaltungen werden korrekt an dieselbe Komponente übergeben.
- E05: Nach Auswahl eines Bestandskunden entfällt die Dublettenkarte für Neukunden. C10/C11: Die freie Kopfzeile über dem Seitenblatt bleibt bedienbar; die transparente Portalfläche fängt dort keine Klicks mehr ab. Die eigentlichen Dialoge behalten ihre Eingabeebene. Kein zweites Plus oder zweite Kundenkarte.
- P49 E34: Genau ein sicherer Telefonnummer-/E-Mail-Treffer setzt den Bestandskunden über denselben Auswahlhandler. Eine manuell getroffene Kundenwahl bleibt erhalten; mehrere oder bloße Namenstreffer bleiben Vorschläge. Dieselbe Serversuche und die öffentliche Kunden-Telefonnormalisierung, kein zweiter Suchweg. Beim Kundenwechsel wird die vorübergehende Such-Markierung zurückgesetzt.
- P49 TA01/TA08/TA09/TA10: Die tatsächlich gespeicherte Terminherkunft ist sichtbar; die vom Server berechnete Bearbeitungszeit wird als „App-Schätzung“ gezeigt. Ohne Oberfläche erscheint die fehlende Vergleichsgrundlage auch vor der Übergabewahl. Keine erfundenen Terminvorschläge oder zusätzliche Zustandsregel.

## Nachweise

| Prüfung | Belegter Stand |
|---|---|
| Neue M6-Serverbefehle | Neuester echter Teil-2-Replay 17/17 H18-Actions PASS; Auswahl, Restanliegen, negativer Quell-/Geldzugriff, vollständiger Bulk-Rollback, Wiederholung, Wiederöffnen und Rechnungsschutz per DB/Event/erneutem Lesen geprüft. Keine sieben M6-Browserfälle als grün gewertet |
| Lokale A11 | 22/22 PASS; nach mechanischer Harness-/Fixture-Arbeit Typen, Lint, Generator und Whitespace erneut grün |
| Echte Server-Actions → Replay-DB/Event → erneutes Lesen | 13 bisherige Fälle plus neuer E28 einzeln PASS. E28 prüft Kunde bar/pickup unverändert, neuer Auftrag shipping/vorkasse, erneutes Lesen beider Ansichten und genau ein Ereignis nach Wiederholung. Der erste E28-Lauf scheiterte ausschließlich am nicht registrierten synthetischen Straßennamen; dieselbe isolierte Kundenweg-Fixture korrigiert |
| Bestehende UI-Regression | 58/58 grün; nach dem E26-Dropdown-Fix gemeinsame Kundenkarte 9/9 und betroffene Erfassungsfälle 2/2 grün. Kein unabhängiger Abnahmeclaim |
| Kopie-UI / kanonischer Leser | 2/2 Rollenvarianten und 7/7 Leser-Units grün |
| Unveränderte erzeugte Browserfälle | E33, RT04-01…10 sowie E22/E25/E26/E27 tatsächlich grün gegen echte App/Replay-DB; RT04-10 nach mechanischer DB-Zielbindung des Harness |
| Rotliste | Nach dem Teil-1-Rebase 152, nach sechs belegten Korrekturen 146 von 306. Nur echte Erfolge entfernt, keine neue Ausnahme. Alle 14 erzeugten Flow-Dateien mit 306 Erwartungen bytegleich; `_model.ts` enthält ausschließlich zusätzliche technische Speicherzuordnungen |
| Feste AP01a–d | In diesem Schritt unverändert. AP01c isoliert auf frischem Replay **1/1 PASS** mit echtem Erkennen, Serversuche, Kundenzeile und Ereignis. Die übrigen früheren Einzelläufe 9/9 bei d7e21756 bleiben historische Belege, kein neuer Komplettclaim |
| Produktionsbuild | Abschließender lokaler Build PASS; Vercel hat den oben genannten exakten Produkt-SHA gebaut |
| P49 eigener vollständiger Lauf | **119 Fälle** (rein 13, eingang 99, entwurf 7): zunächst tatsächlich **90 grün / 29 rot**. Nach gezielter Korrektur E28/E34/TA01/TA08/TA09/TA10 insgesamt **96 grün / 23 rot**. M6 ist gemäß P48 Teil 4 und zählt hier nicht mit. Zusätzlich K24 auf diesem Teil-2-Stand PASS |

Die Modellfälle und der BAUPLAN sind unverändert (DF3E1AFE…). Bei als rot vorgemerkten Fällen bedeutet „Expected to fail, but passed“ tatsächliches Grün; strukturiertes Playwright-JSON wurde geprüft. Nachweise lokal unter .git/kreile-ein2-recognition-*, .git/kreile-ein2-copy-* und .git/kreile-ein2-prospect-*.

## CI am Produkt-SHA

[Lauf 41789608506](https://github.com/schoggertraube-rev/galvanik-kreile-app/actions/runs/41789608506) am Produkt-SHA `4c094f8f`: agentur-gate vollständig PASS; h16-schema Replay/H12/H18/Acceptance PASS, Generated bei Abgabe noch laufend; Vercel READY. Alle Jobs/Schritte wurden gelesen. Quality, Ratchet und Fresh-Supabase-Replay wurden bei diesem gestapelten Branch-PR nicht ausgelöst und werden hier nicht als bestanden ausgegeben.

Am vorherigen Kopf c88bc8c1 war [Lauf 41770794471](https://github.com/schoggertraube-rev/galvanik-kreile-app/actions/runs/41770794471) rot: ausschließlich H18 `notifyAdminPinReset`, fehlendes `pin_reset_requested` in `h18_settings_actions.integration.test.ts:327`. Grund ist die Kandidatenbegrenzung auf 32 im geschützten Start-Pfad. Replay/H12/agentur waren grün; Acceptance/Generated danach nicht ausgeführt. Ein minimaler, noch nicht angewendeter Patch liegt dem Planungschat mit den zwei benötigten Pfaden vor. Keine Lockerung oder Testabschaltung.

Die sechs früheren roten APR-Fixtures sind durch die ausdrückliche P46-Freigabe korrigiert: ausschließlich `geprueft: true` im gemeinsamen Waren-Input. SHA-256 **E55A18D1397C5763ECDCBED4D05C25EFEA8DFD0AE8878742454B21357442CB3A** statt F22BE903…, Entfernen genau dieser einen Zeile stellt die alten Bytes wieder her. Sämtliche Assertions unverändert; lokaler APR-Replay 7/7 PASS. Kein Prüftor abgeschwächt.

Quality, Fresh-Supabase-Replay und Ratchet wurden wegen der gestapelten PR-Basis kreile/b2-ein-1 nicht gestartet. Sie werden nicht als grün gewertet; Workflows bleiben unverändert.

## DB-Beleg und Migration

Ein tatsächlich durchlaufener synthetischer Interessenten-/Buchungsfall, ausschließlich lokale Replay-DB:

| Zeile | Gelesener Wert |
|---|---|
| Kunde | K-2026-0020 / 4e9284d9-2acf-4bf8-96fb-47f89f4cea8c |
| Auftrag | A-2026-0022 / d26f65a4-c1e2-497b-b0bd-011fbaf4de73 |
| intake_item.id | 16a8f9fe-25cf-45d9-9687-e13e55df45d5 |
| intake_item.vorgang_id | d26f65a4-c1e2-497b-b0bd-011fbaf4de73 = orders.id |
| Customer-Mode / Kundenanzahl / Auftragsereignisse | EXISTING / genau 1 / genau 1 |
| Entwurf | 169b51e1-c91d-4d8d-a6e0-f80d1125f839, nach Buchen nicht mehr vorhanden |
| Zuordnung / Originalversion | hand, erledigt / Version 2; Interessenten-Receipt Version 1 |

Beleg .git/kreile-ein2-prospect-db-proof.json vor Fixture-Bereinigung; keine Behauptung über Dev-Geschäftsdaten. Weitere echte Action-Tests lesen den eingegebenen Freitextpreis 1200 Cent / 1900 Basispunkte erneut und prüfen, dass der Leser ohne Geld nur null überträgt, während dieselbe DB-Zeile unverändert bleibt.

Migration supabase/migrations/20261103053000_ein2_erfassung.sql, SHA-256 **0D3CD6230913C703DFB6ABB72FD96B59FBCA108FC501F67E95E14D01D77E9D5E**. Noch nicht auf main; keine bereits gemergte Migration geändert. Letzter echter Gleichstandsbeleg: **70 Repo-Versionen = 70 Replay-Versionen**, vollständige Listen bytegleich; .git/kreile-ein2-latest-migration-parity.json.

**Dev-Gleichstand nach P47, 04.11. 02:38:57 UTC:** **70 Repo-Versionen = 70 Dev-Versionen**, vollständige Listen gleich. Die Owner-Freigabe erlaubt jetzt diese Anwendung vor dem Merge. Zuerst lief die vollständige Kette mit erzwungenem ROLLBACK erfolgreich; danach waren wieder exakt 66 Versionen und unveränderte Zeilenzahlen vorhanden. Anschließend wurden dieselben vier Dateien in derselben Reihenfolge atomar angewendet:

| Datei | SHA-256 |
|---|---|
| 20261103010000_ap_r_freitext_einheiten.sql | 0830E7F4E516EC69A6D8ED0940F16AABA9611F64A294EBA1129C25110CBDBE31 |
| 20261103032000_b2_kunde_k1.sql | 501FC772832FBF6CD8F653B71F9E9AFCA720006469A488EA4920CEBD04BEE60E |
| 20261103032001_ein1_kunde_schreibweg.sql | D9BD01A7DFAB6FB77E91DCFBC2C53C6920337A12A0DF3D332C99589330F3706A |
| 20261103053000_ein2_erfassung.sql | 0D3CD6230913C703DFB6ABB72FD96B59FBCA108FC501F67E95E14D01D77E9D5E |

Diese vier Dateien sind ab jetzt eingefroren. Kunden/Aufträge/Positionen/Eingänge vor und nach der Anwendung: **13/12/14/8**. Kein Datensatz gelöscht, kein Testkunde oder Testauftrag auf Dev angelegt. Der Altwert chrom wurde durch die freigegebene Bestandsumstellung zu verchromen. Der echte Produktleser `readTenantOperationalOrders` liest danach über eine erzwungene Read-only-Verbindung **12 Aufträge erfolgreich**, darunter A-2026-0001 mit Anzeige „Verchromen“; der frühere ORDER_POSITION_SURFACE_UNKNOWN tritt dort nicht mehr auf. Belege: .git/kreile-p47-dev-probe.json, .git/kreile-p47-dev-apply.json, .git/kreile-p47-dev-reader.json. Der vollständige Preview-Sichtlauf ist gesondert offen.

## Bestehende Assertions: alt → neu

- Bestandskunde unvollständig: kein PLZ-Feld → nur tatsächlich ungültige Felder inline; gültige Angaben bleiben geschützt. Unvollständiges Buchen schreibt keine Kundenergänzung.
- Zweiter Inline-Neukunden-Dialog / separater Speicheraufruf → ein Dialog, erhaltene Positionen, kein Kunden-/Auftragswriter vor Buchen, gemeinsame Transaktion im echten Integrationstest.
- Kundenkarte: „In Kundenkarte ergänzen“ → ausdrücklicher „Kundenkarte“-Knopf; Ebenenerhalt, erneutes Lesen nach Rückkehr und Vollständigkeitsprüfung bleiben erhalten.
- Normale Buchungs-Fixtures: 20.10.2026 → 20.11.2026; Datum war inzwischen vergangen. Zugehörige Receipt-Erwartung gleichwertig mitgezogen.
- Termintest: alter Vorschlagsknopf → Übergabe, tatsächlicher Abgleich, „anbieten“, Gegenangebot plus ursprünglicher Wunsch und ausgewählter Gegenangebotsstatus. Kein Ersatz für Modellabnahme.
- Auswahl-Harness: Kindknopf „undefined“ → bereits adressierter Einzelknopf. aria-pressed=true und Erfolg-Grün weiterhin Pflicht. Isoliertes Settings-Fixture aktualisiert die vorhandene Zeile statt eine zweite anzulegen.
- OrderCard-Snapshot: Ausführung wurde verworfen → zusätzlich derselbe gespeicherte executionRequested-Wert erwartet; übrige alte Assertions erhalten. Freitextpreis wird nach demselben kanonischen Preisvertrag geprüft.
- E33-Unit-Fixture: quantity=3 als number → quantity="3" nach dem tatsächlichen Erkennungsvertrag; Ausführung explizit. Sämtliche Feld-/Prüfpflicht-Assertions erhalten.
- H18-Notiz: bisherige Original-/Event-/Replay-Prüfung → zusätzlich anliegen_abgewaehlt=[hinweis] und unveränderte Abwahl nach erneutem Server-Aufruf erwartet.
- RT04-10-Harness: DB-Werte ohne wo/neu hatten keine Zeilenbindung → Snapshot der IDs vor dem Lauf, genau eine tatsächlich neue Action-Zeile als Ziel. Keine Zeile oder mehrere neue Zeilen bleibt Fehler. Modell und Werte-Assertion unverändert.
- E26 gemeinsame Kundenkomponente: ungültiger Rechnung-Altwert führte zur ersten sichtbaren Option Vorkasse → leere Anzeige mit Bitte wählen, kein Speicheraufruf; weiterhin Rechnung nur bei echter Freischaltung. Zusätzliche Assertion, keine bisherige entfernt.
- APR F2: gemäß P46 ausschließlich geprueft=true ergänzt, alle bestehenden Erwartungen und übrigen Bytes unverändert.
- Generator-Speicheradapter E28: fehlende Rückübersetzung des kanonischen Kundenwerts `shipping` → derselbe bereits vorhandene `handover`-Transform nach `versand`; erwarteter Modellwert, abgefragte Kundenzeile und Identität unverändert.
- Generator-Speicheradapter DA01/DA02: unbekannte logische Tabelle `order_events` → bestehende kanonische Tabelle `events`. Keine neue Tabelle und keine geänderte Anzahl-/Wert-Erwartung; die Fälle scheitern jetzt am tatsächlich noch fehlenden Abholer-Bedienelement.
- D06-Gerüst: im Modell deklarierte Feld-Erwartung ohne Aktion wurde als unbekannte Aktion verworfen → diese Erwartung wird tatsächlich ausgeführt. Die unvollständige Entwurfs-Fixture bleibt rot; keine Daten hinzuerfunden.
- Original-Fixtures: unvollständige Dateizeile ohne MIME → vorhandener Loopback-Storage-Helfer aus Teil 3 bytegleich vorgezogen. Er materialisiert die ausdrücklich synthetischen Originalbytes, speichert sie wirklich in lokalem Storage und prüft SHA/Dateimetadaten. Kein Produkt-Mock, kein anderer Original-Schreibweg. AB03 erreicht damit die noch fehlende Mail-Einstiegsaktion statt am Seed zu scheitern.

Unveränderte aktuelle Test-SHAs: AP01 `3A5F7B5C4DE3BD91AC855E782C99B9F9F7FACD214AB204CA1E157E61662CA083`, AP01b `EDDD0B1189513DA6DF8D8C4D65D862EA72A638ECFC86534B6302982DE67AC9A5`, AP01c `B33A375E1B2F75E2A001B532791C796DA67245578EB9F686E63132BD476C4059`, AP01d `1A55AC520A61476D96833D68593ACB44076B53D14275241756A0A31CCFE280AF`.

## Offene Wege und Sicht

**Keine Owner-Abnahme anfordern.** Die offenen 23 Fälle sind vollständig:

| Fälle | Verbleibender Befund |
|---|---|
| E09 | Alter Enter-Fall widerspricht U-240; P46 entscheidet zugunsten U-240 |
| E38, Q01, C07, TA11 | KV-Weg/KV-Kartenziel noch offen; kein wirkungsloser KV-Knopf ergänzt |
| C02, C03 | Vorlagenkonflikte: Übergabe aus Vorgeschichte gegenüber K1-Kundenpräferenz; Zahlung vor Übergabewahl gegenüber geltender Leer-Regel |
| C06, C08, C09 | Quell-Auftrags-Fixture ohne kanonischen Intake-Receipt beziehungsweise Warenprüfung aus Teil 3 |
| E40 | Foto-/gemeinsame Warenprüfungs-Anbindung aus Teil 3 |
| TA02, TA07, TA12 | Stations-Fixture `in_arbeit` gegenüber kanonischem `galvanik`, dadurch keine belegte Auslastung |
| AB02 | Provider-Adapter sendet bereits, Erwartung verlangt noch `wartet`; kein künstlicher Produkt-Sonderzweig |
| AB03 | Mail-Einstieg `mailein.neuer-eingang-aus-mail` gehört zur Anbindung aus Teil 4 |
| DA01, DA02 | Abholer-Mitteilung noch nicht implementiert; kanonischer Auftrags-Schreibpfad/äußere Kartenwirkung zu klären |
| D04 | Nachrichten-Navigation benötigt Teil 4 |
| D06 | Vorgegebene gespeicherte Entwurfs-Fixture enthält nicht den benötigten vollständigen Erfassungsstand |
| F02, F05, F07 | „Wem gehört das?“ beziehungsweise erwartete Ware: Anbindung an Teil 4/3 offen |

Zusätzlich weiter offen: Bundesland/Betriebsruhe, exakter Pfad `src/lib/domain/workingDays.ts` außerhalb der B2-Allowlist. M6-Browserfälle werden gemäß P48 ausschließlich mit Teil 4 geprüft; die einmaligen Serverbefehle bleiben in Teil 2. Vollständige RG11-Belegmerkmale/Rückfrage und Chef-Kontrolle gehören zum Rechnungsweg; der bekannte Rechnungsfall wird bereits vor dem stillen Beenden blockiert.

P46 ordnet den vollständigen domainAttachment-Ersatz über file_id samt Bestandsmigration Teil 3 zu. Bis dahin keine zweite Verknüpfungsstrecke oder nur optisch wirkendes Entfernen. C06/C08 bleiben rot: Die synthetische geschlossene Quell-Fixture besitzt keinen kanonischen Auftragsanlage-Beleg; der echte Leser verweigert sie mit ORDER_CARD_INTAKE_RECEIPT_INVALID. Kein Vertrauenstor gelockert und keine erfundene Historie ergänzt.

Der Zugangsblocker ist behoben: Der vorhandene lokale Vercel-OAuth-Zugang war abgelaufen. Reguläre Erneuerung desselben Zugangs, Verifikation desselben Nutzers und Nutzung des bereits vorhandenen Automation-Bypass; kein CLI-Aufruf, kein Env-Pull, keine Änderung einer Schutzregel. Es wird kein Zugangsschritt des Owners benötigt.

Eigener unveränderter R52-Prüfer auf der oben genannten READY-Preview **4c094f8f** nach dem Dev-Abgleich: **27 Ansichten, 2 grün / 22 gelb / 3 rot**. Entwurf Desktop/Tablet grün; Eingang in allen drei Größen rot. Bericht, Log und Bildpaare außerhalb des Repositorys: C:/Users/Traube/.codex/visualizations/2026/11/03/01a1a122-06c4-7570-a4d3-dc1eedb311aa/sicht-4c094f8f-rein-eingang-entwurf-anliegenwahl/ (pruefbericht.json, lauf.log, nachweis.json, bilder/).

Gelbe Befunde bleiben ausdrücklich sichtbar: Nicht gebundene Modi haben in der unveränderten Routendatei `pfad: null` mit Einzelgrund. Bei „Neu erfassen“ ist der verlangte Platzhalter tatsächlich vorhanden; der Prüfer bildet seine Textkennung jedoch vorrangig aus dem zugänglichen Namen „Notiz“. Die sinnvolle ARIA-Beschriftung wird nicht zur Umgehung entfernt. Beim neutralen Entwurf-Knopf auf Handy ist die gemessene Bündelfarbe `rgb(245,246,248)` statt Weiß; kein eigener CSS-Override und kein Grünclaim. Die fehlenden Routen und die Farbabweichung bleiben dem Planungschat zur Einordnung vorgelegt.

Quellenbefund an Planung/Endversion: routen.json öffnet eine leere Erfassung; der gebundene Normalvertrag verlangt bereits bestätigbare Erkennung, Bestandskunden und konkrete datenabhängige Historien-/Katalogtexte. Diese Zustände fehlen beim leeren Aufruf. Keine Mustertexte oder wirkungslosen Blindknöpfe ergänzt. Empfehlung: Zustandsbindung und parametrisierte Beschriftungen im Sichtvertrag eindeutig entscheiden; Originalprüfer und Bericht bleiben unverändert. Echte Produktlücken (KV, gemeinsame Warenprüfung, M6) bleiben davon getrennt offen. Woche/Termin-Vorschläge erscheinen korrekt erst nach Übergabewahl und realer Terminlage.

Teil 2 bleibt Draft, bis die unveränderten Fälle und der originale Sichtprüfer auf der READY-Preview des abschließenden SHA bestanden sind. Der Planungschat legt danach den Owner-Klickweg vor.
