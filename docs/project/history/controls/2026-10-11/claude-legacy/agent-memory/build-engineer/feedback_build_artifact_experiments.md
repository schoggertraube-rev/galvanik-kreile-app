---
name: build-artifact-experiments
description: Bei Build-Diagnosen keine Geschwister-Kopien von .next anlegen — der Kreile-Projektguard blockiert `rm -rf`, Aufraeumen braucht dann Freigabe.
metadata:
  type: feedback
---

Fuer Cold-Cache-Experimente NICHT `.next` per `mv` zur Seite kopieren (`.next.bak` o.ae.).
Entweder in-place neu bauen oder vorher Freigabe fuer das spaetere Loeschen einholen.

**Why:** Ein `rm -rf` wird vom Kreile-Projektguard hart blockiert
("Destruktiver Befehl durch Kreile-Projektguard blockiert ... hole ausdrueckliche Freigabe ein").
Das versionierte `.gitignore` enthaelt bewusst nur `/.next/` (ein `/.next.*/`-Block wurde am
2026-09-28 als Scope-Verstoss aus PR #115 / Paket B2 entfernt und ist separat zu autorisieren).
Geschwister-Kopien wie `.next.green-warm` sind hier nur deshalb unsichtbar, weil `/.next.*/`
lokal in `.git/info/exclude` steht — das ist nicht versioniert, gilt also nicht in frischen
Clones oder CI, wo solche Ordner sofort als untracked auftauchen und den Commit verschmutzen.
Ergebnis: Der Muell laesst sich nicht mehr selbst beseitigen, weil der Guard genau das Kommando
blockiert, das man dafuer braucht — und Umgehen des Guards ist nicht erlaubt.

**How to apply:** Sobald eine Build-Diagnose einen Cache-Reset verlangt, zuerst fragen, ob
`.next` geloescht werden darf, statt eine Kopie anzulegen. Falls doch Kopien noetig sind, sie
ausserhalb des Repos unter `os.tmpdir()` ablegen (`C:\Users\Traube\AppData\Local\Temp`) —
dort ist Schreiben erlaubt und der Worktree bleibt sauber.
Siehe auch [[scope-stop-and-report]].
