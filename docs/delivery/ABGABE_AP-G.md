# Abgabe AP-G · ausführbares Testmodell

Stand: 02.11.2026 · PR [#164](https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/164) · kein Merge durch Codex

## Kandidat und Preview

- Produkt-SHA: `b3823e11e67dd9ca1b2a194cc8db360e58011d46`
- READY-Git-Preview genau dieses SHA: https://galvanik-kreile-werksta-git-7220b7-schoggertraube-revs-projects.vercel.app
- Bauplan: spec `a887ece362f4`
- Bauplan-SHA-256: `5E7B880BD9D4B35EAF7BF906F2693011192933E000FA7AEA94222395F34A1F70`
- Generator: Schreib- und `--check`-Lauf deterministisch PASS

## Erzeugte Fälle

| Seite | Fälle |
| --- | ---: |
| `eingang` | 49 |
| `kundeneu` | 31 |
| `kundebearbeiten` | 19 |
| **Gesamt** | **99** |

44 Fälle sind im AP-G/AP-R-Kandidaten grün. 55 noch nicht abgenommene Zukunftsfälle stehen explizit in
`e2e/generated/_erwartet_rot.json`; ein unerwartet roter oder unerwartet grüner Fall lässt das Gate scheitern.

## Erwartet rot

- AP-02 (4): `E04`, `E35`, `E36`, `E37`
- AP-U (1): `E07` — Oberflächen-/Einheitsschlüssel gemeinsam mit Datenmigration; AP-R behält bis dahin den Anzeigewert
- AP-K1 (44): `E22`, `E25`, `E27`, `E28`, `K01`, `K02`, `K03`, `K04`, `K05`, `K06`, `K08`, `K10`, `K11`, `K13`, `K16`, `K18b`, `K19a`, `K19b`, `K19c`, `K20`, `K21`, `K22`, `K23`, `K26`, `K28`, `B01`, `B02`, `B03`, `B04`, `B05`, `B06`, `B07`, `B08`, `B09`, `B10`, `B11`, `B12a`, `B12b`, `B12c`, `B13`, `B14`, `B15`, `B16`, `B17`
- AP-N (1): `E34`
- AP-E (1): `E38`
- AP-F (1): `E40`
- AP-M (3): `E43`, `E44`, `K24`

## Nachweise

- Lokale A11-Strecke: Authority, Delivery, Scope-Selbsttest, Modul-Gates, H16, F0–F2-Schema gegen Replay-DB, TypeScript, ESLint und Produktionsbuild PASS.
- Unit-Suite am Produkt-SHA: 133/133 Dateien, 1083/1083 Tests PASS.
- Exakte Pfad-Probe mit TA-B2e gegen diesen Produkt-SHA: `KREILE_LIVE_PACKAGE_SCOPE=PASS branch=kreile/b2-eingang`.
- CI-Lauf: https://github.com/schoggertraube-rev/galvanik-kreile-app/actions/runs/41528656271
- Scope-Anker: [#163](https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/163), SHA `05eedd4fa55f60357e92c092ec6a5c3fde626c73`, kein Merge durch Codex.

Bis #163 gemergt ist, darf der Scope-/Ratchet-Anteil des Produkt-PRs rot sein. Alle weiteren roten Checks werden als echter Befund behandelt.
