# Abgabe Korrektur F0-06 · Mein Code als Eigene-Zeile-Dialog

Datum: 28.10.2026

Branch: `kreile/s1-p2-eingang`

PR: <https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/154>

Bauquelle: `docs/project/endversion/codex/BAUPLAN.json`, Korrektur `meincode` (mittel)

## Befund

> „Mein Code ändern“ steht als fester Block oben auf der Einstellungsseite für alle; Spec: Dialog 8.8, geöffnet über „Mein Code“ in der eigenen Zeile unter Einstellungen › Personen & Rechte.

## Änderung

- `src/app/settings/SettingsAdminClient.tsx`: Der dauerhafte Block ist entfernt. Nur die eigene Loginzeile zeigt nun `Mein Code`; der Knopf öffnet einen modal ausgezeichneten Dialog.
- `src/app/settings/SettingsAdminClient.tsx`: Der Dialog akzeptiert weiterhin genau zwei gleiche vierstellige Codes; erfolgreiches Speichern schließt ihn und meldet exakt `Neuer Code gespeichert`.
- `src/app/actions/settings.actions.ts` und `src/app/settings/SettingsAdminClient.tsx`: Ein Login ohne Verwaltungsrecht erhält und sieht ausschließlich seine eigene Zeile und kann dort seinen Code ändern, nicht aber fremde Logins oder die Rechtematrix.
- `src/app/settings/settings.module.css`: Dialog-Überlagerung und kompakte Dialogbreite ergänzt.
- `src/app/settings/__tests__/SettingsAppAdapter.test.tsx`: Dialog-Zugriff und Fehlerpfad aktualisiert.

## Prüfergebnis

- `npx vitest run src/app/settings/__tests__/SettingsAppAdapter.test.tsx`: **PASS**, 12/12 Tests.
- `npx tsc --noEmit --incremental false`: **PASS**.
- ESLint der geänderten Einstellungsdateien: **PASS**.
- `node scripts/ui/spec-check.mjs --screens=meincode,rechte`: **PASS**, 5/5 Spec-IDs gefunden.
- `npm run quality:module-gates`: **PASS**.
- `git diff --check`: **PASS**.

## Owner-Klickweg

1. Mit einem bestehenden Login `Einstellungen` → `Logins & Rechte` öffnen.
2. In der eigenen Zeile `Mein Code` klicken; nur dort erscheint der Knopf.
3. Prüfen: Es öffnet sich der Dialog `Mein Code ändern` mit `Neuer Code` und `Code wiederholen`.
4. Einen neuen vierstelligen Code zweimal eintragen und `Code speichern` klicken.
5. Prüfen: Der Dialog schließt und die Meldung `Neuer Code gespeichert` steht auf der Seite.

Erwarteter Datenbankzustand nach Schritt 4: ausschließlich der eigene Login hat den neuen PIN-Hash und den zugehörigen Änderungszeitpunkt; andere Logins und Rechte bleiben unverändert.
