# Abgabe AP-R · 3.0 „Neu erfassen“

Stand: 02.11.2026 · PR [#164](https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/164) · kein Merge durch Codex

## Kandidat und Preview

- Produkt-SHA: `b3823e11e67dd9ca1b2a194cc8db360e58011d46`
- READY-Git-Preview genau dieses SHA: https://galvanik-kreile-werksta-git-7220b7-schoggertraube-revs-projects.vercel.app
- Scope-Anker: [#163](https://github.com/schoggertraube-rev/galvanik-kreile-app/pull/163), SHA `05eedd4fa55f60357e92c092ec6a5c3fde626c73`

## Geliefert

- Plus und Taste N öffnen als einzigen kontextlosen Einstieg 3.0 „Neu erfassen“ mit genau zwei Kacheln.
- „Auftrag oder KV erfassen“ öffnet die leere Erfassung; „Kunde anlegen“ öffnet das bestehende Kundenformular.
- Aufrufe mit Kunde bleiben direkt in der Erfassung; ohne Recht `eingang` gibt es weder Plus noch N-Einstieg.
- Prüfliste, Enter-Tor, Position hinzufügen/entfernen und Feldprüfung sind an die Bauplan-Kennungen gebunden.
- Eine gemeinsame client-/serverfähige Einheitenliste wird von Oberfläche, Command, Belegleser und Auftragskartenleser genutzt.
- `next/font/google` ist aus den Produktpfaden entfernt; Fraunces, Inter, Geist Mono und Manrope liegen als lokale Latin-WOFF2 samt OFL im Repo.
- Der nicht paketierte Oberflächen-Schlüssel-Vorgriff wurde vollständig zurückgenommen. `orderIntakeSurfaces.ts` und alle Aufrufe sind entfernt; AP-U übernimmt Schlüssel plus Datenmigration später gemeinsam.

## Migration und Vertrag

- Migration: `supabase/migrations/20261103010000_ap_r_freitext_einheiten.sql`
- Migrations-SHA-256: `0830E7F4E516EC69A6D8ED0940F16AABA9611F64A294EBA1129C25110CBDBE31`
- Akzeptanztest-SHA-256: `6863EDA9CD74B806209C42C212EB81BA841B55DE6C34B1C61EBABDEB86D43243`
- View-Diff: im Freitext-Zweig genau die erlaubte Einheitenprüfung; Kopfkommentar auf AP-R korrigiert; keine Remote-/Dev-Migration durch Codex.

## Fälle und Checks

- Grün: 44 von 99 erzeugten Fällen, darunter `E09`, `E10`, `E11`, `E20`, `E39`, `E41`.
- Erwartet rot: 55 Fälle ausschließlich nicht abgenommener Folgepakete; vollständige Zuordnung in [ABGABE_AP-G.md](./ABGABE_AP-G.md).
- `E07` steht auf AP-U, weil a887 bereits den Oberflächen-Key `offen` erwartet, AP-R aber vertragsgemäß den bestehenden Anzeigewert `noch zu klären` bewahrt.
- Modul-Gates PASS; gezielte Regression 144/144; Gesamtsuite 133/133 Dateien und 1083/1083 Tests PASS; TypeScript und Produktionsbuild PASS.
- Git-Preview ist ohne Google-Schriftabruf READY.

## Owner-Klickweg

1. Als Rolf auf das Plus klicken: „Neu erfassen“ zeigt genau „Auftrag oder KV erfassen“ und „Kunde anlegen“.
2. „Auftrag oder KV erfassen“ öffnen: leere Erfassung, Fokus in der Kundensuche.
3. Schließen und Taste N drücken: wieder „Neu erfassen“; Taste K öffnet „Kunde anlegen“.
4. Aus einer Kundenkarte „Neuer Auftrag“ wählen: Erfassung öffnet direkt mit gesetztem Kunden, ohne Zwischenmenü.
5. Einen vollständigen Auftrag buchen: Meldung, genau ein Auftrag/`intake_item`/Event und direkt geöffnete Auftragskarte prüfen.

Der PR bleibt ungemergt. CI wird nach dem Merge von #163 vollständig neu bewertet.
