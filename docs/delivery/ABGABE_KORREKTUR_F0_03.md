# Abgabe Korrektur F0-03 · Bezeichnung optional

Datum: 28.10.2026

Branch: `kreile/s1-p2-eingang`

PR: <https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/154>

Bauquelle: `docs/project/endversion/codex/BAUPLAN.json`, `spec_sha: cd8ad96671d1`

## Befund

> Ändern verlangt eine Bezeichnung (mind. 1 Zeichen); Logins ohne Bezeichnung lassen sich nicht speichern („Name, Kürzel, Bezeichnung, Status oder Code ist ungültig“). Spec: Bezeichnung optional.

## Änderung

- `src/modules/fundament/server/systemSettingsPort.ts:192`: Anlegen und Ändern prüfen jedes Feld einzeln und melden das konkret fehlerhafte Feld.
- `src/modules/fundament/server/systemSettingsPort.ts:203`: Eine leere Bezeichnung ist im Serververtrag zulässig.
- `src/modules/fundament/server/systemSettingsPort.ts:232`: Eine leere Bezeichnung wird beim Ändern als `NULL` gespeichert.
- `src/modules/fundament/server/systemSettingsPort.ts:293`: Eine leere Bezeichnung wird auch beim Anlegen als `NULL` gespeichert.
- `src/app/settings/SettingsAdminClient.tsx:258`: Das Formular kennzeichnet „Bezeichnung“ sichtbar als optional.
- `src/app/settings/SettingsAdminClient.tsx:266`: Ein Login ohne Bezeichnung wird ohne führenden Trennpunkt dargestellt.
- `src/modules/fundament/__tests__/systemSettingsPort.test.ts`: Servertests belegen Anlegen und Ändern ohne Bezeichnung sowie feldgenaue Fehler.
- `src/app/settings/__tests__/SettingsAppAdapter.test.tsx`: Der Oberflächentest legt einen Login ohne Bezeichnung an.

## Prüfergebnis

- `npx vitest run src/modules/fundament/__tests__/systemSettingsPort.test.ts src/app/settings/__tests__/SettingsAppAdapter.test.tsx`: **PASS**, 20/20 Tests.
- `npx tsc --noEmit --incremental false`: **PASS**.
- ESLint der vier geänderten Produkt-/Testdateien: **PASS**.
- `node scripts/ui/spec-check.mjs --screens=rechte`: **PASS**, `expected=1 found=1 missing=0`.
- `npm run quality:module-gates`: **PASS**.
- `git diff --check`: **PASS** für das Paket; nur ein Zeilenende-Hinweis zu einer vorhandenen, nicht paketbezogenen Datei.

## Datenbank-Nachweis

- Keine Schema- oder Datenmigration und keine Live-Datenänderung durch Codex.
- `app_users.bezeichnung` ist im kanonischen Schema nullable (`src/db/schema.ts:14`).
- Die vorhandene Datenbank-Constraint erlaubt `NULL`, aber keinen leeren Text (`supabase/migrations/20261027180000_f0_user_access_areas.sql:31`).
- Erwarteter Zustand nach einem echten Speichern ohne Bezeichnung: `app_users.bezeichnung IS NULL`; beim Ändern entsteht wie bisher genau ein `ui_events`-Eintrag `login_updated`, beim Anlegen `login_created`.

## Owner-Klickweg

1. Als berechtigter Nutzer `Einstellungen` → `Logins & Rechte` öffnen.
2. Bei einem bestehenden Login `Ändern` wählen.
3. Die optionale Bezeichnung leeren und speichern.
4. Prüfen: Die Erfolgsmeldung erscheint und der Login bleibt ohne Bezeichnung sichtbar.
5. Die ursprüngliche Bezeichnung wieder eintragen und speichern.
6. Prüfen: Die Bezeichnung erscheint wieder; andere Loginfelder und Rechte sind unverändert.

Kein Codex-Klicktest und keine neuen Screenshots gemäß Regel 4d; der Owner-Klickweg bleibt auf sechs Schritte begrenzt.
