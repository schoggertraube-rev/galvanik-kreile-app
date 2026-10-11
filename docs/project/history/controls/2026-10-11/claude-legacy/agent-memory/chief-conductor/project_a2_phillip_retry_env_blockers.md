---
name: project-a2-phillip-retry-env-blockers
description: Repo-wide OS-ACL blockers in 02_app — .env.local DENY makes all Vitest unrunnable and missions/ denies file creation so mission-file updates fail; first seen in the A2 Phillip retry session, re-confirmed 2026-09-20
metadata:
  type: project
---

On 2026-09-19, branch `path1/a2-phillip-recovery-20260919` (base origin/main
0e2216d01d22edac765ffd527fa71c50158e25d3), the A2 WerkstattView retry-port ratification
(add `onRetry` port to `WerkstattViewPorts`, bind to `useRouter().refresh` in
`WerkstattAppAdapter.tsx`, add safe-data-state messaging + single "Erneut laden" button to
error/conflict states) hit real, independently-verified external blockers:

- `src/app/warendurchlauf/__tests__/` is not writable by the session account (EPERM on write,
  confirmed via direct PowerShell `Add-Content` attempt, not just subagent claim).
- `.env.local` is not readable by the session account (EPERM, confirmed directly). This makes
  Vitest's config bootstrap (`loadEnv`) fail before any test runs — so the *entire* suite is
  unrunnable in this environment, not just the new test.
- The existing test file's `next/navigation` mock only provides `push`, not `refresh` — so even
  if the file were writable, the new retry test needs its own router mock update to avoid
  `router.refresh is not a function`.

Separately, two governance-level items surfaced (not resolved by writer or QA — correctly
escalated instead of silently decided, see [[feedback_sole_writer_verifier_conflict]]):
- `missions/F1_ORDER_TO_CASH_PILOT_001.yml` names a different branch/base
  (`path1/v5-p3-core-surfaces-search-20260916` @ `70ae0989...`) than the one this session
  actually worked on — a mission-file vs. actual-execution mismatch (F005).
- `docs/project/linie/ARCHITEKTUR_MODULE_PATH1.md:48` says Phillip has "fuenf eng typisierte
  Aktionsports"; adding `onRetry` makes it six. QA judged this fachlich defensible (recovery
  port ≠ work-order action port) but voted AMBIGUOUS, not PASS, because a written "fuenf" in
  the architecture truth can't be silently reinterpreted — needs an owner-level one-line
  precision edit to that doc before this can close.

**Why this matters:** the closure status for this session was `BLOCKED_EXTERNAL_PERMISSION`
(plus an unresolved `BLOCKED_GOVERNANCE_CONFLICT`-flavored branch mismatch) — not a code defect.
tsc, ESLint, module-gates, and git diff --check all passed; only test execution and the
architecture-doc number are blocking.

**How to apply:** Before resuming this work, a human needs to (1) fix the ACL on the `__tests__`
dir and `.env.local` for this session's account, or run the test step in an environment that has
access, and (2) get an owner decision on the ARCHITEKTUR_MODULE_PATH1.md "five ports" wording and
on which mission-file branch/base is authoritative. Don't re-attempt test execution repeatedly in
the same blocked environment — it's a permissions issue, not a flaky test.

**2026-09-19 re-confirmation:** Same session, same branch/HEAD, re-verified independently (not
just re-quoted from memory): `git status`/`diff --stat` matched the claimed WIP exactly (4 files,
21+/9-). Direct Bash `echo >> .../w2cB2m5j.unavailable.realRender.test.tsx` still returns
`Permission denied` right now — EPERM on the test file is reproducible today, not stale. Refused a
second prompt instructing "sole writer and verifier, no subagents" for the identical blocked task
(see [[feedback_sole_writer_verifier_conflict]]) instead of silently retrying. Stop hook then
confirmed all three points (EPERM, mission-file mismatch, five-vs-six-ports doc gap) as valid
blockers for closing this out — correct escalation, not over-caution.

**2026-09-20 scope update (branch `path1/p3-loopback-gate-recovery-20260919`, HEAD 73de6562):**
The permission damage is broader than the A2 paths and is confirmed OS-level, not harness-level:
- `.env.local` denies even `icacls` ("Zugriff verweigert") → an explicit DENY ACE for
  `CodexSandboxOnline`. Every Vitest entry point dies identically in `loadEnv` during
  `resolveConfig`: `npx vitest run <file>`, `npm test`, and `npm run test:unit`
  (`scripts/run-unit-tests.mjs`). `dangerouslyDisableSandbox: true` does **not** help, which
  proves it is the OS ACL and not the Bash tool sandbox. No CLI flag can move Vite's `envDir`
  (it follows `root`), and `vitest.config.ts` sets no `envDir`.
- `missions/` denies **file creation** for this account: the Edit tool fails with
  `EPERM ... F1_ORDER_TO_CASH_PILOT_001.yml.tmp.<pid>.<hash>` (atomic tmp+rename), and a plain
  shell `touch missions/.probe` returns `Permission denied`. The directory ACL *looks* permissive
  (`Authentifizierte Benutzer:(I)(M)`) — so do not trust `icacls` output here, probe instead.
  Consequence: **any mission-file documentation step is unexecutable**, which blocks the standard
  closing ritual for every package, not just this one.
- `src/**` writes still work normally (Edit succeeded on `src/lib/auth/`, `src/lib/server/`).
  Working checks that remain available: `npx tsc --noEmit`, `npx eslint <changed files>`,
  `npm run quality:authority-gate`, `git diff --check`.

**How to apply:** treat "run the focused unit tests" and "update `missions/*.yml`" as
capability-blocked in this environment until an admin repairs the ACLs for the session account.
Report them as `BLOCKED_EXTERNAL_PERMISSION` with the probe evidence above rather than retrying,
and never route around them via shell/ACL changes. See also [[project_tsx_userinfo_enomem_blocker]].

**2026-09-20, third confirmation (P1_BROWSER_HYDRATION_RECOVERY, HEAD 9291fd8a / PR #104):**
Both blockers re-probed twice in one session and are persistent, not transient — `.env.local`
`readFileSync` → EPERM, Vitest startup → EPERM in `loadEnv`, `missions/` file creation → EPERM.
A writer task can still deliver `src/**` code + tests and pass `tsc` / `eslint` / `authority-gate`
/ `git diff --check`; only the focused test run and the mission binding are unprovable. Useful
substitute when Vitest is dead: recompute the test's hardcoded expectations inline with `node -e`
in the same Node runtime and label it explicitly as *not* a test substitute — it validates the
constants, never the render.

**2026-09-21 scope widening (E0b_GOVERNANCE_SCOPE_REPAIR, branch
`path1/intake-v6-e0-governance-20260921`, HEAD c0e4b300e7268f13f16f9e383b1a265c8e2eecfe):**
The directory-level EPERM-on-create blocker is not limited to `missions/` — it now also covers
`docs/project/linie/` (probed directly with `echo >> docs/project/linie/<file>.probe` for both
`MODULKARTE_KANON.md` and `ARCHITEKTUR_MODULE_PATH1.md`: both `Permission denied`; the Edit tool's
atomic tmp+rename on `MODULKARTE_KANON.md` failed identically with
`EPERM ... MODULKARTE_KANON.md.tmp.<pid>.<hash>`). Control probe `src/probe.tmp` succeeded, so this
is again directory-scoped, not repo-wide. Net effect: a governance-doc-only package (mission YAML +
two `docs/project/linie/*.md` files, zero code) is fully blocked from delivery in this environment —
all three required target files sit in denied directories. Reported `BLOCKED_EXTERNAL_PERMISSION`
without retrying past the first confirmed probe per file, per the "don't re-attempt in the same
blocked environment" rule below.

**2026-09-21 re-confirmation (E0c_ALLOWLIST_REPAIR, repair 2/2, same branch/HEAD
`path1/intake-v6-e0-governance-20260921` @ c0e4b300e7268f13f16f9e383b1a265c8e2eecfe):** Sole-writer
task to insert exactly one line (`- docs/project/linie/ARCHITEKTUR_MODULE_PATH1.md`) into
`missions/F1_ORDER_TO_CASH_PILOT_001.yml` under `path1_intake_v6_allowlist`. Edit tool failed
identically on first attempt: `EPERM ... F1_ORDER_TO_CASH_PILOT_001.yml.tmp.16252.e8c0671001e1`
(atomic tmp+rename blocked). Per binding, no retry was attempted; exact unified diff was returned
for an authorized host bridge instead. This is the same `missions/`-directory-scoped, persistent
EPERM already logged above for this branch/HEAD in the E0b entry — not a new or transient blocker.
Closure status: `BLOCKED_EXTERNAL_PERMISSION`.

**Open owner scope decision (as of 2026-09-20, not yet routed):** the Rolf hydration P1
(`Intl.DateTimeFormat` without `timeZone` in a `"use client"` component → React #418) has at
least one live sibling of the same class that sits **outside** that mission's write allowlist:
`src/modules/werkstatt/ui/WerkstattView.tsx` (Phillip's tablet home, same `loadedAt` field).
Lower-risk date-only siblings: `src/modules/suche/ui/SearchDialog.tsx`,
`src/app/buchhaltung/rechnungen/InvoicesClient.tsx`.
**Why:** the physical-roles smoke gate covers Phillip too, so fixing only Rolf will very likely
still fail that gate. **How to apply:** when scoping the next hydration package, commission the
WerkstattView fix explicitly rather than letting a writer widen its own allowlist.
