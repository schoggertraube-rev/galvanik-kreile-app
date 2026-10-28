# Abgabe Korrektur F0-05 · Kassieren bei Abholung

Datum: 28.10.2026

Branch: `kreile/s1-p2-eingang`

PR: <https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/154>

Bauquelle: `docs/project/endversion/codex/BAUPLAN.json`, Korrektur `rechte` (mittel), K28

## Befund

> Bereich „Kassieren bei Abholung“ fehlt (U-208, nach dem Bau entschieden).

## Änderung

- `src/lib/auth/authorizationContract.ts`: Neuer Bereich `kassieren` mit Bezeichnung „Kassieren bei Abholung“ und der Fähigkeit `perm_cash_pickup`.
- `src/lib/auth/authorizationContract.ts`: Meister- und Developer-Vorlage enthalten den Bereich; Werkstatt erhält ihn nicht.
- `src/lib/server/commands/confirmPaymentCommand.ts`: Ohne Geldrecht ist das Buchen einer Bar-/Kartenzahlung nur mit `kassieren` **und** Auftragsrecht bei fertiger Ware zur Abholung möglich. Developer bleibt serverseitig ausgeschlossen.
- `supabase/migrations/20261028081227_add_pickup_cash_access_area.sql`: Die bestehende Bereichs-Constraint erlaubt `kassieren`; bestehende Meister- und Developer-Logins erhalten das Recht idempotent.

## Prüfergebnis

- `npx vitest run src/lib/server/commands/__tests__/confirmPaymentCommand.test.ts src/lib/auth/__tests__/PermissionsContext.test.tsx src/modules/fundament/__tests__/systemSettingsPort.test.ts`: **PASS**, 35/35 Tests.
- `npx tsc --noEmit --incremental false`: **PASS**.
- ESLint der geänderten Auth-/Zahlungsdateien: **PASS**.
- `npm run quality:module-gates`: **PASS**.
- Supabase Security Advisor (Fehlerstufe): **keine Befunde**.

## Datenbank-Nachweis

- Migration `20261028081227_add_pickup_cash_access_area` wurde auf die autorisierte Entwicklungsdatenbank angewendet; lokaler und Remote-Migrationsstand sind identisch.
- Lesender Nachweis danach: `kassieren` ist für **1** Developer-Login und **2** Meister-Logins gespeichert; für Werkstatt wurde keine Rechtezeile angelegt.
- Keine bestehenden Rechte oder Geschäftsdaten gelöscht.

## Owner-Klickweg

1. Als Gregor oder Rolf `Einstellungen` → `Logins & Rechte` öffnen.
2. Prüfen: In der Rechtematrix steht die Zeile `Kassieren bei Abholung`.
3. Prüfen: Sie ist bei den Meister-/Developer-Logins gesetzt und bei Werkstatt nicht gesetzt.
4. Die Ansicht ohne Speichern schließen.

Erwarteter Datenbankzustand nach diesem Weg: unverändert. Die Oberfläche für Betrag und „bezahlt · bar/Karte“ folgt ausdrücklich erst mit F3; bis dahin erzwingt der Server bereits den neuen Rechtepfad.
