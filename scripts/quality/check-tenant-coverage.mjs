import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

// BF-008 Coverage-Gate: verifiziert docs/evidence/f0/F0_TENANT_COVERAGE.json gegen die
// tatsaechliche, frisch replayte Datenbank (kein statisches Vertrauen in die JSON-Datei).
//
// Drei Pruefungen:
//  (1) Jede live public-Basistabelle mit Spalte tenant_id ist in der JSON-Map enthalten
//      (keine fehlenden, keine ueberzaehligen Eintraege).
//  (2) Die Menge der als "fixture_tested" kategorisierten Tabellen ist exakt die Menge der
//      "tenant_isolation_*"-Policies aus supabase/migrations/20260807090000_f0_05_rls_contract_hardening.sql
//      (aus der Migrationsdatei selbst extrahiert, nicht aus der JSON uebernommen).
//  (3) policy_names je Tabelle stimmt als Menge exakt mit den live vorhandenen pg_policy-Eintraegen ueberein.
//
// Aufruf (Replay-CI, nach "supabase db reset --local"):
//   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres node scripts/quality/check-tenant-coverage.mjs

const ROOT = process.cwd();
const COVERAGE_PATH = path.join(ROOT, "docs/evidence/f0/F0_TENANT_COVERAGE.json");
const HARDENING_MIGRATION_PATH = path.join(
  ROOT,
  "supabase/migrations/20260807090000_f0_05_rls_contract_hardening.sql",
);
const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const LIVE_QUERY = `
select coalesce(json_agg(row_to_json(t) order by t.table_name), '[]'::json)
from (
  select
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    coalesce(array_agg(distinct p.polname) filter (where p.polname is not null), '{}') as policy_names
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attname = 'tenant_id' and a.attnum > 0 and not a.attisdropped
  left join pg_policy p on p.polrelid = c.oid
  where n.nspname = 'public' and c.relkind = 'r'
  group by c.relname, c.relrowsecurity
) t;
`;

function queryLiveTenantTables() {
  const raw = execFileSync(
    "psql",
    [DATABASE_URL, "-tA", "-v", "ON_ERROR_STOP=1", "-c", LIVE_QUERY],
    { encoding: "utf8" },
  ).trim();
  return JSON.parse(raw);
}

function extractFixtureTestedTablesFromMigration() {
  const content = readFileSync(HARDENING_MIGRATION_PATH, "utf8");
  const pattern = /create policy "tenant_isolation_\w+" on public\.(\w+)/g;
  const tables = new Set();
  let match;
  while ((match = pattern.exec(content)) !== null) {
    tables.add(match[1]);
  }
  return tables;
}

function sortedUnique(list) {
  return [...new Set(list)].sort();
}

function arraysEqualAsSets(a, b) {
  const sa = sortedUnique(a);
  const sb = sortedUnique(b);
  return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
}

const errors = [];

const coverage = JSON.parse(readFileSync(COVERAGE_PATH, "utf8"));
const coverageTables = coverage.tables ?? {};

const liveRows = queryLiveTenantTables();
const liveTableNames = new Set(liveRows.map((row) => row.table_name));
const coverageTableNames = new Set(Object.keys(coverageTables));

// (1) Tabellenmenge muss exakt uebereinstimmen.
const missingInCoverage = [...liveTableNames].filter((t) => !coverageTableNames.has(t));
const staleInCoverage = [...coverageTableNames].filter((t) => !liveTableNames.has(t));
if (missingInCoverage.length > 0) {
  errors.push(
    `Live-Tabellen mit tenant_id fehlen in F0_TENANT_COVERAGE.json: ${missingInCoverage.join(", ")}`,
  );
}
if (staleInCoverage.length > 0) {
  errors.push(
    `F0_TENANT_COVERAGE.json enthaelt Tabellen ohne live tenant_id-Spalte (veraltet): ${staleInCoverage.join(", ")}`,
  );
}

// (2) fixture_tested-Menge muss exakt der Migrationsquelle entsprechen.
const migrationFixtureTables = extractFixtureTestedTablesFromMigration();
const jsonFixtureTables = new Set(
  Object.entries(coverageTables)
    .filter(([, entry]) => entry.category === "fixture_tested")
    .map(([name]) => name),
);
const missingFixtureInJson = [...migrationFixtureTables].filter((t) => !jsonFixtureTables.has(t));
const extraFixtureInJson = [...jsonFixtureTables].filter((t) => !migrationFixtureTables.has(t));
if (missingFixtureInJson.length > 0) {
  errors.push(
    `Tabellen mit tenant_isolation_*-Policy aus der Haertungsmigration fehlen in category=fixture_tested: ${missingFixtureInJson.join(", ")}`,
  );
}
if (extraFixtureInJson.length > 0) {
  errors.push(
    `category=fixture_tested enthaelt Tabellen, die NICHT aus der Haertungsmigration stammen: ${extraFixtureInJson.join(", ")}`,
  );
}

// (3) policy_names je Tabelle muss live exakt (als Menge) uebereinstimmen.
const liveByTable = new Map(liveRows.map((row) => [row.table_name, row]));
for (const [tableName, entry] of Object.entries(coverageTables)) {
  const live = liveByTable.get(tableName);
  if (!live) continue; // bereits oben als staleInCoverage gemeldet
  if (!arraysEqualAsSets(entry.policy_names ?? [], live.policy_names ?? [])) {
    errors.push(
      `${tableName}: policy_names in F0_TENANT_COVERAGE.json (${JSON.stringify(sortedUnique(entry.policy_names ?? []))}) ` +
        `!= live (${JSON.stringify(sortedUnique(live.policy_names ?? []))})`,
    );
  }
}

if (errors.length > 0) {
  console.error("F0_TENANT_COVERAGE_CHECK=FAIL");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(
  `F0_TENANT_COVERAGE_CHECK=PASS (${liveTableNames.size} live tenant_id-Tabellen, ` +
    `${migrationFixtureTables.size} fixture_tested, alle policy_names live-verifiziert)`,
);
process.exit(0);
