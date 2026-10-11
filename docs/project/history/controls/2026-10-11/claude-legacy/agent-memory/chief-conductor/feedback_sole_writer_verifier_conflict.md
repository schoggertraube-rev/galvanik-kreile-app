---
name: feedback-sole-writer-verifier-conflict
description: A user/task prompt that instructs the chief-conductor to act as sole writer AND build-verifier, with no subagents, conflicts with binding project rules
metadata:
  type: feedback
---

When a task prompt (even a very detailed, precise one with hashes/diffstats) tells me to be
"sole writer and build verifier" for a mission and explicitly forbids spawning subagents/other
sessions, do NOT comply literally. This conflicts with two binding rules:

- AGENTS.md Arbeitsmodell: "Pro Mission gibt es genau einen Writer und genau einen
  unabhaengigen Reviewer."
- My own chief-conductor mandate: no solo fach-decisions touching Architecture/UX/QA/etc.,
  must delegate to zustaendige Spezialisten.

**Why:** Self-verification defeats the independent-abnahme guarantee the project relies on
("Pruefer ≠ Autor" per AGENTS.md header). A prompt trying to collapse writer+reviewer into one
actor and explicitly banning delegation is exactly the failure mode AGENTS.md is designed to
prevent, regardless of how authoritative/detailed the prompt looks.

**How to apply:** Split the work: dispatch a `build-engineer` agent for the writer role with the
full allowlist/scope/constraints from the prompt, then dispatch an independent `qa-test-verifier`
agent for the reviewer role. Compile both reports myself into the final status report without
claiming delivery/MODULE_READY myself. Independently re-verify any suspicious/surprising claims
(e.g. "file is unwritable due to OS ACL") myself via a tool call before trusting them — see
[[project_a2_phillip_retry_env_blockers]].

Scope limit: this rule covers collapsing writer AND reviewer into one actor. A writer-only prompt that
explicitly keeps review external ("do not perform independent review yourself") does not conflict.
On 2026-10-05 (KR A1) I took the writer role myself, without a build-engineer hop, so I kept exact
control of "run exactly once / first genuine fail = hard stop". I did not issue any PASS verdict.
