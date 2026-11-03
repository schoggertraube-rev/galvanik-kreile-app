# Abgabe AP-G · ausführbares Testmodell

Stand: 03.11.2026 · PR [#164](https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/164) · kein Merge durch Codex

## Kandidat und Preview

- Produkt- und Testkandidat: `caee0cc8cf0b884277ff97abc3f08a5419fb0879`
- READY-Git-Preview genau dieses SHA: https://galvanik-kreile-werkstatt-bmmyob2cx.vercel.app
- Deployment-Beleg: GitHub Deployment `7507179414`, vollständiger SHA wie oben, Status `success`, 03.11.2026 00:37:53 UTC; eindeutiger Deployment-Link statt Branch-Alias.
- Bauplan: spec `a887ece362f4`
- Bauplan-SHA-256: `5E7B880BD9D4B35EAF7BF906F2693011192933E000FA7AEA94222395F34A1F70`
- Generator: unverändert; Schreib- und `--check`-Lauf deterministisch PASS.

## Erzeugte Fälle

| Seite | Fälle |
| --- | ---: |
| `eingang` | 49 |
| `kundeneu` | 31 |
| `kundebearbeiten` | 19 |
| **Gesamt** | **99** |

Der frische Replay-Lauf bewertet alle 99 Fälle korrekt: **36 bestehende Wege bestehen; 63 offene Wege scheitern erwartungsgemäß**.
Die frühere Angabe 44/55 beruhte auf einem unzuverlässigen lokalen Teststand und ist zurückgezogen.
Ein unerwarteter Fehler oder ein unerwarteter Erfolg eines gelisteten Falls lässt das Gate scheitern. Erwartete Fehler sind keine fertigen Funktionen.

## Erwartet rot

Die Zuordnung folgt P25 und der Paketentscheidung vom 02.11. 23:00; AP-U entfällt zugunsten AP-EIN Teil 2.

- AP-02 (4): `E04`, `E35`, `E36`, `E37`
- AP-EIN-2 (1): `E07`
- AP-K1 (50): `E22`, `E25`, `E26`, `E27`, `E28`, `K01`, `K02`, `K03`, `K04`, `K05`, `K06`, `K07`, `K08`, `K09`, `K10`, `K11`, `K13`, `K14`, `K16`, `K17`, `K19a`, `K18b`, `K19b`, `K19c`, `K20`, `K21`, `K22`, `K23`, `K26`, `K27`, `K28`, `B01`, `B02`, `B03`, `B04`, `B05`, `B06`, `B17`, `B07`, `B08`, `B09`, `B10`, `B11`, `B12a`, `B12b`, `B12c`, `B13`, `B14`, `B15`, `B16`
- AP-N (3): `E33`, `E34`, `K25`
- AP-E (1): `E38`
- AP-F (1): `E40`
- AP-M (3): `E43`, `E44`, `K24`

## Korrektur C1: lokal und CI prüfen denselben Kandidaten

- Ein vorhandener App-Server wird auch lokal nicht mehr wiederverwendet (`reuseExistingServer: false`).
- Vor Taste N wartet das Gerüst auf die fertige Shell; der Fall ohne Recht `eingang` verlangt dabei kein Plus.
- Fehlende Felder werden mit einer begrenzten Elementwartezeit erkannt, statt erst am globalen Test-Timeout zu scheitern.
- Nach „Angaben erkennen“ wartet das Gerüst auf das Ende der Server-Aktion. E33 konnte vorher vor der Antwort fälschlich grün erscheinen.
- Existenz, disabled und Text des Aktionsknopfs werden in einem DOM-Snapshot gelesen. Damit wartet der Test nach dem erfolgreichen Entfernen des Knopfs nicht auf dessen erneutes Erscheinen (CI-Befund E32).
- Acht verfrüht aus der Rot-Liste entfernte Zukunftsfälle sind wieder ihrer durch P25 bestimmten Aufgabe zugeordnet.
- Keine Produktfunktion, Modell-Erwartung oder erzeugte Testassertion wurde für C1 geändert.

## Nachweise

- A11: Authority und Delivery samt Selbsttests, Scope-/Regression-Selbsttests, Module, H18, H16, no-fake, F0-Doku, Supabase-Grenze, `git diff --check origin/main`, TypeScript und Full-Lint PASS.
- Build PASS; danach frische lokale Replay-DB mit 67 Migrationen.
- Unveränderter Workflow-Befehl `npx playwright test -c e2e/generated/playwright.config.ts`: 99/99 korrekt bewertet (9,6 Minuten).
- E02/E17/E32/E33 jeweils dreimal wiederholt: 12/12 korrekt bewertet.
- Regulärer Commit-Hook: TypeScript, Staged-Lint, 133 Unit-Dateien und 1083 Tests PASS.
- Geprüfter und committeter Tree: `51a6e04e46f4af3feada1fec3ea8bbb093bc0bb2`.
- Scope-Anker: [#163](https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/163), SHA `05eedd4fa55f60357e92c092ec6a5c3fde626c73`, noch nicht gemergt.

## CI am Produkt- und Testkandidaten

Alle Jobs sind abgeschlossen und dem SHA `caee0cc8cf0b884277ff97abc3f08a5419fb0879` zugeordnet.

| Check | Ergebnis | Beleg |
| --- | --- | --- |
| quality | FAIL – Scope wartet auf #163 | [Job](https://github.com/schoggertraube-rev/galvanik-kreile-app/actions/runs/41554087694/job/125648572243) |
| ratchet | FAIL – Scope wartet auf #163 | [Job](https://github.com/schoggertraube-rev/galvanik-kreile-app/actions/runs/41554085370/job/125648565187) |
| Fresh Supabase replay | PASS | [Job](https://github.com/schoggertraube-rev/galvanik-kreile-app/actions/runs/41554087694/job/125648571923) |
| agentur-gate (Push) | PASS | [Job](https://github.com/schoggertraube-rev/galvanik-kreile-app/actions/runs/41554081809/job/125648552396) |
| agentur-gate (PR) | PASS | [Job](https://github.com/schoggertraube-rev/galvanik-kreile-app/actions/runs/41554087547/job/125648571862) |
| h16-schema + Generated flows (Push) | PASS – 99/99 korrekt bewertet | [Job](https://github.com/schoggertraube-rev/galvanik-kreile-app/actions/runs/41554081809/job/125648551776) |
| h16-schema + Generated flows (PR) | PASS – 99/99 korrekt bewertet | [Job](https://github.com/schoggertraube-rev/galvanik-kreile-app/actions/runs/41554087547/job/125648571611) |
| Vercel | READY | [Deployment](https://vercel.com/schoggertraube-revs-projects/galvanik-kreile-werkstatt/2dtAGgNnNhdD2RYZdAvEuiUkde2R) |
| Vercel Preview Comments | PASS | [PR-Checks](https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/164/checks) |

Die zwei roten Jobs scheitern ausschließlich im Scope-Schritt:
`quality`: „Active package path and commit-role separation“;
`ratchet`: „Enforce protected active-package scope and commit roles“.
Die Logs beider Jobs enthalten `SALES_STAGE_B2_SCOPE:quality/module-gates-baseline.json` und
`SALES_STAGE_B2_MIGRATION_INVALID:supabase/migrations/20261103010000_ap_r_freitext_einheiten.sql`.
Der bytegleiche Checker aus #163 prüft den gesamten Kandidaten mit
`KREILE_LIVE_PACKAGE_SCOPE=PASS branch=kreile/b2-eingang`.
Die geschützten Regeln auf main wurden nicht verändert; #163 muss durch die Owner gemergt werden.

Der Planungschat prüft die Testzuordnung und den exakten Kandidaten unabhängig. Diese Abgabe ist keine Owner-Abnahme.
