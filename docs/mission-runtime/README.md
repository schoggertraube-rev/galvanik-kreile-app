# Control Plane Minimum CI

This control-plane slice keeps `main` as the single delivery truth and adds the smallest blocking CI gate that can run on every pull request to `main` and every push on `main`.

The workflow intentionally separates two concerns:

- blocking gates for TypeScript, unit tests, build, changed-file ESLint, `git diff --check`, and forbidden-pattern checks
- non-blocking visibility for the repository-wide lint debt that already exists outside a given PR scope

Node resolution is kept deterministic in the workflow: it prefers `package.json` `engines.node` when present and otherwise falls back to `24`, matching the current delivery runtime used by `main`.

The forbidden-pattern script only inspects changed files in the CI diff range. That keeps existing repo debt visible without turning unrelated historical issues into a permanent red gate for future small PRs.
