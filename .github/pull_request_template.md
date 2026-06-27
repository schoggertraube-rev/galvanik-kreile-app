## Scope

- Base branch is `main`.
- This PR keeps one delivery topic only.
- Changed TS/TSX files pass blocking ESLint.
- Repository-wide lint debt, if present, is unchanged debt and not bundled with unrelated fixes.
- No mixed app, schema, navigation, and control-plane changes in one PR.

## Checks

- `npx tsc --noEmit --incremental false`
- `npm run test:unit`
- `npm run build`
- `git diff --check`
- forbidden pattern gate

