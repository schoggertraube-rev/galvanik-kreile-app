# Abgabe Korrektur F0-01 · Login-Liste

Datum: 27.10.2026

Branch: `kreile/s1-p2-eingang`

PR: <https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/154>

Bauquelle: `docs/project/endversion/codex/BAUPLAN.json`, `spec_sha: 7abb6cab6d70`

## Befund

> Logins-Liste zeigt alle Logins dauerhaft als offene Eingabefelder (Name, Kürzel, Bezeichnung, Code, Aktiv) untereinander; Spec: Anzeige-Liste, „Ändern“ öffnet ein Formular nur für diesen Login.

## Änderung

- `src/app/settings/SettingsAdminClient.tsx:65`: Es existiert genau ein Bearbeitungsentwurf für genau einen Login.
- `src/app/settings/SettingsAdminClient.tsx:248`: Jede Login-Zeile ist zunächst reine Anzeige und besitzt den Knopf „Ändern“.
- `src/app/settings/SettingsAdminClient.tsx:249`: Nur der ausgewählte Login zeigt das vorbelegte Formular mit „Übernehmen“ und „Abbrechen“.
- `src/app/settings/SettingsAdminClient.tsx:150`: Erst ein erfolgreicher Server-Schreibvorgang übernimmt die Daten in die sichtbare Liste und schließt das Formular.
- `src/app/settings/settings.module.css:192`: Der Zeilenknopf steht getrennt rechts in der Anzeige.
- `src/app/settings/__tests__/SettingsAppAdapter.test.tsx:140`: Der vorhandene Test belegt Anzeigezustand, Vorbelegung, Wechsel auf einen zweiten Login, Ein-Formular-Grenze und Abbruch.

## Prüfergebnis

- `npx vitest run src/app/settings/__tests__/SettingsAppAdapter.test.tsx`: **PASS**, 11/11 Tests.
- `npx tsc --noEmit --incremental false`: **PASS**.
- `node scripts/ui/spec-check.mjs --screens=rechte`: **PASS**, `expected=1 found=1 missing=0`.
- Datenbank: **unverändert**; diese Korrektur ändert nur Darstellung und lokalen Bearbeitungszustand.

## Owner-Klickweg

1. Als berechtigter Nutzer `Einstellungen` → `Logins & Rechte` öffnen.
2. Prüfen: Alle bestehenden Logins erscheinen als Anzeigezeilen; kein Bearbeitungsformular ist offen.
3. Bei Phillip „Ändern“ wählen; prüfen: genau sein vorbelegtes Formular ist offen.
4. Bei Rolf „Ändern“ wählen; prüfen: Phillips Formular schließt, genau Rolfs Formular ist offen.
5. „Abbrechen“ wählen; prüfen: die Anzeige bleibt unverändert und es ist kein Formular offen.
6. Erneut „Ändern“, einen sichtbaren Wert ändern und „Übernehmen“ wählen; Erfolgsmeldung und aktualisierte Anzeige prüfen.
