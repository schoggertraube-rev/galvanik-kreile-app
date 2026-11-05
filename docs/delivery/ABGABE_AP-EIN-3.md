# AP-EIN Teil 3 · Warenprüfung und Original, Runde 52

## Aktualisierung P63/P64 · 05.11.

Teil 3 übernimmt die Eingangskorrekturen aus #168 einschließlich `003a6a68` (Datei-Einstieg und PC-QR-Unterzeile). Der vorhandene Original-/Waren-Dialog bestätigt nun dem bestehenden Navigationsbus, dass er tatsächlich geöffnet wurde. Dadurch kann 3.0 seine Ebene bei „Original ansehen“ behalten und bei der Warenannahme gezielt schließen; ohne Empfänger bleibt ein sichtbarer Fehler. Keine zweite Originalansicht oder Erfassung.

Die bisherigen Wiederholungs-/Parallelitäts-Schutzregeln der Originalerkennung, die geprüften Vorschlagsmerkmale und die neuen Art-Vorschläge aus U-241 bleiben zusammen erhalten. XML geht auch nach dem Zusammenführen niemals an OCR. Echte Actions → lokale DB/Storage → erneuter Leser: **27/27 grün**. Die additive Lese-View aus Teil 2 wurde nach P47 mit Abbruchprobe auf Dev angewendet (vollständiger damaliger Teil-4-Stack 75 = 75; inzwischen liegt auch die Teil-5-Migration auf Dev). Neue CI, READY-Preview und Sichtbericht stehen noch aus; historische URLs unten belegen diese Aktualisierung nicht.

CI am vorherigen Produkt-SHA `d32ad607`: [Lauf 42018265653](https://github.com/schoggertraube-rev/galvanik-kreile-app/actions/runs/42018265653/job/127214162416) hat genau einen Fehler: **F07 „Expected to fail, but passed.“** Der unveränderte Fall öffnet bei unklarer Art die erwartete Ware und deren vorhandene Warenprüfung erfolgreich. Deshalb ausschließlich den veralteten F07-Rotmarker nach P50 entfernt; keine Erwartung oder Assertion geändert. Die übrigen 305 Runner-Ergebnisse enthalten weiterhin erwartete Fehler und sind kein Nachweis von 305 gebauten Funktionen.

A11 **22/22**, Scope und Build grün. Echter Browser: 3.0 → Original mit gespeichertem SHA und `geoeffnet=true` → zurück zu derselben Erfassung grün; externe Bilder `desktop-p64-original-open.png` / `desktop-p64-original-return.png`. Unveränderter 37-Fälle-Lauf: Runner 37 akzeptiert, davon **8 tatsächlich grün, 29 erwartete Fehler**. Das ist keine Merge-Reife. Rest unverändert einzeln in `_erwartet_rot.json`; insbesondere Zuordnung im Gespräch benötigt Teil 4, XML den bestehenden Rechnungsparser aus Teil 5, Teil-Galvanik und der bekannte Altanhang-Pfadvertrag bleiben offen. Keine Assertion geändert oder durch neue Testdaten ersetzt.

**Draft #171, nicht abnahmefähig und nicht merge-reif.** Der nachstehende Stand ist historisch; die aktuelle gestapelte Fassung übernimmt die P55/P56-Korrekturen aus Teil 2 und benötigt neue Preview- und CI-Nachweise. Historischer Produkt-SHA: `7838f1f80c3fcbf73ae642742b5145a0d1d3de0f`.
READY-Preview genau dieses SHA: https://galvanik-kreile-werkstatt-457nqh912.vercel.app (GitHub-Deployment 7540900422, Vercel dpl_Q4yStGZoLFRoPesrC2SWL1Sk5WJY). Basis ist Teil 2 `65172a16`. Kein Merge und kein Production-Deploy.

## Gebaut und ersetzt

- Ein Warenprüfungs-Baustein für bestehende Aufträge: Zustand, Packstücke, tatsächliche Positionen/Mengen, unveränderte Foto-Originale. Erfassung und bestehende Aufträge bekommen keinen zweiten Waren- oder Stationsschreibweg.
- Annahme schreibt goods_receipt, orders.ware und Verlauf zusammen; Galvanik nutzt den bestehenden Stationsbefehl. Version, Idempotenz und bestätigte Identität sind geschützt. Ein bestätigter Beleg lässt sich nicht wieder zum Entwurf überschreiben.
- Fotos nutzen vorhandenen Upload/Storage und den einen Puffer für unbestätigte Originale. Ein Foto verlässt den Puffer erst nach bestätigter Speicherung und Zuordnung.
- Originalansicht: reale Storage-Bytes, SHA-256-/Formatprüfung und signierter Download. Öffnen und „Am Original geprüft“ sind getrennt protokolliert. Ohne Mail-Recht nur erlaubte Metadaten/Prüfsumme, keine Mail-Inhalte/Download-URL. FILE_BLOCKED geht in das vorhandene Fehlerprotokoll.
- Neuer Fix: Supabase gab service_role über Defaultprivilegien trotz des eingeschränkten GRANT auch DELETE/TRUNCATE. Die bis dahin nicht auf Dev angewendete ein3-Datei widerruft jetzt vorher auch service_role-Rechte. Genau eine SQL-Zeile geändert; keine neue Produktfunktion, keine gelockerte Regel.

Fundstellen: src/modules/eingang/ui/{GoodsInspectionForm,GoodsReceiptDialog,OriginalDialog,IntakeObjectDialogs}.tsx; src/modules/eingang/server/{goodsReceipt,intakeOriginal}.ts; vorhandene Actions src/app/actions/eingang.actions.ts; Ports goodsReceiptOrderPort.ts/intakeOriginalAudit.ts. Die noch fehlende Verknüpfungsumstellung von domainAttachment ist unten ausdrücklich offen.

## Prüfungen am Produktstand

| Prüfung | Ergebnis |
|---|---|
| A11, Typen, vollständiges Lint, Whitespace | 22/22 PASS; Vollsuite gemäß Owner parallel in CI |
| Aktuelles Scope-Gate, Generator --check | PASS; alle 306 Modell-Assertions unverändert |
| Produktions-Build | Vorgänger 339c9750 PASS; dessen Laufzeitquellen sind unverändert, anschließend nur Rotlisten-/Abgabeabgleich und SQL-Grant-Fix |
| Frischer lokaler Replay | 71/71, korrigierte ein3-Datei vollständig neu abgespielt |
| Echte Server-Actions → DB/Event → erneute Ansicht | 21/21 H18, src/test/h18_customer_actions.integration.test.ts |
| Tatsächliche DELETE-/TRUNCATE-Versuche als service_role | Jeweils SQLSTATE 42501; SELECT/INSERT/UPDATE erlaubt; anon/authenticated ohne SELECT |
| 37 eigene Modellfälle | Aus den bisherigen Läufen 8/37 tatsächlich belegt: W01/W03/W05/W11/W13/W15/W16/O07; übrige offen, kein vollständiger PASS |
| Globale Rotliste dieses gestapelten Stands | 137; bestandener M08b-Marker aus Teil 2 entfernt, K22/E09 mit U-240 begründet |
| CI | Aktueller Kopf läuft neu. Letzter Vorläufer 339c9750: agentur PASS, H18 scheitert ausschließlich am bereits gemeldeten PIN-Reset-limit(32); run41791766402, h18_settings_actions.integration.test.ts:327. Fehlende Auth-Pfade sind in NACHTLAUF C gemeldet. Kein Gesamtgrün-Claim. |

Technische Testanschlüsse: echte synthetische Originalbytes in lokalem Storage, Metadaten/Hash daraus berechnet; Akkordeon vor einer bezeichneten Bedienung öffnen; DB-Zwischenassertionen am jeweiligen Schritt ausführen; reine Erwartungsschritte ohne Aktion bleiben prüfbar. Keine feste Akzeptanzdatei und keine Owner-Modell-Erwartung geändert.

Bestehende Assertions alt → neu: O07 erwartet für den geschützten Intake-Inhaltsleser FORBIDDEN statt redigiertem OK, zusätzlich unverändertes Original und keinen Mailtext; der separate Metadatenleser bleibt OK/restricted/ohne URLs. Das Original-Ereignis zählt 3 → 4 durch den ausdrücklich protokollierten Erkennungsstart; bisherige Ergebnis-/Originalprüfungen bleiben. Für den Rechtefix wurde keine dieser Assertions verändert.

## Dev-Migration und Datenbeleg

Datei: supabase/migrations/20261103191000_ein3_warenpruefung.sql.
SHA-256: `8897E5116BC8B9D9D26F06F40F016533565DF0A3EF95B4A14673F100FFB547E3`. **Nach P47 auf Dev angewendet und ab jetzt eingefroren.**

Probe mit erzwungenem Rollback: 2026-11-04T07:51:39.300Z; während der Probe 71 Versionen, danach wieder 70, neue Tabelle nicht vorhanden, Bestand unverändert. Anwendung: 2026-11-04T07:52:24.957Z; anschließend **Repo=Dev 71/71**, Ledger-SQL bytegleich. Tenant-RLS aktiv, service_role nur SELECT/INSERT/UPDATE; DELETE/TRUNCATE=false, anon/authenticated SELECT=false.

Bestehende Zeilenzahlen vor/nach Probe und Anwendung: Kunden 13, Aufträge 12, Positionen 14, Eingänge 8, Originale 0; neue Warenprüfungszeilen 0. Keine Testbuchung, kein Testnutzer und keine vorhandene Zeile gelöscht. Echte Buchungs-/Ereignis-/Readback-Prüfungen liefen ausschließlich mit synthetischen Daten auf der isolierten Replay-DB.

Private Laufbelege: .git/kreile-p50-ein3-dev-probe.json, .git/kreile-p50-ein3-dev-apply.json, .git/kreile-p50-goods-grants.json und .git/kreile-ein3-round52-p50GoodsGrant.log. Die ältere Aussage über fehlende Dev-Vorgängermigrationen/den chrom-Lesefehler ist überholt: P47 hat die Bestandsumstellung und den Tagesleser nachgezogen. Zugang zu geschützter Vercel-Preview funktioniert; kein offener SSO-/403-Blocker.

## Sichtprüfung und offener Zustand

Originalprüfer FDA7C59C und Sichtvertrag B1A53EA6 unverändert auf genau dem READY-Produkt-SHA: **0 grün / 3 gelb / 3 rot**, sechs Einträge über alle drei Größen. Bericht: C:/Users/Traube/.codex/visualizations/2026/11/03/01a1a122-06c4-7570-a4d3-dc1eedb311aa/sicht-7838f1f8-ware-original/pruefbericht.json; Bilder daneben. Ausgabe ausschließlich außerhalb des Repos.

- Ware: echter Dev-Auftrag A-2026-0012 über den bereits vorhandenen Objekt-Deep-Link `/#ware:41f3bbc8-bfbf-49a7-841d-6e1d41ad818c`. Kein erfundenes Objekt. Je Größe 8 rote Befunde: Fotos/Zustand haben als nummerierte Akkordeonköpfe einen anderen Namen; Rest kommt noch/Alle stimmen/stimmt sind im anfänglichen Fotos-Schritt verborgen. Das Prüfbild zeigt dagegen Inhalt nach bereits geprüften Vorgängerschritten. Die Karte wurde nicht umgeschaltet, weil das bereits einen neuen Warenprüfungsentwurf auf Dev persistiert. Konflikt und Empfehlung für einen gebundenen Anfangszustand stehen in NACHTLAUF C.
- Original: drei gelbe Einträge, weil Dev 0 intake_file-Zeilen hat. Es wurde kein künstliches Original auf Dev erzeugt. Die echten lokalen H18-Tests belegen den Serverweg; dies ersetzt keinen Preview-Sicht-PASS.

Weitere offene Arbeit: Integration des gemeinsamen Warenbausteins in die Erfassung; Restannahme/Druckweg; Aufgaben/Abweichungsantworten aus Teil 4; Stations-Fixture in_arbeit gegenüber kanonischem galvanik; domainAttachment-Verknüpfung nach P46 auf intake_file/file_id samt Bestandsmigration (zusätzliche Pfade bisher nicht freigegeben). Keine zweite Ablage, keine umbenannte Spaltenbedeutung, kein neuer Provider.

Owner-Klickweg für den lesenden Zwischenstand: READY-Preview oben → vorhandenen Profilzugang → denselben vorhandenen Waren-Deep-Link öffnen → Fotos/Zustand/Inhalt ansehen. Speichern/Annehmen ist keine abgeschlossene Owner-Abnahme dieses Drafts; erst nach Schließen der offenen Fälle und grünem Sichtlauf. Kein Erfolg oder Livefähigkeit behauptet.
