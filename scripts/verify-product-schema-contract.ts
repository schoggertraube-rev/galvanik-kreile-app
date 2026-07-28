import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns, getTableName } from "drizzle-orm";

import * as coreSchema from "../src/db/schema";
import * as financeSchema from "../src/db/schema_buchhaltung";
import * as captureSchema from "../src/db/schema_erfassung";
import * as marketingSchema from "../src/db/schema_marketing";

type SnapshotRelation = { table: string; columns: string[] };
type ProductSnapshot = {
  contractVersion: number;
  targetType: string;
  targetRef: string;
  scope: string;
  capturedOn: string;
  relations: SnapshotRelation[];
};

type RuntimeRequirement = { relation: string; column: string; reason: string };
type RuntimeRequirements = {
  contractVersion: number;
  targetType: string;
  targetRef: string;
  observedDeployment: string;
  observedOn: string;
  requirements: RuntimeRequirement[];
};

type RequirementSource = "drizzle" | "runtime_observed";
type Mismatch = {
  kind: "relation_missing" | "column_missing";
  relation: string;
  column?: string;
  sources: RequirementSource[];
};

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(resolve(repositoryRoot, relativePath), "utf8")) as T;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function candidateSha(): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return process.env.GITHUB_SHA?.trim() || process.env.VERCEL_GIT_COMMIT_SHA?.trim() || "unknown";
  }
}

function addRequirement(
  requirements: Map<string, Map<string, Set<RequirementSource>>>,
  relation: string,
  column: string,
  source: RequirementSource,
): void {
  const columns = requirements.get(relation) ?? new Map<string, Set<RequirementSource>>();
  const sources = columns.get(column) ?? new Set<RequirementSource>();
  sources.add(source);
  columns.set(column, sources);
  requirements.set(relation, columns);
}

function collectDrizzleRequirements(
  requirements: Map<string, Map<string, Set<RequirementSource>>>,
  moduleExports: Record<string, unknown>,
): void {
  for (const candidate of Object.values(moduleExports)) {
    try {
      const relation = getTableName(candidate as never);
      const columns = getTableColumns(candidate as never);
      for (const column of Object.values(columns)) {
        const physicalName = (column as { name?: unknown }).name;
        if (typeof physicalName === "string" && physicalName.length > 0) {
          addRequirement(requirements, relation, physicalName, "drizzle");
        }
      }
    } catch {
      // Non-table exports (types, relations, helpers) are deliberately ignored.
    }
  }
}

const snapshot = readJson<ProductSnapshot>("contracts/product-schema-snapshot.v1.json");
const runtime = readJson<RuntimeRequirements>("contracts/runtime-observed-required-columns.v1.json");

if (snapshot.targetType !== "CANONICAL_PRODUCT_SYSTEM" || runtime.targetType !== snapshot.targetType) {
  throw new Error("Product schema contract target type is invalid.");
}
if (runtime.targetRef !== snapshot.targetRef) {
  throw new Error("Runtime and schema contracts target different Supabase projects.");
}

const productRelations = new Map(snapshot.relations.map((relation) => [relation.table, new Set(relation.columns)]));
const requirements = new Map<string, Map<string, Set<RequirementSource>>>();

for (const moduleExports of [coreSchema, financeSchema, captureSchema, marketingSchema]) {
  collectDrizzleRequirements(requirements, moduleExports);
}
for (const requirement of runtime.requirements) {
  addRequirement(requirements, requirement.relation, requirement.column, "runtime_observed");
}

const mismatches: Mismatch[] = [];
for (const [relation, columns] of [...requirements.entries()].sort(([left], [right]) => left.localeCompare(right))) {
  const productColumns = productRelations.get(relation);
  if (!productColumns) {
    mismatches.push({ kind: "relation_missing", relation, sources: [...new Set([...columns.values()].flatMap((sources) => [...sources]))].sort() });
    continue;
  }
  for (const [column, sources] of [...columns.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    if (!productColumns.has(column)) {
      mismatches.push({ kind: "column_missing", relation, column, sources: [...sources].sort() });
    }
  }
}

const snapshotCanonical = JSON.stringify(
  [...snapshot.relations]
    .map((relation) => ({ table: relation.table, columns: [...relation.columns].sort() }))
    .sort((left, right) => left.table.localeCompare(right.table)),
);
const sourceCanonical = JSON.stringify(
  [...requirements.entries()]
    .map(([relation, columns]) => ({ relation, columns: [...columns.keys()].sort() }))
    .sort((left, right) => left.relation.localeCompare(right.relation)),
);

const summary = {
  testClass: "REMOTE_PRODUCT_SCHEMA_CONTRACT",
  candidateSha: candidateSha(),
  targetType: snapshot.targetType,
  targetRef: snapshot.targetRef,
  snapshotFingerprint: sha256(snapshotCanonical),
  sourceFingerprint: sha256(sourceCanonical),
  snapshotRelations: snapshot.relations.length,
  sourceRelations: requirements.size,
  mismatches,
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log(
    `KREILE_SCHEMA_CONTRACT testClass=${summary.testClass} candidateSha=${summary.candidateSha} targetType=${summary.targetType} targetRef=${summary.targetRef}`,
  );
  console.log(
    `KREILE_SCHEMA_CONTRACT snapshotFingerprint=${summary.snapshotFingerprint} sourceFingerprint=${summary.sourceFingerprint} relations=${summary.snapshotRelations}/${summary.sourceRelations} mismatches=${summary.mismatches.length}`,
  );
  for (const mismatch of summary.mismatches.slice(0, 40)) {
    console.log(
      `KREILE_SCHEMA_MISMATCH kind=${mismatch.kind} relation=${mismatch.relation}${mismatch.column ? ` column=${mismatch.column}` : ""} sources=${mismatch.sources.join(",")}`,
    );
  }
  if (summary.mismatches.length > 40) {
    console.log(`KREILE_SCHEMA_MISMATCH remaining=${summary.mismatches.length - 40} (run with --json for the full reconciliation input)`);
  }
}

if (summary.mismatches.length > 0) {
  process.exitCode = 1;
}
