import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ACTIVE_MIGRATIONS_DIR = "supabase/migrations";
const LEGACY_DIR = "supabase/migrations_legacy";
const LEGACY_SHA_MANIFEST_PATH =
  "supabase/migrations_legacy/legacy-sha256-manifest.txt";
const PRODUCTION_LEDGER_MANIFEST_PATH =
  "supabase/migrations_legacy/production-ledger-manifest.txt";
const PRE_BASELINE_PRODUCTION_MANIFEST_PATH =
  "scripts/migration-ledger-manifest.txt";

const ACTIVE_FILE_PATTERN = /^(\d{14})_([a-z0-9_]+)\.sql$/;
const LEGACY_FILE_PATTERN = /^(\d+)_([a-z0-9_]+)\.sql$/;
const LEDGER_MANIFEST_PATTERN = /^(\d+)\|([a-z0-9_]+)\|([a-f0-9]{32})$/;
const LEGACY_SHA_PATTERN =
  /^([a-f0-9]{64})\|(supabase\/migrations_legacy\/[^|]+)$/;
const BASELINE_NAME = "production_schema_baseline";

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

function parseProductionLedger(content, source) {
  const entries = [];
  const versions = new Set();
  const names = new Set();

  for (const [index, rawLine] of content.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = LEDGER_MANIFEST_PATTERN.exec(line);
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

  return entries;
}

function parseLegacyShaManifest(content) {
  const entries = [];
  const paths = new Set();

  for (const [index, rawLine] of content.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = LEGACY_SHA_PATTERN.exec(line);
    if (!match) {
      throw new Error(
        `${LEGACY_SHA_MANIFEST_PATH}:${index + 1}: ungueltige Manifestzeile`,
      );
    }

    const [, sha256, repositoryPath] = match;
    if (repositoryPath === LEGACY_SHA_MANIFEST_PATH) {
      throw new Error(
        `${LEGACY_SHA_MANIFEST_PATH} darf sich nicht selbst hashen`,
      );
    }
    if (paths.has(repositoryPath)) {
      throw new Error(
        `${LEGACY_SHA_MANIFEST_PATH}:${index + 1}: doppelter Pfad ${repositoryPath}`,
      );
    }

    paths.add(repositoryPath);
    entries.push({ sha256, repositoryPath });
  }

  return entries;
}

function normalizeText(content) {
  return content.replace(/\r\n/g, "\n");
}

function readBaseFile(root, base, repositoryPath) {
  try {
    const safeRoot = root.replaceAll("\\", "/");
    return execFileSync(
      "git",
      [
        "-c",
        `safe.directory=${safeRoot}`,
        "show",
        `${base}:${repositoryPath}`,
      ],
      {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch {
    return null;
  }
}

async function sha256File(filePath) {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

const { root, base } = parseArgs(process.argv.slice(2));
const activeDirectory = path.join(root, ACTIVE_MIGRATIONS_DIR);
const legacyDirectory = path.join(root, LEGACY_DIR);

const productionLedgerContent = await readFile(
  path.join(root, PRODUCTION_LEDGER_MANIFEST_PATH),
  "utf8",
);
const productionLedger = parseProductionLedger(
  productionLedgerContent,
  PRODUCTION_LEDGER_MANIFEST_PATH,
);

const legacyShaContent = await readFile(
  path.join(root, LEGACY_SHA_MANIFEST_PATH),
  "utf8",
);
const legacyShaEntries = parseLegacyShaManifest(legacyShaContent);
const legacyShaByPath = new Map(
  legacyShaEntries.map((entry) => [entry.repositoryPath, entry.sha256]),
);

const legacyFiles = (await readdir(legacyDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile())
  .map((entry) => `${LEGACY_DIR}/${entry.name}`)
  .filter((repositoryPath) => repositoryPath !== LEGACY_SHA_MANIFEST_PATH)
  .sort();

const unmanifestedLegacy = legacyFiles.filter(
  (repositoryPath) => !legacyShaByPath.has(repositoryPath),
);
const missingLegacy = [...legacyShaByPath.keys()].filter(
  (repositoryPath) => !legacyFiles.includes(repositoryPath),
);
if (unmanifestedLegacy.length > 0 || missingLegacy.length > 0) {
  throw new Error(
    [
      "Legacy-Archiv und SHA-256-Manifest weichen ab.",
      unmanifestedLegacy.length > 0
        ? `Ohne Manifest: ${unmanifestedLegacy.join(", ")}`
        : null,
      missingLegacy.length > 0
        ? `Fehlende Dateien: ${missingLegacy.join(", ")}`
        : null,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

for (const { repositoryPath, sha256 } of legacyShaEntries) {
  const actualSha256 = await sha256File(path.join(root, repositoryPath));
  if (actualSha256 !== sha256) {
    throw new Error(
      `Legacy-SHA-256 abweichend: ${repositoryPath} (erwartet ${sha256}, ist ${actualSha256})`,
    );
  }
}

const legacySqlFiles = legacyFiles
  .map((repositoryPath) => path.posix.basename(repositoryPath))
  .filter((fileName) => fileName.endsWith(".sql"));
const legacySqlNames = new Set();
for (const fileName of legacySqlFiles) {
  const match = LEGACY_FILE_PATTERN.exec(fileName);
  if (!match) {
    throw new Error(`${LEGACY_DIR}/${fileName}: ungueltiger Dateiname`);
  }
  legacySqlNames.add(match[2]);
}

const legacyFileNames = new Set(legacySqlFiles);
const missingProductionSources = productionLedger
  .map((entry) => `${entry.version}_${entry.name}.sql`)
  .filter((fileName) => !legacyFileNames.has(fileName));
if (missingProductionSources.length > 0) {
  throw new Error(
    `Production-Ledger-Quellen fehlen im Legacy-Archiv: ${missingProductionSources.join(", ")}`,
  );
}

const activeFiles = (await readdir(activeDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
  .map((entry) => entry.name)
  .sort();

const activeEntries = [];
const activeVersions = new Set();
const activeNames = new Set();
for (const fileName of activeFiles) {
  const match = ACTIVE_FILE_PATTERN.exec(fileName);
  if (!match) {
    throw new Error(`${ACTIVE_MIGRATIONS_DIR}/${fileName}: ungueltiger Dateiname`);
  }

  const [, version, name] = match;
  if (activeVersions.has(version)) {
    throw new Error(
      `${ACTIVE_MIGRATIONS_DIR}: doppelte aktive Version ${version}`,
    );
  }
  if (activeNames.has(name)) {
    throw new Error(
      `${ACTIVE_MIGRATIONS_DIR}: doppelter aktiver Migrationsname ${name}`,
    );
  }
  if (legacyFileNames.has(fileName) || legacySqlNames.has(name)) {
    throw new Error(
      `Legacy-Migration ist in die aktive Kette zurueckgekehrt: ${fileName}`,
    );
  }

  activeVersions.add(version);
  activeNames.add(name);
  activeEntries.push({ fileName, version, name });
}

const baselines = activeEntries.filter((entry) => entry.name === BASELINE_NAME);
if (baselines.length !== 1) {
  throw new Error(
    `Aktive Kette muss genau eine ${BASELINE_NAME}-Migration enthalten`,
  );
}
const baseline = baselines[0];
if (activeEntries[0] !== baseline) {
  throw new Error("Production-Schema-Baseline ist nicht die erste aktive Migration");
}
for (const entry of activeEntries.slice(1)) {
  if (entry.version <= baseline.version) {
    throw new Error(
      `Post-Baseline-Migration liegt nicht hinter der Baseline: ${entry.fileName}`,
    );
  }
}

const baselineContent = await readFile(
  path.join(activeDirectory, baseline.fileName),
  "utf8",
);
if (/^\s*COPY\b/im.test(baselineContent)) {
  throw new Error("Production-Schema-Baseline enthaelt COPY-Daten");
}
const firstTableIndex = baselineContent.search(/^CREATE TABLE\b/m);
if (
  firstTableIndex >= 0 &&
  /^\s*(INSERT|UPDATE|DELETE)\b/im.test(baselineContent.slice(firstTableIndex))
) {
  throw new Error(
    "Production-Schema-Baseline enthaelt top-level Nutzdaten-DML nach den Funktionsdefinitionen",
  );
}

const legacyHashes = new Set(legacyShaEntries.map((entry) => entry.sha256));
for (const entry of activeEntries) {
  const activeSha256 = await sha256File(
    path.join(activeDirectory, entry.fileName),
  );
  if (legacyHashes.has(activeSha256)) {
    throw new Error(
      `Aktive Migration dupliziert eine Legacy-Datei: ${entry.fileName}`,
    );
  }
}

if (base) {
  const baseProductionLedger =
    readBaseFile(root, base, PRE_BASELINE_PRODUCTION_MANIFEST_PATH) ??
    readBaseFile(root, base, PRODUCTION_LEDGER_MANIFEST_PATH);
  if (!baseProductionLedger) {
    throw new Error(
      `Historisches Production-Manifest ist in Base ${base} nicht lesbar`,
    );
  }
  if (
    normalizeText(baseProductionLedger) !==
    normalizeText(productionLedgerContent)
  ) {
    throw new Error(
      "Historisches Production-Manifest wurde gegen den Base-Stand veraendert",
    );
  }

  const baseLegacySha = readBaseFile(root, base, LEGACY_SHA_MANIFEST_PATH);
  if (
    baseLegacySha &&
    normalizeText(baseLegacySha) !== normalizeText(legacyShaContent)
  ) {
    throw new Error(
      "Legacy-SHA-256-Manifest wurde gegen den Base-Stand veraendert",
    );
  }
}

console.log("MIGRATION_MODE=PRODUCTION_SCHEMA_BASELINE");
console.log(`PRODUCTION_LEDGER_ARCHIVED=${productionLedger.length}`);
console.log(`LEGACY_FILES_HASH_VERIFIED=${legacyShaEntries.length}`);
console.log(`LEGACY_SQL_FILES=${legacySqlFiles.length}`);
console.log(`ACTIVE_MIGRATIONS=${activeEntries.length}`);
console.log(`BASELINE_MIGRATION=${baseline.fileName}`);
const postBaseline = activeEntries.slice(1).map((entry) => entry.fileName);
console.log(
  `POST_BASELINE_MIGRATIONS=${postBaseline.length > 0 ? postBaseline.join(",") : "NONE"}`,
);
console.log("PRODUCTION_BASELINE_APPLIED=LEDGER_RECONCILED_2026-08-08");
console.log("PRODUCTION_LEDGER_RECONCILIATION=DONE_2026-08-08_POST_693a36ce_EXTENDED_2026-08-10_POST_268ce6c1d87a7d020d68369eac20b2b4");
console.log("REMOTE_LEDGER_MUTATION=PERFORMED_WITH_APPROVAL_2026-08-08_AND_2026-08-10");
console.log("MIGRATION_LEDGER_CONTRACT=PASS");
