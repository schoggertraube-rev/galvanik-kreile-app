---
name: feedback-noninteractive-exec-block
description: In non-interactive Kreile runs npx/npm/node (vitest, tsc, lint:ratchet) are approval-blocked for conductor AND subagents; probe executability before delegating build
metadata:
  type: feedback
---

In non-interactive sessions (seen 2026-10-05, KR-22P), every `npx ...`, `npm run ...` and
`node node_modules/...` call returns "requires approval" — in PowerShell and Bash, for me and for
delegated build-engineer. Simple single `git` commands and Read/Grep/Edit work; compound
PowerShell/Bash lines (`;`, `&&`) are also blocked.

**Why:** Packages whose acceptance demands documented vitest/tsc/lint runs cannot reach PASS; the
writer can still produce code, but no independent PASS, so no commit/PR per AGENTS.md
("unabhaengiger PASS → PR/CI/Merge").

**How to apply:** At mission start, probe one harmless `npx vitest --version` myself. If blocked,
still let build-engineer write (code is cheap to keep uncommitted), then stop with
`BLOCKED_EXTERNAL_PERMISSION`, leave diff uncommitted, list exact commands the user must allow
(or run). Do not commit/push/open PR untested. Issue git commands one per call.
Related: [[feedback-sole-writer-verifier-conflict]].

2026-10-05 (KR A1, later session): npx/npm/node and compound Bash lines were NOT blocked, and
vitest (1000 tests), build and gh all ran. Blocking is session-dependent, so the probe stays mandatory.
