---
name: feedback-ci-schema-pin-pattern
description: quality.yml resets the local schema to a version-pinned migration before running feature test blocks — a new migration after that pin is invisible to its own tests even if the test file is added to the run list
metadata:
  type: feedback
---

`quality.yml` runs several `supabase db reset --local --no-seed --version <pinned>` steps
between feature test blocks (e.g. `--version 20260909180000` before the F1.4/F1.5 block). Any
migration created AFTER that pinned version is invisible to tests run in that block, even if the
test file is correctly added to the block's `run:` command. Only steps using a bare
`supabase db reset --local --no-seed` (no `--version`) pick up the newest migration.

**Why:** Discovered during [[project_b1_storno_p0_package]] retry: qa-test-verifier found that
merely adding a new test file to a CI step's run list (the obvious fix for "test doesn't run in
CI") is NOT sufficient when that step's preceding schema reset is version-pinned older than the
new migration — the test would then run against the stale schema and fail for the wrong reason,
or worse, silently not exercise the new guard at all if the old schema still passes.

**How to apply:** Whenever a build-engineer or I am asked to wire a new migration + its test into
CI, always check BOTH: (1) is the test file listed in the relevant blocking step's `run:` command,
AND (2) does the schema-reset step immediately preceding it use a `--version` pin, and if so, is
that pin at or after the new migration's timestamp. Fixing only (1) without checking (2) produces
a false sense of coverage. This is a systemic CI-topology issue (build-engineer's own scope was
correctly restricted from seeing it — quality.yml was outside their allowlist), not a one-off
mistake by any single package's author.
