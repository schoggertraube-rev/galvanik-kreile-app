import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];
const repositoryRoot = process.cwd();
const checkerPath = path.join(
  repositoryRoot,
  "scripts",
  "check-schema-parity.mjs",
);
const fixtureCatalog = "-- deterministic schema parity test catalog\nSELECT 1;\n";

const completeRows = [
  {
    category: "relation",
    object_key: "public.customers",
    payload: {
      relation_type: "r",
      rls_enabled: true,
      rls_forced: false,
    },
  },
  {
    category: "column",
    object_key: "public.customers.id",
    payload: {
      type: "text",
      not_null: true,
      default: null,
      identity: "",
      generated: "",
      collation: null,
    },
  },
  {
    category: "column",
    object_key: "public.customers.name",
    payload: {
      type: "text",
      not_null: true,
      default: null,
      identity: "",
      generated: "",
      collation: null,
    },
  },
];

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function buildFixtureInventory(rows: typeof completeRows) {
  const categoryItems = new Map<string, Array<[string, string]>>();
  for (const row of rows) {
    const items = categoryItems.get(row.category) ?? [];
    items.push([row.object_key, stableJson(row.payload)]);
    categoryItems.set(row.category, items);
  }

  const categoryEntries: Record<
    string,
    { count: number; keySha256: string; contentSha256: string }
  > = {};
  const globalItems: Array<[string, string, string]> = [];
  for (const [category, items] of [...categoryItems].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    items.sort(([left], [right]) => left.localeCompare(right));
    categoryEntries[category] = {
      count: items.length,
      keySha256: sha256(JSON.stringify(items.map(([key]) => key))),
      contentSha256: sha256(JSON.stringify(items)),
    };
    for (const [key, payload] of items) {
      globalItems.push([category, key, payload]);
    }
  }

  return {
    schemaVersion: 2,
    source: {
      projectRef: "syhaigjhsbpjmtnggqka",
      capturedAt: "2026-08-06T00:00:00Z",
      scope: "scripts/schema-parity-catalog.sql",
      captureMethod: "supabase-read-only-execute-sql",
    },
    catalogSha256: sha256(fixtureCatalog),
    totalEntries: rows.length,
    globalContentSha256: sha256(JSON.stringify(globalItems)),
    categoryEntries,
  };
}

function writeSnapshot(directory: string, name: string, rows: unknown[]) {
  const filePath = path.join(directory, name);
  writeFileSync(filePath, JSON.stringify({ rows }), "utf8");
  return filePath;
}

function runChecker(
  productionRows: unknown[],
  localRows: unknown[],
  options: { driftCatalog?: boolean; defaultContracts?: boolean } = {},
) {
  const directory = mkdtempSync(path.join(tmpdir(), "schema-parity-checker-"));
  temporaryDirectories.push(directory);
  const production = writeSnapshot(directory, "production.json", productionRows);
  const local = writeSnapshot(directory, "local.json", localRows);
  const catalogPath = path.join(directory, "catalog.sql");
  const inventoryPath = path.join(directory, "inventory.json");
  writeFileSync(
    catalogPath,
    options.driftCatalog ? `${fixtureCatalog}-- drift\n` : fixtureCatalog,
    "utf8",
  );
  writeFileSync(
    inventoryPath,
    JSON.stringify(buildFixtureInventory(completeRows)),
    "utf8",
  );

  const args = [checkerPath, "--production", production, "--local", local];
  if (!options.defaultContracts) {
    args.push("--inventory", inventoryPath, "--catalog", catalogPath);
  }

  return spawnSync(process.execPath, args, {
    cwd: directory,
    encoding: "utf8",
  });
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("schema parity checker", () => {
  it("rejects two empty snapshots instead of reporting false parity", () => {
    const result = runChecker([], []);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("unvollstaendiger Katalog-Snapshot");
    expect(result.stdout).not.toContain("SCHEMA_PARITY_VERDICT=PASS");
  });

  it("rejects structurally incomplete snapshots", () => {
    const incompleteRows = completeRows.slice(0, -1);
    const result = runChecker(incompleteRows, incompleteRows);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("unvollstaendiger Katalog-Snapshot");
    expect(result.stdout).not.toContain("SCHEMA_PARITY_VERDICT=PASS");
  });

  it("accepts snapshots bound to the exact key and content inventory", () => {
    const result = runChecker(completeRows, completeRows);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("SCHEMA_PARITY_VERDICT=PASS");
  });

  it("rejects count-preserving symmetric key manipulation", () => {
    const manipulatedRows = structuredClone(completeRows);
    manipulatedRows[0].object_key = "public.fabricated";
    const result = runChecker(manipulatedRows, manipulatedRows);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Objektinventar der Kategorie relation weicht ab");
    expect(result.stdout).not.toContain("SCHEMA_PARITY_VERDICT=PASS");
  });

  it("rejects count-preserving symmetric payload manipulation", () => {
    const manipulatedRows = structuredClone(completeRows);
    manipulatedRows[0].payload.relation_type = "v";
    const result = runChecker(manipulatedRows, manipulatedRows);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Inhaltsinventar der Kategorie relation weicht ab");
    expect(result.stdout).not.toContain("SCHEMA_PARITY_VERDICT=PASS");
  });

  it("rejects missing payload fields before digest comparison", () => {
    const malformedRows = structuredClone(completeRows) as Array<{
      payload: Record<string, unknown>;
    }>;
    delete malformedRows[0].payload.rls_forced;
    const result = runChecker(malformedRows, malformedRows);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Payload-Vertrag fuer relation");
  });

  it("rejects a catalog query that is not bound to the inventory", () => {
    const result = runChecker(completeRows, completeRows, {
      driftCatalog: true,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("SHA-256 weicht vom Inventarvertrag ab");
    expect(result.stdout).not.toContain("SCHEMA_PARITY_VERDICT=PASS");
  });

  it("resolves default contracts relative to the script, not the caller CWD", () => {
    const result = runChecker([], [], { defaultContracts: true });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("erwartet exakt 3839, erhalten 0");
    expect(result.stderr).not.toContain("ENOENT");
  });
});
