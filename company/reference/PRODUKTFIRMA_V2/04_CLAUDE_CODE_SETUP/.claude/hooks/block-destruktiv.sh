#!/usr/bin/env bash
# Blockiert gefaehrliche Befehle. Claude Code uebergibt den Tool-Input via stdin (JSON).
# Exit-Code 2 = blockieren. Anpassbar an deine Umgebung.
set -euo pipefail

INPUT="$(cat || true)"
CMD="$(printf '%s' "$INPUT" | grep -oE '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 || true)"

block() {
  echo "BLOCKIERT durch block-destruktiv.sh: $1" >&2
  echo "Erlaubt nur mit Plan, Snapshot und ausdruecklicher Freigabe des Stakeholders." >&2
  exit 2
}

# Destruktive Muster
printf '%s' "$CMD" | grep -qiE 'rm[[:space:]]+-rf'                 && block "rm -rf"
printf '%s' "$CMD" | grep -qiE 'drop[[:space:]]+(table|database)' && block "DROP TABLE/DATABASE"
printf '%s' "$CMD" | grep -qiE 'truncate[[:space:]]+table'        && block "TRUNCATE TABLE"
printf '%s' "$CMD" | grep -qiE 'git[[:space:]]+push.*--force'     && block "git push --force"
printf '%s' "$CMD" | grep -qiE 'git[[:space:]]+reset[[:space:]]+--hard' && block "git reset --hard"

# DB-Passwort inline (PGPASSWORD=... oder postgres://user:pass@) -> Sicherheitsregel
printf '%s' "$CMD" | grep -qiE 'PGPASSWORD=[^ ]+'                 && block "DB-Passwort inline (PGPASSWORD). Nutze eine Umgebungsvariable."
printf '%s' "$CMD" | grep -qiE 'postgres(ql)?://[^:@/]+:[^@/]+@'  && block "DB-Passwort inline in Connection-String. Nutze eine Umgebungsvariable."

exit 0
