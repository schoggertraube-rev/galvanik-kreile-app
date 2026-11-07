# KV V04 Server-A – Zwischenabgabe, noch nicht mergebereit

Produktstand `2be47beaa3a7bcb0d240cda0eff4ba6631d9bb8e`. PR-Kopf und Git-Preview werden im PR am exakten Kopf gebunden. Kein neuer V04-Oberflächenbau; Freigabe des Durchstich-Moduls steht aus.

## Gebaut und gezielt belegt

- Bestehende Quote-Writer: Fassung, genaue Zeilensummen, explizite Kalkulations-Snapshots, unabhängige Metadaten, Zusage/Vorbehalt/Absage samt Nachweis und idempotentem Journal.
- Eingang/Mail → Vorbereitung mit bestehender Erkennung/Kundensuche, Originalbezug und aktiven Kundenhinweisen; ausschließlich vorhandener createQuote-Writer.
- Zusage erzeugt keinen Auftrag. Frühe Ware nutzt denselben goods_receipt mit KV-Bezug und abgeleiteter Sperre. Aktuelle Zusage plus Ware erzeugen genau einen Auftrag mit Ware atomar über createOrderIntake; Rollback und Retry geprüft.
- Exakte KV-Preise, Sonderwünsche und Originale bleiben am Auftrag nachvollziehbar; keine gerundete Preiskopie.
- Nachfassen: vorhandene Aufgabe ist die Autorität, Quote-Datum nur geschützte Projektion; Der Tag öffnet den vorhandenen Aufgabendialog. Keine neue Task-Datenwelt.
- Mailversand: reales PDF und Inhaltsfassung/Hash, echter lokaler Versandbeleg und erst danach KV-Status. Gleiches Anliegen sendet nicht doppelt; fremder Retry wird abgelehnt. Konkurrierende Änderung bleibt eine neue, ungesendete Fassung; Providerfehler markiert nichts als gesendet.
- Nachtrag: bestehender KV-Update und genau das Änderungsanliegen atomar; anderes offenes Anliegen bleibt offen. Nur expliziter Terminstatus wird geändert, unabhängige Herkunftsfakten bleiben erhalten.

15 echte Replay-Fälle des Pakets zusammen PASS am Produktstand; Datenbankzeile, Ereignis und Ansicht werden nachgelesen. Geschäftsbefehle/Auth/DB sind echt. Nur isolierter TEST-Tenant und bei Versand die äußere Graph-HTTP-Grenze sind synthetisch. Mail-/Foto-Vorzustand im Vorbereitungsfall ist ausdrücklich eine synthetische DB-Fixture; kein Live-Graph-/Storage-Versandclaim.

Gezielte Erkennung (15 Fälle), Mailformular (5 Fälle), vorhandener GlobalCreate-Render (88 Fälle), Lint/Typen/Diff bestanden. Keine lokale Projektsuite. CI am neuen PR-Kopf folgt.

## Änderung bestehender Assertions (alt → neu)

| Fall | Alt → neu |
| --- | --- |
| Früherer Zuschlag ohne Ware | Auftrag/Receipt/Navigation erwartet → echte Zusage mit Wortlaut, KV behalten, ausdrücklich kein Auftrag/Conversion-Aufruf/Navigation. U-245 und PL22:05. |
| Neuer Zuschlag nach Bearbeiten | Auftragstermin zurücksetzen → Zusage-Wortlaut zurücksetzen; keine Speicherung vor neuer Bestätigung. |
| Konflikt beim Zuschlag | Conversion-Konflikt + Datum erhalten → Zusage-Konflikt + Wortlaut erhalten; kein falscher Erfolg. |
| Ungeklärter Ausgang | Neuer Submit möglich → Eingaben gesperrt, gleicher unveränderter Request beim expliziten Retry, keine neue Auftragsanlage. |
| Bestehende Konversions-Tests | Zusage und tatsächlich angenommene TEST-Ware als Vorbedingung ergänzt; Ergebnis-/Preis-/Receipt-/Einmaligkeitsassertionen bleiben erhalten. Hash `geprueft=false` → `true`, da die Ware geprüft ist. |
| Neue Mailbelege | Tatsächliche vorhandene Korrelation ODER client_event_id lesen; drei echte Ereignisse bleiben Pflicht. Kein reduzierter Prüfinhalt. |

Bestehender KV-Bereich: „Zusage vermerken“ und erforderlicher Wortlaut ersetzen dort die frühere direkte Auftragsbeauftragung. Auftragstermin/Übergabe/Zahlung werden dort nicht mehr ohne Auftrag abgefragt; direkte Auftragserfassung bleibt bestehen. Vollständiger Waren-Klickweg und neue KV-Oberfläche folgen erst nach Freigabe. Diese sichtbare Umfangsänderung ist dem PL-Diffreview ausdrücklich vorzulegen.

## Dev-Schema

Fünf unveränderte additive Migrationen nach echter Abbruchprobe angewandt. Alte Inhalte von 2 Quotes, 3 Positionszeilen, 0 Warenbelegen, 0 Aufgaben und 1 Firmendatenzeile unverändert. Einzel-SHAs und Beleg: `docs/evidence/kv-v04/dev-migrations.json`.

**Repo 92 / Dev 93; kein behaupteter Gleichstand.** Einziger zusätzlicher Dev-Stand ist die bereits bytegeprüfte Migration `20261107195500` aus dem noch offenen #193. Nach dessen Owner-Merge Branch synchronisieren und Gleichstand neu belegen.

## Vor Abschluss offen

- KV-11 Kopier-/Vergleichsport; aktive kanonische Ist-Stundenquelle wird vom PL benötigt. Keine Mehrarbeitsminuten oder Stationsdauer als Gesamtarbeitszeit ausgeben.
- Vollständiger KV-12-Nachweis bis zum späteren Auftrag mit geändertem Datum ergänzen.
- Alte H18-Konversionsfälle lokal durch die strenge Migrationsparität blockiert, weil Replay bereits #193 enthält; Check bleibt unverändert. Fresh-CI prüft saubere Paketbasis.
- Finale CI, Exact-SHA-Preview, freigegebener Sichtumfang und PL-Diffreview. Keine Merge-Bitte, kein Gesamt-PASS und kein Production-Deploy.
