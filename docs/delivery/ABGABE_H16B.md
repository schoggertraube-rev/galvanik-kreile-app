# ABGABE H16b · Go-live-Vorbereitung

Branch: `kreile/s1-p2-eingang` · PR #154

## 1. Migrationsgleichstand

- Vorher: `20261028115141_f2_today_layout.sql` war lokal vorhanden und in der verknüpften Dev-DB nicht eingetragen. Der Dry-Run mit `--include-all` nannte ausschließlich diese eine Migration.
- Ausgeführt: genau `20261028115141_f2_today_layout.sql` wurde additiv auf die Dev-DB angewandt. Keine Seed-, Rollen- oder weiteren Migrationsdateien wurden übertragen.
- Nachher: 60 SQL-Migrationsdateien im Repository, 60 Einträge in der Dev-DB, 0 Abweichungen. Der Eintrag `20261028115141` ist auf beiden Seiten vorhanden.
- Abweichung zur Warteschlange: Dort steht als erwartete Anzahl `61`. Die reale, erneut gezählte Anzahl in `supabase/migrations/` ist 60. Der Gleichstand ist belegt; die Dokumentzahl 61 wird nicht als Tatsachenbehauptung übernommen.

## Datenbank-Soll

Die Dev-DB enthält dieselben Migrationsversionen wie `supabase/migrations/`. Die Migration ist additiv; es wurden keine Fach- oder Stammdaten gelöscht.

## 2. Datenregister

- `docs/delivery/DATEN_REGISTER.md` enthält jede aktuell direkt aus der Dev-DB gelesene Tabelle des Schemas `public` genau einmal.
- Abgleich: 97 Dev-Tabellen, 97 Registerzeilen, 97 eindeutige Namen; fehlend 0, doppelt 0, zusätzlich 0.
- Klassen: 20 `stammdaten`, 50 `bewegungsdaten`, 16 `system`, 3 `tot`, 8 `?`.
- Die acht ungeklärten Tabellen sind ausdrücklich nicht zur Übernahme freigegeben. PIN-Werte werden auch aus `app_users` nicht übernommen.
- Das Register selbst verändert keine Datenbankzeile.

## Owner-Klickweg

1. Preview öffnen und mit einem vorhandenen Zugang anmelden.
2. **Der Tag** öffnen; die Seite muss unverändert laden, die Stufe-2-Anpassung bleibt ausgeblendet.
3. Im Prüfnachweis die Migrationslisten vergleichen: Repository und Dev-DB jeweils 60, Abweichungen 0, Zielversion `20261028115141` vorhanden.
4. Das Datenregister gegen die Dev-DB prüfen: 97 Public-Tabellen, jede genau einmal; acht mit `?` bleiben gesperrt bis zur fachlichen Klärung.
