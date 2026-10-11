---
name: package-deliverables-arrive-uncommitted
description: Bei den kr-b1/kr-b2 Paketen liegen die Rundenergebnisse regelmaessig NUR im Worktree; Branch und origin sind in sync und kennen die neuen Dateien nicht — Commit-/Push-Stand immer zuerst pruefen.
metadata:
  type: project
---

Wiederkehrendes Muster in den Out-of-band-Paketen (`claude/kr-b1-storno-p0`,
`claude/kr-b2-auftrag-zeitpunkte`): Der Build-/Writer-Bericht listet "FILES" und
"CHECKS gruen", aber die Dateien sind uncommitted Worktree-Aenderungen. Am
2026-09-28 fuer B2 Runde 5 verifiziert: `HEAD == origin/claude/kr-b2-auftrag-zeitpunkte`
(0 ahead / 0 behind), waehrend alle vier Rundenergebnisse nur im Worktree lagen —
die neue Integrationstestdatei war sogar untracked (`??`). PR-CI hat den neuen
Gate-Schritt und die Testdatei also nie gesehen.

**Why:** AGENTS.md verlangt "Kein Abschluss ohne Draft-PR, Checks, Vercel Preview"
und behandelt Dirty-Worktrees als bloss Quellenmaterial. Ein gruener lokaler Lauf
auf uncommitted Dateien ist kein Lieferbeweis, und "Diff gegen origin/main ist leer"
kann bedeuten, dass der Worktree eigene Commits des Branches zurueckdreht (bei B2
Runde 5 genau so bei `missions/F1_ORDER_TO_CASH_PILOT_001.yml`: leer gegen
origin/main, aber -21 Zeilen gegen HEAD).

Bestaetigt am 2026-09-28 ein zweites Mal, diesmal fuer einen *Revert*: Ein
build-engineer meldete ".gitignore ist bytegleich mit origin/main, keine andere Datei
angefasst". Beides stimmte — aber nur fuer die Arbeitskopie. `git ls-tree HEAD` und
`gh pr view 115 --json files` zeigten `.gitignore` unverandert im PR (Blob 0aee810c
statt 4366fc4f). Der P1-Reviewbefund "aus PR #115 entfernen" war also NICHT erledigt,
obwohl `git diff main -- .gitignore` leer war.

**How to apply:** Vor jeder Abnahme zuerst `git status --short`,
`git rev-list --left-right --count HEAD...origin/<branch>` und `git diff HEAD` je
Datei fahren — und Diffs IMMER gegen HEAD, nicht nur gegen origin/main, sonst
uebersieht man Reverts eigener Commits. Bei uncommitted Stand hoechstens
PROPOSED_PASS vergeben. Zusatzpruefung: untracked Testdateien sind kein
Lieferstand, und ein CI-Schritt, der eine untracked Datei aufruft, laesst CI
fail-closed laufen (vitest endet mit Exit 1 ohne Treffer). Verwandt:
[[b1-storno-ci-wiring-oscillation]], [[runner-report-staleness]].
