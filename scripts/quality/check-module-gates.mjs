// S1 Gate (D-ARCH-008 / ARCHITEKTUR_MODULE_PATH1.md §2 + §5): die Modul-Naehte als
// AUSFUEHRBARE Pruefung, nicht als Prosa. Dependency-frei, deterministisch, testbar
// (src/test/s1_module_gates.test.ts beweist, dass jede Naht bei Verstoss ROT wird).
//
// Naht 1  Manifest je Modul:  src/modules/<fach>/<fach>.manifest.json valide gegen
//         docs/architecture/MODULE_MANIFEST.schema.json, moduleId == Ordnername,
//         public.ts client-sicher vorhanden; optionale server-public.ts ist explizit
//         server-only. publicExports bindet Symbol und genaue Fassade.
//         Ablage: nichts vom Fach ausserhalb src/modules/<fach>/ (kein src/app|components|
//         lib|features|hooks|contexts/<fach>).
// Naht 2  Positive Fassade: Browser-/UI-Vertrag nur ueber public; Commands nur ueber
//         server-public aus serverseitigen App-Actions/Real-DB-Tests. Tiefimport = FAIL.
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

import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { checkAuthorityRepository } from "./check-authoritative-sources.mjs";

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
const NEXT_COMPOSITION_ENTRYPOINTS = new Set(["page.tsx", "layout.tsx", "loading.tsx", "error.tsx", "not-found.tsx"]);
const APP_ADAPTER_NAME = /^[A-Z][A-Za-z0-9]*AppAdapter\.tsx$/;
const ADAPTER_FORBIDDEN_IMPORT = /(?:^@\/db(?:\/|$)|\/commands(?:\/|$)|\/repositories?(?:\/|$))/;
const ROUTE_LITERAL = /['"`](\/(?!\/)[^'"`\s]*)['"`]/g;
const SERVER_ACTION_FILE = /^src\/app\/actions\/[^/]+\.actions\.ts$/;
const REAL_DB_TEST_FILE = /^src\/test\/.+\.integration\.test\.[cm]?[jt]s$/;
const SERVER_ONLY_SPEC = /^(?:server-only|postgres(?:\/|$)|drizzle-orm(?:\/|$)|@supabase(?:\/|$)|node:)|^@\/(?:db(?:\/|$)|lib\/server\/privilegedDb(?:\/|$)|lib\/supabase(?:\/|$)|utils\/supabase(?:\/|$))/;

const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".mdx"]);
const SQL_EXTENSIONS = new Set([...CODE_EXTENSIONS, ".sql"]);
// Red-Team P0: NUR node_modules/.git ueberspringen — ein Ordner namens build/ oder out/
// unter src/ ist Quellcode und wird gescannt.
const SKIP_DIRS = new Set(["node_modules", ".git"]);

// ── Hilfen ────────────────────────────────────────────────────────────────────

function toPosix(p) {
  return p.replaceAll("\\", "/");
}

// Symlinks (Red-Team P0): werden verfolgt, muessen aber innerhalb <root> bleiben —
// sonst Befund (Dateien ausserhalb waeren fuer das Gate unsichtbar). Schleifenschutz via Realpath.
function walk(root, relDir, out, seen = new Set(), findings = null) {
  const abs = path.join(root, relDir);
  if (!existsSync(abs)) return out;
  const rootReal = realpathSync(root);
  for (const entry of readdirSync(abs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const rel = toPosix(path.join(relDir, entry.name));
    const entryAbs = path.join(abs, entry.name);
    let isDir = entry.isDirectory();
    let isFile = entry.isFile();
    if (entry.isSymbolicLink()) {
      let real;
      try {
        real = realpathSync(entryAbs);
      } catch {
        findings?.push(`[naht2] ${rel}: haengender Symlink`);
        continue;
      }
      if (real !== rootReal && !real.startsWith(rootReal + path.sep)) {
        findings?.push(`[naht2] ${rel}: Symlink zeigt aus dem Repo heraus (${toPosix(real)}) — fuer das Gate unsichtbarer Code ist verboten`);
        continue;
      }
      if (seen.has(real)) continue;
      seen.add(real);
      const st = statSync(real);
      isDir = st.isDirectory();
      isFile = st.isFile();
    }
    if (isDir) walk(root, rel, out, seen, findings);
    else if (isFile) out.push(rel);
  }
  return out;
}

function listFiles(root, relDir, extensions, findings = null) {
  return walk(root, relDir, [], new Set(), findings).filter((f) => extensions.has(path.extname(f)));
}

function listCodeFiles(root, relDir, findings = null) {
  return listFiles(root, relDir, CODE_EXTENSIONS, findings);
}

function asStringArray(value) {
  return Array.isArray(value) ? value.filter((v) => typeof v === "string") : [];
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

// Star-Re-Exports (`export * from`) sind in public.ts VERBOTEN: die Fassade ist eine
// explizite Liste, sonst waere publicExports nicht pruefbar (Red-Team P1).
export const STAR_REEXPORT = /^\s*export\s+(?:type\s+)?\*\s*(?:as\s+[\w$]+\s+)?from\b/m;

export function exportedSymbols(source) {
  const names = new Set();
  const decl = /^\s*export\s+(?:default\s+)?(?:declare\s+)?(?:async\s+)?(?:const|let|var|function\*?|class|type|interface|enum|namespace|abstract\s+class)\s+([A-Za-z_$][\w$]*)/gm;
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
  // Quelle in ' " oder ` (Template ohne Interpolation). Bewusst NICHT erfasst (Design-
  // Grenze, dokumentiert): dynamisch zusammengesetzte Pfade, Aliase ausser @/ (tsconfig
  // wird separat auf genau "@/*" festgenagelt).
  const q = `['"\`]([^'"\`$\\n]+)['"\`]`;
  const patterns = [
    new RegExp(`\\bimport\\s+(?:type\\s+)?[^'"\`;]*?\\bfrom\\s*${q}`, "g"),
    new RegExp(`\\bexport\\s+(?:type\\s+)?(?:\\*(?:\\s+as\\s+[\\w$]+)?|\\{[^}]*\\})\\s*from\\s*${q}`, "g"),
    new RegExp(`\\bimport\\s*${q}`, "g"),
    new RegExp(`\\bimport\\s*\\(\\s*${q}\\s*\\)`, "g"),
    new RegExp(`\\brequire\\s*\\(\\s*${q}\\s*\\)`, "g"),
    new RegExp(`\\b(?:vi|jest)\\.(?:mock|doMock|unmock|importActual|requireActual|importMock)\\s*\\(\\s*${q}`, "g"),
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
  // Bewusst KEIN /index-Kollaps (Red-Team P1): `@/modules/x/public/index` ist NICHT die Fassade.
  return target.replace(/\.(?:[cm]?[jt]sx?)$/, "");
}

export function moduleOf(relPath) {
  const m = relPath.match(/^src\/modules\/([^/]+)(?:\/|$)/);
  return m ? m[1] : null;
}

function isTypeOnlyReference(source, index) {
  return /^(?:import|export)\s+type\b/.test(source.slice(index, index + 80));
}

function existingCodeTarget(root, target) {
  const candidates = [
    ...[".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"].map((extension) => `${target}${extension}`),
    ...[".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"].map((extension) => `${target}/index${extension}`),
  ];
  return candidates.find((candidate) => existsSync(path.join(root, candidate))) ?? null;
}

function clientFacadeViolation(root, entryRel) {
  const pending = [{ rel: entryRel, chain: [entryRel] }];
  const seen = new Set();
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || seen.has(current.rel)) continue;
    seen.add(current.rel);
    const source = readFileSync(path.join(root, current.rel), "utf8");
    if (/^\s*['"]use server['"]\s*;/m.test(source)) {
      return `${current.chain.join(" -> ")} erreicht 'use server'`;
    }
    for (const { spec, index } of importSources(source)) {
      if (isTypeOnlyReference(source, index)) continue;
      if (SERVER_ONLY_SPEC.test(spec)) {
        return `${current.chain.join(" -> ")} importiert server-only '${spec}'`;
      }
      const target = resolveSpec(current.rel, spec);
      const targetFile = target ? existingCodeTarget(root, target) : null;
      if (targetFile && !seen.has(targetFile)) {
        pending.push({ rel: targetFile, chain: [...current.chain, targetFile] });
      }
    }
  }
  return null;
}

function allowedServerFacadeConsumer(file, source) {
  if (REAL_DB_TEST_FILE.test(file)) return true;
  return SERVER_ACTION_FILE.test(file) && /^\s*['"]use server['"]\s*;/m.test(source);
}

function gateAppCompositionFile(root, rel, fach, findings) {
  const prefix = `src/app/${fach}/`;
  if (!rel.startsWith(prefix)) return false;
  const nested = rel.slice(prefix.length);
  const basename = path.posix.basename(nested);
  const isEntrypoint = NEXT_COMPOSITION_ENTRYPOINTS.has(basename);
  const isDirectAdapter = !nested.includes("/") && APP_ADAPTER_NAME.test(basename);
  if (!isEntrypoint && !isDirectAdapter) return false;

  const source = readFileSync(path.join(root, rel), "utf8");
  const imports = importSources(source);
  const moduleFacade = `${MODULES_DIR}/${fach}/public`;
  const adapterRoot = `src/app/${fach}/`;
  let hasCompositionSeam = false;
  for (const { spec, index } of imports) {
    const target = resolveSpec(rel, spec);
    if (target === moduleFacade) {
      hasCompositionSeam = true;
      continue;
    }
    if (isEntrypoint && target?.startsWith(adapterRoot) && APP_ADAPTER_NAME.test(path.posix.basename(target) + ".tsx")) {
      hasCompositionSeam = true;
      continue;
    }
    if (isEntrypoint && target) {
      findings.push(`[naht1] ${rel}:${lineOf(source, index)}: Next-Entrypoint darf lokalen Code nur ueber @/modules/${fach}/public oder einen direkten *AppAdapter.tsx komponieren ('${spec}')`);
    }
    if (isDirectAdapter && ADAPTER_FORBIDDEN_IMPORT.test(spec)) {
      findings.push(`[naht1] ${rel}:${lineOf(source, index)}: AppAdapter darf keine DB-, Repository-, Command-Implementierung oder Navigation importieren ('${spec}')`);
    }
  }
  if (!hasCompositionSeam) {
    findings.push(`[naht1] ${rel}: App-Kompositionsdatei muss @/modules/${fach}/public konsumieren oder ueber einen direkten *AppAdapter.tsx dorthin fuehren`);
  }
  if (isDirectAdapter) {
    for (const match of source.matchAll(ROUTE_LITERAL)) {
      if (match[1] !== `/${fach}`) {
        findings.push(`[naht1] ${rel}:${lineOf(source, match.index)}: AppAdapter darf nur den festen eigenen Deeplink-Fallback '/${fach}' kennen, keinen generischen Router-/URL-Tunnel ('${match[1]}')`);
      }
    }
  }
  return true;
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
    const serverPublicRel = `${MODULES_DIR}/${fach}/server-public.ts`;
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
    const schemaErrors = validateAgainstSchema(manifest, schema);
    for (const err of schemaErrors) findings.push(`[naht1] ${manifestRel}: ${err}`);
    if (manifest === null || typeof manifest !== "object" || Array.isArray(manifest)) continue; // Rest waere Folgefehler
    if (manifest.moduleId !== fach) findings.push(`[naht1] ${manifestRel}: moduleId '${manifest.moduleId}' != Ordnername '${fach}'`);
    if (existsSync(path.join(root, MODULES_DIR, fach, "public"))) {
      findings.push(`[naht1] ${MODULES_DIR}/${fach}/public: Ordner 'public/' verboten — die Fassade ist genau die Datei public.ts`);
    }
    if (!existsSync(path.join(root, publicRel))) {
      findings.push(`[naht1] ${publicRel}: positive Fassade public.ts fehlt`);
    } else {
      const publicSource = readFileSync(path.join(root, publicRel), "utf8");
      if (STAR_REEXPORT.test(publicSource)) {
        findings.push(`[naht1] ${publicRel}: 'export * from' verboten — Fassade ist eine explizite Liste (publicExports)`);
      }
      const publicViolation = clientFacadeViolation(root, publicRel);
      if (publicViolation) {
        findings.push(`[naht1] ${publicRel}: Client-Fassade ist nicht browser-sicher (${publicViolation})`);
      }
      const facadeExports = new Map([["public", exportedSymbols(publicSource)]]);
      if (existsSync(path.join(root, serverPublicRel))) {
        const serverPublicSource = readFileSync(path.join(root, serverPublicRel), "utf8");
        if (!/^\s*import\s+['"]server-only['"]\s*;/m.test(serverPublicSource)) {
          findings.push(`[naht1] ${serverPublicRel}: Server-Fassade muss direkt 'server-only' importieren`);
        }
        if (STAR_REEXPORT.test(serverPublicSource)) {
          findings.push(`[naht1] ${serverPublicRel}: 'export * from' verboten — Server-Fassade ist eine explizite Liste (publicExports)`);
        }
        facadeExports.set("server-public", exportedSymbols(serverPublicSource));
      }
      for (const entry of asStringArray(manifest.publicExports)) {
        const m = entry.match(/^@\/modules\/([^/#]+)\/(public|server-public)#([A-Za-z_$][\w$]*)$/);
        if (!m || m[1] !== fach) {
          findings.push(`[naht1] ${manifestRel}: publicExports '${entry}' muss '@/modules/${fach}/public#Symbol' sein oder '@/modules/${fach}/server-public#Symbol'`);
        } else if (!facadeExports.has(m[2])) {
          findings.push(`[naht1] ${manifestRel}: publicExports '${entry}' verweist auf fehlende Fassade ${m[2]}.ts`);
        } else if (!facadeExports.get(m[2]).has(m[3])) {
          findings.push(`[naht1] ${MODULES_DIR}/${fach}/${m[2]}.ts: exportiert '${m[3]}' nicht, steht aber in publicExports`);
        }
      }
    }
    for (const dep of asStringArray(manifest.dependencies)) {
      if (!modules.includes(dep)) findings.push(`[naht1] ${manifestRel}: dependency '${dep}' ist kein Modul unter ${MODULES_DIR}/`);
      if (dep === fach) findings.push(`[naht1] ${manifestRel}: Modul haengt von sich selbst ab`);
    }
    // Ablage (Red-Team P2): jedes Pfadsegment == fach (case-insensitive) unter den
    // Legacy-Eltern, plus Datei <fach>.ts(x) direkt darunter.
    for (const parent of LEGACY_DOMAIN_PARENTS) {
      for (const rel of walk(root, parent, [])) {
        const segments = rel.split("/").slice(parent.split("/").length);
        const dirs = segments.slice(0, -1);
        const file = segments.at(-1) ?? "";
        const dirHit = dirs.find((d) => d.replace(/^[([]|[)\]]$/g, "").toLowerCase() === fach);
        const fileHit = dirs.length === 0 && file.replace(/\.[cm]?[jt]sx?$/, "").toLowerCase() === fach;
        if ((dirHit || fileHit) && !(parent === "src/app" && gateAppCompositionFile(root, rel, fach, findings))) {
          findings.push(`[naht1] ${rel}: Fach '${fach}' hat ein Modul, darf nicht mehr ausserhalb ${MODULES_DIR}/${fach}/ liegen`);
        }
      }
    }
    manifests.set(fach, manifest);
  }
  // ownsTables eindeutig (Red-Team P1): eine Tabelle gehoert genau EINEM Modul.
  const owners = new Map();
  for (const [fach, manifest] of manifests) {
    for (const t of asStringArray(manifest.ownsTables)) {
      const key = t.toLowerCase();
      if (owners.has(key)) findings.push(`[naht1] ${MODULES_DIR}/${fach}/${fach}.manifest.json: ownsTables '${t}' gehoert bereits Modul '${owners.get(key)}'`);
      else owners.set(key, fach);
    }
  }
  return { modules, manifests };
}

// ── Naht 2: Positive Fassade / Tiefimport-Verbot ─────────────────────────────

// tsconfig paths (Red-Team P1): das Gate loest nur "@/" auf. Jeder weitere Alias waere ein
// unsichtbarer Importpfad -> verboten. Erlaubt ist exakt {"@/*": ["./src/*"]}.
function gateTsconfigAliases(root, findings) {
  const tsconfigAbs = path.join(root, "tsconfig.json");
  if (!existsSync(tsconfigAbs)) return;
  let paths;
  try {
    paths = readJson(tsconfigAbs)?.compilerOptions?.paths ?? {};
  } catch {
    findings.push("[naht2] tsconfig.json: kein gueltiges JSON");
    return;
  }
  for (const [alias, targets] of Object.entries(paths)) {
    const ok = alias === "@/*" && Array.isArray(targets) && targets.length === 1 && /^\.\/src\/\*$/.test(targets[0]);
    if (!ok) findings.push(`[naht2] tsconfig.json: paths '${alias}' -> ${JSON.stringify(targets)} — nur "@/*": ["./src/*"] erlaubt (Gate loest nur @/ auf)`);
  }
}

function gateImports(root, findings) {
  gateTsconfigAliases(root, findings);
  for (const file of listCodeFiles(root, "src", findings)) {
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
      if (target === `${MODULES_DIR}/${targetModule}/public`) continue;
      if (target === `${MODULES_DIR}/${targetModule}/server-public`) {
        if (!allowedServerFacadeConsumer(file, source)) {
          findings.push(`[naht2] ${where}: Server-Fassade '${spec}' darf nur eine 'use server'-App-Action oder ein Real-DB-Integrationstest konsumieren`);
        }
        continue;
      }
      if (target !== `${MODULES_DIR}/${targetModule}/public`) {
        findings.push(`[naht2] ${where}: Tiefimport '${spec}' — Fremdmodul '${targetModule}' nur ueber @/modules/${targetModule}/public`);
      }
    }
  }
}

// ── Naht 4: Cross-Modul-Fakten nur ueber v_*-Views ───────────────────────────

// Roh-SQL: schema-qualifiziert, optional mit "-Quoting. Supabase-Client: .from('tabelle')
// zaehlt als public.tabelle. Bewusst NICHT erfasst (Design-Grenze, in ARCHITEKTUR §2
// dokumentiert): unqualifizierte Tabellennamen, Drizzle-Tabellenobjekte, interpolierte Namen.
const SQL_TABLE_REF = /\b(?:from|join|into|update|table|only|truncate)\s+"?(public|private)"?\."?([a-z_][a-z0-9_]*)"?/gi;
const SUPABASE_FROM = /(?<!storage)\.from\s*\(\s*['"`]([a-z_][a-z0-9_]*)['"`]\s*\)/gi; // storage.from(bucket) ist keine Tabelle

function tableRefs(source) {
  const refs = [];
  for (const m of source.matchAll(SQL_TABLE_REF)) refs.push({ ref: `${m[1]}.${m[2]}`.toLowerCase(), index: m.index });
  for (const m of source.matchAll(SUPABASE_FROM)) refs.push({ ref: `public.${m[1]}`.toLowerCase(), index: m.index });
  return refs;
}

function gateData(root, findings, manifests) {
  const declaredViews = new Set();
  for (const manifest of manifests.values()) {
    for (const v of asStringArray(manifest.viewsFunctions)) if (/^public\.v_/i.test(v)) declaredViews.add(v.toLowerCase());
  }
  for (const [fach, manifest] of manifests) {
    const owned = new Set(asStringArray(manifest.ownsTables).map((t) => t.toLowerCase()));
    const ownedViewsFunctions = new Set(asStringArray(manifest.viewsFunctions).map((t) => t.toLowerCase()));
    for (const file of listFiles(root, `${MODULES_DIR}/${fach}`, SQL_EXTENSIONS)) {
      const source = readFileSync(path.join(root, file), "utf8");
      for (const m of tableRefs(source)) {
        const ref = m.ref;
        if (owned.has(ref) || ownedViewsFunctions.has(ref)) continue;
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

function readBaseline(absPath, findings) {
  const empty = { uiContract: { allowedLegacyFiles: [] } };
  if (!existsSync(absPath)) return empty;
  try {
    const parsed = readJson(absPath);
    const files = parsed?.uiContract?.allowedLegacyFiles;
    if (!Array.isArray(files) || files.some((f) => typeof f !== "string")) {
      findings.push(`[naht5] ${toPosix(absPath)}: uiContract.allowedLegacyFiles muss ein String-Array sein`);
      return empty;
    }
    return parsed;
  } catch (error) {
    findings.push(`[naht5] ${toPosix(absPath)}: kein gueltiges JSON (${error.message})`);
    return empty;
  }
}

/**
 * @param {string} root
 * @param {{ baseBaselinePath?: string | null, schemaPath?: string | null }} [options]
 * @returns {{ ok: boolean, findings: string[] }}
 */
export function runModuleGates(root, { baseBaselinePath = null, schemaPath = null } = {}) {
  const findings = [];
  const baseline = readBaseline(path.join(root, BASELINE_PATH), findings);
  const baseBaseline = baseBaselinePath ? readBaseline(baseBaselinePath, findings) : null;
  const { manifests } = gateManifests(root, findings, schemaPath);
  gateImports(root, findings);
  gateData(root, findings, manifests);
  gateUi(root, findings, baseline, baseBaseline);
  gateAgents(root, findings);
  if (existsSync(path.join(root, "quality/authoritative-sources.json"))) {
    for (const finding of checkAuthorityRepository(root)) findings.push(`[authority] ${finding}`);
  } else if (existsSync(path.join(root, "package.json"))) {
    findings.push("[authority] AUTHORITY_CONFIG_PATH_MISSING:quality/authoritative-sources.json");
  }
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
    console.log("module-gates: alle Naehte halten (Manifest, Fassade, v_*-Daten, UI-Vertrag, AGENTS, Authority).");
  } else {
    console.error(`module-gates: ${result.findings.length} Verstoss/Verstoesse`);
    for (const f of result.findings) console.error("  " + f);
    process.exitCode = 1;
  }
}
