import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const MANIFEST_PATH = "scripts/migration-ledger-manifest.txt";
const MIGRATIONS_DIR = "supabase/migrations";
const FILE_PATTERN = /^(\d+)_([a-z0-9_]+)\.sql$/;
const MANIFEST_PATTERN = /^(\d+)\|([a-z0-9_]+)\|([a-f0-9]{32})$/;

function versionKey(version) {
  return version.length >= 8 ? version.padEnd(14, "0") : version.padStart(14, "0");
}

function compareVersions(left, right) {
  const leftKey = versionKey(left);
  const rightKey = versionKey(right);
  if (leftKey < rightKey) return -1;
  if (leftKey > rightKey) return 1;
  return 0;
}

function parseArgs(argv) {
  const args = { root: process.cwd(), base: null };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--root") {
      args.root = argv[index + 1];
      index += 1;
    } else if (argument === "--base") {
      args.base = argv[index + 1];
      index += 1;
    } else {
      throw new Error(`Unbekanntes Argument: ${argument}`);
    }
  }

  return args;
}

function parseManifest(content, source) {
  const entries = [];
  const versions = new Set();
  const names = new Set();

  for (const [index, rawLine] of content.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = MANIFEST_PATTERN.exec(line);
    if (!match) {
      throw new Error(`${source}:${index + 1}: ungueltige Manifestzeile`);
    }

    const [, version, name, statementsMd5] = match;
    if (versions.has(version)) {
      throw new Error(`${source}:${index + 1}: doppelte Version ${version}`);
    }
    if (names.has(name)) {
      throw new Error(`${source}:${index + 1}: doppelter Migrationsname ${name}`);
    }

    versions.add(version);
    names.add(name);
    entries.push({ version, name, statementsMd5, line });
  }

  const sorted = [...entries].sort((left, right) =>
    compareVersions(left.version, right.version),
  );
  if (entries.some((entry, index) => entry !== sorted[index])) {
    throw new Error(`${source}: Eintraege sind nicht aufsteigend nach Version sortiert`);
  }

  return entries;
}

function readBaseManifest(root, base) {
  if (!base) return null;

  try {
    return execFileSync("git", ["show", `${base}:${MANIFEST_PATH}`], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    return null;
  }
}

const { root, base } = parseArgs(process.argv.slice(2));
const manifestFile = path.join(root, MANIFEST_PATH);
const migrationsDirectory = path.join(root, MIGRATIONS_DIR);
const manifest = parseManifest(await readFile(manifestFile, "utf8"), MANIFEST_PATH);
const manifestByFile = new Map(
  manifest.map((entry) => [`${entry.version}_${entry.name}.sql`, entry]),
);
const appliedNames = new Set(manifest.map((entry) => entry.name));

const migrationFiles = (await readdir(migrationsDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
  .map((entry) => entry.name)
  .sort();

const localVersions = new Set();
const localNames = new Set();
for (const file of migrationFiles) {
  const match = FILE_PATTERN.exec(file);
  if (!match) throw new Error(`${MIGRATIONS_DIR}/${file}: ungueltiger Dateiname`);

  const [, version, name] = match;
  if (localVersions.has(version)) {
    throw new Error(`${MIGRATIONS_DIR}: doppelte lokale Version ${version}`);
  }
  if (localNames.has(name)) {
    throw new Error(`${MIGRATIONS_DIR}: doppelter lokaler Migrationsname ${name}`);
  }
  localVersions.add(version);
  localNames.add(name);
}

const missingApplied = [...manifestByFile.keys()].filter(
  (file) => !migrationFiles.includes(file),
);
if (missingApplied.length > 0) {
  throw new Error(`Angewandte Production-Quellen fehlen lokal: ${missingApplied.join(", ")}`);
}

const maxAppliedVersion = manifest.at(-1)?.version;
const pending = migrationFiles.filter((file) => !manifestByFile.has(file));
for (const file of pending) {
  const [, version, name] = FILE_PATTERN.exec(file);
  if (maxAppliedVersion && compareVersions(version, maxAppliedVersion) <= 0) {
    throw new Error(
      `Lokale Altversion ist nicht im Production-Ledger: ${file} (max. angewandt ${maxAppliedVersion})`,
    );
  }
  if (appliedNames.has(name)) {
    throw new Error(`Lokale Migration dupliziert angewandten Namen: ${file}`);
  }
}

const baseContent = readBaseManifest(root, base);
if (baseContent) {
  const baseManifest = parseManifest(baseContent, `${base}:${MANIFEST_PATH}`);
  const currentLines = new Set(manifest.map((entry) => entry.line));
  const rewritten = baseManifest.filter((entry) => !currentLines.has(entry.line));
  if (rewritten.length > 0) {
    throw new Error(
      `Angewandte Ledger-Eintraege wurden entfernt oder umgeschrieben: ${rewritten
        .map((entry) => entry.version)
        .join(", ")}`,
    );
  }
}

console.log(`MIGRATION_LEDGER_APPLIED=${manifest.length}`);
console.log(`MIGRATION_FILES_LOCAL=${migrationFiles.length}`);
console.log(`MIGRATION_FILES_PENDING=${pending.length}`);
if (pending.length > 0) console.log(`PENDING_MIGRATIONS=${pending.join(",")}`);
console.log("MIGRATION_LEDGER_CONTRACT=PASS");
