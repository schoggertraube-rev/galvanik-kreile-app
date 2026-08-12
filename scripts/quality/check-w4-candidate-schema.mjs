#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CONTRACT_PATH = path.join(ROOT, "docs/evidence/f0/W4_CANDIDATE_SCHEMA_CONTRACT.json");
const PENDING = "PENDING_LOCAL_CAPTURE";
const COMPONENTS = ["cols", "idx", "func", "cons", "trig", "pol", "rls", "grants", "func_grants", "viewopts", "def_privs"];
const CHANGED_COMPONENTS = ["cols", "idx", "cons", "trig", "rls", "viewopts"];
const UNCHANGED_COMPONENTS = ["func", "pol", "grants", "func_grants", "def_privs"];
const FORBIDDEN_DELTA = ["CHANGE", "REMOVE", "function", "policy", "default_acl", "bucket", "non_owner_grant"];
const EXPECTED_REFERENCES = {
  "docs/evidence/f0/PROD_FINGERPRINT_REFERENCE.txt": "7d3a6d679e8e32e064297901d43fe2eacfe2a7681e408a76206a85ef6c2e4fcb",
  "scripts/schema-parity-catalog.sql": "175b8ca9f8b964532ef8ad6a5cff710fcea833874ceb5f7b1f7cf358f5a1357d",
  "docs/evidence/f0/hardening/f0_schema_fingerprint.sql": "814c888d0d9b25fdc7fdd066eddc9c34887e07fe839bc2702e6250e3a004f315",
  "scripts/schema-parity-inventory.json": "060de7673beef3d9eaa73289dc04159e262137e23bb437354dccffd363696d4b",
};
const EXPECTED_LEDGER = [
  ["20260805180624", "production_schema_baseline", "c472a4c8e436817be44673ec393d6a1308644bd67babb8aa7b227c4ff7e999e2"],
  ["20260805180801", "production_reference_configuration", "37dc504a2847144e950474a5f591004430610f3189a7ba628fd15744293464bb"],
  ["20260806120000", "set_belege_bucket_private", "946f44ba191e06daab3cda76fef0b39920e999575400dbdb51b8c6ae97c2eba0"],
  ["20260806120100", "revoke_execute_public_app_functions", "32f2f9787ceaa5e89f1e401b4e76e100812a82fed26dce89365f9489f4291ef4"],
  ["20260806120200", "prod_faithful_app_functions", "c08731ae2ce76d7f9663486a5ad1020fa68213d7c62a430448cf5ceb9ebf7ba2"],
  ["20260806120300", "prod_faithful_service_role_grants", "2a6e3b1714e0ff2368343a5a25f4fce4305a30ad8f5de2853f4a6e22d98eebcf"],
  ["20260807090000", "f0_05_rls_contract_hardening", "d7df069f7312cf2ce9232369dd7a2ee9f3b8f3eaa711dfc2c3b8017ad12ae29a"],
  ["20260807090100", "f0_06_storage_view_hardening", "6427c9fdabfbeb1a4303a7d634d9550f6711aebc9cdacc431bd39ff0a7134548"],
  ["20260810100000", "normalize_view_invoker_spelling", "d1292cb8c24ae435b067b9528f94b1a1fc338396600d387b6af7054c775a3b72"],
  ["20260811150000", "w3_order_station_version", "034cc8d6509aabe093948ff84c2e092289ddc211123d087a87e5bdfe7cbb45d7"],
  ["20260811154732", "w4_order_station_event_readmodels", "44ecf82b34023c763c1f0773266483cfe6a0a87809fc5970d0406370aea00595"],
  ["20260811184850", "w4_order_station_attachment", "70aaead2150d95069829997bfdb128c2496b292d59cb6b69c8440dd1dfd2b6cb"],
].map(([version, name, sha256]) => ({ version, name, sha256 }));
const OWNER_RELATIONS = [
  "private.order_station_evidence",
  "private.order_station_evidence_reservations",
  "private.v_operational_station_queue_v1",
  "private.v_order_station_evidence_receipts_v1",
  "private.v_order_station_receipts_v1",
];
const OWNER_PRIVILEGES = ["DELETE", "INSERT", "MAINTAIN", "REFERENCES", "SELECT", "TRIGGER", "TRUNCATE", "UPDATE"];
const EXPECTED_OBJECT_MANIFEST_SHA256 = "fe5f4513ec094c434236682faaa2b00318a0199055ea9c6b02b368d239b2a7a2";
const EXPECTED_CANONICALIZATION = {
  transport: "ascii-decimal-byte-length:base64(canonical-json)",
  json_keys: "UTF-8 bytewise ascending",
  catalog_records: "strict key ascending; duplicates rejected",
  view_sql: "pg_get_viewdef(oid, true) exact output; no broad whitespace collapse",
  acl: "explicit c.relacl fingerprint unchanged; effective owner ACL expands 8 relation privileges including MAINTAIN",
};
const CANDIDATE_PAYLOAD_KEYS = {
  relation: ["relation_type", "rls_enabled", "rls_forced"],
  column: ["type", "not_null", "default", "identity", "generated", "collation"],
  constraint: ["type", "definition", "deferrable", "deferred", "validated"],
  index: ["definition", "unique", "primary", "valid", "ready", "live", "keys"],
  view: ["relation_type", "definition", "options"],
  trigger: ["definition", "enabled"],
  relation_grant: ["grantor", "grantable"],
};
const PSQL_BASE_ARGS = ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-P", "pager=off", "-P", "footer=off"];
const exactKeys = (value, expected, code) => {
  if (!value || typeof value !== "object" || Array.isArray(value) || canonical(Object.keys(value).sort(compareText)) !== canonical([...expected].sort(compareText))) fail(code);
};

const fail = (code, detail = "") => {
  throw new Error(`${code}${detail ? `: ${detail}` : ""}`);
};
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const compareText = (a, b) => Buffer.from(a).compare(Buffer.from(b));

function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort(compareText).map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}

// Catalog transport is deliberately length-framed base64, never delimiter-based
// text: <decimal byte length>:<base64 payload> repeated until EOF.
export function encodeCatalog(records) {
  return records.map((record) => {
    const payload = Buffer.from(canonical(record), "utf8").toString("base64");
    return `${Buffer.byteLength(payload, "ascii")}:${payload}`;
  }).join("");
}

export function parseCatalog(raw) {
  const bytes = Buffer.from(raw, "utf8");
  const records = [];
  let offset = 0;
  while (offset < bytes.length) {
    const colon = bytes.indexOf(58, offset);
    if (colon < 0) fail("CATALOG_FRAME_INCOMPLETE", `offset=${offset}`);
    const lengthText = bytes.subarray(offset, colon).toString("ascii");
    if (!/^(0|[1-9][0-9]*)$/.test(lengthText)) fail("CATALOG_FRAME_LENGTH_INVALID", lengthText);
    const length = Number(lengthText);
    const start = colon + 1;
    const end = start + length;
    if (!Number.isSafeInteger(length) || end > bytes.length) fail("CATALOG_FRAME_INCOMPLETE", `offset=${offset}`);
    const encoded = bytes.subarray(start, end).toString("ascii");
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) fail("CATALOG_FRAME_BASE64_INVALID", `offset=${offset}`);
    const decoded = Buffer.from(encoded, "base64");
    if (decoded.toString("base64") !== encoded) fail("CATALOG_FRAME_BASE64_NONCANONICAL", `offset=${offset}`);
    let record;
    try { record = JSON.parse(decoded.toString("utf8")); } catch { fail("CATALOG_FRAME_JSON_INVALID", `offset=${offset}`); }
    if (canonical(record) !== decoded.toString("utf8")) fail("CATALOG_RECORD_NONCANONICAL", `offset=${offset}`);
    records.push(record);
    offset = end;
  }
  return records;
}

function indexCatalog(records, label) {
  const map = new Map();
  let previous = "";
  for (const record of records) {
    if (!record || typeof record !== "object" || Array.isArray(record)) fail("CATALOG_RECORD_INVALID", label);
    exactKeys(record, ["key", "kind", "payload"], "CATALOG_RECORD_FIELDS_INVALID");
    if (typeof record.key !== "string" || typeof record.kind !== "string" || !("payload" in record)) fail("CATALOG_RECORD_INCOMPLETE", label);
    if (map.has(record.key)) fail("CATALOG_DUPLICATE_KEY", `${label}:${record.key}`);
    if (previous && compareText(previous, record.key) >= 0) fail("CATALOG_NONDETERMINISTIC_ORDER", `${label}:${record.key}`);
    previous = record.key;
    map.set(record.key, record);
  }
  return map;
}

function validateContract(contract) {
  exactKeys(contract, ["contract_version", "capture_status", "postgres_major", "canonicalization", "baseline", "candidate", "reference_files", "candidate_migrations", "expected_delta", "changed_components", "unchanged_components", "forbidden_delta", "objects"], "CONTRACT_FIELDS_INVALID");
  if (contract.contract_version !== 1) fail("CONTRACT_VERSION_INVALID");
  if (contract.postgres_major !== 17) fail("POSTGRES_MAJOR_INVALID");
  if (canonical(contract.canonicalization) !== canonical(EXPECTED_CANONICALIZATION)) fail("CANONICALIZATION_CONTRACT_INVALID");
  if (contract.capture_status !== PENDING && contract.capture_status !== "CAPTURED_LOCAL") fail("CAPTURE_STATUS_INVALID");
  exactKeys(contract.reference_files, Object.keys(EXPECTED_REFERENCES), "REFERENCE_SET_INVALID");
  if (canonical(contract.reference_files) !== canonical(EXPECTED_REFERENCES)) fail("REFERENCE_CONTRACT_INVALID");
  if (contract.baseline.migration_cutoff !== "20260810100000" || contract.baseline.migration_count !== 9) fail("BASELINE_LEDGER_CONTRACT_INVALID");
  if (contract.candidate.migration_cutoff !== "20260811184850" || contract.candidate.migration_count !== 12) fail("CANDIDATE_LEDGER_CONTRACT_INVALID");
  exactKeys(contract.baseline, ["migration_cutoff", "migration_count", "migrations", "component_hashes", "catalog_payload_sha256"], "BASELINE_FIELDS_INVALID");
  exactKeys(contract.candidate, ["migration_cutoff", "migration_count", "migrations", "component_hashes", "catalog_payload_sha256"], "CANDIDATE_FIELDS_INVALID");
  if (canonical(contract.baseline.migrations) !== canonical(EXPECTED_LEDGER.slice(0, 9))) fail("BASELINE_LEDGER_CONTRACT_INVALID");
  if (canonical(contract.candidate.migrations) !== canonical(EXPECTED_LEDGER)) fail("CANDIDATE_LEDGER_CONTRACT_INVALID");
  if (canonical(contract.candidate_migrations) !== canonical(EXPECTED_LEDGER.slice(9))) fail("CANDIDATE_MIGRATIONS_INVALID");
  if (canonical(contract.changed_components) !== canonical(CHANGED_COMPONENTS) || canonical(contract.unchanged_components) !== canonical(UNCHANGED_COMPONENTS)) fail("COMPONENT_PARTITION_INVALID");
  if (canonical(contract.forbidden_delta) !== canonical(FORBIDDEN_DELTA)) fail("FORBIDDEN_DELTA_INVALID");
  for (const snapshot of [contract.baseline, contract.candidate]) {
    exactKeys(snapshot.component_hashes, COMPONENTS, "COMPONENT_HASH_SET_INVALID");
    for (const [component, hash] of Object.entries(snapshot.component_hashes)) {
      if (hash !== PENDING && !/^[0-9a-f]{32}$/.test(hash)) fail("COMPONENT_HASH_INVALID", component);
    }
    if (snapshot.catalog_payload_sha256 !== PENDING && !/^[0-9a-f]{64}$/.test(snapshot.catalog_payload_sha256)) fail("CATALOG_SHA_INVALID");
  }
  if (!Array.isArray(contract.objects) || contract.objects.length !== 182) fail("OBJECT_COUNT_INVALID", String(contract.objects?.length));
  exactKeys(contract.expected_delta, ["operation", "total", "by_migration", "by_kind"], "DELTA_FIELDS_INVALID");
  exactKeys(contract.expected_delta.by_migration, ["20260811150000", "20260811154732", "20260811184850"], "DELTA_MIGRATION_SET_INVALID");
  exactKeys(contract.expected_delta.by_kind, ["relation", "column", "constraint", "index", "view", "trigger", "relation_grant"], "DELTA_KIND_SET_INVALID");
  const keys = new Set();
  const kindCounts = {};
  const migrationCounts = {};
  let previous = "";
  for (const object of contract.objects) {
    exactKeys(object, ["key", "kind", "migration", "operation", "payload_sha256"], "OBJECT_FIELDS_INVALID");
    if (!object || typeof object.key !== "string" || typeof object.kind !== "string" || typeof object.migration !== "string") fail("OBJECT_CONTRACT_INCOMPLETE");
    if (keys.has(object.key)) fail("OBJECT_CONTRACT_DUPLICATE", object.key);
    if (previous && compareText(previous, object.key) >= 0) fail("OBJECT_CONTRACT_NONDETERMINISTIC_ORDER", object.key);
    if (object.operation !== "ADD") fail("OBJECT_OPERATION_INVALID", object.key);
    if (object.payload_sha256 !== PENDING && !/^[0-9a-f]{64}$/.test(object.payload_sha256)) fail("OBJECT_PAYLOAD_SHA_INVALID", object.key);
    if (!Object.hasOwn(contract.expected_delta.by_kind, object.kind)) fail("OBJECT_KIND_FORBIDDEN", object.kind);
    if (!Object.hasOwn(contract.expected_delta.by_migration, object.migration)) fail("OBJECT_MIGRATION_FORBIDDEN", object.migration);
    keys.add(object.key); previous = object.key;
    kindCounts[object.kind] = (kindCounts[object.kind] ?? 0) + 1;
    migrationCounts[object.migration] = (migrationCounts[object.migration] ?? 0) + 1;
  }
  if (canonical(kindCounts) !== canonical(contract.expected_delta.by_kind)) fail("OBJECT_KIND_COUNTS_INVALID");
  if (canonical(migrationCounts) !== canonical(contract.expected_delta.by_migration)) fail("OBJECT_MIGRATION_COUNTS_INVALID");
  if (contract.expected_delta.operation !== "ADD" || contract.expected_delta.total !== 182) fail("DELTA_CONTRACT_INVALID");
  const expectedGrantKeys = OWNER_RELATIONS.flatMap((relation) => OWNER_PRIVILEGES.map((privilege) => `relation_grant:${relation}|postgres|${privilege}`)).sort(compareText);
  const actualGrantKeys = contract.objects.filter((object) => object.kind === "relation_grant").map((object) => object.key).sort(compareText);
  if (canonical(actualGrantKeys) !== canonical(expectedGrantKeys)) fail("OWNER_GRANT_CONTRACT_INVALID");
  const manifestSha = sha256(canonical(contract.objects.map(({ key, kind, migration, operation }) => [key, kind, migration, operation])));
  if (manifestSha !== EXPECTED_OBJECT_MANIFEST_SHA256) fail("OBJECT_MANIFEST_INVALID");
  if (contract.capture_status === "CAPTURED_LOCAL" && canonical(contract).includes(PENDING)) fail("CAPTURED_CONTRACT_CONTAINS_PENDING");
  return keys;
}

function validateLedger(contract, ledger) {
  if (!Array.isArray(ledger) || ledger.length !== contract.candidate.migration_count) fail("LEDGER_COUNT_INVALID");
  for (const entry of ledger) exactKeys(entry, ["version", "name", "sha256"], "LEDGER_FIELDS_INVALID");
  if (canonical(ledger) !== canonical(EXPECTED_LEDGER)) fail("LEDGER_EXACT_SEQUENCE_INVALID");
}

function validateFingerprints(contract, baseline, candidate) {
  exactKeys(baseline, COMPONENTS, "BASELINE_FINGERPRINT_SET_INVALID");
  exactKeys(candidate, COMPONENTS, "CANDIDATE_FINGERPRINT_SET_INVALID");
  for (const component of COMPONENTS) {
    if (!/^[0-9a-f]{32}$/.test(baseline[component]) || !/^[0-9a-f]{32}$/.test(candidate[component])) fail("FINGERPRINT_VALUE_INVALID", component);
    const changed = baseline[component] !== candidate[component];
    if (contract.changed_components.includes(component) !== changed) fail("FINGERPRINT_COMPONENT_CHANGE_INVALID", component);
    if (contract.baseline.component_hashes[component] !== PENDING && baseline[component] !== contract.baseline.component_hashes[component]) fail("BASELINE_FINGERPRINT_CONTRACT_MISMATCH", component);
    if (contract.candidate.component_hashes[component] !== PENDING && candidate[component] !== contract.candidate.component_hashes[component]) fail("CANDIDATE_FINGERPRINT_CONTRACT_MISMATCH", component);
  }
}

function validateDelta(contract, baselineRecords, candidateRecords) {
  const baseline = indexCatalog(baselineRecords, "baseline");
  const candidate = indexCatalog(candidateRecords, "candidate");
  const expectedKeys = validateContract(contract);
  for (const key of baseline.keys()) if (!candidate.has(key)) fail("REMOVE_DETECTED", key);
  for (const [key, before] of baseline) {
    const after = candidate.get(key);
    if (canonical(before) !== canonical(after)) fail("CHANGE_DETECTED", key);
  }
  const additions = [...candidate.keys()].filter((key) => !baseline.has(key));
  for (const key of additions) if (!expectedKeys.has(key)) fail("UNEXPECTED_ADD", key);
  for (const key of expectedKeys) if (!candidate.has(key)) fail("EXPECTED_ADD_MISSING", key);
  if (additions.length !== expectedKeys.size) fail("ADD_COUNT_INVALID", String(additions.length));
  for (const object of contract.objects) {
    if (baseline.has(object.key)) fail("ADD_BASELINE_PRESENT", object.key);
    const record = candidate.get(object.key);
    if (!record) fail("EXPECTED_ADD_MISSING", object.key);
    if (record.kind !== object.kind) fail("OBJECT_KIND_INVALID", object.key);
    exactKeys(record.payload, CANDIDATE_PAYLOAD_KEYS[record.kind], "OBJECT_PAYLOAD_FIELDS_INVALID");
    if (record.kind === "index") {
      const payload = record.payload;
      if (payload.valid !== true || payload.ready !== true || payload.live !== true) fail("INDEX_NOT_LIVE_READY_VALID", object.key);
      if (typeof payload.unique !== "boolean" || typeof payload.primary !== "boolean") fail("INDEX_BOOLEAN_STATE_INVALID", object.key);
      if (typeof payload.definition !== "string" || payload.definition.trim() === "") fail("INDEX_DEFINITION_INVALID", object.key);
      if (typeof payload.keys !== "string" || !/^-?\d+(?: +-?\d+)*$/.test(payload.keys)) fail("INDEX_KEYS_INVALID", object.key);
    }
    if (record.kind === "relation_grant") {
      exactKeys(record.payload, ["grantor", "grantable"], "RELATION_GRANT_PAYLOAD_FIELDS_INVALID");
      if (record.payload.grantor !== "postgres" || record.payload.grantable !== false) fail("NON_OWNER_OR_GRANTABLE_GRANT", object.key);
    }
    const actualSha = sha256(canonical(record.payload));
    if (object.payload_sha256 !== PENDING && actualSha !== object.payload_sha256) fail("OBJECT_PAYLOAD_SHA_MISMATCH", object.key);
  }
}

async function loadJson(file) { return JSON.parse(await readFile(file, "utf8")); }
async function loadContract(file = CONTRACT_PATH) { return loadJson(file); }

function runPsql(databaseUrl, sql) {
  const result = spawnSync("psql", [...PSQL_BASE_ARGS, databaseUrl], {
    input: sql,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) fail("PSQL_EXECUTION_FAILED", result.error.message);
  if (result.status !== 0) fail("PSQL_QUERY_FAILED", (result.stderr || result.stdout).trim());
  return result.stdout.replace(/\r/g, "").trim();
}

function validatePostgresMajor(versionNum) {
  if (!/^17[0-9]{4}$/.test(versionNum)) fail("POSTGRES_MAJOR_MISMATCH", versionNum);
}
function assertPostgres17(databaseUrl) { validatePostgresMajor(runPsql(databaseUrl, "show server_version_num;")); }

function validateLocalDatabaseUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { fail("LOCAL_DATABASE_URL_INVALID"); }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") fail("LOCAL_DATABASE_PROTOCOL_INVALID");
  if (url.search !== "" || url.hash !== "") fail("REMOTE_DATABASE_CAPTURE_FORBIDDEN");
  if (!new Set(["127.0.0.1", "localhost"]).has(url.hostname) || url.port !== "54322" || url.pathname !== "/postgres") fail("REMOTE_DATABASE_CAPTURE_FORBIDDEN");
  if (decodeURIComponent(url.username) !== "postgres" || decodeURIComponent(url.password) !== "postgres") fail("LOCAL_DATABASE_CREDENTIALS_INVALID");
  return url.toString();
}

async function captureCatalog(databaseUrl, outputPath) {
  const source = await readFile(path.join(ROOT, "scripts/schema-parity-catalog.sql"), "utf8");
  const tail = /SELECT category, object_key, payload\s+FROM snapshot\s+ORDER BY category, object_key;\s*$/;
  if (!tail.test(source)) fail("CATALOG_SQL_TAIL_DRIFT");
  const sql = source.replace(tail, `SELECT replace(encode(convert_to(jsonb_build_object(
    'key', category || ':' || object_key,
    'kind', category,
    'payload', payload
  )::text, 'UTF8'), 'base64'), E'\\n', '')
FROM snapshot
ORDER BY category, object_key;`);
  const lines = runPsql(databaseUrl, sql).split("\n").filter(Boolean);
  const records = lines.map((line, index) => {
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(line)) fail("CATALOG_CAPTURE_BASE64_INVALID", String(index));
    return JSON.parse(Buffer.from(line, "base64").toString("utf8"));
  });
  const indexExtrasSql = `select replace(encode(convert_to(jsonb_build_object(
    'key', 'index:' || format('%I.%I|%I', n.nspname, c.relname, idx.relname),
    'payload', jsonb_build_object('live', i.indislive, 'keys', i.indkey::text)
  )::text, 'UTF8'), 'base64'), E'\\n', '')
from pg_catalog.pg_index i
join pg_catalog.pg_class c on c.oid=i.indrelid
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
join pg_catalog.pg_class idx on idx.oid=i.indexrelid
where n.nspname in ('public','private','drizzle')
order by n.nspname,c.relname,idx.relname;`;
  const indexExtras = new Map(runPsql(databaseUrl, indexExtrasSql).split("\n").filter(Boolean).map((line) => {
    const decoded = JSON.parse(Buffer.from(line, "base64").toString("utf8"));
    return [decoded.key, decoded.payload];
  }));
  for (const record of records) {
    if (record.kind === "index") {
      const extra = indexExtras.get(record.key);
      if (!extra) fail("INDEX_SEMANTIC_PAYLOAD_MISSING", record.key);
      record.payload = { ...record.payload, ...extra };
    }
  }
  records.sort((a, b) => compareText(a.key, b.key));
  indexCatalog(records, "capture");
  await writeFile(outputPath, encodeCatalog(records), "utf8");
}

async function captureFingerprint(databaseUrl, outputPath) {
  const sql = await readFile(path.join(ROOT, "docs/evidence/f0/hardening/f0_schema_fingerprint.sql"), "utf8");
  const values = runPsql(databaseUrl, sql).split("|");
  const sqlOrder = ["cols", "idx", "cons", "trig", "func", "pol", "rls", "grants", "func_grants", "def_privs", "viewopts"];
  if (values.length !== sqlOrder.length) fail("FINGERPRINT_CAPTURE_INCOMPLETE");
  const fingerprint = Object.fromEntries(sqlOrder.map((component, index) => [component, values[index].trim().toLowerCase()]));
  exactKeys(fingerprint, COMPONENTS, "FINGERPRINT_CAPTURE_SET_INVALID");
  for (const [component, hash] of Object.entries(fingerprint)) if (!/^[0-9a-f]{32}$/.test(hash)) fail("FINGERPRINT_CAPTURE_VALUE_INVALID", component);
  await writeFile(outputPath, `${canonical(fingerprint)}\n`, "utf8");
}

async function captureLedger(databaseUrl, outputPath) {
  const sql = `select replace(encode(convert_to(jsonb_build_object('version', version, 'name', name)::text, 'UTF8'), 'base64'), E'\\n', '')
from supabase_migrations.schema_migrations order by version;`;
  const rows = runPsql(databaseUrl, sql).split("\n").filter(Boolean).map((line) => JSON.parse(Buffer.from(line, "base64").toString("utf8")));
  const expected = EXPECTED_LEDGER.slice(0, rows.length);
  if (rows.length !== 9 && rows.length !== 12) fail("LEDGER_CAPTURE_COUNT_INVALID", String(rows.length));
  if (canonical(rows) !== canonical(expected.map(({ version, name }) => ({ version, name })))) fail("LEDGER_CAPTURE_SEQUENCE_INVALID");
  await writeFile(outputPath, `${canonical(expected)}\n`, "utf8");
}

async function runCapture(args) {
  const databaseUrl = validateCaptureRequest(args);
  assertPostgres17(databaseUrl);
  if (args.includes("--catalog")) await captureCatalog(databaseUrl, takeArg(args, "--catalog"));
  if (args.includes("--fingerprint")) await captureFingerprint(databaseUrl, takeArg(args, "--fingerprint"));
  if (args.includes("--ledger")) await captureLedger(databaseUrl, takeArg(args, "--ledger"));
  console.log(JSON.stringify({ gate: "W4_CANDIDATE_CAPTURE", status: "PASS" }));
}

async function exportInventorySnapshot(args) {
  const input = takeArg(args, "--catalog");
  const output = takeArg(args, "--output");
  const records = parseCatalog(await readFile(input, "utf8"));
  indexCatalog(records, "inventory-export");
  const rows = records.map(({ key, kind, payload }) => {
    const inventoryPayload = { ...payload };
    if (kind === "index") { delete inventoryPayload.live; delete inventoryPayload.keys; }
    return { category: kind, object_key: key.slice(kind.length + 1), payload: inventoryPayload };
  });
  await writeFile(output, `${canonical({ rows })}\n`, "utf8");
  console.log(JSON.stringify({ gate: "W4_INVENTORY_EXPORT", status: "PASS", rows: rows.length }));
}

function validateCaptureRequest(args) {
  if (!["--catalog", "--fingerprint", "--ledger"].some((selector) => args.includes(selector))) fail("CAPTURE_SELECTOR_REQUIRED");
  return validateLocalDatabaseUrl(takeArg(args, "--database-url"));
}

async function validateReferences(contract) {
  for (const [relative, expected] of Object.entries(contract.reference_files)) {
    const actual = sha256(await readFile(path.join(ROOT, relative)));
    if (actual !== expected) fail("REFERENCE_SHA_MISMATCH", relative);
  }
  for (const migration of contract.candidate.migrations) {
    const relative = `supabase/migrations/${migration.version}_${migration.name}.sql`;
    const actual = sha256(await readFile(path.join(ROOT, relative)));
    if (actual !== migration.sha256) fail("MIGRATION_SHA_MISMATCH", relative);
  }
}

function takeArg(args, name) {
  const index = args.indexOf(name);
  if (index < 0 || index + 1 >= args.length) fail("ARGUMENT_MISSING", name);
  return args[index + 1];
}

async function runCheck(args) {
  const contract = await loadContract(args.includes("--contract") ? takeArg(args, "--contract") : CONTRACT_PATH);
  validateContract(contract);
  await validateReferences(contract);
  const required = ["--baseline-catalog", "--candidate-catalog", "--baseline-fingerprint", "--candidate-fingerprint", "--ledger"];
  validateCheckReadiness(contract, args, required);
  const baselineCatalogRaw = await readFile(takeArg(args, "--baseline-catalog"), "utf8");
  const candidateCatalogRaw = await readFile(takeArg(args, "--candidate-catalog"), "utf8");
  const baselineCatalog = parseCatalog(baselineCatalogRaw);
  const candidateCatalog = parseCatalog(candidateCatalogRaw);
  validateDelta(contract, baselineCatalog, candidateCatalog);
  validateFingerprints(contract, await loadJson(takeArg(args, "--baseline-fingerprint")), await loadJson(takeArg(args, "--candidate-fingerprint")));
  validateLedger(contract, await loadJson(takeArg(args, "--ledger")));
  const baselineSha = sha256(baselineCatalogRaw); const candidateSha = sha256(candidateCatalogRaw);
  if (contract.baseline.catalog_payload_sha256 !== PENDING && baselineSha !== contract.baseline.catalog_payload_sha256) fail("BASELINE_CATALOG_SHA_MISMATCH");
  if (contract.candidate.catalog_payload_sha256 !== PENDING && candidateSha !== contract.candidate.catalog_payload_sha256) fail("CANDIDATE_CATALOG_SHA_MISMATCH");
  console.log(JSON.stringify({ gate: "W4_CANDIDATE_SCHEMA", status: "PASS", additions: 182, baseline_catalog_sha256: baselineSha, candidate_catalog_sha256: candidateSha }));
}

async function materializeContract(args) {
  const contract = await loadContract(args.includes("--contract") ? takeArg(args, "--contract") : CONTRACT_PATH);
  validateContract(contract);
  await validateReferences(contract);
  const pendingContract = structuredClone(contract);
  pendingContract.capture_status = PENDING;
  for (const snapshot of [pendingContract.baseline, pendingContract.candidate]) {
    snapshot.catalog_payload_sha256 = PENDING;
    for (const component of COMPONENTS) snapshot.component_hashes[component] = PENDING;
  }
  for (const object of pendingContract.objects) object.payload_sha256 = PENDING;
  const baselineRaw = await readFile(takeArg(args, "--baseline-catalog"), "utf8");
  const candidateRaw = await readFile(takeArg(args, "--candidate-catalog"), "utf8");
  const baselineRecords = parseCatalog(baselineRaw);
  const candidateRecords = parseCatalog(candidateRaw);
  const baselineFingerprint = await loadJson(takeArg(args, "--baseline-fingerprint"));
  const candidateFingerprint = await loadJson(takeArg(args, "--candidate-fingerprint"));
  validateDelta(pendingContract, baselineRecords, candidateRecords);
  validateFingerprints(pendingContract, baselineFingerprint, candidateFingerprint);
  validateLedger(pendingContract, await loadJson(takeArg(args, "--ledger")));
  const candidateByKey = indexCatalog(candidateRecords, "candidate-materialization");
  contract.capture_status = "CAPTURED_LOCAL";
  contract.baseline.catalog_payload_sha256 = sha256(baselineRaw);
  contract.candidate.catalog_payload_sha256 = sha256(candidateRaw);
  contract.baseline.component_hashes = baselineFingerprint;
  contract.candidate.component_hashes = candidateFingerprint;
  for (const object of contract.objects) object.payload_sha256 = sha256(canonical(candidateByKey.get(object.key).payload));
  validateContract(contract);
  await writeFile(takeArg(args, "--output"), `${JSON.stringify(contract, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ gate: "W4_CANDIDATE_CONTRACT_MATERIALIZATION", status: "PASS", objects: 182 }));
}

function validateCheckReadiness(contract, args, required = ["--baseline-catalog", "--candidate-catalog", "--baseline-fingerprint", "--candidate-fingerprint", "--ledger"]) {
  if (contract.capture_status !== "CAPTURED_LOCAL") fail("CONTRACT_CAPTURE_PENDING");
  if (!required.every((name) => args.includes(name))) fail("CAPTURE_ARGUMENTS_REQUIRED");
}

async function main() {
  const [mode = "--check", ...args] = process.argv.slice(2);
  if (mode === "--check") return runCheck(args);
  if (mode === "--selftest") return runSelftest();
  if (mode === "--capture") return runCapture(args);
  if (mode === "--export-inventory-snapshot") return exportInventorySnapshot(args);
  if (mode === "--materialize-contract") return materializeContract(args);
  fail("MODE_UNSUPPORTED", mode);
}

// Filled out below after the contract manifest is installed. Selftest never
// reads or mutates a database and uses only synthetic framed catalogs.
async function runSelftest() {
  const contract = await loadContract();
  validateContract(contract);
  const expectReject = (code, fn) => {
    try { fn(); } catch (error) { if (String(error.message).startsWith(code)) return; throw error; }
    fail("SELFTEST_EXPECTED_REJECTION_MISSING", code);
  };
  const clone = (value) => structuredClone(value);
  const syntheticContract = clone(contract);
  syntheticContract.capture_status = PENDING;
  for (const snapshot of [syntheticContract.baseline, syntheticContract.candidate]) {
    snapshot.catalog_payload_sha256 = PENDING;
    for (const component of COMPONENTS) snapshot.component_hashes[component] = PENDING;
  }
  for (const object of syntheticContract.objects) object.payload_sha256 = PENDING;
  validateContract(syntheticContract);
  const recordFor = (object) => ({
    key: object.key,
    kind: object.kind,
    payload: {
      relation: { relation_type: "r", rls_enabled: false, rls_forced: false },
      column: { type: "text", not_null: false, default: null, identity: "", generated: "", collation: null },
      constraint: { type: "c", definition: "CHECK (true)", deferrable: false, deferred: false, validated: true },
      index: { definition: "CREATE INDEX", unique: false, primary: false, valid: true, ready: true, live: true, keys: "1" },
      view: { relation_type: "v", definition: "SELECT 1", options: ["security_invoker=true"] },
      trigger: { definition: "CREATE TRIGGER", enabled: "O" },
      relation_grant: { grantor: "postgres", grantable: false },
    }[object.kind],
  });
  const added = syntheticContract.objects.map(recordFor).sort((a, b) => compareText(a.key, b.key));
  const old = { key: "column:private.preexisting.id", kind: "column", payload: { value: "stable" } };
  const baseline = [old];
  const candidate = [old, ...added].sort((a, b) => compareText(a.key, b.key));
  validateDelta(syntheticContract, baseline, candidate);

  const unicodeRecords = [
    { key: "column:private.a", kind: "column", payload: { nested: { z: "|:\u00e4", a: [1, true, null] } } },
    { key: "column:private.b", kind: "column", payload: { b: 2, a: 1 } },
  ];
  const framedOnce = encodeCatalog(unicodeRecords);
  const framedTwice = encodeCatalog(parseCatalog(framedOnce));
  if (framedOnce !== framedTwice) fail("SELFTEST_CANONICAL_ROUNDTRIP_MISMATCH");

  expectReject("CATALOG_FRAME_INCOMPLETE", () => parseCatalog("4:e30"));
  expectReject("CATALOG_DUPLICATE_KEY", () => indexCatalog([{ key: "a", kind: "relation", payload: {} }, { key: "a", kind: "relation", payload: {} }], "test"));
  expectReject("CATALOG_NONDETERMINISTIC_ORDER", () => indexCatalog([{ key: "b", kind: "relation", payload: {} }, { key: "a", kind: "relation", payload: {} }], "test"));
  expectReject("CATALOG_RECORD_FIELDS_INVALID", () => indexCatalog([{ key: "a", kind: "relation", payload: {}, extra: true }], "test"));

  expectReject("EXPECTED_ADD_MISSING", () => validateDelta(syntheticContract, baseline, candidate.slice(0, -1)));
  expectReject("UNEXPECTED_ADD", () => validateDelta(syntheticContract, baseline, [...candidate, { key: "view:private.unexpected", kind: "view", payload: {} }].sort((a, b) => compareText(a.key, b.key))));
  expectReject("CHANGE_DETECTED", () => validateDelta(syntheticContract, baseline, [{ ...old, payload: { value: "drift" } }, ...added].sort((a, b) => compareText(a.key, b.key))));
  expectReject("REMOVE_DETECTED", () => validateDelta(syntheticContract, baseline, added));
  const sameNameView = { key: "view:private.v_order_station_receipts_v1", kind: "view", payload: { definition: "old" } };
  const candidateViewDrift = candidate.map((record) => record.key === sameNameView.key ? { ...record, payload: { definition: "new" } } : record);
  expectReject("CHANGE_DETECTED", () => validateDelta(syntheticContract, [old, sameNameView].sort((a, b) => compareText(a.key, b.key)), candidateViewDrift));
  const nonOwner = candidate.map((record) => record.kind === "relation_grant" ? { ...record, payload: { grantor: "supabase_admin", grantable: false } } : record);
  expectReject("NON_OWNER_OR_GRANTABLE_GRANT", () => validateDelta(syntheticContract, baseline, nonOwner));
  const deadIndex = candidate.map((record) => record.kind === "index" ? { ...record, payload: { ...record.payload, live: false } } : record);
  expectReject("INDEX_NOT_LIVE_READY_VALID", () => validateDelta(syntheticContract, baseline, deadIndex));
  const payloadContract = clone(syntheticContract);
  payloadContract.objects[0].payload_sha256 = "0".repeat(64);
  expectReject("OBJECT_PAYLOAD_SHA_MISMATCH", () => validateDelta(payloadContract, baseline, candidate));

  const incomplete = Object.fromEntries(COMPONENTS.slice(1).map((key) => [key, "a".repeat(32)]));
  expectReject("BASELINE_FINGERPRINT_SET_INVALID", () => validateFingerprints(syntheticContract, incomplete, incomplete));
  const fpBaseline = Object.fromEntries(COMPONENTS.map((key) => [key, "a".repeat(32)]));
  const fpCandidate = Object.fromEntries(COMPONENTS.map((key) => [key, CHANGED_COMPONENTS.includes(key) ? "b".repeat(32) : "a".repeat(32)]));
  validateFingerprints(syntheticContract, fpBaseline, fpCandidate);
  const unchangedDrift = clone(fpCandidate); unchangedDrift.func = "c".repeat(32);
  expectReject("FINGERPRINT_COMPONENT_CHANGE_INVALID", () => validateFingerprints(syntheticContract, fpBaseline, unchangedDrift));

  validateLedger(contract, EXPECTED_LEDGER);
  const ledgerDrift = clone(EXPECTED_LEDGER); ledgerDrift[0].sha256 = "0".repeat(64);
  expectReject("LEDGER_EXACT_SEQUENCE_INVALID", () => validateLedger(contract, ledgerDrift));
  expectReject("LEDGER_COUNT_INVALID", () => validateLedger(contract, EXPECTED_LEDGER.slice(1)));

  const prodRefDrift = clone(contract); prodRefDrift.reference_files["docs/evidence/f0/PROD_FINGERPRINT_REFERENCE.txt"] = "0".repeat(64);
  expectReject("REFERENCE_CONTRACT_INVALID", () => validateContract(prodRefDrift));
  const migrationDrift = clone(contract); migrationDrift.candidate.migrations[11].sha256 = "0".repeat(64);
  expectReject("CANDIDATE_LEDGER_CONTRACT_INVALID", () => validateContract(migrationDrift));
  const migrationMissing = clone(contract); migrationMissing.candidate.migrations.pop();
  expectReject("CANDIDATE_LEDGER_CONTRACT_INVALID", () => validateContract(migrationMissing));
  const forbiddenDrift = clone(contract); forbiddenDrift.forbidden_delta.pop();
  expectReject("FORBIDDEN_DELTA_INVALID", () => validateContract(forbiddenDrift));
  const componentDrift = clone(contract); componentDrift.unchanged_components = componentDrift.unchanged_components.filter((x) => x !== "func");
  expectReject("COMPONENT_PARTITION_INVALID", () => validateContract(componentDrift));
  const manifestDrift = clone(contract);
  const firstW401 = manifestDrift.objects.find((object) => object.migration === "20260811154732");
  const firstW403 = manifestDrift.objects.find((object) => object.migration === "20260811184850");
  [firstW401.migration, firstW403.migration] = [firstW403.migration, firstW401.migration];
  expectReject("OBJECT_MANIFEST_INVALID", () => validateContract(manifestDrift));
  const capturedPending = clone(syntheticContract); capturedPending.capture_status = "CAPTURED_LOCAL";
  expectReject("CAPTURED_CONTRACT_CONTAINS_PENDING", () => validateContract(capturedPending));
  expectReject("CONTRACT_CAPTURE_PENDING", () => validateCheckReadiness(syntheticContract, ["--baseline-catalog", "x", "--candidate-catalog", "x", "--baseline-fingerprint", "x", "--candidate-fingerprint", "x", "--ledger", "x"]));
  const readyContract = clone(syntheticContract); readyContract.capture_status = "CAPTURED_LOCAL";
  for (const snapshot of [readyContract.baseline, readyContract.candidate]) {
    snapshot.catalog_payload_sha256 = "0".repeat(64);
    for (const component of COMPONENTS) snapshot.component_hashes[component] = "0".repeat(32);
  }
  for (const object of readyContract.objects) object.payload_sha256 = "0".repeat(64);
  validateCheckReadiness(readyContract, ["--baseline-catalog", "x", "--candidate-catalog", "x", "--baseline-fingerprint", "x", "--candidate-fingerprint", "x", "--ledger", "x"]);
  expectReject("CAPTURE_ARGUMENTS_REQUIRED", () => validateCheckReadiness(readyContract, []));
  validateLocalDatabaseUrl("postgresql://postgres:postgres@127.0.0.1:54322/postgres");
  expectReject("REMOTE_DATABASE_CAPTURE_FORBIDDEN", () => validateLocalDatabaseUrl("postgresql://postgres:postgres@db.example.com:5432/postgres"));
  expectReject("LOCAL_DATABASE_CREDENTIALS_INVALID", () => validateLocalDatabaseUrl("postgresql://service_role:secret@127.0.0.1:54322/postgres"));
  expectReject("REMOTE_DATABASE_CAPTURE_FORBIDDEN", () => validateLocalDatabaseUrl("postgresql://postgres:postgres@127.0.0.1:54322/postgres?host=db.example.com"));
  expectReject("CAPTURE_SELECTOR_REQUIRED", () => validateCaptureRequest(["--database-url", "postgresql://postgres:postgres@127.0.0.1:54322/postgres"]));
  validatePostgresMajor("170006");
  expectReject("POSTGRES_MAJOR_MISMATCH", () => validatePostgresMajor("160010"));
  if (PSQL_BASE_ARGS[0] !== "-X" || PSQL_BASE_ARGS.some((arg) => /^postgres(?:ql)?:/i.test(arg))) fail("SELFTEST_PSQL_ARG_ORDER_INVALID");
  console.log(JSON.stringify({ gate: "W4_CANDIDATE_SCHEMA_SELFTEST", status: "PASS", mutation_free: true }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
