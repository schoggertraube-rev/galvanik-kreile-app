#!/usr/bin/env node

/**
 * Kreile project guard for destructive Bash/PowerShell commands.
 * Reads Claude Code hook JSON from stdin.
 */

let input = "";
for await (const chunk of process.stdin) input += chunk;

let payload;
try {
  payload = JSON.parse(input || "{}");
} catch {
  process.exit(0);
}

const command = String(payload?.tool_input?.command ?? "");
const normalized = command.toLowerCase().replace(/\s+/g, " ").trim();

const destructivePatterns = [
  /\brm\s+-[^\n]*r[^\n]*f\b/,
  /\bremove-item\b[^\n]*(?:-recurse)[^\n]*(?:-force)/,
  /\brmdir\s+\/s\b/,
  /\bdel\s+\/[sq]\b/,
  /\bgit\s+reset\s+--hard\b/,
  /\bgit\s+clean\s+-[^\n]*f/,
  /\bgit\s+push\b[^\n]*(?:--force|-f)\b/,
  /\bgit\s+checkout\s+--\s+/,
  /\bgit\s+restore\s+(?:\.|--source|--worktree)/,
  /\bdrop\s+(?:table|schema|database)\b/,
  /\btruncate\s+(?:table\s+)?\w+/,
  /\bdelete\s+from\s+\w+\s*;?\s*$/m
];

const isDestructive = destructivePatterns.some((pattern) => pattern.test(normalized));
if (!isDestructive) process.exit(0);

const result = {
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason:
      "Destruktiver Befehl durch Kreile-Projektguard blockiert. Sichere zuerst Git/DB, liste betroffene Daten und Dateien auf, definiere Rollback und hole ausdrückliche Freigabe ein."
  }
};

process.stdout.write(JSON.stringify(result));
