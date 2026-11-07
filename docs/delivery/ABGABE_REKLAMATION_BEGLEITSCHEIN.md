# Nacharbeit · Begleitschein

Freigegebene enge Folge zu #191, PL 07.11. 20:05/20:10. Kein neues Postfach und kein neuer Reklamationsablauf.

- „Der Tag“ → „Kunde erinnern“ öffnet den vorhandenen Mail-Dialog mit gespeicherter, bearbeitbarer Vorlage.
- Versand über den vorhandenen Microsoft-Writer. Kunden-Recht genügt ausschließlich für die zugehörige, noch auf Ware wartende Nacharbeit.
- Erst der gespeicherte Versandbeleg unterdrückt den Hinweis fünf Arbeitstage. Danach mit Aufträge-Recht „Reklamation öffnen“, sonst wieder „Kunde erinnern“. Die Reklamation bleibt offen.
- Fehler behalten Nachricht und Kennung. Unklares Ergebnis sperrt Änderungen bis zur Klärung; Wiederholung erzeugt keine zweite Mail. Es wird keine PDF-Beilage behauptet.

## Gezielte Belege

- `complaint_goods_reminder.integration.test.ts`: echte Server-Action → Replay-DB (Thread, Nachricht, Ziel, Text) → gemeinsame Reklamationsansicht. Nicht eingerichteter Versand ohne Ruhezeit; erfolgreicher Versand; idempotente Wiederholung; geänderter Inhalt unter derselben Kennung abgewiesen. Nur Microsoft-HTTP durch isolierte TEST-Antwort ersetzt; keine Behauptung über externen Zustellerfolg. PASS.
- `todayProjection.test.ts`: Grenze vier/fünf Arbeitstage und Rechteziel, 3 Fälle PASS.
- Bestehender realRender, neuer Erinnerungsfall: Dialog-Einstieg, editierbarer Text, Fehlererhalt, unveränderte Wiederholung, kein Reklamationsabschluss. PASS.
- H18-Verzeichnis/F1-Exportliste nachgeführt, keine neue Ausnahme. H18 PASS.
- Lint betroffener Dateien PASS. Typprüfung nach rein mechanischer Testtyp-Korrektur folgt am Kandidaten.
- Modul-Gate: nur die zwei bereits bekannten fremden Authority-Befunde (gelöschte alte Steuerdatei/Seitenbindung); keine Verletzung der Produktmodule. #189 ersetzt die alte Steuerbindung.

## Migration

`20261107195500_complaint_goods_reminder_template.sql` ergänzt nur die fehlende Vorlage. Lokale und Dev-Abbruchprobe PASS; angewandte Datei unverändert. Dev `syhaigjhsbpjmtnggqka`: Repository 88 = Dev 88, vollständige Versionsliste gleich; bestehende Vorlagen byteinhaltlich unverändert, eine neue Vorlage.

SHA-256: `0b412525ca9733f0b34850eec8ca129ea9014e8dd4f49a225dd0911833a4543b`. Belegzeit: `2026-11-07T20:05:53.701Z`.

## Abnahme / Grenzen

Klickweg: wartende Nacharbeit in „Der Tag“ → Kunde erinnern → Text prüfen/ändern → Begleitschein senden. Nach dem gespeicherten Versand verschwindet der Hinweis fünf Arbeitstage.

Exact-SHA, Git-Preview und CI stehen im PR; sie sind vor der Merge-Bitte zu prüfen. Sichtlauf einmal am Git-Kandidaten, Ergebnis wird dort ergänzt. Die zehn bekannten Browser-Restfälle von #191 bleiben ausdrücklich separat; dieser PR repariert sie nicht. Kein Merge/Production durch Codex.
