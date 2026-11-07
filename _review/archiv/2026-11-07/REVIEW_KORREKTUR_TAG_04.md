# REVIEW KORREKTUR_TAG_04 — PASS

Geprüft: 28.10.2026 03:27 UTC · Commit fd970e56 (origin/kreile/s1-p2-eingang, 02:41 UTC) · erste Prüfung

Befund war: „Zuordnen“ auf Der Tag öffnete leeren Eingang + stellte Entwurf wieder her.

- RolfHomeClient.tsx:59 übergibt `graphMessageId` an den Mail-Einstieg. Mail-Einträge erhalten die ID immer (todayDashboard.ts:103) → keine tote Schaltfläche.
- F1SourceDialogs.tsx:138–146 zeigt nur die angeklickte Mail, sonst ehrlicher Fehler.
- GlobalCreateFlow.tsx:855 ff.: direkter Mail-Einstieg lädt keinen Entwurf.
- Zuordnung schreibt weiter über attachOutlookMailAction (bestehender Vertrag, idempotent).

Blocker: keine.
- Keine verbotenen Dateien, keine Migration, keine neuen Hex-Farben in src.
- DB: Remote 54 = Repo 54 SQL, synchron.

Offen (kein Blocker): Owner-Klickweg laut Abgabe; Mail-Aktionen andere-mail/nicht-zuordnen/später/übernehmen weiter fehlend (eigene BAUPLAN-Korrektur, steht bereits im BAUPLAN).
