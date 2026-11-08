# Reklamation: Restfälle L06/L10/L11/L13

Keine Produktänderung. Modell und Originalassertions bleiben unverändert.

- L06: echter Browserablauf ohne Notiz/mit Notiz, danach DB/Ereignis/Ansicht: PASS (23,8 s). Überholte Ausnahme entfernt, Commit `32aab116`.
- L10/L11/L13: echte Lieferquelle über bestehende Anlage-, Stations-, Teilfertig-, Freeze-, Preis-, Rechnungs-, Zahlungs- und Warenausgangsaktionen. Keine direkte Statuskorrektur und kein erfundener Lieferbeleg.
- Gezielte drei Browserfälle: alle drei tatsächlich XPASS (27,6 s); überholte Ausnahmen entfernt. Die normale Preisaktion akzeptiert ausschließlich fehlende Preise: Testadapter entsprechend eingegrenzt, keine Produktregel gelockert.
- Eine im Modell absichtlich preislose Position erhält ausschließlich in der isolierten synthetischen Liefer-Fixture einen expliziten Testpreis von 10 EUR über den echten Preiswriter. Kein Produktfallback und keine Änderung des Modells.
- Vorhandene synthetische Stundenrate dient dem echten Freeze; kein neuer Produktwert.

DB-Beleg des letzten erhaltenen Falls: `docs/evidence/reklamation-rest/delivered-source.json`. Auftrag abgeholt, echte Rechnung und genau ein Warenausgangsereignis. Die einzelnen Browserfälle setzen ihre isolierten Daten jeweils zurück.

Typprüfung, gezieltes ESLint und Diff-Leerzeichenprüfung PASS. Keine lokale Gesamtsuite. Kein neuer Sichtlauf erforderlich: ausschließlich Testadapter und Ausnahmeabbau, keine geänderte Produktseite. CI bestätigt den neuen Kopf; unabhängige PL-Diffprüfung vor Merge-Bitte erforderlich. Kein Merge durch Codex.
