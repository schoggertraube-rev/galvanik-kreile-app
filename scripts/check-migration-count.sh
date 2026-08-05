#!/usr/bin/env bash
# Compatibility entrypoint. The old count-only guard could not detect version,
# name, or statement drift. Keep this path for existing callers, but delegate to
# the canonical manifest validator.

set -euo pipefail

exec node scripts/check-migration-ledger.mjs "$@"
