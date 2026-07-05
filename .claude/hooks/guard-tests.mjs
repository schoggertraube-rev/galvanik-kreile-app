#!/usr/bin/env node

/**
 * SSG-14(d) Ablehnungstest — Ebene A (Direkttest je Kommandoklasse).
 *
 * Speist realistische Gefahrenkommandos als Hook-JSON direkt in
 * guard-destructive.mjs (die Kommandos werden NIE ausgefuehrt, nur als
 * Daten geprueft) und verifiziert je Klasse permissionDecision=deny,
 * plus Positivkontrollen (erwartet: erlaubt).
 *
 * Aufruf: node .claude/hooks/guard-tests.mjs   -> Exit 0 = alle Erwartungen erfuellt.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const GUARD = join(dirname(fileURLToPath(import.meta.url)), "guard-destructive.mjs");

// Umgebung OHNE Freigabe-Flag (deterministisch, unabhaengig vom echten Repo-Zustand)
const noFlagDir = mkdtempSync(join(tmpdir(), "kreile-guard-noflag-"));
// Umgebung MIT Freigabe-Flag (nur fuer den Allow-Pfad-Test von git commit)
const flagDir = mkdtempSync(join(tmpdir(), "kreile-guard-flag-"));
mkdirSync(join(flagDir, ".claude", "state"), { recursive: true });
writeFileSync(join(flagDir, ".claude", "state", "MISSIONSFREIGABE"), "TESTLAUF M4+M5 2026-07-05\n");

function runGuard(payload, projectDir) {
  const res = spawnSync(process.execPath, [GUARD], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir }
  });
  const out = (res.stdout || "").trim();
  if (!out) return { denied: false, cls: "", reason: "" };
  try {
    const parsed = JSON.parse(out);
    const deny = parsed?.hookSpecificOutput?.permissionDecision === "deny";
    const reason = String(parsed?.hookSpecificOutput?.permissionDecisionReason || "");
    const cls = (reason.match(/^\[GUARD-DENY:([A-Z_]+)\]/) || [])[1] || "";
    return { denied: deny, cls, reason };
  } catch {
    return { denied: false, cls: "PARSE_ERROR", reason: out.slice(0, 200) };
  }
}

const bash = (command) => ({ tool_name: "Bash", tool_input: { command } });
const pwsh = (command) => ({ tool_name: "PowerShell", tool_input: { command } });

const CASES = [
  // --- Klasse 1: git push (immer) ---
  { id: "A01", klasse: "GIT_PUSH", p: bash("git push origin main"), expect: "deny" },
  { id: "A02", klasse: "GIT_PUSH", p: pwsh("git push --force origin main"), expect: "deny" },
  { id: "A03", klasse: "GIT_PUSH", p: bash("cd sub && git push"), expect: "deny" },
  // --- Klasse 2: git commit ohne Freigabe ---
  { id: "A04", klasse: "GIT_COMMIT", p: bash('git commit -m "wip"'), expect: "deny" },
  { id: "A05", klasse: "GIT_COMMIT", p: pwsh('git commit -am "x"'), expect: "deny" },
  { id: "A06", klasse: "GIT_COMMIT_NOVERIFY", p: bash('git commit --no-verify -m "x"'), expect: "deny", dir: flagDir },
  // --- Klasse 3: git remote ---
  { id: "A07", klasse: "GIT_REMOTE", p: bash("git remote add origin https://github.com/x/y.git"), expect: "deny" },
  { id: "A08", klasse: "GIT_REMOTE", p: pwsh("git remote set-url origin https://evil.example"), expect: "deny" },
  // --- Klasse 4: db:push / drizzle-kit push ---
  { id: "A09", klasse: "DB_PUSH", p: bash("npm run db:push"), expect: "deny" },
  { id: "A10", klasse: "DB_PUSH", p: pwsh("npx drizzle-kit push"), expect: "deny" },
  // --- Klasse 5: supabase-CLI ---
  { id: "A11", klasse: "SUPABASE_CLI", p: bash("npx supabase db reset"), expect: "deny" },
  { id: "A12", klasse: "SUPABASE_CLI", p: pwsh("supabase link --project-ref abc"), expect: "deny" },
  { id: "A13", klasse: "SUPABASE_CLI", p: bash("cd x && supabase start"), expect: "deny" },
  // --- Klasse 6: vercel-CLI ---
  { id: "A14", klasse: "VERCEL_CLI", p: bash("vercel deploy --prod"), expect: "deny" },
  { id: "A15", klasse: "VERCEL_CLI", p: pwsh("npx vercel --prod"), expect: "deny" },
  // --- Klasse 7: Seeds mit Auto-Confirm ---
  { id: "A16", klasse: "SEED_AUTOCONFIRM", p: bash("npm run demo:reset -- --confirm"), expect: "deny" },
  { id: "A17", klasse: "SEED_AUTOCONFIRM", p: bash("npm run db:seed -- --yes"), expect: "deny" },
  { id: "A18", klasse: "SEED_AUTOCONFIRM", p: pwsh("npm run demo:cleanup -- --force"), expect: "deny" },
  { id: "A19", klasse: "SEED_AUTOCONFIRM", p: bash("echo y | npm run db:seed"), expect: "deny" },
  // --- Klasse 8: .env-Zugriff ---
  { id: "A20", klasse: "ENV_ACCESS", p: bash("cat .env.local"), expect: "deny" },
  { id: "A21", klasse: "ENV_ACCESS", p: pwsh("Get-Content .env"), expect: "deny" },
  { id: "A22", klasse: "ENV_ACCESS", p: bash("cp .env.local /tmp/x"), expect: "deny" },
  { id: "A23", klasse: "ENV_ACCESS", p: { tool_name: "Read", tool_input: { file_path: "C:\\repo\\.env.local" } }, expect: "deny" },
  { id: "A24", klasse: "ENV_ACCESS", p: { tool_name: "Edit", tool_input: { file_path: ".env.production", old_string: "a", new_string: "b" } }, expect: "deny" },
  { id: "A25", klasse: "ENV_ACCESS", p: { tool_name: "Write", tool_input: { file_path: "C:/repo/.env", content: "X=1" } }, expect: "deny" },
  { id: "A26", klasse: "ENV_ACCESS", p: { tool_name: "Glob", tool_input: { pattern: ".env*" } }, expect: "deny" },
  { id: "A27", klasse: "ENV_ACCESS", p: { tool_name: "Grep", tool_input: { pattern: "KEY", glob: ".env*" } }, expect: "deny" },
  // --- Klasse 9: MCP-Seitenkanaele ---
  { id: "A28", klasse: "MCP_DB", p: { tool_name: "mcp__53f3d868-21b4-47af-bf7e-526e36004e7e__execute_sql", tool_input: { query: "select 1" } }, expect: "deny" },
  { id: "A29", klasse: "MCP_DB", p: { tool_name: "mcp__53f3d868-21b4-47af-bf7e-526e36004e7e__apply_migration", tool_input: {} }, expect: "deny" },
  { id: "A30", klasse: "MCP_DEPLOY", p: { tool_name: "mcp__5a0f89bc-0951-446f-b7f2-9d1b2cfd4ac2__deploy_to_vercel", tool_input: {} }, expect: "deny" },
  // --- Klasse 10: Bestandsklassen (Regression) ---
  { id: "A31", klasse: "DESTRUKTIV", p: bash("rm -rf src"), expect: "deny" },
  { id: "A32", klasse: "DESTRUKTIV", p: bash("git reset --hard HEAD~1"), expect: "deny" },
  { id: "A33", klasse: "DESTRUKTIV", p: pwsh("Remove-Item -Recurse -Force node_modules"), expect: "deny" },
  { id: "A34", klasse: "SQL_DESTRUKTIV", p: bash('psql -c "drop table orders"'), expect: "deny" },
  // --- Fail-closed: unlesbare Payload ---
  { id: "A35", klasse: "PAYLOAD", raw: "kein json {", expect: "deny" },
  // --- Positivkontrollen (MUESSEN erlaubt sein) ---
  { id: "P01", klasse: "-", p: bash("git status --short"), expect: "allow" },
  { id: "P02", klasse: "-", p: bash("npx tsc --noEmit"), expect: "allow" },
  { id: "P03", klasse: "-", p: bash("git diff --stat"), expect: "allow" },
  { id: "P04", klasse: "-", p: bash("ls supabase/migrations"), expect: "allow" },
  { id: "P05", klasse: "-", p: bash("curl -s https://xyz.supabase.co/rest/v1/health"), expect: "allow" },
  { id: "P06", klasse: "-", p: pwsh("Get-ChildItem src"), expect: "allow" },
  { id: "P07", klasse: "-", p: { tool_name: "Read", tool_input: { file_path: "src/app/page.tsx" } }, expect: "allow" },
  { id: "P08", klasse: "-", p: { tool_name: "Grep", tool_input: { pattern: "process.env", path: "src" } }, expect: "allow" },
  { id: "P09", klasse: "-", p: bash("npm run test:unit"), expect: "allow" },
  // --- Allow-Pfad der Freigabemechanik: commit MIT Flag-Datei ---
  { id: "P10", klasse: "GIT_COMMIT+FLAG", p: bash('git commit -m "freigegebene mission"'), expect: "allow", dir: flagDir }
];

let failures = 0;
const lines = [];
for (const c of CASES) {
  const dir = c.dir || noFlagDir;
  let result;
  if (c.raw !== undefined) {
    const res = spawnSync(process.execPath, [GUARD], {
      input: c.raw,
      encoding: "utf8",
      env: { ...process.env, CLAUDE_PROJECT_DIR: dir }
    });
    const out = (res.stdout || "").trim();
    let denied = false, cls = "", reason = "";
    try {
      const parsed = JSON.parse(out);
      denied = parsed?.hookSpecificOutput?.permissionDecision === "deny";
      reason = String(parsed?.hookSpecificOutput?.permissionDecisionReason || "");
      cls = (reason.match(/^\[GUARD-DENY:([A-Z_]+)\]/) || [])[1] || "";
    } catch { /* leer = allow */ }
    result = { denied, cls, reason };
  } else {
    result = runGuard(c.p, dir);
  }
  const actual = result.denied ? "deny" : "allow";
  const ok = actual === c.expect;
  if (!ok) failures++;
  const cmdText = c.raw !== undefined
    ? "<unlesbare payload>"
    : c.p.tool_input.command || JSON.stringify(c.p.tool_input).slice(0, 80);
  lines.push(
    `${ok ? "PASS" : "FAIL"} | ${c.id} | ${c.klasse} | ${c.p ? c.p.tool_name : "Bash"} | erwartet=${c.expect} | ist=${actual}${result.cls ? " [" + result.cls + "]" : ""} | ${cmdText}`
  );
}

console.log(lines.join("\n"));
console.log(`\nSUMME: ${CASES.length} Faelle, ${CASES.length - failures} erfuellt, ${failures} verletzt.`);
console.log(failures === 0 ? "ABLEHNUNGSTEST_EBENE_A: PASS" : "ABLEHNUNGSTEST_EBENE_A: FAIL");

rmSync(noFlagDir, { recursive: true, force: true });
rmSync(flagDir, { recursive: true, force: true });

process.exit(failures === 0 ? 1 - 1 : 1);
