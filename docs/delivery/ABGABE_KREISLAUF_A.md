# Kreislauf A — kritische Fälle, laufender Bau

**Draft, nicht mergefähig.** Basis main e8aff802. Paket: `_review/pakete/AP-KREISLAUF-REGELN.md`, Teil A (KRITISCH 1–3). Server für AF-3/4/13 ist unten gezielt belegt. Offen bleiben die sichtbaren Anschlüsse an die eine KV-Karte nach #200, die entsprechende operative Verlängerungsfreigabe und Dev-Migrationsgleichstand nach #200. Keine neue Produktquelle und kein Paketabschluss behauptet.

## AF-1: Fachanliegen bleiben offen

Ein gemeinsamer Vertrag erkennt offene Zusage, Absage, Vorbehalt (aktueller Schlüssel `preis_einwand`, historisch `kv_vorbehalt`), Reklamation und Termin. `finishIntakeUse` sperrt generisches Info/Erledigt unter der vorhandenen Sperre in derselben Transaktion, auch in gemischten Stapeln. Der zweite generische Info-Zweig von `setIntakeNoBusiness` verwendet dieselbe Regel. Explizite Werbung/Privat/Fehlzustellung/Duplikat mit bestehendem Grund bleibt erhalten. Ein vorhandener Fachbezug allein erledigt kein offenes Anliegen.

UI: generische Nur-Info-/Erledigt-Knöpfe sind bei diesen offenen Entscheidungen durch den konkreten Fachschritt ersetzt; normale Notizen behalten Info. Gleiche vorhandene Auswahl-/Fachwriter, keine neue Erledigungsstrecke. Veraltete Beschriftung „KV annehmen → Auftrag“ ist „Zusage übernehmen · Ware erwartet“ (Paketpunkt 13).

Echter lokaler Replay-Fall: fünf Anliegen über originale Notiz-/Auswahl-Actions angelegt; je Info/Erledigt und Nebenweg versucht → VALIDATION_ERROR, beide Stapelzeilen/Versionen/Anliegen unverändert, kein Erfolgsevent, Ansicht per `getIntakeCaptureAction` neu gelesen. PASS 6,04 s. Zwei gezielte echte Menü-Renderfälle PASS 2,80 s, keine Tests abgeschwächt. Synthetische Testtexte mussten zur vorhandenen Rückruf-Erkennung passen und der Testlogin die tatsächlichen Auswahlrechte besitzen; keine Produktberechtigung geändert.

Lokale Schema-Besonderheit: Replay/Dev haben bereits die geprüfte PR-200-Migration 20261108151002; main hat sie noch nicht. Für den unveränderten Repo=Replay-Vortest lag ausschließlich diese kanonische Migration aus dem anderen eigenen Branch vorübergehend bytegleich zur bereits angewendeten Windows-Fassung vor (SHA c23b936e…). Danach entfernt; nicht Bestandteil dieses PR, kein SQL ausgeführt, keine DB zurückgesetzt und keine Paritätsassertion gelockert. Fresh CI prüft diesen Branch separat ab main.

## AF-2: Versand bleibt reklamierbar

Auswahl und Writer akzeptieren abgeholt/versendet konsistent. Echter lokaler Replay-Lauf PASS 4,86 s: Auftrag über vorhandene Anlage, Galvanik, Teil fertig, Freeze und `recordGoodsOutAction(mode=versand)` wirklich geliefert; danach Reklamations-Action → eine DB-Zeile, Actor-Ereignis, gleicher Retry, echte Ansicht neu gelesen. Der derzeitige Versandwriter speichert kanonisch `station=abgeholt` und Event `mode=versand`; genau das ist belegt. Der zusätzliche historische Wert `station=versendet` wird vom Guard akzeptiert, wurde nicht künstlich in einen live entstandenen Auftrag geschrieben. Keine Statusfälschung, kein Mock, keine zweite Reklamation.

## Rest

AF-3/4/13 weiterbauen, anschließend vollständige gezielte Abnahme/Preview/CI/Planungsprüfung. Keine Migration in diesem Teilstand, keine Remote-Datenänderung, kein Merge. Die Foto-Pflicht AF-10 ist ein späterer Paketpunkt und hier nicht als umgesetzt dargestellt.

## AF-3 Server-Teilschritt: Gültigkeit ohne neue Inhaltsfassung

Der vorhandene Lifecycle-Writer versteht die eigenständige Handlung `extend` mit neuem Datum und Begründung. Bestehende Quote-/Positionsrevision, Versionssperre, Journal und Retry bleiben der einzige Schreibweg. Nur ein späteres bisheriges Gültigkeitsdatum und heute/später sind zulässig; ungültiges Datum, veränderte Kennung, abgesagter/umgewandelter Stand bleiben gesperrt. Der Verlängerungsschritt löst keine neue Inhaltsfassung aus und beendet kein Anliegen still.

Echter Replay-Fall PASS 4,72 s: abgelaufenen KV wirklich angelegt → verlängert (Fassung 1/1000 Cent unverändert) → gleicher Retry/anderer Intent abgewiesen → versendet und zugesagt → nochmals verlängert (Zusage/Fassung 1 bleiben) → zwei korrekte Actor-Ereignisse und aktuelle Ansicht neu gelesen. Typen/Lint/Scope/Diff PASS. Keine neue Migration. Der sichtbare Anschluss an die einzige KV-Karte sowie die operativen Rechte werden nach dem Rebase auf PR 200 ergänzt; keine zweite Karte in diesem Branch. AF-3 damit noch kein vollständiger UI-/Waren-Kreislauf-PASS. AF-4/13 Rückgabe und Ware nach Absage bleiben weiter offen.

Nebenläufigkeit nachgezogen: der Lifecycle-Writer sperrt zusätzlich die kanonische KV-Zeile, bevor Version und Inhalt gelesen werden. Zwei echte parallele Verlängerungen derselben Version liefern genau einmal OK und einmal CONFLICT, danach genau eine zusätzliche Version und ein Actor-Ereignis; Fassung/Zusage bleiben unverändert. Erweiterter AF-3-Replay PASS 4,86 s. Keine pauschale technische Fehlerantwort und kein zweites erfolgreiches Überschreiben.


## AF-4/13 Server: Rückgabe mit erhaltenem Original und echtem Beleg

Neue additive Migration `20261108163051_quote_goods_return_receipt.sql`: die vorhandene Warenbeleg-View zeigt den tatsächlichen Rückgabebeleg aus einem unveränderlichen `intake_event`. Ein eindeutiger Index erlaubt pro vorhandenen Warenbeleg höchstens eine Rückgabe. Keine neue Tabelle, keine Löschung, keine rückwirkende Änderung des alten Prüfstatus; der Beleg bleibt erreichbar. Aktive KV-Waren-/Mengenleser schließen tatsächlich zurückgegebene Ware ausdrücklich aus.

`recordQuoteGoodsReturnAction` verwendet den bestehenden Eingangsmodul-Kontext. Jeder echte aktive Login darf die Rückgabe eines abgesagten KV ohne Auftrag bestätigen, mit aktuellem KV-/Belegstand und Grund. Der Writer sperrt Kennung, KV und Warenbeleg, schreibt genau einen Actor-Beleg mit Kunde/KV/Ort/Menge/Grund/Zeit und liest ihn in derselben Transaktion zurück. Derselbe Schlüssel liefert denselben Beleg, geänderter Inhalt oder zweite Rückgabe ist CONFLICT. Die tatsächliche Quelle und alle Fotos bleiben am KV. `getQuoteGoodsReturnsAction` liest dieselben Belege ohne Finanzdaten; Route-Revalidierung nach Erfolg.

Ware nach Absage läuft durch denselben bestehenden Warenannahme-Writer und bleibt gesperrt; sie wird weder zum Auftrag noch unsichtbar abgewiesen. Zwei echte Replay-Fälle PASS 5,21 s: Ware vor/nach Absage → Rückgabe durch echten Testlogin **ohne Bereichsrechte** → Retry/anderer Grund/zweite Kennung → genau ein Actor-Ereignis → Historienbeleg und KV neu gelesen → aktive Ware leer, alte Prüfzeile/2 Originalfotos erhalten, kein Auftrag. Finanz-Leser bleibt für diesen Login FORBIDDEN. Die Fotos sind ausdrücklich isolierte kanonische Original-Metadatenfixtures, kein externer Upload-Nachweis. Die Nach-Absage-Fixture liest die neuen Positions-IDs der aktuellen Version tatsächlich neu, statt alte IDs zu verwenden.

Lokale View-/Index-Abbruchprobe PASS, neue Migration lokal angewendet. Typen/Lint/Scope/W4 PASS, Modul-Gate nur fremder DESIGN_POINTER_PAGE_BINDING. H18: 309 Aktionen, 87 belegte Klassifizierungen, 59 unveränderte Ausnahmen. Neue Actions sind mit den echten Replay-Fällen belegt; kein Gate geändert. Dev noch nicht angewendet: der autorisierte gemeinsame Vorgänger 20261108151002 liegt in #200 und ist bereits in Dev, aber noch nicht in main. Nach #200-Merge folgt Rebase, Abbruchprobe/Anwendung der neuen View und strenger Gleichstand. Keine Dev-Parität dieses Branches vorgetäuscht.

Korrektur zum Konkurrenznachweis: Die urspruengliche Lifecycle-Funktion sperrte die kanonische KV-Zeile bereits vor dem Lesen. Die in 3aee6bbb zusaetzlich eingefuegte zweite identische Sperrabfrage war redundant und ist entfernt. Der echte Konkurrenzfall und seine Assertions bleiben erhalten; es gab keinen zuvor fehlenden Zeilenschutz.

## U249: operative Zusage/Verlaengerung ohne Geldfreigabe

recordQuoteDecisionAction fuehrt nur persoenliche Zusage oder begruendete Gueltigkeitsverlaengerung ueber denselben vorhandenen Lifecycle-Writer aus. Jeder aktive Login ist dazu berechtigt. Der Rueckweg liefert ausschliesslich Nummer/ID/Version/Fassung/Gueltigkeit/Zusagefassung/Actorbeleg, keine Positionen/Betraege und keine allgemeine KV-Lesefreigabe. Versand, Bearbeitung und Mailquellen sind an diesem operativen Einstieg ausgeschlossen. Bestehende Rollen/Session-/allgemeine Aufgabenrechte unveraendert.

Die vorhandene Nachfassaufgabe wird bei Zusage in derselben Transaktion durch den vorhandenen Aufgaben-Abschlusswriter erledigt. Enger interner Auftrag: nur die deterministische Nachfasskennung dieses wirklich zugesagten KV und dieser Fassung; keine allgemeine Aufgabenfreigabe. Statt eine dem Login verbotene neue Eingangsnotiz zu erzeugen, schreibt diese Folgehandlung ihren Actorbeleg QUOTE_FOLLOWUP_COMPLETED_V1 in das vorhandene Ereignisjournal. Das ist derselbe Aufgabenbestand, kein Schattenmodell.

Echter Replay PASS 4,25 s: zwei Logins, Operator wirklich ohne Bereichsrechte; alte Finanzaktion bleibt FORBIDDEN, operative Verlaengerung und Zusage erfolgreich; exakte Antwortschluessel ohne Geld/Positionsdaten, unveraenderter Preis und Fassung, Retry/Konflikt, zwei Lifecycle-Actorereignisse. Tatsaechlich angelegte offene Nachfassaufgabe wird durch denselben Operator genau einmal erledigt und mit eigenem Actorbeleg belegt. Allgemeiner Aufgabenabschluss bleibt FORBIDDEN; eine angebliche Mailquelle und Versandaktion werden abgewiesen; KV-Finanzlesen bleibt FORBIDDEN. Kein neuer Schreibweg zur KV-Tabelle.

Der erste Realtest zeigte die bisherige Kopplung des Nachfassabschlusses an Geld/Auftraege. Ein gezielter Fix begrenzt die interne Erlaubnis auf die gepruefte KV-Zusage und den vorhandenen automatischen Aufgabenschluessel. Zwei rein mechanische Testvorbedingungen (nicht abgelaufene gedruckte Fassung, isolierte Firmeneinstellungsfixture) wurden hergestellt, keine Assertions entfernt. H18 310/147/88/59, Typen/Lint/Scope sauber, Module nur fremder Quellpointer. UI-Anschluss und Umwandlungsrechte bleiben noch offen.

Operativer Lesekontext ebenfalls eng vorhanden: getQuoteOperationContextAction gibt nur Arbeitsstand/Nummer/Kunde/Version/Fassung/Termin/Zusage und Warenbeleg-Ziele zurueck. Exakte erlaubte Antwortschluessel am echten bereichslosen Login getestet; Finanz-ReadAction bleibt gesperrt. Realtest inkl. Zusage/Nachfass-Actor und Kontext-Neulesen PASS 4,46 s. Keine Preise/Positionen in diesem Kontext. UI-Anschluss bleibt offen.

## Anschluss nach Owner-Merge #200

main72671bf1 integriert, Telefon-Transaktion/U249/Undo und alle main-Tests erhalten. Die zusaetzlichen Adapter recordQuoteDecisionAction/getQuoteOperationContextAction sind entfallen: die vorhandene changeQuoteLifecycleAction uebernimmt persoenliche Zusage und Gültigkeitsverlaengerung, readQuoteAction purpose=operations liefert den schon auf main vorhandenen finanziell redigierten Arbeitsstand. Eine oeffentliche fachliche Strecke. Allgemeine KV-Aenderung/Versand und normale Aufgabenrechte unveraendert.

Gezielte Replaypruefung der Integration: AF3, AF4/13 und die drei main-Telefon/Undo-Varianten PASS im ersten Lauf (6 Faelle). Operativer Zwei-Login-Fall nach mechanischer Anpassung an die kanonische main-Fehlerantwort PASS: nicht existierende Quelle ergibt NOT_FOUND statt des entfernten Adapter-Validierungsfehlers, kein Erfolg; Zusage/Verlaengerung/finanzielle Redaktion/Actor/geschlossene Nachfassaufgabe/Retry/Konflikt separat nachgelesen. Alte Adapter-Schluesselassertions werden ersetzt durch explizit totalNetCents=null, alle Positionspreise=null und calculation=null an derselben main-Antwort; kein Privacy-Pruefinhalt entfallen.

Typen/Lint/W4/H18/Scope geprueft; H18 312/149/90/59 ohne neue Ausnahme. Sichtbarer Verlaengerungs-/Rueckgabeanschluss, Dev-Paritaet und PL-/Gesamtabnahme stehen weiter aus; Draft bleibt, keine Owner-Merge-Bitte.
