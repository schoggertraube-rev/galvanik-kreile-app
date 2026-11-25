# S38b – Tagesautomatik in der TEST-Vorschau

## Nachweis vom 25.11.2026

Der isolierte Standalone-Lauf verwendete App-Quellen und Migrationen vom Kopf
`d6731f9a6768ba08989bce072bea506f81b63445`.
[Protokoll des Fresh-Laufs](https://github.com/schoggertraube-rev/galvanik-kreile-app/actions/runs/45707093858/job/139531742017)

- Temporärer TEST-Login mit Diagnoserecht, echtes App-Sitzungscookie, kein `CRON_SECRET`. `GET /api/takt`: HTTP 200.
- Zweimal `GET /api/heute/modell?nur=veraltet` mit vollständigem Modell und HTTP 200 in derselben Berliner Minute, 22:51.
- SQL-Beleg für den Tagesneuaufbau: `heute_neuaufbau`, 25.11.2026, `ok`, Versuch 1. Für `takt.nachholen` genau eine Zeile in diesem Mandanten und dieser Minute, `ok`, Versuch 1. Der getrennte Aufbewahrungsauftrag hatte Status `fehler`.
- Das temporäre TEST-Konto wurde in Auth und App deaktiviert. Ein späterer, separater Anmeldungsschritt desselben Workflows brach mit HTTP 502 beim TEST-Anbieter ab.

Der HTTP-Nachweis gilt für den genannten Kopf. Nachweis für den aktuellen
Kopf und Wiederholung auf der gehosteten TEST-Vorschau nach der Übernahme stehen aus.
