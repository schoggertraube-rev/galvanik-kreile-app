// Delivery-Governance-Gate (KR-01): prueft Paketmanifeste, rollende Queue,
// Evidenzzeiger und das Betriebsreceipt als eine fail-closed Wahrheit.
// Keine Netzwerkzugriffe und keine Mutation des geprueften Baums.

import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import yaml from "js-yaml";

export const DELIVERY_PATHS = Object.freeze({
  manifestDir: "docs/delivery/packages",
  manifestSchema: "docs/delivery/packages/PACKAGE_MANIFEST_SCHEMA_V2.json",
  queue: "docs/delivery/ROLLING_MANIFEST_QUEUE_V1.json",
  queueSchema: "docs/delivery/ROLLING_MANIFEST_QUEUE_SCHEMA_V1.json",
  mapping: "docs/delivery/GATE_MAPPING_V1.yaml",
  mission: "missions/F1_ORDER_TO_CASH_PILOT_001.yml",
  operatingReceipt: "docs/delivery/KR-01_BRANCH_PROTECTION_AND_OPERATING_RECEIPT_2026-09-29.json",
  operatingReceiptSchema: "docs/delivery/KR-01_BRANCH_PROTECTION_AND_OPERATING_RECEIPT_SCHEMA_V1.json",
});

export const LEGACY_MANIFEST_BINDINGS = Object.freeze({
  "KR-00E-DELIVERY-CONTRACT": Object.freeze({
    path: "docs/delivery/packages/KR-00E-DELIVERY-CONTRACT.yaml",
    sha256: "527AD0100BEF2B7130F1B75B6F79D4960EF94CD038141079C5D1BAFCBDD570D8",
  }),
  "KR-00G-DOCS-IMPORT": Object.freeze({
    path: "docs/delivery/packages/KR-00G-DOCS-IMPORT.yaml",
    sha256: "04877E37F6DF4017D79960BFCF423FA423FA45E7BC77FE9A35B16EB4812B8D0D",
  }),
});

function toPosix(value) {
  return value.replaceAll("\\", "/");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function readJson(root, rel, findings, label = rel) {
  const abs = path.join(root, rel);
  if (!existsSync(abs)) {
    findings.push(`[delivery] ${label}: Datei fehlt`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(abs, "utf8"));
  } catch (error) {
    findings.push(`[delivery] ${label}: ungueltiges JSON (${error.message})`);
    return null;
  }
}

function readYaml(root, rel, findings, label = rel) {
  const abs = path.join(root, rel);
  if (!existsSync(abs)) {
    findings.push(`[delivery] ${label}: Datei fehlt`);
    return null;
  }
  try {
    const value = yaml.load(readFileSync(abs, "utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      findings.push(`[delivery] ${label}: YAML-Wurzel muss ein Objekt sein`);
      return null;
    }
    return value;
  } catch (error) {
    findings.push(`[delivery] ${label}: ungueltiges YAML (${error.message})`);
    return null;
  }
}

function compileSchema(schema, label, findings) {
  if (!schema) return null;
  try {
    const ajv = new Ajv({ allErrors: true, $data: true, jsonPointers: true });
    return ajv.compile(schema);
  } catch (error) {
    findings.push(`[delivery] ${label}: Schema kompiliert nicht (${error.message})`);
    return null;
  }
}

function validateWith(validate, value, label, findings) {
  if (!validate || value === null) return;
  if (validate(value)) return;
  for (const error of validate.errors ?? []) {
    findings.push(`[delivery] ${label}${error.dataPath || ""}: ${error.message}`);
  }
}

function manifestFiles(root) {
  const abs = path.join(root, DELIVERY_PATHS.manifestDir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".yaml"))
    .map((entry) => toPosix(path.join(DELIVERY_PATHS.manifestDir, entry.name)))
    .sort();
}

function gateTargets(manifest) {
  return new Set([
    ...(Array.isArray(manifest.local_gates) ? manifest.local_gates : []),
    ...(Array.isArray(manifest.required_checks_after_push) ? manifest.required_checks_after_push : []),
    ...(Array.isArray(manifest.non_required_but_must_pass) ? manifest.non_required_but_must_pass : []),
  ]);
}

function receiptTargets(manifest) {
  const values = new Set();
  for (const lock of Array.isArray(manifest.source_locks) ? manifest.source_locks : []) {
    if (typeof lock?.source === "string") values.add(lock.source);
    if (typeof lock?.status === "string") values.add(lock.status);
  }
  for (const key of ["gate_mapping_contract", "findings_ledger_contract", "closure_receipt_contract"]) {
    if (typeof manifest[key] === "string") values.add(manifest[key]);
  }
  if (typeof manifest.dependency?.review_evidence === "string") values.add(manifest.dependency.review_evidence);
  return values;
}

function resolveEvidenceRefs(manifest, rel, findings) {
  if (!manifest.register_gate_evidence) return;
  const acceptance = new Set((manifest.acceptance ?? []).map((entry) => entry?.id).filter((id) => typeof id === "string"));
  const invariants = new Set(Object.keys(manifest.invariants ?? {}));
  const gates = gateTargets(manifest);
  const receipts = receiptTargets(manifest);

  for (const [gateName, evidence] of Object.entries(manifest.register_gate_evidence)) {
    const ref = evidence?.evidence_ref;
    if (typeof ref !== "string" || !ref.includes(":")) continue;
    const split = ref.indexOf(":");
    const kind = ref.slice(0, split);
    const target = ref.slice(split + 1);
    let resolved = false;
    if (kind === "acceptance") resolved = acceptance.has(target);
    else if (kind === "invariant") resolved = invariants.has(target);
    else if (kind === "gate") resolved = gates.has(target);
    else if (kind === "receipt") resolved = receipts.has(target);
    if (!resolved) findings.push(`[delivery] ${rel}: ${gateName} evidence_ref '${ref}' loest nicht im eigenen Manifest auf`);
  }
}

function checkLegacyBindings(root, manifests, findings) {
  const occurrences = new Map();
  for (const { rel, value } of manifests) {
    if (typeof value?.package_id !== "string") continue;
    if (!occurrences.has(value.package_id)) occurrences.set(value.package_id, []);
    occurrences.get(value.package_id).push(rel);
  }

  for (const [packageId, binding] of Object.entries(LEGACY_MANIFEST_BINDINGS)) {
    const seen = occurrences.get(packageId) ?? [];
    if (seen.length !== 1 || seen[0] !== binding.path) {
      findings.push(`[delivery] ${packageId}: Legacy-Ausnahme ist nur fuer '${binding.path}' erlaubt, gefunden ${seen.join(", ") || "nichts"}`);
    }
    const abs = path.join(root, binding.path);
    if (!existsSync(abs)) continue;
    const actual = sha256(readFileSync(abs));
    if (actual !== binding.sha256) {
      findings.push(`[delivery] ${binding.path}: Legacy-Hash ${actual}, erwartet ${binding.sha256}`);
    }
  }
}

function checkRollingConsistency(root, queue, mapping, mission, manifests, findings) {
  if (!queue || !mapping || !mission) return;
  const policy = queue.issuance_policy ?? {};
  const mapped = mapping.rolling_manifest_policy ?? {};
  const pairs = [
    ["one_materialized_contract_at_a_time", "one_materialized_contract_at_a_time"],
    ["exact_reviewed_parent_required", "exact_reviewed_parent_required"],
    ["candidate_chain_when_merge_unavailable", "candidate_chain_when_merge_unavailable"],
    ["candidate_is_not_main_delivery", "candidate_is_not_main_delivery"],
    ["rebase_and_reverify_after_real_main_change", "rebase_and_reverify_after_real_main_change"],
    ["no_periodic_build_automation", "no_periodic_build_automation"],
  ];
  for (const [queueKey, mappingKey] of pairs) {
    if (policy[queueKey] !== mapped[mappingKey]) {
      findings.push(`[delivery] Rolling-Policy-Drift: queue.${queueKey}=${String(policy[queueKey])}, mapping.${mappingKey}=${String(mapped[mappingKey])}`);
    }
  }
  if (policy.max_materialized_future_contracts !== mapped.materialized_future_contracts) {
    findings.push("[delivery] Rolling-Policy-Drift: materialized_future_contracts stimmt nicht ueberein");
  }

  const queueOrder = (queue.initial_horizon ?? []).map((entry) => entry.package_id);
  const mappingOrder = mapped.initial_pointer_order ?? [];
  if (JSON.stringify(queueOrder) !== JSON.stringify(mappingOrder)) {
    findings.push(`[delivery] Rolling-Policy-Drift: Queue-Reihenfolge ${queueOrder.join(" -> ")} != Mapping ${mappingOrder.join(" -> ")}`);
  }
  if (queue.next_contract_blueprint?.package_id !== queueOrder[0]) {
    findings.push("[delivery] next_contract_blueprint muss auf den ersten Queue-Zeiger zeigen");
  }
  const planned = queue.next_contract_blueprint?.planned_path;
  if (typeof planned === "string" && existsSync(path.join(root, planned))) {
    findings.push(`[delivery] ${planned}: Zukunftsmanifest ist vor Abschluss des Vorgaengers materialisiert`);
  }
  if ((queue.materialized_future_contracts ?? []).length !== 0) {
    findings.push("[delivery] materialized_future_contracts muss leer bleiben");
  }

  const activeId = mission.active_package;
  const active = manifests.filter(({ value }) => value?.package_id === activeId);
  if (active.length !== 1) findings.push(`[delivery] Mission active_package '${String(activeId)}' muss genau ein Manifest treffen`);
  if (active.length === 1) {
    if (active[0].value.base_sha !== mission.base_sha) findings.push("[delivery] Mission base_sha stimmt nicht mit aktivem Manifest ueberein");
    if (active[0].value.branch !== mission.branch) findings.push("[delivery] Mission branch stimmt nicht mit aktivem Manifest ueberein");
    if (active[0].value.queue_parent_sha !== queue.parent_candidate?.candidate_sha) {
      findings.push("[delivery] Aktives Manifest ist nicht an den Queue-Parent gebunden");
    }
  }
}

export function checkDeliveryContracts(root = process.cwd()) {
  root = path.resolve(root);
  const findings = [];
  const manifestSchema = readJson(root, DELIVERY_PATHS.manifestSchema, findings);
  const queueSchema = readJson(root, DELIVERY_PATHS.queueSchema, findings);
  const receiptSchema = readJson(root, DELIVERY_PATHS.operatingReceiptSchema, findings);
  const validateManifest = compileSchema(manifestSchema, DELIVERY_PATHS.manifestSchema, findings);
  const validateQueue = compileSchema(queueSchema, DELIVERY_PATHS.queueSchema, findings);
  const validateReceipt = compileSchema(receiptSchema, DELIVERY_PATHS.operatingReceiptSchema, findings);

  const manifests = manifestFiles(root).map((rel) => ({ rel, value: readYaml(root, rel, findings) }));
  for (const { rel, value } of manifests) {
    // KR-00B0/B/C/D sind historische V1-Vertraege aus der Bootstrap-Phase.
    // Sie bleiben parsebar, werden aber nicht nachtraeglich als V2 umgedeutet.
    if (value?.schema_version === 2) {
      validateWith(validateManifest, value, rel, findings);
      resolveEvidenceRefs(value, rel, findings);
    } else if (value?.schema_version !== 1) {
      findings.push(`[delivery] ${rel}: unbekannte schema_version '${String(value?.schema_version)}'`);
    }
  }
  checkLegacyBindings(root, manifests, findings);

  const queue = readJson(root, DELIVERY_PATHS.queue, findings);
  const mapping = readYaml(root, DELIVERY_PATHS.mapping, findings);
  const mission = readYaml(root, DELIVERY_PATHS.mission, findings);
  const receipt = readJson(root, DELIVERY_PATHS.operatingReceipt, findings);
  validateWith(validateQueue, queue, DELIVERY_PATHS.queue, findings);
  validateWith(validateReceipt, receipt, DELIVERY_PATHS.operatingReceipt, findings);
  checkRollingConsistency(root, queue, mapping, mission, manifests, findings);

  return { ok: findings.length === 0, findings: findings.sort() };
}

function fixtureFrom(root) {
  const target = mkdtempSync(path.join(tmpdir(), "kreile-delivery-selftest-"));
  cpSync(path.join(root, "docs/delivery"), path.join(target, "docs/delivery"), { recursive: true });
  cpSync(path.join(root, "missions"), path.join(target, "missions"), { recursive: true });
  return target;
}

function mutateYaml(abs, mutate) {
  const value = yaml.load(readFileSync(abs, "utf8"));
  mutate(value);
  writeFileSync(abs, yaml.dump(value, { lineWidth: 120, noRefs: true }));
}

export function runSelftest(root = process.cwd()) {
  const cases = [];
  const runCase = (name, mutate, expected) => {
    const fixture = fixtureFrom(root);
    try {
      mutate(fixture);
      const result = checkDeliveryContracts(fixture);
      if (result.ok || !result.findings.some((entry) => entry.includes(expected))) {
        throw new Error(`${name}: erwarteter Befund '${expected}' fehlt; erhalten ${result.findings.join(" | ")}`);
      }
      cases.push(name);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  };

  const baseline = checkDeliveryContracts(root);
  if (!baseline.ok) throw new Error(`baseline: ${baseline.findings.join(" | ")}`);
  cases.push("baseline");

  runCase("legacy-id-clone", (fixture) => {
    cpSync(
      path.join(fixture, LEGACY_MANIFEST_BINDINGS["KR-00E-DELIVERY-CONTRACT"].path),
      path.join(fixture, DELIVERY_PATHS.manifestDir, "FAKE-LEGACY.yaml"),
    );
  }, "Legacy-Ausnahme ist nur");

  runCase("unknown-evidence", (fixture) => {
    mutateYaml(path.join(fixture, DELIVERY_PATHS.manifestDir, "KR-01-GOVERNANCE-MERGE.yaml"), (value) => {
      value.register_gate_evidence.FUNCTIONAL_SLICE_PASS.evidence_ref = "acceptance:DOES-NOT-EXIST";
    });
  }, "loest nicht im eigenen Manifest auf");

  runCase("queue-order", (fixture) => {
    const abs = path.join(fixture, DELIVERY_PATHS.queue);
    const value = JSON.parse(readFileSync(abs, "utf8"));
    [value.initial_horizon[0], value.initial_horizon[1]] = [value.initial_horizon[1], value.initial_horizon[0]];
    writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`);
  }, "should be equal to constant");

  runCase("mapping-drift", (fixture) => {
    mutateYaml(path.join(fixture, DELIVERY_PATHS.mapping), (value) => {
      value.rolling_manifest_policy.candidate_is_not_main_delivery = false;
    });
  }, "Rolling-Policy-Drift");

  runCase("receipt-bypass", (fixture) => {
    const abs = path.join(fixture, DELIVERY_PATHS.operatingReceipt);
    const value = JSON.parse(readFileSync(abs, "utf8"));
    value.active_ruleset.bypass_actors.push("admin");
    writeFileSync(abs, `${JSON.stringify(value, null, 2)}\n`);
  }, "should NOT have more than 0 items");

  return cases;
}

function parseArgs(argv) {
  const options = { root: process.cwd(), selftest: false };
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === "--root") options.root = path.resolve(argv[++index]);
    else if (argv[index] === "--selftest") options.selftest = true;
    else throw new Error(`Unbekanntes Argument: ${argv[index]}`);
  }
  return options;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const options = parseArgs(process.argv.slice(2));
  if (options.selftest) {
    const cases = runSelftest(options.root);
    console.log(`delivery-contracts selftest: PASS (${cases.length}/${cases.length})`);
  } else {
    const result = checkDeliveryContracts(options.root);
    if (result.ok) {
      console.log("delivery-contracts: PASS (Manifeste, Evidenzzeiger, Legacy-Bindung, Queue, Mapping, Betriebsreceipt)");
    } else {
      console.error(`delivery-contracts: ${result.findings.length} Verstoss/Verstoesse`);
      for (const finding of result.findings) console.error(`  ${finding}`);
      process.exitCode = 1;
    }
  }
}
