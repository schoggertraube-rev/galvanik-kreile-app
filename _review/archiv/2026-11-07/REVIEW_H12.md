# REVIEW H12 - "Der Tag" ohne Schemafehler und Namensersatz

Pruefer-Lauf: 28.10.2026 20:28 UTC (21:28 Berlin)
Gepruefter Stand: lokal kreile/s1-p2-eingang 2e064eac (9 Commits vor origin 5a090dc0, NICHT gepusht)
Abgabe: docs/delivery/ABGABE_H12.md (committet in 2e064eac)

## Urteil: PASS (lokal) - keine Blocker

- H12.1: todayDashboard.ts sortiert nach `app_users.full_name, id`; `display_name` entfernt. Kein 42703 mehr.
- H12.2: Delegationsziele = alle anderen aktiven Logins mit Bereich `auftraege` (`users.id<>auth.userId`), Name aus DB (`full_name`), Button "an {Name} geben" uebergibt genau dessen ID; ohne Ziel kein "Weitere". "Phillip" in RolfHomeClient entfernt.
- H12.3: scripts/quality/check-f0-f2-schema.mjs + Schritt in .github/workflows/quality.yml + package.json-Skripte. Durch AKTUELLE_ANWEISUNG H12.3 ausdruecklich beauftragt -> kein verbotener Pfad. Selbsttest mit erfundener Spalte vorhanden.
- H11 Rest a-e (906f59b3, 995c43ea, d83bf1b8, 105a87cf): Rechte jetzt nur aus Bereichen; eine Server-Projektion `getAuthorizationActionGrants`; Kundenliste ohne `kunden` FORBIDDEN. Fail-closed, keine Rechteausweitung erkennbar. Rest f zurueckgenommen (Regel 7 eingehalten).
- Keine Migration in diesen Commits; keine Hex-Farben in neuen src-Zeilen; keine Daten geloescht.

## Offen (kein FAIL)

- Push fehlt: ohne `git push` keine Preview, Owner-Klickweg H11+H12 und CI-Nachweis (Schema-Gate gruen/Selbsttest rot) nicht moeglich. Codex: pushen.
- DB: Remote 58 vs Repo 59 - nur `20261028115141_f2_today_layout.sql` (bekannter Owner-Entscheid aus TAG_07/H10), unveraendert.
- Abnahme-grep `Phillip|Rolf|Gregor` in src ohne Tests: nicht 0 (Komponentennamen `RolfHome*`, Rechtevorlage "wie Phillip/wie Rolf" in SettingsAdminClient.tsx:298) -> DEZEMBER_LISTE.
