#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";

const SHA_PATTERN = /^[0-9a-f]{40}$/;

type ProductionReadinessReceipt = {
  gate?: unknown;
  status?: unknown;
  evidenceScope?: unknown;
  exactSha?: unknown;
  valuesRedacted?: unknown;
  synthetic?: unknown;
};

function emit(receipt: object, receiptPath?: string): void {
  const serialized = `${JSON.stringify(receipt)}\n`;
  if (receiptPath) {
    writeFileSync(path.resolve(process.cwd(), receiptPath), serialized, {
      encoding: "utf8",
      flag: "w",
    });
  }
  process.stdout.write(serialized);
}

function requestedReceiptPath(): string | undefined {
  const argument = process.argv.find((value) => value.startsWith("--receipt="));
  return argument?.slice("--receipt=".length) || undefined;
}

export function validateProductionReceipt(
  receipt: ProductionReadinessReceipt,
  expectedSha: string,
  deployedSha: string,
): string | undefined {
  if (
    receipt.gate !== "PRODUCT_ACTOR_PRODUCTION_READINESS" ||
    receipt.status !== "PASS" ||
    receipt.evidenceScope !== "PRODUCTION_READINESS" ||
    receipt.valuesRedacted !== true ||
    receipt.synthetic !== undefined
  ) {
    return "PRODUCTION_READINESS_RECEIPT_INVALID";
  }
  if (
    !SHA_PATTERN.test(expectedSha) ||
    expectedSha !== deployedSha ||
    receipt.exactSha !== expectedSha
  ) {
    return "EXACT_SHA_MISMATCH";
  }
  return undefined;
}

function guardFailure(receipt: ProductionReadinessReceipt): string | undefined {
  if (process.env.PRODUCT_ACTOR_POST_DEPLOY_TARGET !== "production") {
    return "PRODUCTION_TARGET_NOT_CONFIRMED";
  }
  if (process.env.PRODUCT_ACTOR_CONFIRM_REMOTE_READ_ONLY !== "YES") {
    return "REMOTE_READ_ONLY_NOT_CONFIRMED";
  }

  const expectedSha = process.env.PRODUCT_ACTOR_EXPECTED_SHA?.toLowerCase() ?? "";
  const deployedSha = process.env.VERCEL_GIT_COMMIT_SHA?.toLowerCase() ?? "";
  const receiptFailure = validateProductionReceipt(receipt, expectedSha, deployedSha);
  if (receiptFailure) return receiptFailure;

  try {
    const origin = new URL(process.env.PRODUCT_ACTOR_PRODUCTION_ORIGIN ?? "");
    if (
      origin.protocol !== "https:" ||
      origin.username !== "" ||
      origin.password !== "" ||
      origin.pathname !== "/" ||
      origin.search !== "" ||
      origin.hash !== "" ||
      ["localhost", "127.0.0.1", "::1"].includes(origin.hostname.toLowerCase()) ||
      origin.hostname === "example.com" ||
      origin.hostname.endsWith(".example.com") ||
      origin.hostname.endsWith(".example")
    ) {
      return "PRODUCTION_ORIGIN_NOT_CONFIRMED";
    }
  } catch {
    return "PRODUCTION_ORIGIN_NOT_CONFIRMED";
  }

  for (const name of [
    "PRODUCT_ACTOR_ROLF_PIN",
    "PRODUCT_ACTOR_PHILLIP_PIN",
    "PRODUCT_ACTOR_GREGOR_EMAIL",
    "PRODUCT_ACTOR_GREGOR_PASSWORD",
  ]) {
    if (!process.env[name]) return "LOGIN_EVIDENCE_INPUT_MISSING";
  }
  if (
    !/^\d{4}$/.test(process.env.PRODUCT_ACTOR_ROLF_PIN ?? "") ||
    !/^\d{4}$/.test(process.env.PRODUCT_ACTOR_PHILLIP_PIN ?? "") ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(
      process.env.PRODUCT_ACTOR_GREGOR_EMAIL ?? "",
    )
  ) {
    return "LOGIN_EVIDENCE_INPUT_INVALID";
  }
  return undefined;
}

async function assertPath(page: Page, expectedPath: string): Promise<void> {
  await page.waitForURL((url) => url.pathname === expectedPath, {
    timeout: 30_000,
  });
}

async function assertIdentity(
  page: Page,
  actor: "Rolf" | "Phillip" | "Gregor",
): Promise<void> {
  if (actor === "Rolf") {
    await page.getByRole("heading", { name: "Guten Tag, Rolf" }).waitFor();
    await page.getByText("Rolf", { exact: true }).first().waitFor();
    return;
  }
  if (actor === "Phillip") {
    await page.getByRole("heading", { name: "Werkstatt" }).waitFor();
    await page.getByText("Phillip", { exact: true }).first().waitFor();
    return;
  }
  await page.getByTestId("gregor-system-admin").waitFor();
  await page.getByTestId("gregor-system-admin").getByText(/Gregor/).waitFor();
}

async function verifyPinActor(input: {
  origin: string;
  actor: "Rolf" | "Phillip";
  pin: string;
}): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(`${input.origin}/start`, { waitUntil: "networkidle" });
    const card = page.getByRole("button", { name: new RegExp(`^${input.actor}\\b`) });
    await card.click();
    const dialog = page.getByTestId("pin-login-dialog");
    for (const digit of input.pin) {
      await dialog.getByRole("button", { name: digit, exact: true }).click();
    }
    await assertPath(page, "/");
    await assertIdentity(page, input.actor);
    await page.reload({ waitUntil: "networkidle" });
    await assertPath(page, "/");
    await assertIdentity(page, input.actor);
  } finally {
    await context.close();
    await browser.close();
  }
}

async function verifyGregor(input: {
  origin: string;
  email: string;
  password: string;
}): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(`${input.origin}/start`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /^Gregor\b/ }).click();
    const dialog = page.getByTestId("email-login-dialog");
    await dialog.locator("#email").fill(input.email);
    await dialog.locator("#password").fill(input.password);
    await dialog.getByRole("button", { name: "Einloggen", exact: true }).click();
    await assertPath(page, "/settings");
    await assertIdentity(page, "Gregor");
    await page.reload({ waitUntil: "networkidle" });
    await assertPath(page, "/settings");
    await assertIdentity(page, "Gregor");
  } finally {
    await context.close();
    await browser.close();
  }
}

function readProductionReceipt(): ProductionReadinessReceipt | undefined {
  const receiptPath = process.env.PRODUCT_ACTOR_PRODUCTION_READINESS_RECEIPT;
  if (!receiptPath) return undefined;
  try {
    return JSON.parse(readFileSync(path.resolve(process.cwd(), receiptPath), "utf8"));
  } catch {
    return undefined;
  }
}

async function runProductionSmoke(): Promise<number> {
  const receipt = readProductionReceipt();
  const failure = receipt
    ? guardFailure(receipt)
    : "PRODUCTION_READINESS_RECEIPT_MISSING";
  if (failure) {
    emit({
      gate: "PRODUCT_ACTOR_POST_DEPLOY_SMOKE",
      status: "FAIL",
      evidenceScope: "POST_DEPLOY_BROWSER",
      failureCode: failure,
      valuesRedacted: true,
    }, requestedReceiptPath());
    return 1;
  }

  const origin = process.env.PRODUCT_ACTOR_PRODUCTION_ORIGIN as string;
  try {
    await verifyPinActor({
      origin,
      actor: "Rolf",
      pin: process.env.PRODUCT_ACTOR_ROLF_PIN as string,
    });
    await verifyPinActor({
      origin,
      actor: "Phillip",
      pin: process.env.PRODUCT_ACTOR_PHILLIP_PIN as string,
    });
    await verifyGregor({
      origin,
      email: process.env.PRODUCT_ACTOR_GREGOR_EMAIL as string,
      password: process.env.PRODUCT_ACTOR_GREGOR_PASSWORD as string,
    });
  } catch {
    emit({
      gate: "PRODUCT_ACTOR_POST_DEPLOY_SMOKE",
      status: "FAIL",
      evidenceScope: "POST_DEPLOY_BROWSER",
      exactSha: process.env.PRODUCT_ACTOR_EXPECTED_SHA?.toLowerCase(),
      failureCode: "BROWSER_ASSERTION_FAILED",
      valuesRedacted: true,
    }, requestedReceiptPath());
    return 1;
  }

  emit({
    gate: "PRODUCT_ACTOR_POST_DEPLOY_SMOKE",
    status: "PASS",
    evidenceScope: "POST_DEPLOY_BROWSER",
    exactSha: process.env.PRODUCT_ACTOR_EXPECTED_SHA?.toLowerCase(),
    valuesRedacted: true,
    actors: {
      Rolf: { route: "/", reload: "PASS", identity: "PASS" },
      Phillip: { route: "/", reload: "PASS", identity: "PASS" },
      Gregor: { route: "/settings", reload: "PASS", identity: "PASS" },
    },
  }, requestedReceiptPath());
  return 0;
}

function runSelftest(): number {
  const sha = "a".repeat(40);
  const productionReceipt = {
    gate: "PRODUCT_ACTOR_PRODUCTION_READINESS",
    status: "PASS",
    evidenceScope: "PRODUCTION_READINESS",
    exactSha: sha,
    valuesRedacted: true,
  };
  const fixtureReceipt = {
    ...productionReceipt,
    evidenceScope: "SYNTHETIC_CI_FIXTURE",
    synthetic: true,
  };
  if (
    validateProductionReceipt(productionReceipt, sha, sha) !== undefined ||
    validateProductionReceipt(fixtureReceipt, sha, sha) !==
      "PRODUCTION_READINESS_RECEIPT_INVALID" ||
    validateProductionReceipt(productionReceipt, sha, "b".repeat(40)) !==
      "EXACT_SHA_MISMATCH"
  ) {
    emit({ gate: "PRODUCT_ACTOR_POST_DEPLOY_SELFTEST", status: "FAIL" });
    return 1;
  }
  emit({
    gate: "PRODUCT_ACTOR_POST_DEPLOY_SELFTEST",
    status: "PASS",
    syntheticCompatibility: "NOT_ACCEPTED_AS_PRODUCTION_EVIDENCE",
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
  if (process.argv.includes("--production")) {
    process.exitCode = await runProductionSmoke();
    return;
  }
  emit({
    gate: "PRODUCT_ACTOR_POST_DEPLOY_SMOKE",
    status: "FAIL",
    failureCode: "MODE_REQUIRED",
  });
  process.exitCode = 1;
}

void main().catch(() => {
  emit({
    gate: "PRODUCT_ACTOR_POST_DEPLOY_SMOKE",
    status: "FAIL",
    failureCode: "UNEXPECTED_GATE_FAILURE",
    valuesRedacted: true,
  });
  process.exitCode = 1;
});
