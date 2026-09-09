#!/usr/bin/env node

/**
 * Kreile project guard for destructive Bash/PowerShell commands.
 * Reads Codex hook JSON from stdin.
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

const commandSegments = normalized.split(/\s*(?:&&|\|\||;)\s*/);

function hasPosixFlag(args, shortFlag, longFlag) {
  return args.some(
    (argument) =>
      argument === `--${longFlag}` ||
      (/^-[^-]+$/.test(argument) && argument.slice(1).includes(shortFlag))
  );
}

function hasRecursiveForcedRm(segment) {
  const tokens = segment.split(" ").filter(Boolean);
  const commandIndex = tokens.findIndex((token) => /(?:^|[\\/])rm(?:\.exe)?$/.test(token));
  if (commandIndex < 0) return false;

  const args = tokens.slice(commandIndex + 1);
  return hasPosixFlag(args, "r", "recursive") && hasPosixFlag(args, "f", "force");
}

function hasPowerShellSwitch(args, name) {
  return args.some((argument) => argument === `-${name}` || argument.startsWith(`-${name}:`));
}

function hasRecursiveForcedRemoveItem(segment) {
  const tokens = segment.split(" ").filter(Boolean);
  const commandIndex = tokens.indexOf("remove-item");
  if (commandIndex < 0) return false;

  const args = tokens.slice(commandIndex + 1);
  return hasPowerShellSwitch(args, "recurse") && hasPowerShellSwitch(args, "force");
}

const destructivePatterns = [
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

const isDestructive =
  commandSegments.some(hasRecursiveForcedRm) ||
  commandSegments.some(hasRecursiveForcedRemoveItem) ||
  destructivePatterns.some((pattern) => pattern.test(normalized));
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
