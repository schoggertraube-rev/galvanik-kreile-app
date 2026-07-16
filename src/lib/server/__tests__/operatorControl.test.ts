import { generateKeyPairSync, sign } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  canonicalizeOperatorControlPolicy,
  type OperatorControlPolicy,
} from "@/lib/operator/controlContract";
import { resolveOperatorControlForTenant } from "@/lib/server/operatorControl";

const mocks = vi.hoisted(() => ({ where: vi.fn() }));

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: mocks.where })),
    })),
  },
}));

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const publicKeyPem = publicKey.export({ format: "pem", type: "spki" }).toString();
const NOW = new Date("2026-07-15T12:00:00.000Z");

function policy(overrides: Partial<OperatorControlPolicy> = {}): OperatorControlPolicy {
  return {
    tenantId: "galvanik-kreile",
    plan: "basis",
    mode: "suspended",
    reason: "payment_overdue",
    notice: "Der Zugang ist wegen einer offenen Zahlung transparent ausgesetzt.",
    effectiveAt: "2026-07-15T11:00:00.000Z",
    expiresAt: null,
    issuedAt: "2026-07-15T10:59:00.000Z",
    policyVersion: 4,
    ...overrides,
  };
}

function storedRow(value: OperatorControlPolicy, tamperSignature = false) {
  const canonicalPayload = canonicalizeOperatorControlPolicy(value);
  const signature = sign(null, Buffer.from(canonicalPayload), privateKey).toString("base64url");
  return {
    tenantId: value.tenantId,
    plan: value.plan,
    mode: value.mode,
    reason: value.reason,
    notice: value.notice,
    effectiveAt: new Date(value.effectiveAt),
    expiresAt: value.expiresAt ? new Date(value.expiresAt) : null,
    issuedAt: new Date(value.issuedAt),
    policyVersion: value.policyVersion,
    canonicalPayload,
    signature: tamperSignature ? `${signature.slice(0, -1)}${signature.endsWith("A") ? "B" : "A"}` : signature,
    requestDigest: "a".repeat(64),
    receivedAt: NOW,
    updatedAt: NOW,
  };
}

describe("resolveOperatorControlForTenant", () => {
  beforeEach(() => {
    process.env.OPERATOR_CONTROL_PUBLIC_KEY_PEM = publicKeyPem;
    mocks.where.mockReset();
  });

  afterEach(() => {
    delete process.env.OPERATOR_CONTROL_PUBLIC_KEY_PEM;
  });

  it("enforces a valid current restriction and applies its signed plan", async () => {
    mocks.where.mockResolvedValue([storedRow(policy())]);
    const result = await resolveOperatorControlForTenant("galvanik-kreile", NOW);
    expect(result).toMatchObject({
      availability: "available",
      plan: "basis",
      mode: "suspended",
      policyVersion: 4,
      enforced: true,
      accessRestricted: true,
    });
  });

  it("fails open when the signature is invalid", async () => {
    mocks.where.mockResolvedValue([storedRow(policy(), true)]);
    const result = await resolveOperatorControlForTenant("galvanik-kreile", NOW);
    expect(result).toMatchObject({
      availability: "invalid_signature",
      plan: "pro",
      mode: "active",
      enforced: false,
      accessRestricted: false,
    });
  });

  it("does not apply scheduled or expired state", async () => {
    mocks.where.mockResolvedValue([storedRow(policy({
      effectiveAt: "2026-07-16T12:00:00.000Z",
      issuedAt: "2026-07-15T11:59:00.000Z",
    }))]);
    expect(await resolveOperatorControlForTenant("galvanik-kreile", NOW)).toMatchObject({
      availability: "scheduled",
      enforced: false,
    });

    mocks.where.mockResolvedValue([storedRow(policy({
      effectiveAt: "2026-07-13T12:00:00.000Z",
      expiresAt: "2026-07-14T12:00:00.000Z",
    }))]);
    expect(await resolveOperatorControlForTenant("galvanik-kreile", NOW)).toMatchObject({
      availability: "expired",
      enforced: false,
    });
  });

  it("fails open when configuration or storage is unavailable", async () => {
    delete process.env.OPERATOR_CONTROL_PUBLIC_KEY_PEM;
    expect(await resolveOperatorControlForTenant("galvanik-kreile", NOW)).toMatchObject({
      availability: "unavailable",
      enforced: false,
    });

    process.env.OPERATOR_CONTROL_PUBLIC_KEY_PEM = publicKeyPem;
    mocks.where.mockRejectedValue(new Error("offline"));
    expect(await resolveOperatorControlForTenant("galvanik-kreile", NOW)).toMatchObject({
      availability: "unavailable",
      enforced: false,
    });
  });
});
