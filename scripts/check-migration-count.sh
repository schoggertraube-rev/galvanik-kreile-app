#!/usr/bin/env bash
# check-migration-count.sh
# CI guard: verifies local migration file count matches expected ledger count.
# Usage: ./scripts/check-migration-count.sh [expected_count]
#
# If expected_count is omitted, reads from scripts/migration-ledger-count.txt.
# Exit 0 = match, Exit 1 = mismatch.

set -euo pipefail

MIGRATIONS_DIR="supabase/migrations"
COUNT_FILE="scripts/migration-ledger-count.txt"

EXPECTED="${1:-}"
if [ -z "$EXPECTED" ] && [ -f "$COUNT_FILE" ]; then
  EXPECTED=$(head -1 "$COUNT_FILE" | tr -d '[:space:]')
fi

if [ -z "$EXPECTED" ]; then
  echo "ERROR: Kein erwarteter Ledger-Count angegeben."
  echo "Nutzung: $0 <expected_count>  oder  echo 95 > $COUNT_FILE"
  exit 1
fi

ACTUAL=$(find "$MIGRATIONS_DIR" -maxdepth 1 -name '*.sql' -type f | wc -l | tr -d '[:space:]')

if [ "$ACTUAL" -eq "$EXPECTED" ]; then
  echo "OK: Migrations-Dateianzahl ($ACTUAL) stimmt mit Ledger ($EXPECTED) ueberein."
  exit 0
else
  echo "FEHLER: Migrations-Dateianzahl ($ACTUAL) weicht vom Ledger ($EXPECTED) ab!"
  echo "Moegliche Ursachen:"
  echo "  - Migration direkt auf Production angewandt ohne Stub-Datei"
  echo "  - Datei geloescht ohne Ledger-Bereinigung"
  echo "  - Ledger-Count in $COUNT_FILE veraltet"
  exit 1
fi
