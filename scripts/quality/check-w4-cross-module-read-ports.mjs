#!/usr/bin/env node

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const INVENTORY_PATH = "docs/evidence/f0/W4_CROSS_MODULE_READ_PORT_INVENTORY.json";
const SELFTEST = process.argv.includes("--selftest");

function normalize(filePath) {
  return filePath.split(path.sep).join("/");
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label}: object required`);
  }
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  if (actual.length !== sortedExpected.length || actual.some((key, index) => key !== sortedExpected[index])) {
    throw new Error(`${label}: exact keys required (${sortedExpected.join(", ")})`);
  }
}

function sortedUniqueStrings(value, label) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || entry.length === 0)) {
    throw new Error(`${label}: non-empty string array required`);
  }
  const sorted = [...value].sort();
  if (new Set(value).size !== value.length || value.some((entry, index) => entry !== sorted[index])) {
    throw new Error(`${label}: values must be unique and sorted`);
  }
  return value;
}

function validatePortMap(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label}: object required`);
  const keys = Object.keys(value);
  if (keys.some((key, index) => key !== [...keys].sort()[index])) throw new Error(`${label}: paths must be sorted`);
  for (const [file, relations] of Object.entries(value)) {
    if (!file.startsWith("src/") || file.includes("\\")) throw new Error(`${label}: invalid path ${file}`);
    sortedUniqueStrings(relations, `${label}.${file}`);
  }
  return value;
}

function parseInventory(raw) {
  const inventory = JSON.parse(raw);
  exactKeys(inventory, [
    "schemaVersion",
    "contract",
    "productionSourceRoot",
    "excludedPathSegments",
    "baseRelations",
    "readPorts",
    "commandOwners",
    "declarations",
    "forbiddenProductionViewReferences",
    "migrationContract",
  ], "inventory");
  if (inventory.schemaVersion !== 1 || inventory.contract !== "W4-08" || inventory.productionSourceRoot !== "src") {
    throw new Error("inventory: unsupported identity");
  }
  sortedUniqueStrings(inventory.excludedPathSegments, "excludedPathSegments");
  sortedUniqueStrings(inventory.baseRelations, "baseRelations");
  sortedUniqueStrings(inventory.forbiddenProductionViewReferences, "forbiddenProductionViewReferences");
  validatePortMap(inventory.readPorts, "readPorts");
  validatePortMap(inventory.commandOwners, "commandOwners");
  validatePortMap(inventory.declarations, "declarations");
  exactKeys(inventory.migrationContract, ["path", "requiredSecurityInvokerViews", "requiredLegacySource"], "migrationContract");
  sortedUniqueStrings(inventory.migrationContract.requiredSecurityInvokerViews, "requiredSecurityInvokerViews");
  if (
    typeof inventory.migrationContract.path !== "string"
    || !inventory.migrationContract.path.startsWith("supabase/migrations/")
    || typeof inventory.migrationContract.requiredLegacySource !== "string"
  ) throw new Error("migrationContract: invalid values");
  return inventory;
}

function collectSourceFiles(directory, excludedSegments, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    const relative = normalize(path.relative(ROOT, fullPath));
    if (excludedSegments.some((segment) => `/${relative}/`.includes(segment))) continue;
    if (entry.isDirectory()) collectSourceFiles(fullPath, excludedSegments, files);
    else if (/\.(?:ts|tsx)$/.test(entry.name)) files.push(relative);
  }
  return files;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsRelation(content, relation) {
  return new RegExp(`(?<![A-Za-z0-9_])${escapeRegex(relation)}(?![A-Za-z0-9_])`).test(content);
}

function validateSources(inventory, sources) {
  const failures = [];
  const expectedByFile = new Map();
  for (const mapName of ["readPorts", "commandOwners", "declarations"]) {
    for (const [file, relations] of Object.entries(inventory[mapName])) {
      const expected = expectedByFile.get(file) ?? new Set();
      for (const relation of relations) expected.add(relation);
      expectedByFile.set(file, expected);
    }
  }
  const knownViews = new Set([
    ...Object.values(inventory.readPorts).flat(),
    ...inventory.forbiddenProductionViewReferences,
  ]);
  const knownRelations = [...new Set([...inventory.baseRelations, ...knownViews])].sort();

  for (const [file, content] of sources) {
    const actual = new Set(knownRelations.filter((relation) => containsRelation(content, relation)));
    const allowedBase = new Set([
      ...(inventory.commandOwners[file] ?? []),
      ...(inventory.declarations[file] ?? []),
    ]);
    const allowedViews = new Set(inventory.readPorts[file] ?? []);
    for (const relation of actual) {
      if (inventory.baseRelations.includes(relation) && !allowedBase.has(relation)) {
        failures.push(`${file}: base relation bypass ${relation}`);
      }
      if (knownViews.has(relation) && !allowedViews.has(relation)) {
        failures.push(`${file}: undeclared view port ${relation}`);
      }
      if (inventory.forbiddenProductionViewReferences.includes(relation)) {
        failures.push(`${file}: superseded view ${relation}`);
      }
    }
    const discoveredViews = content.match(/private\.v_[a-z0-9_]+/g) ?? [];
    for (const view of new Set(discoveredViews)) {
      if (!/_v[1-9][0-9]*$/.test(view)) failures.push(`${file}: unversioned private view ${view}`);
      if (!knownViews.has(view)) failures.push(`${file}: view missing from inventory ${view}`);
    }
  }

  for (const [file, expected] of expectedByFile) {
    const content = sources.get(file);
    if (content === undefined) {
      failures.push(`${file}: declared source missing`);
      continue;
    }
    for (const relation of expected) {
      if (!containsRelation(content, relation)) failures.push(`${file}: declared relation missing ${relation}`);
    }
  }
  return failures;
}

function validateMigration(inventory, content) {
  const failures = [];
  for (const view of inventory.migrationContract.requiredSecurityInvokerViews) {
    const pattern = new RegExp(
      `CREATE\\s+VIEW\\s+${escapeRegex(view)}\\s+WITH\\s*\\(\\s*security_invoker\\s*=\\s*true\\s*\\)`,
      "i",
    );
    if (!pattern.test(content)) failures.push(`migration: security_invoker view missing ${view}`);
  }
  if (!containsRelation(content, inventory.migrationContract.requiredLegacySource)) {
    failures.push(`migration: legacy source missing ${inventory.migrationContract.requiredLegacySource}`);
  }
  if (/\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|TRUNCATE)\s+public\.scan_uploads\b/i.test(content)) {
    failures.push("migration: legacy adapter mutates public.scan_uploads");
  }
  return failures;
}

function runSelftest(inventory) {
  const positive = new Map();
  for (const portMap of [inventory.readPorts, inventory.commandOwners, inventory.declarations]) {
    for (const [file, relations] of Object.entries(portMap)) {
      positive.set(file, [positive.get(file) ?? "", ...relations].join("\n"));
    }
  }
  const positiveFailures = validateSources(inventory, positive);
  if (positiveFailures.length) throw new Error(`selftest positive failed: ${positiveFailures.join(" | ")}`);

  const cases = [
    ["base-bypass", new Map([...positive, ["src/app/consumer.ts", "private.order_station_evidence"]])],
    ["unversioned-view", new Map([...positive, ["src/app/consumer.ts", "private.v_evidence_records"]])],
    ["forbidden-v1", new Map([...positive, ["src/lib/server/orderStationAttachment.ts", "private.v_order_station_evidence_receipts_v1"]])],
    ["missing-declared", new Map([...positive].filter(([file]) => file !== "src/lib/server/evidenceRead.ts"))],
  ];
  for (const [label, fixture] of cases) {
    if (validateSources(inventory, fixture).length === 0) throw new Error(`selftest negative did not fire: ${label}`);
  }
  const migrationPositive = inventory.migrationContract.requiredSecurityInvokerViews
    .map((view) => `CREATE VIEW ${view} WITH (security_invoker = true) AS SELECT 1;`)
    .join("\n") + `\nSELECT * FROM ${inventory.migrationContract.requiredLegacySource};`;
  if (validateMigration(inventory, migrationPositive).length) throw new Error("selftest migration positive failed");
  if (validateMigration(inventory, `${migrationPositive}\nUPDATE public.scan_uploads SET id=id;`).length === 0) {
    throw new Error("selftest legacy mutation did not fire");
  }
  console.log("W4_READ_PORT_SELFTEST=PASS cases=6");
}

const inventory = parseInventory(readFileSync(path.join(ROOT, INVENTORY_PATH), "utf8"));
if (SELFTEST) {
  runSelftest(inventory);
  process.exit(0);
}

const files = collectSourceFiles(
  path.join(ROOT, inventory.productionSourceRoot),
  inventory.excludedPathSegments,
).sort();
const sources = new Map(files.map((file) => [file, readFileSync(path.join(ROOT, file), "utf8")]));
const migration = readFileSync(path.join(ROOT, inventory.migrationContract.path), "utf8");
const failures = [...validateSources(inventory, sources), ...validateMigration(inventory, migration)];
if (failures.length) {
  console.error("W4_READ_PORT_CONTRACT=FAIL");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`W4_READ_PORT_CONTRACT=PASS files=${files.length} read_ports=${Object.keys(inventory.readPorts).length}`);
