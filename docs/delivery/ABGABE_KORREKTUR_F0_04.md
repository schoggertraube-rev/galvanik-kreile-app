# Abgabe Korrektur F0-04 · Loginanlage mit Kürzel

Datum: 28.10.2026

Branch: `kreile/s1-p2-eingang`

PR: <https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/154>

Bauquelle: `docs/project/endversion/codex/BAUPLAN.json`, Korrektur `rechte` (mittel), `spec_sha: cd8ad96671d1`

## Befund

> Login anlegen: Formular steht dauerhaft offen; kein Kürzel-Feld (nur automatisch). Spec: Knopf „Login anlegen“ öffnet das Formular; Kürzel automatisch vorbelegt, änderbar, max. 3 Zeichen.

## Änderung

- `src/app/settings/SettingsAdminClient.tsx:74`: Das Anlageformular bleibt zunächst geschlossen und öffnet sich erst über „Login anlegen“.
- `src/app/settings/SettingsAdminClient.tsx:266`: Der Name befüllt ein Kürzel automatisch; das sichtbare Feld lässt eine eigene Eingabe mit höchstens drei Zeichen zu.
- `src/app/settings/SettingsAdminClient.tsx:281`: Auch das Ändern begrenzt Kürzel auf drei Zeichen.
- `src/modules/fundament/public.ts:34`: Der bestehende Anlagevertrag enthält das Kürzel ausdrücklich.
- `src/modules/fundament/server/systemSettingsPort.ts:195` und `:258`: Der Server prüft für Anlage und Änderung dieselben ein bis drei erlaubten Zeichen.
- `src/modules/fundament/server/systemSettingsPort.ts:277`: Bei Kollisionen bleibt die bisherige tenant-gebundene, eindeutige Vergabe erhalten – innerhalb von drei Zeichen.

## Prüfergebnis

- `npx vitest run src/modules/fundament/__tests__/systemSettingsPort.test.ts src/app/settings/__tests__/SettingsAppAdapter.test.tsx`: **PASS**, 20/20 Tests.
- `npx tsc --noEmit --incremental false`: **PASS**.
- ESLint der fünf geänderten Produkt-/Testdateien: **PASS**.
- `node scripts/ui/spec-check.mjs --screens=rechte`: **PASS**, `expected=1 found=1 missing=0`.
- `npm run quality:module-gates`: **PASS**.
- Keine Migration und keine Datenbankänderung durch Codex.

## Owner-Klickweg

1. Als berechtigter Nutzer `Einstellungen` → `Logins & Rechte` öffnen.
2. Prüfen: Nur der Knopf `Login anlegen` ist sichtbar; kein dauerhaft offenes Anlageformular.
3. `Login anlegen` wählen und einen Namen eingeben.
4. Prüfen: `Kürzel` ist automatisch gefüllt, kann überschrieben werden und nimmt maximal drei Zeichen an.
5. `Abbrechen` wählen und prüfen: Das Formular schließt ohne Schreibvorgang.

Erwarteter Datenbankzustand nach diesem Weg: unverändert. Bei einem später autorisierten Speichern eines neuen Logins würde `app_users.kuerzel` den gewählten, serverseitig validierten Dreizeichenwert tragen und genau ein `ui_events.login_created` entstehen.
