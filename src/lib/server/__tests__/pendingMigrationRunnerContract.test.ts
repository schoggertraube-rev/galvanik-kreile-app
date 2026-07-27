import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const pendingFoundationMigrations = readdirSync(migrationsDirectory)
  .filter((name) =>
    /^202607(?:13|14|15|16|20)\d+_.*(?:_prepared_unapplied)?\.sql$/.test(name),
  )
  .sort();

describe("pending Supabase migration runner contract", () => {
  it("keeps transaction control with the runner so schema and ledger commit atomically", () => {
    expect(pendingFoundationMigrations).toHaveLength(36);

    for (const migration of pendingFoundationMigrations) {
      const sql = readFileSync(join(migrationsDirectory, migration), "utf8");
      expect(sql, migration).not.toMatch(/^\s*(?:BEGIN|START\s+TRANSACTION)\s*;/im);
      expect(sql, migration).not.toMatch(/^\s*COMMIT\s*;/im);
      expect(sql, migration).toContain("SET LOCAL lock_timeout");
      expect(sql, migration).toContain("SET LOCAL statement_timeout");
    }
  });

  it("contains no statement that requires escaping the runner transaction", () => {
    for (const migration of pendingFoundationMigrations) {
      const sql = readFileSync(join(migrationsDirectory, migration), "utf8");
      expect(sql, migration).not.toMatch(/\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\b/i);
      expect(sql, migration).not.toMatch(/^\s*(?:VACUUM|ALTER\s+SYSTEM|CLUSTER)\b/im);
    }
  });
});
