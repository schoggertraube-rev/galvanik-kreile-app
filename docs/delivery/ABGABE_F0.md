# Abgabe F0 · Login, Logins & Rechte, eigener Code

Status: **PASS mit laufender CI**

Branch: `kreile/s1-p2-eingang`

Produkt-SHA: `32294468d3643a50f25ca14b6b002368c04f9a6c`

PR: <https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/154>

Preview: <https://galvanik-kreile-werkstatt-8nt67ocwi.vercel.app> · beim Abgabe-Commit noch `Building`

## Neu gemacht

- `/start`: einspaltiger Login mit Tagesbegrüßung, aktiven realen Logins, Kürzelkreisen, Geräte-Vorauswahl, vier Codepunkten, Bildschirm- und Desktop-Tastatur sowie automatischer Anmeldung nach vier Ziffern.
- Developer-E-Mail-Anmeldung bleibt als leiser zweiter Weg vorhanden; für andere Logins ist sie nicht sichtbar.
- `/settings`: jeder angemeldete Login kann den eigenen vierstelligen Code ändern; die aktuelle Sitzung wird danach neu ausgestellt, ältere Sitzungen werden durch `updated_at` widerrufen.
- `Logins & Rechte`: Login anlegen, Stammdaten/Code/Aktivstatus ändern und die acht Bereiche pro Login unmittelbar setzen. Die Developer-Rechte `Logins & Rechte` und `Wartung` sind fest.
- Rollen bleiben nur Vorlage und Darstellungswahl. Navigation, relevante Direktseiten und Serveraktionen leiten die Berechtigung aus `app_user_rights` ab.
- Neue additive Migration `20261027180000_f0_user_access_areas.sql`; keine alte Migration geändert.
- Statischer Abgleich `scripts/ui/spec-check.mjs` für die drei F0-Screens.

## Owner-Klickweg (maximal 6 Schritte)

1. Preview `/start` öffnen. Erwartung UI: genau die aktiven Datenbank-Logins als Kreise mit Kürzel und Vorname, ein Kreis amber markiert, darunter vier Punkte und Ziffernblock. Erwartung DB: `app_users.active=true`; keine Demo- oder Testnutzer.
2. Einen bestehenden Kreile-Login auswählen und dessen vorhandenen Code eingeben. Erwartung UI: nach der vierten Ziffer automatische Weiterleitung ohne Anmeldeknopf. Erwartung DB: nur Sitzung/`last_seen`, keine fachlichen Datenänderungen.
3. Als Gregor `/settings` öffnen und `Logins & Rechte` wählen. Erwartung UI: Loginliste mit Kürzel, Name, Bezeichnung, Aktivstatus und Bereichszahl sowie Matrix mit acht Zeilen. Erwartung DB: Darstellung aus `app_users` + `app_user_rights`.
4. Gregors Matrix prüfen. Erwartung UI: `Logins & Rechte verwalten` und `Wartung, Stufen & Anbindungen` sind aktiv und als `fest` nicht abwählbar. Erwartung DB: beide Rechtezeilen vorhanden.
5. Zu `Mein Code ändern` scrollen, ohne zu speichern. Erwartung UI: neuer Code, Wiederholung, Abbrechen und Code speichern. Erwartung DB: keine Änderung, solange nicht gespeichert wird.
6. Als Phillip oder Rolf anmelden. Erwartung UI: Navigation zeigt ausschließlich die für diesen Login gesetzten Bereiche; `/settings` enthält mindestens `Mein Code ändern`. Erwartung DB: Rechte werden bei jeder Autorisierungsauflösung neu aus `app_user_rights` gelesen.

## Datenbank-Nachweis

Migration gegen die verknüpfte Entwicklungsdatenbank angewendet und anschließend ausschließlich lesend geprüft:

```text
migration_local=20261027180000
migration_remote=20261027180000
rights_table=app_user_rights
has_kuerzel=true
has_bezeichnung=true
active_pin_users=3
users_with_rights=6
invalid_rights=0
security_advisor_errors=0
```

Die neue Public-Tabelle erzwingt RLS; `anon`, `authenticated` und `PUBLIC` haben keine Tabellenrechte. Der bestehende privilegierte Serverpfad bleibt der einzige Schreibweg.

## Prüfschritt

```text
SPEC_CHECK screens=login,rechte,meincode expected=8 found=8 missing=0
```

- TypeScript (`npx tsc --noEmit --incremental false`): PASS.
- ESLint auf allen F0-Dateien: PASS.
- F0-nahe Unit- und Render-Tests: 6 Dateien, 52/52 PASS.
- Supabase Security Advisor, Fehlerstufe: PASS, keine Fehler.
- Vollständiger serieller Unit-Wrapper: nach drei Minuten ohne Ausgabe als bekannter Runner-Hänger beendet; kein Testfehler gemeldet. Die betroffenen Testgruppen wurden anschließend direkt grün ausgeführt.
- GitHub `agentur-gate`: am Produkt-SHA bei Abgabe `IN_PROGRESS`.
- Vercel: am Produkt-SHA bei Abgabe `PENDING/Building`. Gemäß Regel 4c wurde nicht gewartet.

## Abweichungen / offen

- Lokaler Supabase-Replay war nicht ausführbar, weil Docker Desktop nicht lief. Dry-run, Remote-Migration, Migrationshistorie, Security Advisor und Readback sind belegt.
- Kein Codex-Klicktest und keine Bildpaare: ab Q11 durch Regel 4d ausdrücklich durch den obigen Owner-Klickweg und `spec-check.mjs` ersetzt.
