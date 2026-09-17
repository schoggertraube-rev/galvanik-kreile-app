#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { KREILE_TENANT_SLUG } from "../../src/lib/tenant";
import {
  PRODUCT_ACTOR_ENVIRONMENT_VARIABLES,
  evaluateProductActorReadiness,
  evaluateProductActorReadinessFixture,
  readProductActorConfiguration,
  validateProductActorConfiguration,
  type ProductActorProfileRow,
} from "../../src/lib/server/productActorReadinessCore";

type GateStatus = "PASS" | "FAIL" | "OPEN";

type PreflightReceipt = {
  gate: "PRODUCT_ACTOR_DEPLOYMENT_PREFLIGHT";
  status: Exclude<GateStatus, "OPEN">;
  evidenceScope: "CONFIG_NAMES_ONLY";
  variables: Array<{ name: string; status: "SET" | "MISSING" }>;
  valuesRedacted: true;
  productionReadiness: "OPEN";
  postDeployEvidence: "OPEN";
  failureCode?: string;
};

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const LOCAL_DATABASE_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

function emit(receipt: object, receiptPath?: string): void {
  const serialized = `${JSON.stringify(receipt)}\n`;
  if (receiptPath) {
    const absolutePath = path.resolve(process.cwd(), receiptPath);
    writeFileSync(absolutePath, serialized, { encoding: "utf8", flag: "w" });
  }
  process.stdout.write(serialized);
}

function requestedReceiptPath(): string | undefined {
  const argument = process.argv.find((value) => value.startsWith("--receipt="));
  return argument?.slice("--receipt=".length) || undefined;
}

export function buildPreflightReceipt(
  environment: Readonly<Record<string, string | undefined>>,
): PreflightReceipt {
  const configuration = readProductActorConfiguration(environment);
  const validation = validateProductActorConfiguration(configuration);
  return {
    gate: "PRODUCT_ACTOR_DEPLOYMENT_PREFLIGHT",
    status: validation.ok ? "PASS" : "FAIL",
    evidenceScope: "CONFIG_NAMES_ONLY",
    variables: Object.values(PRODUCT_ACTOR_ENVIRONMENT_VARIABLES).map((name) => ({
      name,
      status: environment[name]?.trim() ? "SET" : "MISSING",
    })),
    valuesRedacted: true,
    productionReadiness: "OPEN",
    postDeployEvidence: "OPEN",
    ...(!validation.ok ? { failureCode: validation.code } : {}),
  };
}

function currentGitSha(): string | undefined {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim().toLowerCase();
  } catch {
    return undefined;
  }
}

function trackedGitWorktreeIsClean(): boolean {
  try {
    return execFileSync(
      "git",
      ["status", "--porcelain=v1", "--untracked-files=no"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    ).trim() === "";
  } catch {
    return false;
  }
}

function productionGuardFailure(): string | undefined {
  if (process.env.PRODUCT_ACTOR_GATE_TARGET !== "production") {
    return "PRODUCTION_TARGET_NOT_CONFIRMED";
  }
  if (process.env.PRODUCT_ACTOR_CONFIRM_REMOTE_READ_ONLY !== "YES") {
    return "REMOTE_READ_ONLY_NOT_CONFIRMED";
  }

  const expectedSha = process.env.PRODUCT_ACTOR_EXPECTED_SHA?.toLowerCase();
  const candidateSha = process.env.PRODUCT_ACTOR_CANDIDATE_SHA?.toLowerCase();
  const gitSha = currentGitSha();
  if (
    !expectedSha ||
    !candidateSha ||
    !gitSha ||
    !SHA_PATTERN.test(expectedSha) ||
    expectedSha !== candidateSha ||
    expectedSha !== gitSha
  ) {
    return "EXACT_SHA_MISMATCH";
  }
  if (!trackedGitWorktreeIsClean()) {
    return "EXACT_SHA_WORKTREE_DIRTY";
  }

  const databaseUrl = process.env.DATABASE_URL;
  try {
    const parsed = new URL(databaseUrl ?? "");
    if (
      !["postgres:", "postgresql:"].includes(parsed.protocol) ||
      LOCAL_DATABASE_HOSTS.has(parsed.hostname.toLowerCase()) ||
      parsed.hostname === "example.com" ||
      parsed.hostname.endsWith(".example.com") ||
      parsed.hostname.endsWith(".example")
    ) {
      return "PRODUCTION_DATABASE_NOT_CONFIRMED";
    }
  } catch {
    return "PRODUCTION_DATABASE_NOT_CONFIRMED";
  }

  return undefined;
}

function productionFailureReceipt(
  code: string,
  supportReference: string = randomUUID(),
) {
  return {
    gate: "PRODUCT_ACTOR_PRODUCTION_READINESS",
    status: "FAIL" as const,
    evidenceScope: "PRODUCTION_READINESS" as const,
    exactSha: process.env.PRODUCT_ACTOR_EXPECTED_SHA?.toLowerCase() ?? "UNAVAILABLE",
    valuesRedacted: true as const,
    failureCode: code,
    supportReference,
    postDeployEvidence: "OPEN" as const,
  };
}

async function runProductionReadiness(): Promise<number> {
  const guardFailure = productionGuardFailure();
  if (guardFailure) {
    emit(productionFailureReceipt(guardFailure), requestedReceiptPath());
    return 1;
  }

  const configuration = readProductActorConfiguration(process.env);
  const validation = validateProductActorConfiguration(configuration);
  if (!validation.ok) {
    emit(productionFailureReceipt(validation.code), requestedReceiptPath());
    return 1;
  }

  let profiles: ProductActorProfileRow[];
  const sql = postgres(process.env.DATABASE_URL as string, {
    max: 1,
    prepare: false,
  });
  try {
    profiles = await sql<ProductActorProfileRow[]>`
      SELECT
        id::text AS id,
        tenant_id AS "tenantId",
        role,
        active
      FROM public.app_users
      WHERE id = ANY(${sql.array(Object.values(validation.actors))}::uuid[])
    `;
  } catch {
    emit(
      productionFailureReceipt("PROFILE_READ_UNAVAILABLE"),
      requestedReceiptPath(),
    );
    return 1;
  } finally {
    await sql.end({ timeout: 5 }).catch(() => undefined);
  }

  const result = evaluateProductActorReadiness({
    configuration,
    profiles,
    tenantId: KREILE_TENANT_SLUG,
    supportReference: randomUUID(),
    evidenceScope: "PRODUCTION_READINESS",
  });
  if (!result.ok) {
    emit(
      productionFailureReceipt(result.code, result.supportReference),
      requestedReceiptPath(),
    );
    return 1;
  }

  emit(
    {
      gate: "PRODUCT_ACTOR_PRODUCTION_READINESS",
      status: "PASS",
      evidenceScope: result.evidenceScope,
      exactSha: process.env.PRODUCT_ACTOR_EXPECTED_SHA?.toLowerCase(),
      valuesRedacted: true,
      actors: {
        Rolf: "READY",
        Phillip: "READY",
        Gregor: "READY",
      },
      postDeployEvidence: "OPEN",
    },
    requestedReceiptPath(),
  );
  return 0;
}

function runSelftest(): number {
  const syntheticEnvironment = {
    KREILE_ROLF_APP_USER_ID: "11111111-1111-4111-8111-111111111111",
    KREILE_PHILLIP_APP_USER_ID: "22222222-2222-4222-8222-222222222222",
    KREILE_GREGOR_APP_USER_ID: "33333333-3333-4333-8333-333333333333",
  };
  const preflight = buildPreflightReceipt(syntheticEnvironment);
  const fixture = evaluateProductActorReadinessFixture({
    configuration: readProductActorConfiguration(syntheticEnvironment),
    tenantId: KREILE_TENANT_SLUG,
    profiles: [
      { id: syntheticEnvironment.KREILE_ROLF_APP_USER_ID, tenantId: KREILE_TENANT_SLUG, role: "meister", active: true },
      { id: syntheticEnvironment.KREILE_PHILLIP_APP_USER_ID, tenantId: KREILE_TENANT_SLUG, role: "werkstatt", active: true },
      { id: syntheticEnvironment.KREILE_GREGOR_APP_USER_ID, tenantId: KREILE_TENANT_SLUG, role: "admin", active: true },
    ],
  });
  const serializedPreflight = JSON.stringify(preflight);
  const leakedValue = Object.values(syntheticEnvironment).some((value) =>
    serializedPreflight.includes(value),
  );
  if (
    preflight.status !== "PASS" ||
    leakedValue ||
    !fixture.ok ||
    fixture.evidenceScope !== "SYNTHETIC_CI_FIXTURE"
  ) {
    emit({ gate: "PRODUCT_ACTOR_READINESS_SELFTEST", status: "FAIL" });
    return 1;
  }

  emit({
    gate: "PRODUCT_ACTOR_READINESS_SELFTEST",
    status: "PASS",
    syntheticCompatibility: "PASS",
    productionReadiness: "OPEN",
    postDeployEvidence: "OPEN",
    valuesRedacted: true,
  });
  return 0;
}

async function main(): Promise<void> {
  if (process.argv.includes("--selftest")) {
    process.exitCode = runSelftest();
    return;
  }
  if (process.argv.includes("--preflight")) {
    const receipt = buildPreflightReceipt(process.env);
    emit(receipt, requestedReceiptPath());
    process.exitCode = receipt.status === "PASS" ? 0 : 1;
    return;
  }
  if (process.argv.includes("--production")) {
    process.exitCode = await runProductionReadiness();
    return;
  }

  emit({
    gate: "PRODUCT_ACTOR_READINESS",
    status: "FAIL",
    failureCode: "MODE_REQUIRED",
  });
  process.exitCode = 1;
}

void main().catch(() => {
  emit({
    gate: "PRODUCT_ACTOR_READINESS",
    status: "FAIL",
    failureCode: "UNEXPECTED_GATE_FAILURE",
    valuesRedacted: true,
  });
  process.exitCode = 1;
});
