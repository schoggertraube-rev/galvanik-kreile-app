// S1 Gate (D-ARCH-008 / ARCHITEKTUR_MODULE_PATH1.md §2 + §5): die Modul-Naehte als
// AUSFUEHRBARE Pruefung, nicht als Prosa. Dependency-frei, deterministisch, testbar
// (src/test/s1_module_gates.test.ts beweist, dass jede Naht bei Verstoss ROT wird).
//
// Naht 1  Manifest je Modul:  src/modules/<fach>/<fach>.manifest.json valide gegen
//         docs/architecture/MODULE_MANIFEST.schema.json, moduleId == Ordnername,
//         public.ts vorhanden, publicExports = "@/modules/<fach>/public#Symbol" und
//         Symbol wird von public.ts exportiert, dependencies = existierende Module.
//         Ablage: nichts vom Fach ausserhalb src/modules/<fach>/ (kein src/app|components|
//         lib|features|hooks|contexts/<fach>).
// Naht 2  Positive Fassade: Fremdmodul NUR ueber @/modules/<fach>/public (Alias ODER
//         relativ); Tiefimport = FAIL. Eigenes Modul NUR relativ (kein @/modules/<eigen>/...).
// Naht 3  Tenant-Literal: ESLint (S0). Hier nicht doppelt.
// Naht 4  Cross-Modul-Fakten NUR ueber v_*-Views: SQL in src/modules/<fach>/ darf
//         public./private.-Tabellen nur anfassen, wenn ownsTables sie dem Modul zuordnet,
//         oder wenn es eine in irgendeinem Manifest deklarierte public.v_*-View ist.
// Naht 5  UI-Vertrag: verworfene Stationsband-/Transport-Home-Bausteine und -Texte
//         (00_UI_REFERENZ_KANONISCH.md "VERWORFEN") = FAIL. Bestehende Altlasten stehen in
//         quality/module-gates-baseline.json (shrink-only, gegen Basis-Baseline geprueft;
//         S4 leert sie).
// Naht 6  AGENTS.md verweist auf ARCHITEKTUR_MODULE_PATH1.md.
//
// Aufruf:  node scripts/quality/check-module-gates.mjs [--root <dir>]
//            [--base-baseline <quality/module-gates-baseline.json der Basis>]
//            [--schema <MODULE_MANIFEST.schema.json der Basis>] [--update]
// Geschuetzt (eslint-ratchet.yml): Basis-Skript + Basis-Baseline + Basis-Schema gegen den
// Kandidatenbaum — ein Kandidat kann das Gate nicht durch Aendern von Skript/Baseline/Schema umgehen.
// Exit 0 = alle Naehte halten. Exit 1 = mindestens ein Verstoss (Datei:Zeile im Output).

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const BASELINE_PATH = "quality/module-gates-baseline.json";
export const SCHEMA_PATH = "docs/architecture/MODULE_MANIFEST.schema.json";
export const MODULES_DIR = "src/modules";
export const AGENTS_REQUIRED_REFERENCE = "ARCHITEKTUR_MODULE_PATH1.md";

// Naht 5 — verworfen laut docs/project/linie/ui/00_UI_REFERENZ_KANONISCH.md + MODULKARTE_KANON.md
export const FORBIDDEN_UI_IDENTIFIERS = [
  "WorkflowStrip",
  "TabletTopFlowNav",
  "TopWorkflowBar",
  "WarendurchlaufStationNav",
  "ThemeToggle",
];
export const FORBIDDEN_UI_TEXTS = [
  "Station öffnen",
  "In Galvanik starten",
  "Als Nächstes",
];

// Ordner, in denen ein Fach NICHT mehr liegen darf, sobald src/modules/<fach>/ existiert.
export const LEGACY_DOMAIN_PARENTS = [
  "src/app",
  "src/components",
  "src/lib",
  "src/features",
  "src/hooks",
  "src/contexts",
];

const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);
const SKIP_DIRS = new Set(["node_modules", ".next", "out", "build", ".git"]);

// ── Hilfen ────────────────────────────────────────────────────────────────────

function toPosix(p) {
  return p.replaceAll("\\", "/");
}

function walk(root, relDir, out) {
  const abs = path.join(root, relDir);
  if (!existsSync(abs)) return out;
  for (const entry of readdirSync(abs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const rel = toPosix(path.join(relDir, entry.name));
    if (entry.isDirectory()) walk(root, rel, out);
    else if (entry.isFile()) out.push(rel);
  }
  return out;
}

function listCodeFiles(root, relDir) {
  return walk(root, relDir, []).filter((f) => CODE_EXTENSIONS.has(path.extname(f)));
}

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

function readJson(absPath) {
  return JSON.parse(readFileSync(absPath, "utf8"));
}

function listModuleDirs(root) {
  const abs = path.join(root, MODULES_DIR);
  if (!existsSync(abs)) return [];
  return readdirSync(abs, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

// ── Minimaler JSON-Schema-Validator (genau die Konstrukte, die MODULE_MANIFEST.schema.json nutzt) ──

export function validateAgainstSchema(value, schema, at = "$") {
  const errors = [];
  const type = schema.type;
  if (type === "object") {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return [`${at}: erwartet object`];
    }
    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push(`${at}: Pflichtfeld '${key}' fehlt`);
    }
    const props = schema.properties ?? {};
    for (const [key, child] of Object.entries(value)) {
      if (key === "$schema") continue;
      if (key in props) {
        errors.push(...validateAgainstSchema(child, props[key], `${at}.${key}`));
      } else if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
        errors.push(...validateAgainstSchema(child, schema.additionalProperties, `${at}.${key}`));
      } else if (schema.additionalProperties === false) {
        errors.push(`${at}: unbekanntes Feld '${key}' (additionalProperties=false)`);
      }
    }
    return errors;
  }
  if (type === "array") {
    if (!Array.isArray(value)) return [`${at}: erwartet array`];
    if (schema.items) value.forEach((item, i) => errors.push(...validateAgainstSchema(item, schema.items, `${at}[${i}]`)));
    return errors;
  }
  if (type === "string") {
    if (typeof value !== "string") return [`${at}: erwartet string`];
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${at}: kuerzer als minLength ${schema.minLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${at}: '${value}' verletzt pattern ${schema.pattern}`);
    return errors;
  }
  return errors;
}

// ── Export-/Import-Extraktion (regex-basiert, bewusst konservativ) ─────────────

export function exportedSymbols(source) {
  const names = new Set();
  const decl = /^\s*export\s+(?:default\s+)?(?:declare\s+)?(?:async\s+)?(?:const|let|var|function\*?|class|type|interface|enum|abstract\s+class)\s+([A-Za-z_$][\w$]*)/gm;
  for (const m of source.matchAll(decl)) names.add(m[1]);
  const list = /^\s*export\s+(?:type\s+)?\{([^}]*)\}/gm;
  for (const m of source.matchAll(list)) {
    for (const part of m[1].split(",")) {
      const item = part.trim().replace(/^type\s+/, "");
      if (!item) continue;
      const asMatch = item.match(/^[A-Za-z_$][\w$]*\s+as\s+([A-Za-z_$][\w$]*)$/);
      names.add(asMatch ? asMatch[1] : item.split(/\s+/)[0]);
    }
  }
  return names;
}

export function importSources(source) {
  const out = [];
  const patterns = [
    /\bimport\s+(?:type\s+)?[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bexport\s+(?:type\s+)?(?:\*|\{[^}]*\})\s*from\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bvi\.mock\s*\(\s*['"]([^'"]+)['"]/g,
  ];
  for (const re of patterns) {
    for (const m of source.matchAll(re)) out.push({ spec: m[1], index: m.index });
  }
  return out;
}

// Loest einen Import-Spezifizierer auf einen repo-relativen Pfad ohne Endung auf
// (nur @/-Alias und relative Pfade; Pakete -> null).
export function resolveSpec(importerRel, spec) {
  let target;
  if (spec.startsWith("@/")) target = "src/" + spec.slice(2);
  else if (spec.startsWith("./") || spec.startsWith("../")) target = toPosix(path.posix.join(path.posix.dirname(importerRel), spec));
  else return null;
  return target.replace(/\.(?:[cm]?[jt]sx?)$/, "").replace(/\/index$/, "");
}

export function moduleOf(relPath) {
  const m = relPath.match(/^src\/modules\/([^/]+)(?:\/|$)/);
  return m ? m[1] : null;
}

// ── Naht 1: Manifest je Modul + Ablage ───────────────────────────────────────

function gateManifests(root, findings, schemaPath) {
  const modules = listModuleDirs(root);
  const schemaAbs = schemaPath ?? path.join(root, SCHEMA_PATH);
  if (modules.length > 0 && !existsSync(schemaAbs)) {
    findings.push(`[naht1] ${SCHEMA_PATH}: Schema fehlt, Manifeste nicht pruefbar`);
    return { modules, manifests: new Map() };
  }
  const schema = modules.length > 0 ? readJson(schemaAbs) : null;
  const manifests = new Map();
  for (const fach of modules) {
    const manifestRel = `${MODULES_DIR}/${fach}/${fach}.manifest.json`;
    const publicRel = `${MODULES_DIR}/${fach}/public.ts`;
    if (!existsSync(path.join(root, manifestRel))) {
      findings.push(`[naht1] ${manifestRel}: Manifest fehlt (Modul ohne Manifest = FAIL)`);
      continue;
    }
    let manifest;
    try {
      manifest = readJson(path.join(root, manifestRel));
    } catch (error) {
      findings.push(`[naht1] ${manifestRel}: kein gueltiges JSON (${error.message})`);
      continue;
    }
    for (const err of validateAgainstSchema(manifest, schema)) findings.push(`[naht1] ${manifestRel}: ${err}`);
    if (manifest.moduleId !== fach) findings.push(`[naht1] ${manifestRel}: moduleId '${manifest.moduleId}' != Ordnername '${fach}'`);
    if (!existsSync(path.join(root, publicRel))) {
      findings.push(`[naht1] ${publicRel}: positive Fassade public.ts fehlt`);
    } else {
      const exported = exportedSymbols(readFileSync(path.join(root, publicRel), "utf8"));
      for (const entry of manifest.publicExports ?? []) {
        const m = typeof entry === "string" ? entry.match(/^@\/modules\/([^/#]+)\/public#([A-Za-z_$][\w$]*)$/) : null;
        if (!m || m[1] !== fach) {
          findings.push(`[naht1] ${manifestRel}: publicExports '${entry}' muss '@/modules/${fach}/public#Symbol' sein`);
        } else if (!exported.has(m[2])) {
          findings.push(`[naht1] ${publicRel}: exportiert '${m[2]}' nicht, steht aber in publicExports`);
        }
      }
    }
    for (const dep of manifest.dependencies ?? []) {
      if (!modules.includes(dep)) findings.push(`[naht1] ${manifestRel}: dependency '${dep}' ist kein Modul unter ${MODULES_DIR}/`);
      if (dep === fach) findings.push(`[naht1] ${manifestRel}: Modul haengt von sich selbst ab`);
    }
    for (const parent of LEGACY_DOMAIN_PARENTS) {
      const legacy = `${parent}/${fach}`;
      if (existsSync(path.join(root, legacy))) {
        findings.push(`[naht1] ${legacy}: Fach '${fach}' hat ein Modul, darf nicht mehr ausserhalb ${MODULES_DIR}/${fach}/ liegen`);
      }
    }
    manifests.set(fach, manifest);
  }
  return { modules, manifests };
}

// ── Naht 2: Positive Fassade / Tiefimport-Verbot ─────────────────────────────

function gateImports(root, findings) {
  for (const file of listCodeFiles(root, "src")) {
    const source = readFileSync(path.join(root, file), "utf8");
    const importer = moduleOf(file);
    for (const { spec, index } of importSources(source)) {
      const target = resolveSpec(file, spec);
      if (!target) continue;
      const targetModule = moduleOf(target);
      if (!targetModule) continue;
      const where = `${file}:${lineOf(source, index)}`;
      if (targetModule === importer) {
        if (spec.startsWith("@/")) findings.push(`[naht2] ${where}: Import im eigenen Modul muss relativ sein, nicht '${spec}'`);
        continue;
      }
      if (target !== `${MODULES_DIR}/${targetModule}/public`) {
        findings.push(`[naht2] ${where}: Tiefimport '${spec}' — Fremdmodul '${targetModule}' nur ueber @/modules/${targetModule}/public`);
      }
    }
  }
}

// ── Naht 4: Cross-Modul-Fakten nur ueber v_*-Views ───────────────────────────

const SQL_TABLE_REF = /\b(?:from|join|into|update|table|only)\s+((?:public|private)\.[a-z_][a-z0-9_]*)/gi;

function gateData(root, findings, manifests) {
  const declaredViews = new Set();
  for (const manifest of manifests.values()) {
    for (const v of manifest.viewsFunctions ?? []) if (/^public\.v_/.test(v)) declaredViews.add(v);
  }
  for (const [fach, manifest] of manifests) {
    const owned = new Set(manifest.ownsTables ?? []);
    for (const file of listCodeFiles(root, `${MODULES_DIR}/${fach}`)) {
      const source = readFileSync(path.join(root, file), "utf8");
      for (const m of source.matchAll(SQL_TABLE_REF)) {
        const ref = m[1].toLowerCase();
        if (owned.has(ref)) continue;
        if (/^public\.v_/.test(ref)) {
          if (!declaredViews.has(ref)) findings.push(`[naht4] ${file}:${lineOf(source, m.index)}: View '${ref}' ist in keinem Manifest (viewsFunctions) deklariert`);
          continue;
        }
        findings.push(`[naht4] ${file}:${lineOf(source, m.index)}: Tabelle '${ref}' gehoert nicht zu Modul '${fach}' (ownsTables) — Fremdfakten nur ueber public.v_*`);
      }
    }
  }
}

// ── Naht 5: UI-Vertrag (verworfene Bausteine/Texte), shrink-only Baseline ────

export function uiContractHits(root) {
  const hits = new Map();
  const identRe = new RegExp(`\\b(${FORBIDDEN_UI_IDENTIFIERS.join("|")})\\b`, "g");
  for (const file of listCodeFiles(root, "src")) {
    const source = readFileSync(path.join(root, file), "utf8");
    const list = [];
    for (const m of source.matchAll(identRe)) list.push(`${lineOf(source, m.index)}: Baustein '${m[1]}'`);
    for (const text of FORBIDDEN_UI_TEXTS) {
      let i = source.indexOf(text);
      while (i !== -1) {
        list.push(`${lineOf(source, i)}: Text '${text}'`);
        i = source.indexOf(text, i + text.length);
      }
    }
    if (list.length > 0) hits.set(file, list);
  }
  return hits;
}

function gateUi(root, findings, baseline, baseBaseline) {
  const hits = uiContractHits(root);
  const allowed = new Set(baseline.uiContract?.allowedLegacyFiles ?? []);
  for (const [file, list] of hits) {
    if (allowed.has(file)) continue;
    for (const entry of list) findings.push(`[naht5] ${file}:${entry} — verworfen laut 00_UI_REFERENZ_KANONISCH.md (Stationsband/Transport-Home)`);
  }
  for (const file of allowed) {
    if (!hits.has(file)) findings.push(`[naht5] ${BASELINE_PATH}: '${file}' hat keine Treffer mehr — aus allowedLegacyFiles entfernen (shrink-only)`);
  }
  if (baseBaseline) {
    const baseAllowed = new Set(baseBaseline.uiContract?.allowedLegacyFiles ?? []);
    for (const file of allowed) {
      if (!baseAllowed.has(file)) findings.push(`[naht5] ${BASELINE_PATH}: '${file}' neu in allowedLegacyFiles — Baseline darf nur schrumpfen`);
    }
  }
}

// ── Naht 6: AGENTS.md verweist auf die Bauanleitung ──────────────────────────

function gateAgents(root, findings) {
  const agents = path.join(root, "AGENTS.md");
  if (!existsSync(agents)) return findings.push("[naht6] AGENTS.md fehlt");
  if (!readFileSync(agents, "utf8").includes(AGENTS_REQUIRED_REFERENCE)) {
    findings.push(`[naht6] AGENTS.md: Verweis auf ${AGENTS_REQUIRED_REFERENCE} fehlt`);
  }
}

// ── Orchestrierung ───────────────────────────────────────────────────────────

function readBaseline(absPath) {
  if (!existsSync(absPath)) return { uiContract: { allowedLegacyFiles: [] } };
  return readJson(absPath);
}

/**
 * @param {string} root
 * @param {{ baseBaselinePath?: string | null, schemaPath?: string | null }} [options]
 * @returns {{ ok: boolean, findings: string[] }}
 */
export function runModuleGates(root, { baseBaselinePath = null, schemaPath = null } = {}) {
  const findings = [];
  const baseline = readBaseline(path.join(root, BASELINE_PATH));
  const baseBaseline = baseBaselinePath ? readBaseline(baseBaselinePath) : null;
  const { manifests } = gateManifests(root, findings, schemaPath);
  gateImports(root, findings);
  gateData(root, findings, manifests);
  gateUi(root, findings, baseline, baseBaseline);
  gateAgents(root, findings);
  return { ok: findings.length === 0, findings: findings.sort() };
}

export function writeBaseline(root) {
  const files = [...uiContractHits(root).keys()].sort();
  const baseline = {
    $comment: "S1 Naht 5 (UI-Vertrag): Altlasten mit verworfenen Stationsband-/Transport-Home-Bausteinen. Shrink-only; S4 leert die Liste. Nur ueber 'npm run quality:module-gates:update' + Review aendern.",
    uiContract: { allowedLegacyFiles: files },
  };
  mkdirSync(path.dirname(path.join(root, BASELINE_PATH)), { recursive: true });
  writeFileSync(path.join(root, BASELINE_PATH), `${JSON.stringify(baseline, null, 2)}\n`);
  return files;
}

function parseArgs(argv) {
  const opts = { root: process.cwd(), baseBaselinePath: null, schemaPath: null, update: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--root") opts.root = path.resolve(argv[++i]);
    else if (argv[i] === "--base-baseline") opts.baseBaselinePath = path.resolve(argv[++i]);
    else if (argv[i] === "--schema") opts.schemaPath = path.resolve(argv[++i]);
    else if (argv[i] === "--update") opts.update = true;
    else throw new Error(`Unbekanntes Argument: ${argv[i]}`);
  }
  return opts;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.update) {
    const files = writeBaseline(opts.root);
    console.log(`module-gates: Baseline geschrieben (${files.length} Altlast-Dateien).`);
  }
  const result = runModuleGates(opts.root, { baseBaselinePath: opts.baseBaselinePath, schemaPath: opts.schemaPath });
  if (result.ok) {
    console.log("module-gates: alle Naehte halten (Manifest, Fassade, v_*-Daten, UI-Vertrag, AGENTS).");
  } else {
    console.error(`module-gates: ${result.findings.length} Verstoss/Verstoesse`);
    for (const f of result.findings) console.error("  " + f);
    process.exitCode = 1;
  }
}
