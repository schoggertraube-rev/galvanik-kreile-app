import { readFile } from "node:fs/promises";
import process from "node:process";

function parseArgs(argv) {
  const args = { production: null, local: null };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--production") {
      args.production = argv[index + 1];
      index += 1;
    } else if (argument === "--local") {
      args.local = argv[index + 1];
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

async function readCliSnapshot(filePath) {
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
  const categoryCounts = new Map();
  for (const row of parsed.rows) {
    if (
      typeof row.category !== "string" ||
      typeof row.object_key !== "string"
    ) {
      throw new Error(`${filePath}: ungueltige Snapshot-Zeile`);
    }
    const key = `${row.category}\u0000${row.object_key}`;
    if (entries.has(key)) {
      throw new Error(
        `${filePath}: doppelter Snapshot-Schluessel ${row.category}|${row.object_key}`,
      );
    }
    entries.set(key, stableJson(row.payload));
    categoryCounts.set(
      row.category,
      (categoryCounts.get(row.category) ?? 0) + 1,
    );
  }

  return { entries, categoryCounts };
}

const { production, local } = parseArgs(process.argv.slice(2));
const productionSnapshot = await readCliSnapshot(production);
const localSnapshot = await readCliSnapshot(local);

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
