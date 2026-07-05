#!/usr/bin/env node

/**
 * Kreile SSG-14 Guard — gehärtet in Mission M4+M5 (2026-07-05).
 *
 * Liest Claude-Code-Hook-JSON von stdin (PreToolUse) und verweigert
 * fail-closed alle SSG-14(b)-Kommandoklassen über ALLE Tools
 * (Bash, PowerShell, jedes Tool mit command-Feld, Datei-Tools, MCP):
 *
 *   1. git push               — immer (auch ohne --force)
 *   2. git commit             — ohne Missionsfreigabe (Flag-Datei, s.u.)
 *   3. git remote add/set-url/remove/rename
 *   4. npm run db:push / drizzle-kit push
 *   5. supabase-CLI           — jede Aufrufform
 *   6. vercel-CLI             — jede Aufrufform
 *   7. Seeds mit Auto-Confirm (seed/demo:reset/demo:cleanup/db:reset + --yes/--force/--confirm/-y/-f)
 *   8. .env*-Zugriff          — Shell UND Read/Edit/Write/Glob/Grep/Notebook
 *   9. MCP-Seitenkanäle       — Supabase-MCP komplett, Vercel-Deploy-Tool
 *  10. Bestandsklassen        — rm -rf, git reset --hard, DROP/TRUNCATE/DELETE ... (Regression)
 *
 * Missionsfreigabe (nur fuer git commit):
 *   Der Auftraggeber legt AUSSER-BAND die Datei .claude/state/MISSIONSFREIGABE
 *   mit nicht-leerem Inhalt (Missions-ID) an und entfernt sie nach dem Commit.
 *   Kein Agent erstellt diese Datei. Ohne Datei: deny (fail-closed).
 *
 * Rollback: Snapshot unter .claude/_snapshots/2026-07-05_pre_M4M5/
 */

import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

let input = "";
for await (const chunk of process.stdin) input += chunk;

let payload = null;
try {
  payload = JSON.parse(input || "{}");
} catch {
  payload = null;
}

function deny(cls, reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `[GUARD-DENY:${cls}] ${reason}`
      }
    })
  );
  process.exit(0);
}

// Fail-closed: unlesbare Payload wird verweigert, nicht durchgewunken.
if (payload === null || typeof payload !== "object") {
  deny(
    "PAYLOAD",
    "Hook-Payload unlesbar. Der Kreile-Guard verweigert fail-closed. Payload-Format pruefen."
  );
}

const toolName = String(payload?.tool_name ?? "");
const toolInput =
  payload?.tool_input && typeof payload.tool_input === "object"
    ? payload.tool_input
    : {};

// ---------------------------------------------------------------------------
// Klasse 9: MCP-Seitenkanaele (SSG-14(c))
// ---------------------------------------------------------------------------
const MCP_DENY_SERVERS = [
  // Supabase-MCP: kompletter Server (DB-Schreib- UND Lesetools; Lockerung nur ausser-Band)
  "mcp__53f3d868-21b4-47af-bf7e-526e36004e7e"
];
const MCP_DENY_TOOLS = [
  // Vercel-MCP: Deploy-Werkzeug
  "mcp__5a0f89bc-0951-446f-b7f2-9d1b2cfd4ac2__deploy_to_vercel"
];

if (MCP_DENY_SERVERS.some((s) => toolName === s || toolName.startsWith(s + "__"))) {
  deny(
    "MCP_DB",
    "Supabase-MCP-Seitenkanal ist in Agentur-Sessions technisch blockiert (SSG-14(c)). DB-Arbeit nur ueber freigegebene Missionen; Lockerung nur ausser-Band durch den Auftraggeber."
  );
}
if (MCP_DENY_TOOLS.includes(toolName)) {
  deny(
    "MCP_DEPLOY",
    "Vercel-Deploy ueber MCP ist blockiert (SSG-14(c)). Deploy ist ein Release-Manager-/Ausser-Band-Akt."
  );
}

// ---------------------------------------------------------------------------
// Klasse 8 (Datei-Tools): .env*-Zugriff ueber Read/Edit/Write/Glob/Grep/Notebook
// ---------------------------------------------------------------------------
const ENV_PATH_RE = /(^|[\\/])\.env/i;
const pathFields = ["file_path", "notebook_path", "path"];
if (toolName === "Glob") pathFields.push("pattern");
if (toolName === "Grep") pathFields.push("glob");
for (const field of pathFields) {
  const value = toolInput[field];
  if (typeof value === "string" && ENV_PATH_RE.test(value)) {
    deny(
      "ENV_ACCESS",
      `Zugriff auf .env*-Dateien ist blockiert (SSG-14(b)) — Feld "${field}". Secrets werden nie von Agenten gelesen oder geschrieben.`
    );
  }
}

// ---------------------------------------------------------------------------
// Shell-Klassen: jedes Tool mit command-Feld (Bash, PowerShell, kuenftige Shells)
// ---------------------------------------------------------------------------
const rawCommand = typeof toolInput.command === "string" ? toolInput.command : "";
if (!rawCommand) process.exit(0); // kein Kommando, keine Pfadtreffer -> erlaubt

const cmd = rawCommand.toLowerCase().replace(/\s+/g, " ").trim();

function missionApproved() {
  const dir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  try {
    const flag = join(dir, ".claude", "state", "MISSIONSFREIGABE");
    return statSync(flag).isFile() && readFileSync(flag, "utf8").trim().length > 0;
  } catch {
    return false;
  }
}

// Klasse 2: git commit — nur mit Missionsfreigabe; --no-verify nie.
if (/\bgit\s+commit\b/.test(cmd)) {
  if (/--no-verify\b/.test(cmd)) {
    deny(
      "GIT_COMMIT_NOVERIFY",
      "git commit --no-verify ist ausnahmslos blockiert. Hooks werden nie umgangen."
    );
  }
  if (!missionApproved()) {
    deny(
      "GIT_COMMIT",
      "git commit ohne Missionsfreigabe ist blockiert (SSG-14(b)). Freigabe = Auftraggeber legt .claude/state/MISSIONSFREIGABE mit Missions-ID an (ausser-Band) und entfernt sie nach dem Commit."
    );
  }
}

const SHELL_RULES = [
  {
    cls: "GIT_PUSH",
    re: /\bgit\s+push\b/,
    msg: "git push ist ausnahmslos blockiert — auch ohne --force (SSG-14(b)). Push ist ein Ausser-Band-Akt des Auftraggebers."
  },
  {
    cls: "GIT_REMOTE",
    re: /\bgit\s+remote\s+(add|set-url|remove|rm|rename)\b/,
    msg: "Aenderungen an git-Remotes sind blockiert (SSG-14(b))."
  },
  {
    cls: "DB_PUSH",
    re: /\bdb:push\b|\bdrizzle-kit\s+push\b/,
    msg: "Schema-Push (npm run db:push / drizzle-kit push) ist blockiert (SSG-14(b)). Schemaaenderungen nur als freigegebene, geprüfte Migrationsmission."
  },
  {
    cls: "SUPABASE_CLI",
    re: /(^|[;|&(]\s*|\bnpx\s+|\bbunx\s+|\bpnpm\s+dlx\s+|\bpnpm\s+exec\s+)supabase\b/,
    msg: "Die supabase-CLI ist blockiert (SSG-14(b)) — jede Aufrufform, auch npx supabase."
  },
  {
    cls: "VERCEL_CLI",
    re: /(^|[;|&(]\s*|\bnpx\s+|\bbunx\s+|\bpnpm\s+dlx\s+|\bpnpm\s+exec\s+)vercel\b/,
    msg: "Die vercel-CLI ist blockiert (SSG-14(b)). Deploys sind Ausser-Band-/Release-Akte."
  },
  {
    cls: "SEED_AUTOCONFIRM",
    re: /(seed|demo:reset|demo:cleanup|db:reset)[\w:.-]*\s.*(--yes\b|--force\b|--confirm\b|\s-y\b|\s-f\b)/,
    msg: "Seeds/Resets mit Auto-Confirm sind blockiert (SSG-14(b)). Bestaetigung ist ein menschlicher Akt."
  },
  {
    cls: "SEED_AUTOCONFIRM",
    re: /\becho\s+"?y(es)?"?\s*\|.*\b(seed|reset)\b/,
    msg: "Pipe-Bestaetigung (echo y | ...) fuer Seeds/Resets ist blockiert (SSG-14(b))."
  },
  {
    cls: "ENV_ACCESS",
    re: /(^|[\s"'`=(:\\/])\.env/,
    msg: "Shell-Zugriff auf .env*-Dateien ist blockiert (SSG-14(b)). Secrets werden nie von Agenten gelesen oder geschrieben."
  },
  // --- Bestandsklassen (Regression, aus dem Alt-Guard uebernommen) ---
  {
    cls: "DESTRUKTIV",
    re: /\brm\s+-[^\n]*r[^\n]*f\b/,
    msg: "Rekursives Loeschen (rm -rf) ist blockiert."
  },
  {
    cls: "DESTRUKTIV",
    re: /\bremove-item\b[^\n]*(?:-recurse)[^\n]*(?:-force)/,
    msg: "Remove-Item -Recurse -Force ist blockiert."
  },
  { cls: "DESTRUKTIV", re: /\brmdir\s+\/s\b/, msg: "rmdir /s ist blockiert." },
  { cls: "DESTRUKTIV", re: /\bdel\s+\/[sq]\b/, msg: "del /s|/q ist blockiert." },
  {
    cls: "DESTRUKTIV",
    re: /\bgit\s+reset\s+--hard\b/,
    msg: "git reset --hard ist blockiert."
  },
  {
    cls: "DESTRUKTIV",
    re: /\bgit\s+clean\s+-[^\n]*f/,
    msg: "git clean -f ist blockiert."
  },
  {
    cls: "DESTRUKTIV",
    re: /\bgit\s+checkout\s+--\s+/,
    msg: "git checkout -- <pfad> verwirft Aenderungen und ist blockiert."
  },
  {
    cls: "DESTRUKTIV",
    re: /\bgit\s+restore\s+(?:\.|--source|--worktree)/,
    msg: "git restore auf Arbeitsstand ist blockiert."
  },
  {
    cls: "SQL_DESTRUKTIV",
    re: /\bdrop\s+(?:table|schema|database)\b/,
    msg: "DROP TABLE/SCHEMA/DATABASE ist blockiert."
  },
  {
    cls: "SQL_DESTRUKTIV",
    re: /\btruncate\s+(?:table\s+)?\w+/,
    msg: "TRUNCATE ist blockiert."
  },
  {
    cls: "SQL_DESTRUKTIV",
    re: /\bdelete\s+from\s+\w+\s*;?\s*$/m,
    msg: "Pauschales DELETE FROM ist blockiert."
  }
];

for (const rule of SHELL_RULES) {
  if (rule.re.test(cmd)) {
    deny(
      rule.cls,
      `${rule.msg} Sichere Git/DB, benenne betroffene Daten, definiere Rollback und hole ausdrueckliche Auftraggeber-Freigabe ein.`
    );
  }
}

process.exit(0);
