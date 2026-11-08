# Kreislauf A — kritische Fälle, laufender Bau

**Draft, nicht mergefähig.** Basis main e8aff802. Paket: `_review/pakete/AP-KREISLAUF-REGELN.md`, Teil A (KRITISCH 1–3). Noch offen: AF-3/4/13 (abgelaufener bzw. abgesagter KV, vorhandene Ware verlängern/zurückgeben/weiter sicher annehmen). Keine neue Produktquelle und kein Paketabschluss behauptet.

## AF-1: Fachanliegen bleiben offen

Ein gemeinsamer Vertrag erkennt offene Zusage, Absage, Vorbehalt (aktueller Schlüssel `preis_einwand`, historisch `kv_vorbehalt`), Reklamation und Termin. `finishIntakeUse` sperrt generisches Info/Erledigt unter der vorhandenen Sperre in derselben Transaktion, auch in gemischten Stapeln. Der zweite generische Info-Zweig von `setIntakeNoBusiness` verwendet dieselbe Regel. Explizite Werbung/Privat/Fehlzustellung/Duplikat mit bestehendem Grund bleibt erhalten. Ein vorhandener Fachbezug allein erledigt kein offenes Anliegen.

UI: generische Nur-Info-/Erledigt-Knöpfe sind bei diesen offenen Entscheidungen durch den konkreten Fachschritt ersetzt; normale Notizen behalten Info. Gleiche vorhandene Auswahl-/Fachwriter, keine neue Erledigungsstrecke. Veraltete Beschriftung „KV annehmen → Auftrag“ ist „Zusage übernehmen · Ware erwartet“ (Paketpunkt 13).

Echter lokaler Replay-Fall: fünf Anliegen über originale Notiz-/Auswahl-Actions angelegt; je Info/Erledigt und Nebenweg versucht → VALIDATION_ERROR, beide Stapelzeilen/Versionen/Anliegen unverändert, kein Erfolgsevent, Ansicht per `getIntakeCaptureAction` neu gelesen. PASS 6,04 s. Zwei gezielte echte Menü-Renderfälle PASS 2,80 s, keine Tests abgeschwächt. Synthetische Testtexte mussten zur vorhandenen Rückruf-Erkennung passen und der Testlogin die tatsächlichen Auswahlrechte besitzen; keine Produktberechtigung geändert.

Lokale Schema-Besonderheit: Replay/Dev haben bereits die geprüfte PR-200-Migration 20261108151002; main hat sie noch nicht. Für den unveränderten Repo=Replay-Vortest lag ausschließlich diese kanonische Migration aus dem anderen eigenen Branch vorübergehend bytegleich zur bereits angewendeten Windows-Fassung vor (SHA c23b936e…). Danach entfernt; nicht Bestandteil dieses PR, kein SQL ausgeführt, keine DB zurückgesetzt und keine Paritätsassertion gelockert. Fresh CI prüft diesen Branch separat ab main.

## AF-2: Versand bleibt reklamierbar

Auswahl und Writer akzeptieren abgeholt/versendet konsistent. Echter lokaler Replay-Lauf PASS 4,86 s: Auftrag über vorhandene Anlage, Galvanik, Teil fertig, Freeze und `recordGoodsOutAction(mode=versand)` wirklich geliefert; danach Reklamations-Action → eine DB-Zeile, Actor-Ereignis, gleicher Retry, echte Ansicht neu gelesen. Der derzeitige Versandwriter speichert kanonisch `station=abgeholt` und Event `mode=versand`; genau das ist belegt. Der zusätzliche historische Wert `station=versendet` wird vom Guard akzeptiert, wurde nicht künstlich in einen live entstandenen Auftrag geschrieben. Keine Statusfälschung, kein Mock, keine zweite Reklamation.

## Rest

AF-3/4/13 weiterbauen, anschließend vollständige gezielte Abnahme/Preview/CI/Planungsprüfung. Keine Migration in diesem Teilstand, keine Remote-Datenänderung, kein Merge. Die Foto-Pflicht AF-10 ist ein späterer Paketpunkt und hier nicht als umgesetzt dargestellt.
