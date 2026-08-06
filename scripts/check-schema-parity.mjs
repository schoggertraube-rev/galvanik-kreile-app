import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
const EXPECTED_PROJECT_REF = "syhaigjhsbpjmtnggqka";
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

const PAYLOAD_KEYS = new Map(
  Object.entries({
    relation: ["relation_type", "rls_enabled", "rls_forced"],
    column: [
      "type",
      "not_null",
      "default",
      "identity",
      "generated",
      "collation",
    ],
    constraint: ["type", "definition", "deferrable", "deferred", "validated"],
    index: ["definition", "unique", "primary", "valid", "ready"],
    view: ["relation_type", "definition", "options"],
    function: [
      "definition",
      "security_definer",
      "volatility",
      "parallel",
      "config",
    ],
    trigger: ["definition", "enabled"],
    policy: ["permissive", "roles", "command", "using", "with_check"],
    relation_grant: ["grantor", "grantable"],
    function_grant: ["grantor", "grantable"],
    default_privilege: ["grantor", "grantable"],
    extension: ["version", "schema"],
    storage_bucket: [
      "name",
      "public",
      "file_size_limit",
      "allowed_mime_types",
    ],
  }).map(([category, keys]) => [category, [...keys].sort()]),
);

function parseArgs(argv) {
  const args = {
    production: null,
    local: null,
    inventory: null,
    catalog: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--production") {
      args.production = argv[index + 1];
      index += 1;
    } else if (argument === "--local") {
      args.local = argv[index + 1];
      index += 1;
    } else if (argument === "--inventory") {
      args.inventory = argv[index + 1];
      index += 1;
    } else if (argument === "--catalog") {
      args.catalog = argv[index + 1];
      index += 1;
    } else {
      throw new Error(`Unbekanntes Argument: ${argument}`);
    }
  }

  if (!args.production || !args.local) {
    throw new Error("--production und --local sind erforderlich");
  }
  return args;
}

const DATABASE_DEFINITION_KEYS = new Set([
  "default",
  "definition",
  "using",
  "with_check",
]);

function normalizeDatabaseDefinition(value) {
  return value
    .replace(/[ \t]+$/gm, "")
    .replace(/\n+$/g, "")
    .replaceAll("::character varying::text", "::text")
    .replaceAll("::character varying", "::text")
    .replace(/\(('(?:''|[^'])*'::text)\)::text/g, "$1")
    .replace(
      /\((ARRAY\['(?:''|[^'])*'::text(?:,\s*'(?:''|[^'])*'::text)*\])\)::text\[\]/g,
      "$1",
    )
    .replace(
      /(ARRAY\['(?:''|[^'])*'::text(?:,\s*'(?:''|[^'])*'::text)*\])::text\[\]/g,
      "$1",
    );
}

function stableJson(value, propertyName = null) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item, propertyName)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key], key)}`)
      .join(",")}}`;
  }
  if (typeof value === "string" && DATABASE_DEFINITION_KEYS.has(propertyName)) {
    return JSON.stringify(normalizeDatabaseDefinition(value));
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertPayloadShape(filePath, row) {
  if (
    !Object.hasOwn(row, "payload") ||
    !row.payload ||
    typeof row.payload !== "object" ||
    Array.isArray(row.payload)
  ) {
    throw new Error(`${filePath}: ${row.category}|${row.object_key} ohne Objekt-Payload`);
  }
  const expectedKeys = PAYLOAD_KEYS.get(row.category);
  if (!expectedKeys) {
    throw new Error(`${filePath}: unbekannter Payload-Vertrag ${row.category}`);
  }
  const actualKeys = Object.keys(row.payload).sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    throw new Error(
      `${filePath}: Payload-Vertrag fuer ${row.category}|${row.object_key} verletzt`,
    );
  }
}

async function readInventory(filePath, catalogPath) {
  const parsed = JSON.parse(await readFile(filePath, "utf8"));
  if (
    parsed.schemaVersion !== 2 ||
    parsed.source?.projectRef !== EXPECTED_PROJECT_REF ||
    typeof parsed.source?.capturedAt !== "string" ||
    !Number.isFinite(Date.parse(parsed.source.capturedAt)) ||
    parsed.source?.scope !== "scripts/schema-parity-catalog.sql" ||
    parsed.source?.captureMethod !== "supabase-read-only-execute-sql" ||
    !Number.isInteger(parsed.totalEntries) ||
    parsed.totalEntries <= 0 ||
    !parsed.categoryEntries ||
    typeof parsed.categoryEntries !== "object" ||
    Array.isArray(parsed.categoryEntries) ||
    !SHA256_PATTERN.test(parsed.catalogSha256 ?? "") ||
    !SHA256_PATTERN.test(parsed.globalContentSha256 ?? "")
  ) {
    throw new Error(`${filePath}: ungueltiger Inventarvertrag`);
  }

  const categoryEntries = new Map();
  for (const [category, contract] of Object.entries(parsed.categoryEntries)) {
    if (
      !category ||
      !PAYLOAD_KEYS.has(category) ||
      !contract ||
      typeof contract !== "object" ||
      Array.isArray(contract) ||
      !Number.isInteger(contract.count) ||
      contract.count <= 0 ||
      !SHA256_PATTERN.test(contract.keySha256 ?? "") ||
      !SHA256_PATTERN.test(contract.contentSha256 ?? "")
    ) {
      throw new Error(
        `${filePath}: ungueltiger Sollvertrag fuer Kategorie ${category}`,
      );
    }
    categoryEntries.set(category, contract);
  }
  const categoryTotal = [...categoryEntries.values()].reduce(
    (sum, contract) => sum + contract.count,
    0,
  );
  if (categoryTotal !== parsed.totalEntries) {
    throw new Error(
      `${filePath}: Kategoriesumme ${categoryTotal} weicht von ` +
        `totalEntries ${parsed.totalEntries} ab`,
    );
  }

  const catalogContent = await readFile(catalogPath);
  const catalogSha256 = sha256(catalogContent);
  if (catalogSha256 !== parsed.catalogSha256) {
    throw new Error(
      `${catalogPath}: SHA-256 weicht vom Inventarvertrag ab; ` +
        "Katalogabfrage und Sollinventar muessen gemeinsam aktualisiert werden",
    );
  }

  return {
    totalEntries: parsed.totalEntries,
    categoryEntries,
    globalContentSha256: parsed.globalContentSha256,
  };
}

async function readCliSnapshot(filePath, inventory) {
  const content = await readFile(filePath, "utf8");
  const jsonStart = content.indexOf("{");
  const jsonEnd = content.lastIndexOf("}");
  if (jsonStart < 0 || jsonEnd < jsonStart) {
    throw new Error(`${filePath}: keine JSON-Ausgabe gefunden`);
  }

  const parsed = JSON.parse(content.slice(jsonStart, jsonEnd + 1));
  if (!Array.isArray(parsed.rows)) {
    throw new Error(`${filePath}: rows fehlt in CLI-Ausgabe`);
  }

  const entries = new Map();
  const categoryItems = new Map();
  for (const row of parsed.rows) {
    if (
      typeof row.category !== "string" ||
      row.category.length === 0 ||
      typeof row.object_key !== "string" ||
      row.object_key.length === 0
    ) {
      throw new Error(`${filePath}: ungueltige Snapshot-Zeile`);
    }
    if (!inventory.categoryEntries.has(row.category)) {
      throw new Error(`${filePath}: unerwartete Kategorie ${row.category}`);
    }
    assertPayloadShape(filePath, row);
    const key = `${row.category}\u0000${row.object_key}`;
    if (entries.has(key)) {
      throw new Error(
        `${filePath}: doppelter Snapshot-Schluessel ${row.category}|${row.object_key}`,
      );
    }
    const payload = stableJson(row.payload);
    entries.set(key, payload);
    if (!categoryItems.has(row.category)) {
      categoryItems.set(row.category, []);
    }
    categoryItems.get(row.category).push([row.object_key, payload]);
  }

  if (entries.size !== inventory.totalEntries) {
    throw new Error(
      `${filePath}: unvollstaendiger Katalog-Snapshot; erwartet exakt ` +
        `${inventory.totalEntries}, erhalten ${entries.size}`,
    );
  }

  const globalItems = [];
  const categoryCounts = new Map();
  for (const [category, expected] of inventory.categoryEntries) {
    const items = categoryItems.get(category) ?? [];
    items.sort(([left], [right]) => left.localeCompare(right));
    const actual = items.length;
    categoryCounts.set(category, actual);
    if (actual !== expected.count) {
      throw new Error(
        `${filePath}: Kategorie ${category} unvollstaendig; ` +
          `erwartet exakt ${expected.count}, erhalten ${actual}`,
      );
    }
    const keySha256 = sha256(JSON.stringify(items.map(([key]) => key)));
    if (keySha256 !== expected.keySha256) {
      throw new Error(
        `${filePath}: Objektinventar der Kategorie ${category} weicht ab`,
      );
    }
    const contentSha256 = sha256(JSON.stringify(items));
    if (contentSha256 !== expected.contentSha256) {
      throw new Error(
        `${filePath}: Inhaltsinventar der Kategorie ${category} weicht ab`,
      );
    }
    for (const [key, payload] of items) {
      globalItems.push([category, key, payload]);
    }
  }
  const globalContentSha256 = sha256(JSON.stringify(globalItems));
  if (globalContentSha256 !== inventory.globalContentSha256) {
    throw new Error(`${filePath}: globaler Snapshot-Digest weicht ab`);
  }

  return { entries, categoryCounts };
}

const { production, local, inventory: inventoryArg, catalog: catalogArg } =
  parseArgs(process.argv.slice(2));
const inventoryPath = inventoryArg
  ? path.resolve(process.cwd(), inventoryArg)
  : path.join(REPOSITORY_ROOT, "scripts", "schema-parity-inventory.json");
const catalogPath = catalogArg
  ? path.resolve(process.cwd(), catalogArg)
  : path.join(REPOSITORY_ROOT, "scripts", "schema-parity-catalog.sql");
const inventory = await readInventory(inventoryPath, catalogPath);
const productionSnapshot = await readCliSnapshot(production, inventory);
const localSnapshot = await readCliSnapshot(local, inventory);

const missingLocal = [];
const unexpectedLocal = [];
const changed = [];

for (const [key, productionPayload] of productionSnapshot.entries) {
  if (!localSnapshot.entries.has(key)) {
    missingLocal.push(key);
  } else if (localSnapshot.entries.get(key) !== productionPayload) {
    changed.push(key);
  }
}
for (const key of localSnapshot.entries.keys()) {
  if (!productionSnapshot.entries.has(key)) {
    unexpectedLocal.push(key);
  }
}

const differences = [
  ...missingLocal.map((key) => `MISSING_LOCAL|${key.replace("\u0000", "|")}`),
  ...unexpectedLocal.map(
    (key) => `UNEXPECTED_LOCAL|${key.replace("\u0000", "|")}`,
  ),
  ...changed.map((key) => `CHANGED|${key.replace("\u0000", "|")}`),
].sort();

const differenceCounts = new Map();
for (const difference of differences) {
  const [kind, category] = difference.split("|", 2);
  const key = `${kind}_${category}`;
  differenceCounts.set(key, (differenceCounts.get(key) ?? 0) + 1);
}

console.log(
  `SCHEMA_PARITY_PRODUCTION_ENTRIES=${productionSnapshot.entries.size}`,
);
console.log(`SCHEMA_PARITY_LOCAL_ENTRIES=${localSnapshot.entries.size}`);
for (const [category, count] of [...productionSnapshot.categoryCounts].sort()) {
  console.log(`SCHEMA_PARITY_CATEGORY_${category.toUpperCase()}=${count}`);
}
console.log(
  `SCHEMA_PARITY_UNCLASSIFIED_DIFFERENCES=${differences.length}`,
);
for (const [key, count] of [...differenceCounts].sort()) {
  console.log(`SCHEMA_PARITY_DIFFERENCE_${key}=${count}`);
}

if (differences.length > 0) {
  for (const difference of differences.slice(0, 200)) {
    console.error(difference);
  }
  if (differences.length > 200) {
    console.error(`... ${differences.length - 200} weitere Abweichungen`);
  }
  if (process.env.SCHEMA_PARITY_DETAILS === "1") {
    for (const key of changed.slice(0, 100)) {
      const label = key.replace("\u0000", "|");
      console.error(
        `PRODUCTION_PAYLOAD|${label}|${productionSnapshot.entries.get(key)}`,
      );
      console.error(
        `LOCAL_PAYLOAD|${label}|${localSnapshot.entries.get(key)}`,
      );
    }
  }
  console.error("SCHEMA_PARITY_VERDICT=FAIL");
  process.exitCode = 1;
} else {
  console.log("SCHEMA_PARITY_VERDICT=PASS");
}
