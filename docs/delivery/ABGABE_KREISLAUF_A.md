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
