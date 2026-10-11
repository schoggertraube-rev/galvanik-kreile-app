---
name: feedback-verifier-needs-workflow-context
description: qa-test-verifier must be told explicitly that uncommitted worktree changes are the expected handoff state in this repo's synchronous background-package workflow
metadata:
  type: feedback
---

In this project's "Hintergrund-Paket"/synchronous review-rework workflow, writer agents (and me)
are explicitly forbidden from running git write commands (add/commit/push/checkout/merge/rebase/
etc.). The Runner commits and pushes only after receiving the final MAIN_REPORT. So a finished,
correct fix legitimately sits as an uncommitted working-tree diff at handoff time — that is not a
delivery failure.

**Why:** In [[project_b2_auftrag_zeitpunkte_package]] Runde 4, a qa-test-verifier agent was not
given this workflow context and correctly found (via `ls-tree HEAD`/PR file list) that a fix was
"not delivered" (still uncommitted, PR unchanged) and returned an overall FAIL verdict for an
otherwise fully-verified, byte-identical, no-scope-creep fix. The finding itself was accurate and
worth surfacing, but framing it as a blocking FAIL misrepresents readiness — it makes a correctly
staged handoff look like unfinished work.

**How to apply:** When briefing qa-test-verifier (or any reviewer) on a fix produced under this
project's synchronous no-git-writes convention, state explicitly: "commit/push happens after your
report, by the Runner — verify the working-tree diff and its content/scope, not whether it is
already committed or already reflected in the remote PR." Ask the verifier to report an uncommitted
correct diff as PASS-pending-Runner-commit, distinct from an actual defect in the diff's content.
Still have them check for scope creep and correctness — just not commit status as a blocker.
