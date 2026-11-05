# AP-EIN Teil 4 · Zwischenstand

## Aktualisierung P63/P64 · 05.11.

Auf Teil 3 `1c499f03` gestapelt, einschließlich der Datei-/QR-Korrektur `003a6a68`, der belegten F07-Rotlistenbereinigung und der W08-Station-Prüfung. Der vorhandene Originaldialog öffnet die vorhandene Zuordnung 3.4 über denselben bestätigten Navigationsbus. Zuordnung und Original bleiben Ebenen über der Erfassung; nach der Änderung werden beide aus der einen Datenquelle erneut gelesen. Kundenanlage aus dem Original verwendet ausschließlich die bereits vorhandene atomare `createCustomerForIntakeAction`. Die Eingangskorrekturen und Quellen aus #168 bleiben erhalten; keine zweite Erfassungsstrecke.

Echte Server-Actions → DB/Event → erneuter Leser: **36/36 grün**. A11 **22/22**, Typprüfung, vollständiges Lint, Scope und Build grün. Echter Browser: Original → vorhandenen Kunden wählen → `intake_item.kunde_id` und genau ein `zugeordnet`-Ereignis → Original zeigt „Umhängen“ → dieselbe Erfassung und derselbe Original-SHA. Belege außerhalb des Repos unter `p63-local-camera/desktop-p64-original-assigned.png` und `desktop-p64-assigned-return-capture.png`. Kein vorweggenommener CI-/Preview- oder Mergeclaim. Die Migrationen aus Teil 3/4 bleiben bytegleich; die additive Teil-2-Lese-View wurde nach P47 mit Abbruchprobe angewendet, damals vollständige Repo-/Dev-Liste 75 = 75. Dev enthält inzwischen zusätzlich die freigegebene Teil-5-Migration (vollständiger Teil-5-Stack 76 = 76).

Bestehende Assertion alt → neu: „Was ist neu“ erwartete #168 zuerst → #173 zuerst, weil der neue Zuordnungs-Eintrag auf den 05.11. gehoben wurde. Die echte Datumssortierung und Prüfung des ersten Eintrags bleiben unverändert; gezielte Original-/Neuigkeiten-Tests **6/6 grün**. Generierte Assertions und Akzeptanztests unverändert. Die drei nicht mehr exportierten alten Reklamationsaktionen werden aus den H18-Ausnahmen entfernt; keine Ausnahme ergänzt.

CI am Kopf `3f46ce47`: [Generated BAUPLAN flows](https://github.com/schoggertraube-rev/galvanik-kreile-app/actions/runs/42018269701/job/127214175119) rot an G09 (Klick auf `aufgabe.speichern`, Element während des Klicks entfernt) sowie F07/O08 „Expected to fail, but passed.“ F07 wurde im vorgelagerten Teil 3 nach P50 bereinigt; hier wird ausschließlich der belegte O08-Rotmarker entfernt. Keine Assertion geändert. Der G09-Timeout bleibt bis zum neuen Nachweis offen; kein behobener Produktfehler behauptet.

Gezielter Nachweis dieses Schritts: frischer lokaler Supabase-Replay aller 75 Teil-4-Migrationen, Build und unveränderte **G09/O08/F07 3/3 tatsächlich grün**, einschließlich Trace. G09 ist lokal damit erneut nicht reproduziert; der neue CI-Lauf entscheidet über den Kandidaten, keine vermutete Produktkorrektur eingebaut. A11 vollständig ausgeführt: **19 grün / 3 rot**, ausschließlich authority/selftest/module-gates mit `DESIGN_POINTER_SYSTEM/FLOW/PAGE_BINDING`, nachdem die fremde Runde-53-UI-Lieferung während des Laufs im Arbeitsbaum eingetroffen ist. Diese Dateien bleiben unverändert und ungestaged; der Produktcommit enthält weiterhin nur die gebundene Runde 52 sowie die zwei eigenen Marker-/Abgabepfade. Bindungsbefund in NACHTLAUF C gemeldet; kein lokaler Gesamt-Grünclaim. Typprüfung, Lint, H18, H16, Scope-Selbsttest und Whitespace grün. Keine Erhöhung der Ausnahmen, kein Mergeclaim.

Gezielt ausgeführt: A04 und G09 tatsächlich grün, O05 tatsächlicher Erfolg mit veraltetem Rotmarker (XPASS). Ausschließlich O05 nach P50/Regel 20b aus der Rotliste entfernt; keine generierte Assertion geändert. Der erste zusätzliche Zuordnungs-Browserlauf stoppte vor der Aktion an einer absichtlich leeren F01-Fixture; mit der vorhandenen F07-Bestandskunden-Fixture besteht der echte Weg. Keine Produktkorrektur aus dem Fixture-Befund.

### G09: reproduzierte Ursache und eine Produktkorrektur

Der Transportfehler ließ den unbestätigten Schreibauftrag korrekt in `pending` stehen. „Erneut“ führte diesen Auftrag aber sofort aus. Dadurch schloss der erfolgreiche Retry den Dialog vor dem laut G09 folgenden Klick auf „Auf Der Tag“; ob dieser Klick noch traf, hing von der Antwortzeit ab. Bei einer regulären Fehlerrückgabe war der Schreibauftrag dagegen bereits zurückgesetzt und „Erneut“ blendete nur den Fehler aus. Das erklärt den Unterschied zwischen lokalem Erfolg und CI-Timeout.

Korrektur ausschließlich in `TaskDialog.tsx`: Mit vorhandenen Aufgabendaten entfernt „Erneut“ die Meldung; erst die ausdrücklich gewählte Hauptaktion schreibt erneut. Der unbestätigte Auftrag, alle Eingaben und derselbe `clientKey` bleiben erhalten. Ohne geladene Daten liest „Erneut“ weiterhin neu. Kein zusätzlicher Serverbefehl oder Datenweg.

Zusätzlicher Komponententest nach dem unveränderten G09-Ablauf: vor dem Fix deterministisch rot (zwei Schreibaufrufe statt einem unmittelbar nach „Erneut“), danach grün; der nächste Hauptklick verwendet denselben vollständigen Payload. Dieser Test verwendet isolierte UI-Ports und ist ausdrücklich **kein** DB-Nachweis. Zusätzlich besteht der unveränderte G09 mit echter Server-Action, Replay-DB und erneuter Anzeige **1/1 grün**, Build grün. Kein neuer Reset und keine Akzeptanz-Assertion geändert. Der lokale Build enthält die fremde Runde-53-CSS aus dem Arbeitsbaum und ist deshalb kein R52-Sichtnachweis; die neue CI prüft die tatsächlich committeten Quellen. „Was ist neu“ #173 nennt die konkrete Reparatur. Lokale A11-/exakte CI-Ergebnisse werden im Protokoll ergänzt.

**Draft, nicht abnahme- oder mergefähig.** Die nachstehenden SHA-, Preview- und Testergebnisse sind historische Nachweise. Der neu auf Teil 3 gestapelte Stand benötigt eigene CI-, Preview- und Sichtnachweise; Reklamationsaufnahme und kompletter Mailweg bleiben offen.

Produkt-SHA: **5dc31d9c17977624158e238c1a686bfd5e29232f**

Git-Preview genau dieses SHA: https://galvanik-kreile-werkstatt-nfz3icuvr.vercel.app · **READY**. GitHub-Deployment 7539200073, Vercel dpl_4HDBNxrcR3y2X5Q4vWAkZxHEZsZB. Kein Branch-Alias.

## Gebaut und belegt

- Aufgaben: genau public.tasks und ein Modul src/modules/tasks. orders.task bleibt Auftragsbeschreibung. Speichern, Lesen und Erledigen prüfen Sitzung, Tenant, Bezug, Zuständigkeit, Version und idempotenten clientKey; der Verlauf verwendet intake_item/intake_event.
- Warenannahme mit offenen Prüfpunkten: dieselbe Transaktion schreibt Warenbeleg, Auftrag, verknüpfte Aufgabe und Verlauf. Ein Retry erzeugt keine zweite Aufgabe. goods_receipt.aufgabe_id hat einen Tenant-FK auf tasks. Der feste W04 ist wegen des offenen Laufzettel-/Erfolgspfads weiter rot.
- Nachrichten: eine Projektion der kanonischen intake_item/intake_file-Daten, Filter und Gespräch; kein zweites Postfachmodell. Gruppen verwenden Kunde bzw. die gespeicherte gruppe_adresse, keine geratene Absenderregel. Offen/Erledigt werden nach einer Aktion erneut gelesen.
- M6: Liste nach den gebundenen R52-Klassen, ein Weitere-Eintrag, Rechte und Kontext. Die Wahl speichert über den einmaligen Teil-2-Befehl, bevor das Ziel öffnet. Ein Abbruch des Rückrufs lässt das Anliegen offen. Nur Info schreibt Event und liest den Stand zurück. × und Esc ändern keine Daten.
- 3.4: echte Vorschläge, Kundensuche über die bestehende Serversuche, Kunde zuordnen, kompatible Gruppenmitglieder mitnehmen, nachvollziehbarer Erfolg, gleicher Retry-Schlüssel, Schon-zugeordnet-Zustand. Ein konkurrierender anderer Vorschlag wird nicht überschrieben. Ohne Mails fehlen Mailtext, Betreff und Anlagen; Zuordnungsmetadaten bleiben nach ihrem Recht verfügbar.
- Neukunde aus Absender: der vorhandene Kunden-Writer und derselbe Zuordnungs-Writer laufen in einer Transaktion. Ein Zuordnungskonflikt rollt auch die Kundenanlage zurück. Kein zweiter Kunden-Schreibweg. Ein unverändertes Vorbelegungsformular gilt nicht als manuelle Änderung.
- Kein Geschäftsvorgang: Grund, vorher/nachher und Wiederholschutz; Originaldateien bleiben unverändert. Die Rechnungssicherung wird von derselben Funktion wie Nur Info geprüft.
- Mail → Erfassung übergibt die echte Quellen-ID und liest sie erneut. Unveränderter Originaltext erzeugt keine kopierte Notiz.
- P48: complaints.intake_item_id ist der neue Tenant-FK auf den auslösenden Eingang. complaints.item_id bleibt der bisherige Positionsbezug. Der neue Modul-Leser bildet itemId auf intake_item_id und legacyPositionId auf item_id ab. Auth-/Tenant-/Fehlerpfad und der bisherige Aufrufer sind gegen die echte DB geprüft.
- Geerbtes DELETE für service_role auf tasks und complaints entzogen; tatsächlicher SQL-Versuch mit WHERE false wird mit 42501 abgewiesen. Kein Datensatz dafür gelöscht.

## Ersetzt und Grenzen

Die zusätzliche Aufgabenprojektion auf Der Tag ist zurückgenommen; dort erlaubt das Paket bislang nur die Zeilenklick-Korrektur. Aufgabenmaske und Verlauf bleiben; kein neuer Tages-Einstieg wird behauptet.

Die alten Reklamations-Leser sind in src/modules/complaints aufgegangen. Der bisherige Repository-Pfad komponiert die öffentliche Fassade. Die nachweislich ungenutzten alten Schreib-Exports createComplaint/updateComplaint/resolveComplaint und die direkten Repository-Schreiber sind entfernt. Die neue Reklamationsaufnahme ist noch offen.

Die komplette Ablösung der alten communication-/scan-Pfade, Graph-Abruf und Antwortweg, weitere Nachrichtenaktionen und Reklamationsfolgen sind noch nicht abgeschlossen. Kein vollständiger Ersetzt- oder Liveclaim für Teil 4. Die Domänen-Dateiverknüpfung bleibt am gemeldeten P46-Entscheid offen.

## Tests und CI

| Prüfung | Ergebnis |
|---|---|
| A11 lokal | 22/22 PASS; finale Typ-/Lint-/Generator-/Whitespace-Prüfung nach den beiden Korrekturen zusätzlich PASS. Volle Units nach Owner-Freigabe in CI |
| Build | PASS auf aktuellem Produktstand |
| Feste Browserfälle | mailein 15/15 und anliegenwahl 7/7, gemeinsam final 22/22 PASS gegen echte Replay-DB |
| Echte Server-Actions | 30/30 PASS, mit DB-Zeile, Event, erneutem Lesen, Retry, Rechteprüfung und atomarem Rollback |
| Bestehende UI-Fälle | 58/58 im vorangegangenen M6-Schritt; keine unveränderte Vollsuite wiederholt |
| H18-Inventar | 275 Funktionen, 115 Writes, 54 getestet, 61 Ausnahmen; keine neue Ausnahme |
| Scope-Probe | Gesamter 224-Pfade-Stapel mit Checker aus TA-B2h 4e48201a PASS; Anker #172 noch offen |
| Modell | 306 feste Fälle, gebundener SHA DF3E1AFE…; Generator --check PASS. Keine Modell-/Assertionsänderung |
| Rotliste | 123 Einträge. Nur tatsächlich bestandene Fälle entfernt; keine Gesamt-Abnahmequote |
| CI am Produkt-SHA | Lauf 41782772056: Vercel READY; Replay, H12, H18 und Acceptance PASS. Generated und Units liefen beim Erstellen dieser Abgabe noch; kein Gesamtgrün-Claim |
| Voriger CI-Lauf 10764dd9 | Lauf 41778951651: einmaliger Docker-Ratelimit-/Portfehler; erneuter Replay/H12 PASS, danach PIN-Reset-Test rot (fehlendes pin_reset_requested, Zeile 327). Bekannter 32-Kandidaten-Pfad ist nicht geändert; Pfadfreigabe bleibt in NACHTLAUF C dokumentiert |

Die zuvor ausdrücklich bestätigten G05/G06/G10 bleiben positive Aufgabenfälle; G11 hängt am noch nicht gebauten Eingangsrechnungsziel. Der erste vollständige Teil-4-Lauf hatte tatsächlich 5 grüne und 49 rote Fälle; erwartete Fehler waren kein Bau-Nachweis. Kein neuer vollständiger Sicht-PASS wird daraus abgeleitet.

## Teständerungen, einzeln

- Keine bestehende Produktassertion im Schritt 5dc31d9c geändert. Die drei zusätzlichen H18-Fälle konkretisieren die vorgegebenen M02/M03/M10, M05/M12 sowie Neukunde-aus-Absender; sie rufen die echten Actions auf.
- Harness-Aufruf alt: nur ziel/arg. Neu: zusätzlich der tatsächliche Kanal der gebundenen Quell-Fixture, entsprechend der Nachricht in der UI. Der Kanal verändert nur die zutreffende Ladefehler-Beschriftung, keine Daten, Rechte oder Erwartung. Alle festen Assertions bleiben gleich.
- Mechanische H18-Fixture: JSON-Wert mit sql.json statt doppelt serialisierter JSON-Zeichenkette; unverändertes Soll. Version des Originaleingangs wird aus der DB gelesen.
- P62/N14, G09 und B11: Die Netzunterbrechung im bestehenden Harness trifft gezielt die jeweilige aus dem Next-Build-Manifest ermittelte Schreibaction statt einen beliebigen parallelen Leseaufruf. Der Nachweis des fehlgeschlagenen Requests ist auf dieselbe Action beschränkt; Anzeige-, Wiederholungs- und Datenbank-Assertions bleiben unverändert. Der Nachrichten-Schreibfehler bleibt unabhängig von erneutem Lesen sichtbar. Die vollständige CI und Sichtprüfung am neuen SHA stehen noch aus.
- Bereits im Stapel korrigierter O07: getIntakeCaptureAction alt OK mit redigiertem Text → neu FORBIDDEN ohne Mail-Inhalt und ohne Zeilenänderung; der separate Original-Leser liefert weiterhin echte Metadaten/Prüfsumme, restricted=true und keine URLs. Keine Owner-Modell-Assertion geändert.

## DB-Beleg und Migration

supabase/migrations/20261104012000_ein4_nachrichten.sql

SHA-256: **EB651DF6F4B147285A7A9302E38243825B4EBA8B094F17F90E77BF13E9237753**

Zum Erhebungszeitpunkt des ursprünglichen Belegs: lokaler frischer Replay 72 Repo-Versionen = 72 Replay-Versionen, Dev 70 Versionen und Kunden/Aufträge/Positionen/Eingänge 13/12/14/8. Aktuelle Dev-Anwendungen und der jeweilige Gleichstand stehen im NACHTLAUF unter C; dieser historische Stand belegt keinen heutigen Gleichstand. Keine neue Dev-Migration im P62-Schritt.

Action-Belege: Bestätigte Zuordnung schreibt kunde_id, zuordnung=bestaetigt, Version+1 und ein Event; kompatibles Gruppenmitglied wird hand zugeordnet, anderer Vorschlag bleibt offen. Retry schreibt kein weiteres Event. Privat schreibt einsatz=erledigt, einsatz_aktion=kein_gv, Grund, leere offenen Anliegen und keine Kunden-/Vorgangszuordnung; dieselbe Originalzeile bleibt unverändert. Der Erledigt-Leser findet sie wieder. Neukundenkonflikt lässt Kundenanzahl unverändert; erfolgreicher Retry liest denselben Kunden und dieselbe Zuordnung.

P48-Beleg: unveränderte Positions-ID und neue Quellen-ID nebeneinander; Fremd-Tenant-FK wird mit 23503 abgewiesen. Dev-Bestandsprüfung vom 04.11. 04:10 UTC war read-only und ergab 0 Reklamationen.

## Noch kein Owner-Klicktest

Vor einer Abnahme fehlen die übrigen Teil-4-Wege, finale Dev-Anwendung und der eigene Original-Sichtlauf für alle Teil-4-Seiten. Die READY-Preview ist ein Zwischenstand. Bis dahin kein Merge und keine Owner-Klickprüfung als fertig anfordern. P49 priorisiert jetzt die Merge-Reife der Teile 0/0b/1/2 und den Anker.

## Finalisierung Runde 52 · 05.11. 19:40 CET

Dieser Abschnitt ersetzt nur die älteren Zwischenstands-Aussagen über die
Teil-4-Produktprüfung. Der feste Umfang des Drafts bleibt unverändert.

- **Produkt-SHA:** `71c5f5c07db024d3ea5afb99d042ea5fd665f6fd`
- **Produkt-Preview genau dieses SHA:** https://galvanik-kreile-werkstatt-qe3cgvktn.vercel.app
- **Stapelung:** Der nachfolgende technische Restack übernimmt nur den
  Teil-3-Delivery-Nachweis; gegenüber dem Produkt-SHA ändert sich kein
  Teil-4-Produktpfad.

| Nachweis am Produkt-SHA | Ergebnis |
|---|---|
| Vercel und Vercel Preview Comments | PASS |
| `agentur-gate` | PASS – Typecheck, H16, H18 und Unit-Tests grün |
| `h16-schema` | PASS – frischer Migrations-Replay, H12-SQL-Verträge, H18 echte Server-Actions, alle Akzeptanztests und Generated-BAUPLAN-Flows gegen die Replay-DB grün |
| Scope, Whitespace, H18 und No-Fake | PASS |

Der unveränderte Runde-52-Sichtprüfer lief gegen diese READY-Preview für
`mailein,nachrichten,aufgabe,reklamation`: **0 grün / 33 gelb / 0 rot**.
Bericht: `C:\Users\Traube\.codex\visualizations\2026\11\05\part4-71c5f5c0\sicht-r52-exact\pruefbericht.json`.
Jede gelbe Zeile ist die explizite `pfad:null`-Offenlegung der R52-
`routen.json`; für die datenabhängigen Dialoge wurde weder eine neue Route
erfunden noch ein Dev-Datensatz angelegt. Die kanonische Sicht-Verkabelung
kommt mit der gebundenen Runde-53-Angleichung und bleibt nach Regel 22 aus
diesem festen Teil-4-PR heraus.

Der gestapelte aktuelle Kandidat muss nach dem Push noch seine eigene
unveränderte CI- und READY-Preview erhalten. Erst dann wird #173 nach
P54/P68 als merge-reif gemeldet; dieser Abschnitt macht keinen vorgezogenen
Merge- oder Live-Claim.
