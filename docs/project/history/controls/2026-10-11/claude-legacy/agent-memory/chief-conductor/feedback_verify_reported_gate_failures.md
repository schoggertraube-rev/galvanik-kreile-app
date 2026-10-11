---
name: feedback-verify-reported-gate-failures
description: A pasted "LOKALER VORAB-TEST ROT" gate-failure report must be independently reproduced before delegating a fix — it can itself be wrong or templated
metadata:
  type: feedback
---

When an incoming task hands me a pre-formatted "gate failed, here is the exact error output"
block (file:line violations, exact command line) and instructs me/a writer to "fix the error at
its origin, nothing else," do NOT treat that block as ground truth. Independently reproduce it
first with real tool calls (read the checker script, check `git log --all` / `git ls-files` for
the named paths, grep the actual pattern in source) before dispatching build-engineer.

**Why:** Found in [[project_b2_auftrag_zeitpunkte_package]] Runde 8 — a reported forbidden-pattern
violation named a path (`.next.stopgate-bak/cache/webpack/.../0.pack`) that had never been
committed anywhere in the repo (empty `git log --all -- <path>`), while the report's own command
line still showed a literal, never-substituted template placeholder (`--base {BASE}`). The
checker script only diffs tracked files between two real refs — it cannot structurally see an
untracked working-tree artifact. Delegating this to a build-engineer would have sent them hunting
for a source-code fix for a defect that lived in a stale, untracked local build-cache backup
directory (runner-side sandbox contamination), which no `src/` edit could retroactively change.

**How to apply:** Before delegating any "fix this exact reported gate failure" task: (1) read the
checker/script referenced in the command to learn its actual input scope (tracked diff vs.
working tree vs. full filesystem grep), (2) check whether the named file/path is even tracked
(`git ls-files`, `git log --all --`), (3) grep the actual forbidden pattern in the real source
tree. If none of these confirm the report, do not guess a code fix — report the mismatch as a
blocker (likely runner/sandbox-side artifact or template bug) and ask for a re-run with real refs
on a clean working tree, rather than silently complying or silently refusing.

**Nachtrag 2026-09-28 (Runde 9, dauerhaft geloest):** Die Ursache war strukturell und lag in
`.gitignore`: nur `/.next/` war ignoriert, die Geschwister-Build-Ausgaben der Warmup-/Stop-Gate-
Werkzeuge (`.next.stopgate-bak/`, `.next.green-warm/`) nicht. Deren Webpack-Cache-Packs enthalten
kompilierte Strings (`getPublicUrl`, `SUPABASE_SERVICE_ROLE_KEY`) und tauchen daher in jeder
Werkzeugkette auf, die den Arbeitsbaum statt nur den getrackten Diff scannt. Fix: `/.next.*/` in
`.gitignore` (keine getrackte Datei wird davon verdeckt, `git ls-files | grep '^\.next\.'` = 0).
Wenn ein Gate-Report auf `.next*`-Pfade zeigt, ist das nie ein Quellcode-Defekt — pruefe zuerst,
ob das Ignore-Muster die Artefakte wirklich abdeckt.
