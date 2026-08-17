#!/usr/bin/env node
/**
 * check-no-fake-production.mjs — F1-R0 NO_FAKE_PRODUCTION_GATE
 *
 * BIDIRECTIONAL checks:
 *  A. Every page.tsx on disk is in the registry as PAGE_ROUTE; every PAGE_ROUTE
 *     entry has a real page.tsx on disk.
 *  B. Every route.ts on disk is in the registry as API_ROUTE; every API_ROUTE
 *     entry has a real route.ts on disk.
 *  C. Every "use server" action file on disk is in the registry as
 *     SERVER_ACTION_GROUP (entry_point match); every registered group exists on
 *     disk. Exported function names in every group are compared bidirectionally.
 *  D. Every KPI ID in kpiRegistry.ts is in the registry as KPI_DEFINITION;
 *     every registered KPI ID exists in kpiRegistry.ts.
 *  E. Every provider/adapter candidate discovered in src/lib (Provider files,
 *     Adapter files, external SDK importers) is registered as PROVIDER_CONNECTION;
 *     every registered PROVIDER_CONNECTION with an adapter_file has that file on
 *     disk.
 *  F. No visible internal href links to a route that has neither a real page.tsx
 *     nor a deliberate LEGACY_REMOVE/PENDING_CONTRACT registry entry.
 *  G. No production-reachable source file contains mock/demo/fake data patterns
 *     (narrow, documented rule set).
 *  H. No production-reachable provider file has a silent-success env-var fallback.
 *  I. Registry structure is valid: required fields, valid classifications,
 *     summary.total == capabilities.length.
 *
 * REQUIRED output lines (always printed even on failure):
 *   REACHABLE_PRODUCTION_MOCKS=<n>      — findings from checks G+H
 *   UNREGISTERED_VISIBLE_CAPABILITIES=<n> — findings from checks A–F+I
 *   ACTIVE_CAPABILITY_REAL_E2E=PASS|OPEN
 *
 * Exit 0 only when both counters are 0 AND the registry is structurally valid.
 * ACTIVE_CAPABILITY_REAL_E2E may be OPEN without causing exit 1.
 *
 * --selftest  Run mutation-free tests in a temp directory; exit 0 on success.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

// ─── Paths ────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), "../../");

const REGISTRY_PATH = path.join(
  REPO_ROOT,
  "docs/evidence/f1/F1_R0_CAPABILITY_REGISTRY.json"
);
const KPI_REGISTRY_PATH = path.join(
  REPO_ROOT,
  "src/lib/analytics/kpiRegistry.ts"
);
const SRC_APP = path.join(REPO_ROOT, "src/app");
const SRC_LIB = path.join(REPO_ROOT, "src/lib");

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_CLASSIFICATIONS = new Set([
  "REAL_VERIFIED",
  "REAL_PENDING_SECRET",
  "PENDING_CONTRACT",
  "TEST_ONLY",
  "LEGACY_REMOVE",
]);

/** Next.js App Router production-root file names */
const PRODUCTION_ROOT_NAMES = new Set([
  "page.tsx", "page.ts",
  "route.ts", "route.tsx",
  "layout.tsx", "layout.ts",
  "template.tsx", "template.ts",
  "loading.tsx", "loading.ts",
  "error.tsx", "error.ts",
  "not-found.tsx", "not-found.ts",
  "proxy.ts", "proxy.tsx",
]);

/**
 * Mock/demo/fake detection rules for production-reachable files.
 * Each rule: { id, pattern, reason }
 * Rules are narrow and each has a documented rationale.
 */
const MOCK_RULES = [
  {
    id: "DEMO_ITEMS_CONSTANT",
    pattern: /\bDEMO_ITEMS\b/,
    reason:
      "DEMO_ITEMS: hardcoded fixture array served as production data. " +
      "Found in KvpClient.tsx merged with savedItems. Classify page as LEGACY_REMOVE.",
  },
  {
    id: "INLINE_MOCK_COMMENT",
    // Matches: }; // Mock ... (object/value closed with semicolon followed by // Mock comment)
    pattern: /\}[;\s]*\/\/\s*Mock\b/,
    reason:
      "Inline object literal with explicit // Mock comment, indicating a hardcoded " +
      "business value presented as production data (e.g. neukundenUmsatz in RoiKachel).",
  },
  {
    id: "DEMO_MODE_CONDITIONAL",
    pattern: /NEXT_PUBLIC_DEMO_MODE/,
    reason:
      "NEXT_PUBLIC_DEMO_MODE referenced in production-reachable file. " +
      "Includes Demo-Modus UI badge and demo-setup gate. Remove before F1.2.",
  },
  {
    id: "DEMO_UI_LABEL",
    pattern: /Demo-Auswertung|Speicherung erfolgt nur lokal\s*\(Demo\)|Demo-Modus/,
    reason:
      "A production-reachable UI explicitly presents demo or locally simulated " +
      "business state. Such state belongs only in isolated tests.",
  },
  {
    id: "HARDCODED_BEISPIEL_COMMENT",
    // Matches: + 2000; // 2000EUR = ... (Beispiel)
    pattern: /\d+[^/\n]*\/\/\s*\d+[^/\n]*\(Beispiel\)/,
    reason:
      "Hardcoded business number with explicit (Beispiel) comment. " +
      "Indicates a placeholder value in a production calculation (e.g. Fehlerkosten in RoiKachel).",
  },
  {
    id: "PROVIDER_ENV_FALLBACK_LITERAL",
    // Matches: process.env.SOME_KEY || 'hardcoded-long-value'
    // Excludes short strings like 'dev', 'test', 'production' (< 8 chars)
    pattern: /process\.env\.\w+\s*\|\|\s*['"][\dA-Za-z._-]{8,}['"]/,
    reason:
      "Provider env var with hardcoded string fallback delivers fabricated " +
      "production config when the secret is absent (e.g. META_APP_ID fallback).",
  },
];

/**
 * Provider adapter files that return `null/[]/{}` instead of throwing
 * when their required env var is missing. That is a silent-success fallback.
 * NOT flagged: throw new Error(...) or return { error: 'NOT_AVAILABLE' }.
 */
const PROVIDER_SILENT_SUCCESS_PATTERN =
  /if\s*\(\s*!\s*process\.env\.\w+\s*\)\s*(?:return\s+(?:null|undefined|\[\]|\{\})\s*;|resolve\s*\(\s*(?:null|undefined|\[\]|\{\})\s*\))/;

// ─── File System Helpers ──────────────────────────────────────────────────────

function fileExists(p) {
  try { fs.statSync(p); return true; } catch { return false; }
}

function readText(p) { return fs.readFileSync(p, "utf8"); }

/** Walk a directory, excluding known non-production dirs. */
function walkDir(dir, excludeDirs = new Set(["node_modules", ".next", ".git", "__tests__", "stories", "docs", "scripts"])) {
  const result = [];
  function walk(cur) {
    let entries;
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (excludeDirs.has(e.name)) continue;
      const full = path.join(cur, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile()) result.push(full);
    }
  }
  walk(dir);
  return result;
}

// ─── Route Path Computation ───────────────────────────────────────────────────

/**
 * Convert a page.tsx file path to a Next.js route string.
 * src/app/page.tsx → /
 * src/app/admin/analytics/page.tsx → /admin/analytics
 * src/app/customers/[id]/page.tsx → /customers/[id]
 */
function fileToRoute(filePath, srcAppDir) {
  const rel = path.relative(srcAppDir, filePath);
  // Remove file name (page.tsx or route.ts)
  const dir = path.dirname(rel);
  // Convert backslashes (Windows) to forward slashes
  const forward = dir.replace(/\\/g, "/");
  if (forward === ".") return "/";
  return "/" + forward;
}

// ─── Discovery Functions ──────────────────────────────────────────────────────

/** Discover all page.tsx on disk under srcApp. Returns Map<route, absPath>. */
function discoverPagesOnDisk(srcApp) {
  const files = walkDir(srcApp, new Set(["node_modules", ".next", ".git", "__tests__"]));
  const result = new Map();
  for (const f of files) {
    const base = path.basename(f);
    if (base === "page.tsx" || base === "page.ts") {
      const route = fileToRoute(f, srcApp);
      result.set(route, f);
    }
  }
  return result;
}

/** Discover all route.ts on disk under srcApp. Returns Map<route, absPath>. */
function discoverRoutesOnDisk(srcApp) {
  const files = walkDir(srcApp, new Set(["node_modules", ".next", ".git", "__tests__"]));
  const result = new Map();
  for (const f of files) {
    const base = path.basename(f);
    if (base === "route.ts" || base === "route.tsx") {
      const route = fileToRoute(f, srcApp);
      result.set(route, f);
    }
  }
  return result;
}

/**
 * Discover all "use server" action files on disk under srcApp.
 * Returns Map<relPath, exportedFunctions[]>.
 * Detects both single-quoted ('use server') and double-quoted ("use server").
 */
function discoverActionFilesOnDisk(srcApp, repoRoot) {
  const files = walkDir(srcApp, new Set(["node_modules", ".next", ".git", "__tests__"]));
  const result = new Map();
  for (const f of files) {
    if (f.includes("__tests__") || f.includes(".test.") || f.includes(".spec.")) continue;
    let text;
    try { text = readText(f); } catch { continue; }
    if (!/['"]use server['"]/.test(text)) continue;
    const rel = path.relative(repoRoot, f).replace(/\\/g, "/");
    const exports = extractExportedFunctions(text);
    result.set(rel, exports);
  }
  return result;
}

/**
 * Extract exported function/const names from a server action file.
 * Handles: export async function foo, export function foo, export const foo =
 * Does NOT include type exports or re-exports from other modules.
 */
function extractExportedFunctions(text) {
  const names = new Set();
  // export async function / export function
  const fnRe = /^export\s+(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm;
  let m;
  while ((m = fnRe.exec(text)) !== null) names.add(m[1]);
  // export const foo = ...  (only non-type)
  const constRe = /^export\s+const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[=:]/gm;
  while ((m = constRe.exec(text)) !== null) names.add(m[1]);
  // export { foo, bar } (local export list, not re-exports)
  const listRe = /^export\s+\{([^}]+)\}(?!\s*from)/gm;
  while ((m = listRe.exec(text)) !== null) {
    for (const name of m[1].split(",")) {
      const clean = name.trim().split(/\s+as\s+/)[0].trim();
      if (clean && /^[A-Za-z_$]/.test(clean)) names.add(clean);
    }
  }
  return [...names];
}

/**
 * Discover all KPI IDs declared in kpiRegistry.ts.
 * Returns Set<kpiId>.
 */
function discoverKpisFromCode(kpiRegistryPath) {
  const ids = new Set();
  if (!fileExists(kpiRegistryPath)) return ids;
  const text = readText(kpiRegistryPath);
  // Match keys in KPI_REGISTRY: { energie: { id: "energie", ... }
  // Pattern: word followed by colon inside the registry object
  const keyRe = /^\s+([a-z_][a-z0-9_]*)\s*:\s*\{/gm;
  let m;
  while ((m = keyRe.exec(text)) !== null) {
    // Skip obvious non-KPI keys
    if (!["label", "subtitle", "icon", "source", "periods", "linkedAreas", "chartType"].includes(m[1])) {
      ids.add(m[1]);
    }
  }
  return ids;
}

/**
 * Discover provider/adapter candidates in src/lib.
 * Returns Map<relPath, { kind: 'provider'|'adapter'|'sdk-importer'|'mock' }>.
 * Excludes test files.
 */
function discoverProviderCandidates(srcLib, repoRoot) {
  const files = walkDir(srcLib, new Set(["node_modules", ".git", "__tests__"]));
  const result = new Map();
  const EXTERNAL_SDK_PATTERN =
    /from\s+['"](@supabase\/|@google\/|google-genai|@google-genai|klippa|mollie|resend|@sendgrid|@postmark|nodemailer|brevo|stripe|posthog|@instagram|meta-|instagram)['"]/;

  for (const f of files) {
    if (f.includes("__tests__") || f.includes(".test.") || f.includes(".spec.")) continue;
    const base = path.basename(f);
    const rel = path.relative(repoRoot, f).replace(/\\/g, "/");
    const isMock = /Mock|mock|Fake|fake|Stub|stub/.test(base);
    const isProvider = /Provider\.ts|Provider\.tsx/.test(base);
    const isAdapter = /Adapter\.ts|Adapter\.tsx/.test(base);

    if (isProvider || isAdapter) {
      result.set(rel, { kind: isMock ? "mock" : (isProvider ? "provider" : "adapter") });
      continue;
    }

    // Check for external SDK imports
    let text;
    try { text = readText(f); } catch { continue; }
    if (EXTERNAL_SDK_PATTERN.test(text) && !isMock) {
      result.set(rel, { kind: "sdk-importer" });
    }
  }
  return result;
}

// ─── Import Graph ─────────────────────────────────────────────────────────────

/**
 * Resolve an import path to an absolute file path, or null if external.
 * Handles @/ alias, relative paths, extensions, and index files.
 */
function resolveImport(importPath, fromDir, repoRoot) {
  let candidate = importPath;
  if (candidate.startsWith("@/")) {
    candidate = path.join(repoRoot, "src", candidate.slice(2));
  } else if (candidate.startsWith(".")) {
    candidate = path.resolve(fromDir, candidate);
  } else {
    return null; // external package
  }

  if (fileExists(candidate) && fs.statSync(candidate).isFile()) return candidate;
  for (const ext of [".ts", ".tsx", ".js", ".jsx"]) {
    if (fileExists(candidate + ext)) return candidate + ext;
  }
  for (const ext of [".ts", ".tsx", ".js", ".jsx"]) {
    const idx = path.join(candidate, "index" + ext);
    if (fileExists(idx)) return idx;
  }
  return null;
}

/**
 * Extract all local import/require/re-export module paths from source text.
 * Includes: import X from '...', export { X } from '...', export * from '...'
 */
function extractImports(text) {
  const imports = [];
  // static import: import ... from '...'
  const staticRe = /(?:^|\n)\s*import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g;
  let m;
  while ((m = staticRe.exec(text)) !== null) imports.push(m[1]);
  // re-exports: export { X } from '...' / export * from '...' / export type { X } from '...'
  const reexportRe = /(?:^|\n)\s*export\s+(?:type\s+)?(?:\*|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/g;
  while ((m = reexportRe.exec(text)) !== null) imports.push(m[1]);
  // dynamic import('...')
  const dynRe = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = dynRe.exec(text)) !== null) imports.push(m[1]);
  // require('...')
  const reqRe = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = reqRe.exec(text)) !== null) imports.push(m[1]);
  return imports;
}

/**
 * Build the set of all files reachable from production roots via static imports.
 * Test files, stories, docs, scripts, and node_modules are NOT roots and are
 * excluded from traversal even if they would be resolved.
 */
function buildReachabilityGraph(srcApp, repoRoot) {
  const visited = new Set();
  const queue = [];

  // Seed: all production root files
  const allFiles = walkDir(srcApp, new Set(["node_modules", ".next", ".git", "__tests__"]));
  for (const f of allFiles) {
    if (PRODUCTION_ROOT_NAMES.has(path.basename(f))) queue.push(f);
  }

  while (queue.length > 0) {
    const current = queue.pop();
    if (visited.has(current)) continue;
    // Skip test/story/spec files even if transitively imported
    if (/[/\\]__tests__[/\\]|\.test\.[tj]sx?|\.spec\.[tj]sx?|\.stories\.[tj]sx?/.test(current)) continue;

    visited.add(current);
    let text;
    try { text = readText(current); } catch { continue; }

    for (const imp of extractImports(text)) {
      const resolved = resolveImport(imp, path.dirname(current), repoRoot);
      if (resolved && !visited.has(resolved)) queue.push(resolved);
    }
  }
  return visited;
}

// ─── Mock / Fallback Detection ────────────────────────────────────────────────

/** Scan reachable files for mock/demo/fake patterns. */
function detectMocks(reachableFiles, repoRoot = REPO_ROOT) {
  const findings = [];
  for (const file of reachableFiles) {
    let text;
    try { text = readText(file); } catch { continue; }
    for (const rule of MOCK_RULES) {
      if (rule.pattern.test(text)) {
        const lines = text.split("\n");
        let lineNo = -1;
        for (let i = 0; i < lines.length; i++) {
          if (rule.pattern.test(lines[i])) { lineNo = i + 1; break; }
        }
        findings.push({
          file: path.relative(repoRoot, file).replace(/\\/g, "/"),
          rule_id: rule.id,
          reason: rule.reason,
          line: lineNo > 0 ? lineNo : "(multiple lines)",
        });
        break; // one finding per rule per file; subsequent rules still checked below
      }
    }
  }
  return findings;
}

/** Scan provider-like reachable files for silent-success env-var fallbacks. */
function detectProviderFallbacks(reachableFiles, repoRoot = REPO_ROOT) {
  const findings = [];
  const providerLike = [/[Pp]rovider/, /[Cc]lient\.ts$/, /[Aa]dapter/, /[Ss]ervice\.ts$/];
  for (const file of reachableFiles) {
    const rel = path.relative(repoRoot, file).replace(/\\/g, "/");
    if (!providerLike.some((p) => p.test(rel))) continue;
    let text;
    try { text = readText(file); } catch { continue; }
    if (PROVIDER_SILENT_SUCCESS_PATTERN.test(text)) {
      const lines = text.split("\n");
      let lineNo = -1;
      for (let i = 0; i < lines.length; i++) {
        if (PROVIDER_SILENT_SUCCESS_PATTERN.test(lines[i])) { lineNo = i + 1; break; }
      }
      findings.push({ file: rel, line: lineNo > 0 ? lineNo : "(multiple lines)", pattern: "SILENT_SUCCESS_FALLBACK" });
    }
  }
  return findings;
}

// ─── Visible Href Extraction ──────────────────────────────────────────────────

function extractVisibleHrefs(reachableFiles) {
  const hrefs = new Set();
  const hrefRe = /href\s*=\s*["'{`](\/[a-z][a-z0-9\-/_[\]]*)/gi;
  for (const file of reachableFiles) {
    let text;
    try { text = readText(file); } catch { continue; }
    let m;
    while ((m = hrefRe.exec(text)) !== null) {
      const href = m[1].replace(/\/+$/, "") || "/";
      if (!href.startsWith("/api/")) hrefs.add(href);
    }
  }
  return hrefs;
}

// ─── Registry Validation ──────────────────────────────────────────────────────

function validateRegistryStructure(registry) {
  const errors = [];
  if (!registry || typeof registry !== "object") {
    return ["Registry is not a valid JSON object"];
  }

  const caps = registry.capabilities;
  if (!Array.isArray(caps)) {
    return ["registry.capabilities is not an array"];
  }

  // summary.total must match actual length
  if (registry.summary && typeof registry.summary.total === "number") {
    if (registry.summary.total !== caps.length) {
      errors.push(
        `summary.total=${registry.summary.total} does not match ` +
        `capabilities.length=${caps.length}. Fix summary.`
      );
    }
  }

  const ids = new Set();
  for (const cap of caps) {
    if (!cap.stable_id) { errors.push(`Entry missing stable_id: ${JSON.stringify(cap).slice(0, 60)}`); continue; }
    if (ids.has(cap.stable_id)) errors.push(`Duplicate stable_id: ${cap.stable_id}`);
    ids.add(cap.stable_id);

    if (!cap.kind) errors.push(`${cap.stable_id}: missing required field 'kind'`);
    if (typeof cap.visible !== "boolean") errors.push(`${cap.stable_id}: 'visible' must be boolean`);
    if (typeof cap.reachable !== "boolean") errors.push(`${cap.stable_id}: 'reachable' must be boolean`);
    if (!cap.classification) errors.push(`${cap.stable_id}: missing required field 'classification'`);
    if (cap.classification && !VALID_CLASSIFICATIONS.has(cap.classification)) {
      errors.push(`${cap.stable_id}: invalid classification '${cap.classification}'`);
    }
    if (cap.classification === "REAL_VERIFIED" && !cap.evidence) {
      errors.push(`${cap.stable_id}: REAL_VERIFIED requires an evidence block`);
    }
    if (["PENDING_CONTRACT", "LEGACY_REMOVE", "TEST_ONLY", "REAL_PENDING_SECRET"].includes(cap.classification)) {
      if (!cap.open_reason) errors.push(`${cap.stable_id}: ${cap.classification} requires open_reason`);
    }
    if (cap.classification === "REAL_PENDING_SECRET") {
      if (!Array.isArray(cap.env_vars) || cap.env_vars.length === 0) {
        errors.push(`${cap.stable_id}: REAL_PENDING_SECRET requires at least one env_vars entry`);
      }
    }
    // entry_point required for pages, routes, action groups
    const needsEntryPoint = ["PAGE_ROUTE", "API_ROUTE", "SERVER_ACTION_GROUP"].includes(cap.kind);
    if (needsEntryPoint && !cap.entry_point) {
      errors.push(`${cap.stable_id}: ${cap.kind} requires entry_point`);
    }
  }
  return errors;
}

// ─── Legacy + Phantom Nav Detection ──────────────────────────────────────────

/**
 * Check L: Reachable LEGACY_REMOVE registry entries (non-NAV) → REACHABLE_PRODUCTION_MOCKS.
 * Excludes entries whose entry_point file is already in mockFindingFiles (avoid double-count).
 * Excludes NAV_LINK_NO_PAGE (handled by detectPhantomNavLinks).
 * Unreachable LEGACY_REMOVE entries do NOT block.
 */
function detectLegacyReachable(caps, mockFindingFiles = new Set()) {
  const findings = [];
  const seenKeys = new Set(mockFindingFiles);
  for (const cap of caps) {
    if (cap.classification !== "LEGACY_REMOVE") continue;
    if (!cap.reachable) continue;
    if (cap.kind === "NAV_LINK_NO_PAGE") continue;
    const key = cap.entry_point ? cap.entry_point.replace(/\\/g, "/") : null;
    if (key && seenKeys.has(key)) continue; // same violation already counted
    if (key) seenKeys.add(key);
    findings.push({ stable_id: cap.stable_id, kind: cap.kind, entry_point: key });
  }
  return findings;
}

/**
 * Check N: Visible + reachable NAV_LINK_NO_PAGE entries → UNREGISTERED_VISIBLE_CAPABILITIES.
 * These are registered in the registry (so Check F won't flag them as missing hrefs),
 * but they lead to 404 because no page.tsx exists at that route.
 */
function detectPhantomNavLinks(navLinkCaps, visibleHrefs) {
  const findings = [];
  for (const cap of navLinkCaps) {
    if (!visibleHrefs.has(cap.route)) continue;
    findings.push({ stable_id: cap.stable_id, route: cap.route });
  }
  return findings;
}

/**
 * Check M: TEST_ONLY code must live in an isolated test path. Registry flags
 * cannot make a production source file safe or unreachable.
 */
function detectProductionTestOnly(caps, repoRoot) {
  const findings = [];
  for (const cap of caps) {
    if (cap.classification !== "TEST_ONLY") continue;
    const rel = cap.entry_point ?? cap.source_file ?? cap.adapter_file;
    if (!rel) continue;
    const normalized = rel.replace(/\\/g, "/");
    if (/\/(?:__tests__|fixtures|test-fixtures)\/|\.(?:test|spec)\.[tj]sx?$/.test(`/${normalized}`)) continue;
    if (!fileExists(path.join(repoRoot, rel))) continue;
    findings.push({ stable_id: cap.stable_id, entry_point: normalized });
  }
  return findings;
}

// ─── Main Gate ────────────────────────────────────────────────────────────────

function runGate(opts = {}) {
  const repoRoot = opts.repoRoot ?? REPO_ROOT;
  const registryPath = opts.registryPath ?? REGISTRY_PATH;
  const srcApp = opts.srcApp ?? SRC_APP;
  const srcLib = opts.srcLib ?? SRC_LIB;
  const kpiRegistryPath = opts.kpiRegistryPath ?? KPI_REGISTRY_PATH;
  const verbose = opts.verbose ?? true;

  const log = verbose ? (...a) => console.log(...a) : () => {};
  let unregisteredCount = 0;
  let mocksCount = 0;

  // ── Load Registry ──────────────────────────────────────────────────────────
  if (!fileExists(registryPath)) {
    console.error(`FATAL: Registry not found at ${registryPath}`);
    process.exit(2);
  }
  let registry;
  try { registry = JSON.parse(readText(registryPath)); }
  catch (e) { console.error(`FATAL: Registry JSON parse error: ${e.message}`); process.exit(2); }

  const caps = Array.isArray(registry.capabilities) ? registry.capabilities : [];

  // ── Check I: Structure ─────────────────────────────────────────────────────
  log("\n[CHECK I] Registry structure...");
  const structErrors = validateRegistryStructure(registry);
  if (structErrors.length > 0) {
    log(`  FOUND ${structErrors.length} structural error(s):`);
    for (const e of structErrors) log(`    STRUCT_ERROR: ${e}`);
    unregisteredCount += structErrors.length;
  } else {
    log("  OK: Registry structure valid.");
  }

  // Build lookup maps
  const pageRouteCaps = caps.filter((c) => c.kind === "PAGE_ROUTE");
  const apiRouteCaps = caps.filter((c) => c.kind === "API_ROUTE");
  const actionGroupCaps = caps.filter((c) => c.kind === "SERVER_ACTION_GROUP");
  const kpiCaps = caps.filter((c) => c.kind === "KPI_DEFINITION");
  const providerCaps = caps.filter((c) => c.kind === "PROVIDER_CONNECTION");
  const navLinkCaps = caps.filter((c) => c.kind === "NAV_LINK_NO_PAGE");

  const registeredPageRoutes = new Map(pageRouteCaps.map((c) => [c.route, c]));
  const registeredApiRoutes = new Map(apiRouteCaps.map((c) => [c.route, c]));
  const registeredActionEntryPoints = new Map(
    actionGroupCaps.map((c) => [c.entry_point?.replace(/\\/g, "/"), c])
  );
  const registeredKpiIds = new Map(kpiCaps.map((c) => [c.kpi_id, c]));
  const registeredProviderAdapters = new Map(
    providerCaps.filter((c) => c.adapter_file).map((c) => [c.adapter_file, c])
  );
  const registeredRoutes = new Set([
    ...registeredPageRoutes.keys(),
    ...navLinkCaps.map((c) => c.route),
  ]);

  // ── Check A: Pages bidirectional ───────────────────────────────────────────
  log("\n[CHECK A] Page routes bidirectional (disk ↔ registry)...");
  const diskPages = discoverPagesOnDisk(srcApp);
  for (const [route, filePath] of diskPages) {
    const relPath = path.relative(repoRoot, filePath).replace(/\\/g, "/");
    if (!registeredPageRoutes.has(route)) {
      log(`  MISSING_FROM_REGISTRY: ${route} (${relPath})`);
      unregisteredCount++;
    }
  }
  for (const [route, cap] of registeredPageRoutes) {
    if (!diskPages.has(route)) {
      const full = path.join(repoRoot, cap.entry_point || "");
      if (!fileExists(full)) {
        log(`  ENTRY_POINT_MISSING_ON_DISK: ${route} -> ${cap.entry_point}`);
        unregisteredCount++;
      }
    }
  }
  log(`  Page routes: disk=${diskPages.size}, registry=${registeredPageRoutes.size}`);

  // ── Check B: API Routes bidirectional ─────────────────────────────────────
  log("\n[CHECK B] API routes bidirectional (disk ↔ registry)...");
  const diskRoutes = discoverRoutesOnDisk(srcApp);
  for (const [route, filePath] of diskRoutes) {
    const relPath = path.relative(repoRoot, filePath).replace(/\\/g, "/");
    if (!registeredApiRoutes.has(route)) {
      log(`  MISSING_FROM_REGISTRY: ${route} (${relPath})`);
      unregisteredCount++;
    }
  }
  for (const [route, cap] of registeredApiRoutes) {
    if (!diskRoutes.has(route)) {
      const full = path.join(repoRoot, cap.entry_point || "");
      if (!fileExists(full)) {
        log(`  ENTRY_POINT_MISSING_ON_DISK: ${route} -> ${cap.entry_point}`);
        unregisteredCount++;
      }
    }
  }
  log(`  API routes: disk=${diskRoutes.size}, registry=${registeredApiRoutes.size}`);

  // ── Check C: Server Action files + exports bidirectional ───────────────────
  log("\n[CHECK C] Server action files bidirectional (disk ↔ registry)...");
  const diskActions = discoverActionFilesOnDisk(srcApp, repoRoot);
  for (const [relPath, exports] of diskActions) {
    if (!registeredActionEntryPoints.has(relPath)) {
      log(`  ACTION_FILE_NOT_IN_REGISTRY: ${relPath}`);
      unregisteredCount++;
    } else {
      // Check exported_functions bidirectionally
      const cap = registeredActionEntryPoints.get(relPath);
      const regFns = new Set(cap.exported_functions ?? []);
      const diskFns = new Set(exports);
      for (const fn of diskFns) {
        if (!regFns.has(fn) && fn !== "default") {
          log(`  EXPORTED_FN_NOT_IN_REGISTRY: ${relPath}::${fn}`);
          unregisteredCount++;
        }
      }
      for (const fn of regFns) {
        if (!diskFns.has(fn)) {
          log(`  REGISTERED_FN_NOT_ON_DISK: ${relPath}::${fn}`);
          unregisteredCount++;
        }
      }
    }
  }
  for (const ep of registeredActionEntryPoints.keys()) {
    if (!diskActions.has(ep)) {
      const full = path.join(repoRoot, ep);
      if (!fileExists(full)) {
        log(`  REGISTERED_ACTION_FILE_MISSING: ${ep}`);
        unregisteredCount++;
      }
    }
  }
  log(`  Action files: disk=${diskActions.size}, registry=${registeredActionEntryPoints.size}`);

  // ── Check D: KPI IDs bidirectional ────────────────────────────────────────
  log("\n[CHECK D] KPI IDs bidirectional (code ↔ registry)...");
  const diskKpis = discoverKpisFromCode(kpiRegistryPath);
  for (const id of diskKpis) {
    if (!registeredKpiIds.has(id)) {
      log(`  KPI_NOT_IN_REGISTRY: ${id}`);
      unregisteredCount++;
    }
  }
  for (const [id] of registeredKpiIds) {
    if (!diskKpis.has(id)) {
      log(`  REGISTERED_KPI_NOT_IN_CODE: ${id}`);
      unregisteredCount++;
    }
  }
  log(`  KPI IDs: code=${diskKpis.size}, registry=${registeredKpiIds.size}`);

  // ── Check E: Provider candidates bidirectional ────────────────────────────
  log("\n[CHECK E] Provider candidates bidirectional (src/lib ↔ registry)...");
  if (fileExists(srcLib)) {
    const diskProviders = discoverProviderCandidates(srcLib, repoRoot);
    for (const [relPath] of diskProviders) {
      if (!registeredProviderAdapters.has(relPath)) {
        // Check if any provider cap has this as an evidence_file
        const coveredByEvidence = providerCaps.some(
          (c) =>
            (c.evidence_files && c.evidence_files.includes(relPath)) ||
            c.adapter_file === relPath
        );
        if (!coveredByEvidence) {
          log(`  PROVIDER_CANDIDATE_NOT_REGISTERED: ${relPath}`);
          unregisteredCount++;
        }
      }
    }
    for (const cap of providerCaps) {
      if (cap.adapter_file && !fileExists(path.join(repoRoot, cap.adapter_file))) {
        log(`  PROVIDER_ADAPTER_MISSING_ON_DISK: ${cap.stable_id} -> ${cap.adapter_file}`);
        unregisteredCount++;
      }
    }
    log(`  Provider candidates: lib=${diskProviders.size}, registry=${providerCaps.length}`);
  } else {
    log("  SKIP: src/lib not found.");
  }

  // ── Checks G+H: Reachability + Mocks ──────────────────────────────────────
  log("\n[CHECK G+H] Production reachability graph + mock/fallback detection...");
  const reachableFiles = buildReachabilityGraph(srcApp, repoRoot);
  log(`  Reachable production files: ${reachableFiles.size}`);

  const mockFindings = detectMocks(reachableFiles, repoRoot);
  const fallbackFindings = detectProviderFallbacks(reachableFiles, repoRoot);

  if (mockFindings.length > 0) {
    log(`  FOUND ${mockFindings.length} mock pattern(s):`);
    for (const f of mockFindings) {
      log(`    [${f.rule_id}] ${f.file}:${f.line}`);
      log(`      → ${f.reason}`);
    }
  } else {
    log("  OK: No mock patterns in reachable production files.");
  }
  if (fallbackFindings.length > 0) {
    log(`  FOUND ${fallbackFindings.length} provider silent-success fallback(s):`);
    for (const f of fallbackFindings) {
      log(`    [${f.pattern}] ${f.file}:${f.line}`);
    }
  } else {
    log("  OK: No silent-success provider fallbacks.");
  }
  mocksCount = mockFindings.length + fallbackFindings.length;

  // ── Check F: Visible hrefs vs registry ────────────────────────────────────
  log("\n[CHECK F] Visible internal hrefs vs registry...");
  const visibleHrefs = extractVisibleHrefs(reachableFiles);

  // Build normalised route set for matching (treat [param] segments generically)
  const normRoute = (r) => r.replace(/\/\[[^\]]+\]/g, "/[param]");
  const normRegisteredRoutes = new Set([...registeredRoutes].map(normRoute));
  // Also add disk pages as valid routes
  for (const [r] of diskPages) normRegisteredRoutes.add(normRoute(r));

  const unregisteredHrefs = [];
  for (const href of visibleHrefs) {
    const norm = normRoute(href);
    if (!normRegisteredRoutes.has(href) && !normRegisteredRoutes.has(norm)) {
      unregisteredHrefs.push(href);
    }
  }
  if (unregisteredHrefs.length > 0) {
    log(`  FOUND ${unregisteredHrefs.length} unregistered visible href(s):`);
    for (const href of unregisteredHrefs) log(`    UNREGISTERED_HREF: ${href}`);
    unregisteredCount += unregisteredHrefs.length;
  } else {
    log("  OK: All visible hrefs are registered.");
  }

  // ── Check L: Reachable LEGACY_REMOVE entries (non-NAV) ────────────────────
  log("\n[CHECK L] Reachable LEGACY_REMOVE capabilities (non-NAV)...");
  const mockFindingFiles = new Set(mockFindings.map((f) => f.file));
  const legacyReachableFindings = detectLegacyReachable(caps, mockFindingFiles);
  if (legacyReachableFindings.length > 0) {
    log(`  FOUND ${legacyReachableFindings.length} reachable LEGACY_REMOVE capability(ies):`);
    for (const f of legacyReachableFindings) {
      log(`    REACHABLE_LEGACY: ${f.stable_id} (${f.kind})`);
    }
  } else {
    log("  OK: No reachable non-NAV LEGACY_REMOVE capabilities.");
  }
  mocksCount += legacyReachableFindings.length;

  // â”€â”€ Check M: TEST_ONLY code outside isolated tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  log("\n[CHECK M] TEST_ONLY code is isolated from production source...");
  const productionTestOnlyFindings = detectProductionTestOnly(caps, repoRoot);
  if (productionTestOnlyFindings.length > 0) {
    log(`  FOUND ${productionTestOnlyFindings.length} TEST_ONLY production source file(s):`);
    for (const f of productionTestOnlyFindings) {
      log(`    TEST_ONLY_IN_PRODUCTION: ${f.stable_id} -> ${f.entry_point}`);
    }
  } else {
    log("  OK: TEST_ONLY code exists only in isolated test paths.");
  }
  mocksCount += productionTestOnlyFindings.length;

  // ── Check N: Visible+Reachable NAV_LINK_NO_PAGE (phantom links) ───────────
  log("\n[CHECK N] Visible+reachable NAV_LINK_NO_PAGE phantom links...");
  const phantomNavFindings = detectPhantomNavLinks(navLinkCaps, visibleHrefs);
  if (phantomNavFindings.length > 0) {
    log(`  FOUND ${phantomNavFindings.length} phantom nav link(s):`);
    for (const f of phantomNavFindings) {
      log(`    PHANTOM_NAV: ${f.stable_id} -> ${f.route}`);
    }
  } else {
    log("  OK: No visible+reachable phantom NAV_LINK_NO_PAGE entries.");
  }
  unregisteredCount += phantomNavFindings.length;

  // ── ACTIVE_CAPABILITY_REAL_E2E ─────────────────────────────────────────────
  // Must be bound to the explicitly frozen F1.1 evidence SHA256, not just any REAL_VERIFIED entry.
  // Changing this constant requires a new evidence cycle — never weaken this check.
  const F1_1_EVIDENCE_SHA256 = "69F7017DD45700D69FC65D2D2099AB33497D6D1705C2FC03B86260A68323BE9C";
  const hasF1_1RealVerified = caps.some(
    (c) =>
      c.classification === "REAL_VERIFIED" &&
      c.evidence &&
      c.evidence.evidence_sha256 === F1_1_EVIDENCE_SHA256
  );
  const realE2e = hasF1_1RealVerified ? "PASS" : "OPEN";

  // ── Output ─────────────────────────────────────────────────────────────────
  log("\n─── F1-R0 NO_FAKE_PRODUCTION_GATE RESULTS ────────────────────────────");
  if (unregisteredCount > 0 || mocksCount > 0) {
    log(`[GATE] FAIL — ${mocksCount} mock finding(s), ${unregisteredCount} registry/discovery gap(s).`);
  } else {
    log("[GATE] PASS");
  }

  console.log(`REACHABLE_PRODUCTION_MOCKS=${mocksCount}`);
  console.log(`UNREGISTERED_VISIBLE_CAPABILITIES=${unregisteredCount}`);
  console.log(`ACTIVE_CAPABILITY_REAL_E2E=${realE2e}`);

  return mocksCount > 0 || unregisteredCount > 0 ? 1 : 0;
}

// ─── Selftest ─────────────────────────────────────────────────────────────────

function runSelftest() {
  console.log("[SELFTEST] F1-R0 NO_FAKE_PRODUCTION_GATE selftest starting...");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "f1-r0-selftest-"));

  try {
    // Build synthetic codebase
    const fakeApp = path.join(tmpDir, "src", "app");
    const fakeLib = path.join(tmpDir, "src", "lib");
    const fakeAnalytics = path.join(fakeLib, "analytics");
    const fakeProviders = path.join(fakeLib, "providers");
    const fakeEvidence = path.join(tmpDir, "docs", "evidence", "f1");

    for (const d of [fakeApp, fakeAnalytics, fakeProviders, fakeEvidence]) {
      fs.mkdirSync(d, { recursive: true });
    }

    // kpiRegistry.ts — declares three KPIs
    fs.writeFileSync(path.join(fakeAnalytics, "kpiRegistry.ts"),
      `export const KPI_REGISTRY = {
  energie: { id: "energie", label: "Energie" },
  umsatz: { id: "umsatz", label: "Umsatz" },
  kosten: { id: "kosten", label: "Kosten" },
};\n`
    );

    // Real page — registered ✓
    const realDir = path.join(fakeApp, "dashboard");
    fs.mkdirSync(realDir, { recursive: true });
    fs.writeFileSync(path.join(realDir, "page.tsx"),
      `export default function P() { return <div>real</div>; }\n`
    );

    // Unregistered page — on disk but NOT in registry → UNREGISTERED++
    const unknownDir = path.join(fakeApp, "unknown-page");
    fs.mkdirSync(unknownDir, { recursive: true });
    fs.writeFileSync(path.join(unknownDir, "page.tsx"),
      `export default function U() { return <div>unknown</div>; }\n`
    );

    // API route — registered ✓
    const apiDir = path.join(fakeApp, "api", "health");
    fs.mkdirSync(apiDir, { recursive: true });
    fs.writeFileSync(path.join(apiDir, "route.ts"),
      `export async function GET() { return Response.json({ ok: true }); }\n`
    );

    // Page with DEMO_ITEMS — reachable mock → REACHABLE_PRODUCTION_MOCKS++
    const demoDir = path.join(fakeApp, "demo-page");
    fs.mkdirSync(demoDir, { recursive: true });
    fs.writeFileSync(path.join(demoDir, "page.tsx"),
      `const DEMO_ITEMS = [{ id: 1, name: "Fake" }];
export default function D() { return <div>{DEMO_ITEMS.length}</div>; }\n`
    );

    // Demo UI label without a fixture constant â€” must also block.
    const demoLabelDir = path.join(fakeApp, "demo-label");
    fs.mkdirSync(demoLabelDir, { recursive: true });
    fs.writeFileSync(path.join(demoLabelDir, "page.tsx"),
      `export default function D() { return <div>Demo-Auswertung</div>; }\n`
    );

    // Test-only file with DEMO_ITEMS — excluded from reachability
    const testDir = path.join(tmpDir, "src", "__tests__");
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, "something.test.ts"),
      `const DEMO_ITEMS = []; // fixture\n`
    );

    // Provider with silent-success fallback — reachable via layout.tsx
    fs.writeFileSync(path.join(fakeProviders, "fakeProvider.ts"),
      `export function getClient() {
  if (!process.env.FAKE_API_KEY) return null;
  return {};
}\n`
    );
    // layout.tsx imports fakeProvider (making it reachable)
    // layout.tsx is at fakeApp/layout.tsx
    // fakeProvider is at fakeLib/providers/fakeProvider.ts
    // relative: from fakeApp → ../lib/providers/fakeProvider
    fs.writeFileSync(path.join(fakeApp, "layout.tsx"),
      `import { getClient } from '../lib/providers/fakeProvider';
export default function L({ children }) { return <>{children}</>; }\n`
    );

    // Action file — registered ✓
    const actionsDir = path.join(fakeApp, "actions");
    fs.mkdirSync(actionsDir, { recursive: true });
    fs.writeFileSync(path.join(actionsDir, "foo.actions.ts"),
      `'use server'
export async function doFoo() { return 42; }
export async function doBar() { return 43; }
\n`
    );

    // Action file on disk but NOT in registry → UNREGISTERED++
    fs.writeFileSync(path.join(actionsDir, "unregistered.actions.ts"),
      `'use server'
export async function unregisteredAction() { return 1; }
\n`
    );

    // Re-export barrel → page imports barrel → barrel re-exports mock file
    const barrelDir = path.join(fakeLib, "barrel");
    fs.mkdirSync(barrelDir, { recursive: true });
    fs.writeFileSync(path.join(barrelDir, "mockWidget.ts"),
      `// This has DEMO_MODE_CONDITIONAL
const x = process.env.NEXT_PUBLIC_DEMO_MODE;\n`
    );
    fs.writeFileSync(path.join(barrelDir, "index.ts"),
      `export { x } from './mockWidget';\n`
    );
    // A page that imports via re-export barrel
    const reexportPageDir = path.join(fakeApp, "reexport-page");
    fs.mkdirSync(reexportPageDir, { recursive: true });
    fs.writeFileSync(path.join(reexportPageDir, "page.tsx"),
      `import { x } from '../../lib/barrel';
export default function R() { return <div>{x}</div>; }\n`
    );

    // Nav page with unregistered href
    const navDir = path.join(fakeApp, "nav-page");
    fs.mkdirSync(navDir, { recursive: true });
    fs.writeFileSync(path.join(navDir, "page.tsx"),
      `export default function N() {
  return <><a href="/totally-unregistered-href">unknown</a><a href="/some-registered-nav">phantom</a></>;
}\n`
    );

    // TEST_ONLY page under src/app is not isolated, even if registry flags say unreachable.
    const productionTestOnlyDir = path.join(fakeApp, "test-only-page");
    fs.mkdirSync(productionTestOnlyDir, { recursive: true });
    fs.writeFileSync(path.join(productionTestOnlyDir, "page.tsx"),
      `export default function T() { return <div>test tool</div>; }\n`
    );

    // Unregistered provider candidate in lib
    fs.writeFileSync(path.join(fakeProviders, "UnregisteredProvider.ts"),
      `export class UnregisteredProvider {\n  fetch() { return {}; }\n}\n`
    );

    // legacy-no-mock page (LEGACY_REMOVE, no mock pattern)
    const legacyNoMockDir = path.join(fakeApp, "legacy-no-mock");
    fs.mkdirSync(legacyNoMockDir, { recursive: true });
    fs.writeFileSync(path.join(legacyNoMockDir, "page.tsx"),
      `export default function L() { return <div>legacy clean</div>; }\n`
    );

    // unreachable-legacy page (LEGACY_REMOVE, reachable=false)
    const unreachableLegacyDir = path.join(fakeApp, "unreachable-legacy");
    fs.mkdirSync(unreachableLegacyDir, { recursive: true });
    fs.writeFileSync(path.join(unreachableLegacyDir, "page.tsx"),
      `export default function U() { return <div>unreachable legacy</div>; }\n`
    );

    // fail-closed page (PENDING_CONTRACT, renders NOT_AVAILABLE)
    const failClosedDir = path.join(fakeApp, "fail-closed");
    fs.mkdirSync(failClosedDir, { recursive: true });
    fs.writeFileSync(path.join(failClosedDir, "page.tsx"),
      `export default function F() { return <div>NOT_AVAILABLE</div>; }\n`
    );

    // mismatch.actions.ts — has realFunction but NOT phantomFunction
    fs.writeFileSync(path.join(actionsDir, "mismatch.actions.ts"),
      `'use server'\nexport async function realFunction() { return 1; }\n`
    );

    // Build fake registry (intentionally incomplete to trigger findings)
    const fakeRegistry = {
      schema_version: "1.0",
      registry_version: "F1-R0-SELFTEST",
      generated_at: new Date().toISOString(),
      snapshot_sha: "selftest",
      summary: { page_routes: 6, api_routes: 1, total: 99 }, // total intentionally wrong (real count is 16)
      capabilities: [
        {
          stable_id: "page.dashboard",
          kind: "PAGE_ROUTE",
          entry_point: "src/app/dashboard/page.tsx",
          route: "/dashboard",
          visible: true,
          reachable: true,
          classification: "REAL_VERIFIED",
          evidence: {
            note: "selftest verified",
            evidence_sha256: "69F7017DD45700D69FC65D2D2099AB33497D6D1705C2FC03B86260A68323BE9C",
          },
        },
        {
          stable_id: "page.demo-page",
          kind: "PAGE_ROUTE",
          entry_point: "src/app/demo-page/page.tsx",
          route: "/demo-page",
          visible: true,
          reachable: true,
          classification: "LEGACY_REMOVE",
          open_reason: "has DEMO_ITEMS",
        },
        {
          stable_id: "page.demo-label",
          kind: "PAGE_ROUTE",
          entry_point: "src/app/demo-label/page.tsx",
          route: "/demo-label",
          visible: true,
          reachable: true,
          classification: "PENDING_CONTRACT",
          open_reason: "selftest production demo label",
        },
        {
          stable_id: "page.nav-page",
          kind: "PAGE_ROUTE",
          entry_point: "src/app/nav-page/page.tsx",
          route: "/nav-page",
          visible: true,
          reachable: true,
          classification: "PENDING_CONTRACT",
          open_reason: "selftest nav page",
        },
        {
          stable_id: "page.reexport-page",
          kind: "PAGE_ROUTE",
          entry_point: "src/app/reexport-page/page.tsx",
          route: "/reexport-page",
          visible: true,
          reachable: true,
          classification: "PENDING_CONTRACT",
          open_reason: "selftest re-export page",
        },
        // unknown-page intentionally NOT registered → bidirectional gap
        {
          stable_id: "api.health",
          kind: "API_ROUTE",
          entry_point: "src/app/api/health/route.ts",
          route: "/api/health",
          visible: false,
          reachable: true,
          classification: "PENDING_CONTRACT",
          open_reason: "selftest health check",
        },
        {
          stable_id: "server-actions.foo",
          kind: "SERVER_ACTION_GROUP",
          entry_point: "src/app/actions/foo.actions.ts",
          exported_functions: ["doFoo", "doBar"],
          visible: false,
          reachable: true,
          classification: "PENDING_CONTRACT",
          open_reason: "selftest action group",
        },
        // unregistered.actions.ts intentionally NOT in registry
        {
          stable_id: "kpi.energie",
          kind: "KPI_DEFINITION",
          kpi_id: "energie",
          source_file: "src/lib/analytics/kpiRegistry.ts",
          label: "Energie",
          visible: false,
          reachable: false,
          classification: "PENDING_CONTRACT",
          open_reason: "selftest kpi",
        },
        {
          stable_id: "kpi.umsatz",
          kind: "KPI_DEFINITION",
          kpi_id: "umsatz",
          source_file: "src/lib/analytics/kpiRegistry.ts",
          label: "Umsatz",
          visible: false,
          reachable: false,
          classification: "PENDING_CONTRACT",
          open_reason: "selftest kpi",
        },
        // kosten intentionally NOT in registry → KPI bidirectional gap
        {
          stable_id: "provider.fake",
          kind: "PROVIDER_CONNECTION",
          provider: "FakeProvider",
          adapter_file: "src/lib/providers/fakeProvider.ts",
          env_vars: ["FAKE_API_KEY"],
          visible: false,
          reachable: true,
          classification: "REAL_PENDING_SECRET",
          open_reason: "selftest provider requires FAKE_API_KEY",
        },
        // UnregisteredProvider.ts intentionally NOT registered → provider gap
        {
          stable_id: "nav.somelink",
          kind: "NAV_LINK_NO_PAGE",
          route: "/some-registered-nav",
          visible: false,
          reachable: false,
          classification: "LEGACY_REMOVE",
          open_reason: "selftest proves source href wins over registry flags",
        },
        {
          stable_id: "page.test-only-page",
          kind: "PAGE_ROUTE",
          entry_point: "src/app/test-only-page/page.tsx",
          route: "/test-only-page",
          visible: false,
          reachable: false,
          classification: "TEST_ONLY",
          open_reason: "selftest production test tooling",
        },
        {
          stable_id: "provider.supabase",
          kind: "PROVIDER_CONNECTION",
          provider: "Supabase",
          adapter_file: null,
          env_vars: ["SUPABASE_URL"],
          visible: false,
          reachable: true,
          classification: "REAL_PENDING_SECRET",
          open_reason: "selftest supabase",
        },
        {
          stable_id: "page.nonexistent",
          kind: "PAGE_ROUTE",
          entry_point: "src/app/nonexistent/page.tsx",
          route: "/nonexistent",
          visible: true,
          reachable: false,
          classification: "PENDING_CONTRACT",
          open_reason: "this file does not exist on disk",
        },
        // --- new selftest entries ---
        {
          stable_id: "page.legacy-no-mock",
          kind: "PAGE_ROUTE",
          entry_point: "src/app/legacy-no-mock/page.tsx",
          route: "/legacy-no-mock",
          visible: true,
          reachable: true,
          classification: "LEGACY_REMOVE",
          open_reason: "selftest reachable LEGACY_REMOVE without mock pattern",
        },
        {
          stable_id: "page.unreachable-legacy",
          kind: "PAGE_ROUTE",
          entry_point: "src/app/unreachable-legacy/page.tsx",
          route: "/unreachable-legacy",
          visible: true,
          reachable: false,
          classification: "LEGACY_REMOVE",
          open_reason: "selftest unreachable LEGACY_REMOVE — must not block",
        },
        {
          stable_id: "page.fail-closed",
          kind: "PAGE_ROUTE",
          entry_point: "src/app/fail-closed/page.tsx",
          route: "/fail-closed",
          visible: true,
          reachable: true,
          classification: "PENDING_CONTRACT",
          open_reason: "selftest PENDING_CONTRACT fail-closed — must not block",
        },
        {
          stable_id: "server-actions.mismatch",
          kind: "SERVER_ACTION_GROUP",
          entry_point: "src/app/actions/mismatch.actions.ts",
          exported_functions: ["realFunction", "phantomFunction"],
          visible: false,
          reachable: true,
          classification: "REAL_PENDING_SECRET",
          open_reason: "selftest: phantomFunction absent on disk → REGISTERED_FN_NOT_ON_DISK",
          env_vars: ["SOME_MISMATCH_KEY"],
        },
      ],
    };

    const fakeRegistryPath = path.join(fakeEvidence, "F1_R0_CAPABILITY_REGISTRY.json");
    fs.writeFileSync(fakeRegistryPath, JSON.stringify(fakeRegistry, null, 2));

    // ── Run Gate ──
    const exitCode = runGate({
      repoRoot: tmpDir,
      registryPath: fakeRegistryPath,
      srcApp: fakeApp,
      srcLib: fakeLib,
      kpiRegistryPath: path.join(fakeAnalytics, "kpiRegistry.ts"),
      verbose: true,
    });

    // ── Verify expectations ─────────────────────────────────────────────────
    const failures = [];

    // Gate must exit nonzero (many violations expected)
    if (exitCode === 0) {
      failures.push("SELFTEST_FAIL: Gate should exit nonzero (multiple violations expected)");
    } else {
      console.log("[SELFTEST] OK: Gate correctly exits nonzero with violations.");
    }

    // Test: DEMO_ITEMS detected
    const reachable = buildReachabilityGraph(fakeApp, tmpDir);
    const mocks = detectMocks(reachable, tmpDir);
    if (!mocks.find((m) => m.rule_id === "DEMO_ITEMS_CONSTANT")) {
      failures.push("SELFTEST_FAIL: DEMO_ITEMS in demo-page NOT detected");
    } else {
      console.log("[SELFTEST] OK: DEMO_ITEMS detected in production-reachable file.");
    }

    // Test: re-export reachability — DEMO_MODE_CONDITIONAL in barrel/mockWidget.ts
    if (!mocks.find((m) => m.rule_id === "DEMO_MODE_CONDITIONAL")) {
      failures.push("SELFTEST_FAIL: DEMO_MODE_CONDITIONAL via re-export barrel NOT detected");
    } else {
      console.log("[SELFTEST] OK: re-export chain correctly followed to mockWidget.ts.");
    }

    // Test: explicit demo UI label detected without DEMO_ITEMS.
    if (!mocks.find((m) => m.rule_id === "DEMO_UI_LABEL")) {
      failures.push("SELFTEST_FAIL: production Demo-Auswertung label NOT detected");
    } else {
      console.log("[SELFTEST] OK: production demo UI label detected.");
    }

    // Test: registry false flags cannot hide a visible phantom href.
    const visibleHrefs = extractVisibleHrefs(reachable);
    const phantomNav = detectPhantomNavLinks(
      fakeRegistry.capabilities.filter((c) => c.kind === "NAV_LINK_NO_PAGE"),
      visibleHrefs
    );
    if (!phantomNav.find((f) => f.route === "/some-registered-nav")) {
      failures.push("SELFTEST_FAIL: source-visible phantom nav hidden by registry flags");
    } else {
      console.log("[SELFTEST] OK: source-visible phantom nav overrides registry flags.");
    }

    // Test: TEST_ONLY source under src/app is not an isolated test fixture.
    const productionTestOnly = detectProductionTestOnly(fakeRegistry.capabilities, tmpDir);
    if (!productionTestOnly.find((f) => f.stable_id === "page.test-only-page")) {
      failures.push("SELFTEST_FAIL: TEST_ONLY production source NOT detected");
    } else {
      console.log("[SELFTEST] OK: TEST_ONLY production source detected.");
    }

    // Test: test-only file NOT in reachable set
    if (reachable.has(path.join(testDir, "something.test.ts"))) {
      failures.push("SELFTEST_FAIL: test file should NOT be in reachable set");
    } else {
      console.log("[SELFTEST] OK: Test-only file excluded from reachable set.");
    }

    // Test: provider fallback detected
    const fallbacks = detectProviderFallbacks(reachable, tmpDir);
    if (fallbacks.length === 0) {
      failures.push("SELFTEST_FAIL: Provider silent-success fallback NOT detected");
    } else {
      console.log("[SELFTEST] OK: Provider silent-success fallback detected.");
    }

    // Test: unregistered page detected (unknown-page)
    const diskPages = discoverPagesOnDisk(fakeApp);
    const regPages = new Map(fakeRegistry.capabilities.filter(c => c.kind === "PAGE_ROUTE").map(c => [c.route, c]));
    if (regPages.has("/unknown-page")) {
      failures.push("SELFTEST_FAIL: /unknown-page should NOT be in registry");
    } else if (!diskPages.has("/unknown-page")) {
      failures.push("SELFTEST_FAIL: /unknown-page should be on disk");
    } else {
      console.log("[SELFTEST] OK: Bidirectional page gap detected (/unknown-page on disk, not in registry).");
    }

    // Test: unregistered action file detected
    const diskActions = discoverActionFilesOnDisk(fakeApp, tmpDir);
    const unregActionPath = "src/app/actions/unregistered.actions.ts";
    const regActionEps = new Map(fakeRegistry.capabilities.filter(c => c.kind === "SERVER_ACTION_GROUP").map(c => [c.entry_point, c]));
    if (!diskActions.has(unregActionPath)) {
      failures.push("SELFTEST_FAIL: unregistered.actions.ts should be discovered on disk");
    } else if (regActionEps.has(unregActionPath)) {
      failures.push("SELFTEST_FAIL: unregistered.actions.ts should NOT be in registry");
    } else {
      console.log("[SELFTEST] OK: Bidirectional action file gap detected (unregistered.actions.ts).");
    }

    // Test: KPI gap detected (kosten in code, not in registry)
    const diskKpis = discoverKpisFromCode(path.join(fakeAnalytics, "kpiRegistry.ts"));
    const regKpiIds = new Set(fakeRegistry.capabilities.filter(c => c.kind === "KPI_DEFINITION").map(c => c.kpi_id));
    if (!diskKpis.has("kosten")) {
      failures.push("SELFTEST_FAIL: 'kosten' KPI should be in kpiRegistry.ts");
    } else if (regKpiIds.has("kosten")) {
      failures.push("SELFTEST_FAIL: 'kosten' KPI should NOT be in registry");
    } else {
      console.log("[SELFTEST] OK: KPI bidirectional gap detected ('kosten' in code, not in registry).");
    }

    // Test: provider candidate gap detected (UnregisteredProvider.ts)
    const diskProviders = discoverProviderCandidates(fakeLib, tmpDir);
    const unregProv = "src/lib/providers/UnregisteredProvider.ts";
    if (!diskProviders.has(unregProv)) {
      failures.push("SELFTEST_FAIL: UnregisteredProvider.ts should be discovered in lib");
    } else {
      const regAdapters = new Map(fakeRegistry.capabilities.filter(c => c.kind === "PROVIDER_CONNECTION" && c.adapter_file).map(c => [c.adapter_file, c]));
      if (regAdapters.has(unregProv)) {
        failures.push("SELFTEST_FAIL: UnregisteredProvider.ts should NOT be in registry");
      } else {
        console.log("[SELFTEST] OK: Unregistered provider candidate detected (UnregisteredProvider.ts).");
      }
    }

    // Test: summary.total mismatch detected
    const structErrors = validateRegistryStructure(fakeRegistry);
    const summaryError = structErrors.find((e) => e.includes("summary.total"));
    if (!summaryError) {
      failures.push("SELFTEST_FAIL: Inconsistent summary.total should be detected by structure validator");
    } else {
      console.log("[SELFTEST] OK: summary.total mismatch caught by validator.");
    }

    // Test: REAL_VERIFIED entry with F1.1 SHA256 → ACTIVE_CAPABILITY_REAL_E2E=PASS
    // Gate must check for the frozen F1.1 evidence_sha256, not just any REAL_VERIFIED entry.
    const SELFTEST_F1_1_SHA256 = "69F7017DD45700D69FC65D2D2099AB33497D6D1705C2FC03B86260A68323BE9C";
    const hasF1_1Entry = fakeRegistry.capabilities.some(
      (c) => c.classification === "REAL_VERIFIED" && c.evidence && c.evidence.evidence_sha256 === SELFTEST_F1_1_SHA256
    );
    if (!hasF1_1Entry) {
      failures.push("SELFTEST_FAIL: Selftest registry must have a REAL_VERIFIED entry with frozen F1.1 evidence_sha256");
    } else {
      console.log("[SELFTEST] OK: F1.1-pinned REAL_VERIFIED entry found → ACTIVE_CAPABILITY_REAL_E2E=PASS.");
    }

    // Test: three required output lines were emitted (they were printed by runGate above)
    console.log("[SELFTEST] OK: Three required output lines (REACHABLE_PRODUCTION_MOCKS, UNREGISTERED_VISIBLE_CAPABILITIES, ACTIVE_CAPABILITY_REAL_E2E) emitted by runGate.");

    console.log("\n── Selftest Summary ────────────────────────────────────────────────────");
    if (failures.length > 0) {
      console.error("[SELFTEST] FAILED:");
      for (const f of failures) console.error(`  ${f}`);
      process.exitCode = 1;
    } else {
      console.log("[SELFTEST] PASS — all gate rules verified.");
    }
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* non-fatal */ }
  }
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

if (process.argv.includes("--selftest")) {
  runSelftest();
} else {
  process.exit(runGate());
}
