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

AF-5/6/8/9/10/12/18 sowie die übrigen gebundenen mittleren Regeln, vollständige Sicht-/CI-/Planungsprüfung und Preview des abschließenden SHA. Dieser Teilstand ist kein vollständiger Kreislauf-PASS. Kein Merge/Production/Remote-Datenänderung in diesem Schritt.


## AF-17: abgesagten KV auch auf der SQL-Grenze sperren

Additive Migration `20261108165057_quote_decline_write_guard.sql` übernimmt die vorhandene `update_quote_v1` mit identischer Signatur und sämtlichen bestehenden Validierungen/Receipts/Terminregeln. Genau die Statusbedingung ist strenger: `abgesagt_am IS NOT NULL` verbietet neue Änderungen. Die vorhandene Definer-Eigenschaft/ACL wird weder erweitert noch neu eingeführt; kein neuer privilegierter Einstieg.

Abbruchprobe und lokale Anwendung PASS. Bestehender echter KV-04/05-Replayfall ergänzt: Versand → Zusage → neue Fassung → Absage → Versuch weiterer Termin-/Preisänderung → CONFLICT, Version 5/Betrag 1100 Cent/Absagegrund unverändert, kein Update-Receipt; View neu gelesen. PASS 4,69 s. Historische Wiederholungen bestehender Receipts bleiben nachvollziehbar. Eine kopierte Konsolenbeschriftung des lokalen Helfers nannte zunächst die Vorgängernummer; SQL-Datei und eingetragene Migrationsversion sind 20261108165057, Beschriftung korrigiert, kein zweites Anwenden.
