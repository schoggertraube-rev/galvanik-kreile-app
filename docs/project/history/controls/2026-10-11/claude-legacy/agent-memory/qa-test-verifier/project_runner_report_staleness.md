---
name: runner-report-staleness
description: "Runner-Berichte ('LOKALER VORAB-TEST ROT') koennen einen Dateistand vor den Reparatur-Writes beschreiben; per mtime gegenpruefen statt Bericht als Wahrheit nehmen."
metadata:
  type: project
---

Ein ROT-Bericht des Runners kann einen Worktree-Stand beschreiben, der zum Zeitpunkt der
Verifikation schon ueberschrieben ist. Belegt am 2026-09-27 in Paket B2
(`claude/kr-b2-auftrag-zeitpunkte`): 3 gemeldete TS2322-Fehler, aber
`npx tsc --noEmit --incremental false` Exit 0; die mtimes der drei Dateien lagen alle
nach der plausiblen Berichtszeit.

**Why:** Der Writer-Agent speichert Dateien waehrend/nach dem Bericht; Bericht und
Dateistand sind nicht atomar. Zusaetzlich kann `tsconfig.tsbuildinfo` einen
inkrementellen Lauf verfaelschen.

**How to apply:** Bei Widerspruch Bericht vs. eigener gruener Lauf: (1) immer
`--incremental false` bzw. Cache umgehen, (2) `ls -l --time-style=full-iso` der
betroffenen Dateien gegen die Berichtszeit stellen, (3) den Fehlerort im Bericht
(Zeilennummer) gegen `git show HEAD:<pfad>` pruefen — verschobene Zeilennummern
belegen einen Zwischenstand. Ergebnis als OPEN kennzeichnen, wenn die Runner-Uhrzeit
nicht belegbar ist. Siehe auch [[project_b1_storno_ci_wiring_oscillation]].
