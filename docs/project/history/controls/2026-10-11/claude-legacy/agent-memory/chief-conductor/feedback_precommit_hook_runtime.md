---
name: feedback-precommit-hook-runtime
description: Kreile pre-commit hook (tsc + lint:staged + full vitest) runs ~10 min; run git commit backgrounded under an explicit timeout, never assume a hang early
metadata:
  type: feedback
---

`.husky/pre-commit` runs `npm run verify:precommit` = `npx tsc --noEmit && lint:staged && test:unit`
(full suite, 117 files / 1000 tests, --maxWorkers=1). Measured 2026-10-05 (KR A0): 585 s, RC 0.
An earlier A0 writer reported a "hang without output" in `env .husky/pre-commit`; on the rerun the
hook printed output right away and finished cleanly. The earlier report was probably
impatience/output buffering, not a real deadlock. The root cause was not proven.

**Why:** Killing a long-but-healthy hook wastes a correction round and invites `--no-verify` pressure.

**How to apply:** `timeout -k 15 1500 git commit -F msg > log 2>&1` via Bash run_in_background, then
watch the log for the `> test:unit` / `Test Files` markers. Only report a hang if the log stops
advancing past the limit. Related: [[feedback-noninteractive-exec-block]] (in that session npx/node
was NOT blocked, so the blocking is session-dependent).
