# Abgabe AP-R · 3.0 „Neu erfassen“

Stand: 03.11.2026 · PR [#164](https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/164) · kein Merge durch Codex

## Kandidat und Preview

- Produkt- und Testkandidat: `caee0cc8cf0b884277ff97abc3f08a5419fb0879`
- READY-Git-Preview genau dieses SHA: https://galvanik-kreile-werkstatt-bmmyob2cx.vercel.app
- Deployment-Beleg: GitHub Deployment `7507179414`, vollständiger SHA wie oben, Status `success`, 03.11.2026 00:37:53 UTC; eindeutiger Deployment-Link statt Branch-Alias.
- Scope-Anker: [#163](https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/163), SHA `05eedd4fa55f60357e92c092ec6a5c3fde626c73`

## Geliefert

- Plus und Taste N öffnen als einzigen kontextlosen Einstieg 3.0 „Neu erfassen“ mit genau zwei Kacheln.
- „Auftrag oder KV erfassen“ öffnet die leere Erfassung; „Kunde anlegen“ öffnet das bestehende Kundenformular.
- Aufrufe mit Kunde bleiben direkt in der Erfassung; ohne Recht `eingang` gibt es weder Plus noch N-Einstieg.
- Prüfliste, Enter-Tor, Position hinzufügen/entfernen und Feldprüfung sind an die Bauplan-Kennungen gebunden.
- Eine gemeinsame client-/serverfähige Einheitenliste wird von Oberfläche, Command, Belegleser und Auftragskartenleser genutzt.
- `next/font/google` ist aus den Produktpfaden entfernt; Fraunces, Inter, Geist Mono und Manrope liegen als lokale Latin-WOFF2 samt OFL im Repo.
- Der nicht paketierte Oberflächen-Schlüssel-Vorgriff wurde zurückgenommen. `orderIntakeSurfaces.ts` und alle Aufrufe sind entfernt; Schlüssel samt Bestandsmigration folgen gemeinsam in AP-EIN Teil 2 (Entscheidung 02.11. 23:00).
- C1 ändert ausschließlich die Teststeuerung; die Produktfunktionen dieses Kandidaten entsprechen dem vorherigen Produktstand `b3823e11`.

## Migration und Vertrag

- Migration: `supabase/migrations/20261103010000_ap_r_freitext_einheiten.sql`
- Migrations-SHA-256: `0830E7F4E516EC69A6D8ED0940F16AABA9611F64A294EBA1129C25110CBDBE31`
- Akzeptanztest-SHA-256: `6863EDA9CD74B806209C42C212EB81BA841B55DE6C34B1C61EBABDEB86D43243`
- View-Diff: im Freitext-Zweig genau die erlaubte Einheitenprüfung; Kopfkommentar auf AP-R korrigiert.
- Die Migration wurde ausschließlich auf der lokalen Replay-DB geprüft (67 Migrationen). Dieser Nachtlauf führt keine Dev-Migration und keinen Dev-Schreibvorgang aus. Für diese zusätzliche Migration wird hier kein Dev-Gleichstand behauptet.
- Die erzeugten Replay-Fälle prüfen die echten Server-Aktionen, gespeicherte Daten und die wieder gelesene Ansicht, darunter Doppelklick und erneutes Buchen nach Netzfehler.

## Fälle und Checks

- **36 bestehende Wege bestehen**, darunter `E02`, `E09`, `E10`, `E11`, `E17`, `E20`, `E39`, `E41`.
- **63 offene Wege scheitern erwartungsgemäß**; vollständige Zuordnung in [ABGABE_AP-G.md](./ABGABE_AP-G.md). Die frühere Angabe 44/55 ist zurückgezogen.
- `E07` gehört zu AP-EIN Teil 2: a887 erwartet bereits den Oberflächen-Key `offen`; AP-R bewahrt den bestehenden Anzeigewert `noch zu klären`, bis die Bestandsmigration geliefert wird.
- Lokale A11-Strecke, Build und kompletter frischer Replay-Flowlauf PASS; regulärer Commit-Hook mit 133 Dateien/1083 Unit-Tests PASS.

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

## Owner-Klickweg

Beginn mit der oben belegten Git-Preview des Kandidaten; der Planungschat prüft diesen Weg zuerst.

1. Als Rolf auf das Plus klicken: „Neu erfassen“ zeigt genau „Auftrag oder KV erfassen“ und „Kunde anlegen“.
2. „Auftrag oder KV erfassen“ öffnen: leere Erfassung, Fokus in der Kundensuche.
3. Schließen und Taste N drücken: wieder „Neu erfassen“; Taste K öffnet dort „Kunde anlegen“.
4. Aus einer Kundenkarte „Neuer Auftrag“ wählen: Erfassung öffnet direkt mit gesetztem Kunden.
5. Sobald Codex den freigegebenen Dev-Migrationsabgleich belegt hat: einen vollständigen Auftrag buchen und Meldung sowie direkt geöffnete Auftragskarte prüfen. Den DB-/Event-Nachweis übernimmt Codex.

Der PR bleibt ungemergt; #163 ist Voraussetzung für das geschützte Scope-Gate.
