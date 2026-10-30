# Abgabe Korrektur F0-02 · Neuer Login bleibt sichtbar

Datum: 27.10.2026

Branch: `kreile/s1-p2-eingang`

PR: <https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/154>

Bauquelle: `docs/project/endversion/codex/BAUPLAN.json`, `spec_sha: 2d0e16351eb2`

## Befund

> Nach „Login anlegen“ lädt die Seite neu (window.location.reload) und springt auf den Reiter Firmendaten zurück; der neue Login ist nicht zu sehen.

## Änderung

- `src/modules/fundament/server/systemSettingsPort.ts:277`: Der Anlage-Command gibt neben der ID auch das tatsächlich vergebene, kollisionssichere Kürzel zurück.
- `src/modules/fundament/server/systemSettingsPort.ts:310`: Der Server bestätigt den vollständigen neuen Login einschließlich Rolle und wirksamer Bereiche.
- `src/app/settings/SettingsAdminClient.tsx:140`: Der Client verarbeitet die bestätigte Serverantwort ohne Seitenneuladen.
- `src/app/settings/SettingsAdminClient.tsx:152`: Der neue Login wird sofort in Liste und Rechtematrix ergänzt; der Reiter bleibt offen.
- `src/app/settings/SettingsAdminClient.tsx:261`: „Login anlegen“ verwendet den neuen stabilen Ablauf ohne `window.location.reload()`.
- `src/app/settings/__tests__/SettingsAppAdapter.test.tsx:84`: Der Test belegt offenen Reiter, sichtbaren neuen Login, wirksame Matrixbereiche und Erfolgsmeldung.

## Prüfergebnis

- `npx vitest run src/app/settings/__tests__/SettingsAppAdapter.test.tsx`: **PASS**, 12/12 Tests.
- `npx tsc --noEmit --incremental false`: **PASS**.
- Datenbank: **keine Schema- oder Datenmigration**. Ein realer Klick legt wie zuvor genau einen Login über den bestehenden Server-Command an; neu ist nur die vollständige Rückgabe dieses bestätigten Datensatzes.

## Owner-Klickweg

1. Als berechtigter Nutzer `Einstellungen` → `Logins & Rechte` öffnen.
2. Unter „Login anlegen“ Name, Bezeichnung, Vorlage und vierstelligen Code ausfüllen.
3. „Login anlegen“ wählen.
4. Prüfen: Der Reiter `Logins & Rechte` bleibt ohne Neuladen geöffnet.
5. Prüfen: Der neue Login erscheint sofort in der Login-Liste und als Spalte in der Rechtematrix.
6. Prüfen: Die Bereiche der gewählten Vorlage sind in der neuen Spalte gesetzt und die Meldung „Login angelegt.“ erscheint.
