import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const pendingFoundationMigrations = readdirSync(migrationsDirectory)
  .filter((name) =>
    /^202607(?:13|14|15|16|20)\d+_.*(?:_prepared_unapplied)?\.sql$/.test(name),
  )
  .sort();
const approvedRemoteWaveMigrations = pendingFoundationMigrations.filter((name) =>
  /^20260713000[1-8]00_.*\.sql$/.test(name),
);

describe("pending Supabase migration runner contract", () => {
  it("keeps transaction control with the runner so schema and ledger commit atomically", () => {
    expect(pendingFoundationMigrations).toHaveLength(36);
    expect(approvedRemoteWaveMigrations).toHaveLength(8);

    for (const migration of pendingFoundationMigrations) {
      const sql = readFileSync(join(migrationsDirectory, migration), "utf8");
      expect(sql, migration).not.toMatch(/^\s*(?:BEGIN|START\s+TRANSACTION)\s*;/im);
      expect(sql, migration).not.toMatch(/^\s*COMMIT\s*;/im);
    }

    for (const migration of approvedRemoteWaveMigrations) {
      const sql = readFileSync(join(migrationsDirectory, migration), "utf8");
      expect(sql, migration).toMatch(/^\s*SET lock_timeout\s*=/im);
      expect(sql, migration).toMatch(/^\s*SET statement_timeout\s*=/im);
      expect(sql, migration).not.toMatch(/^\s*SET LOCAL\b/im);
      expect(sql, migration).not.toMatch(/^\s*LOCK TABLE\b/im);
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
