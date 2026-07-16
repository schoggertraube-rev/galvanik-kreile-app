import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  canonicalizeOperatorControlPolicy,
  parseOperatorControlEnvelope,
  verifyOperatorControlSignature,
  type OperatorControlPolicy,
} from "./controlContract";

const NOW = Date.parse("2026-07-15T12:00:00.000Z");
const BASE_POLICY: OperatorControlPolicy = {
  tenantId: "galvanik-kreile",
  plan: "pro",
  mode: "grace",
  reason: "payment_overdue",
  notice: "Die Zahlungsfrist ist überschritten. Der Zugang bleibt bis zum angegebenen Termin aktiv.",
  effectiveAt: "2026-07-15T12:00:00.000Z",
  expiresAt: "2026-07-22T12:00:00.000Z",
  issuedAt: "2026-07-15T11:59:00.000Z",
  policyVersion: 7,
};

function signedEnvelope(policy: OperatorControlPolicy = BASE_POLICY) {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const signature = sign(null, Buffer.from(canonicalizeOperatorControlPolicy(policy)), privateKey).toString("base64url");
  return {
    envelope: { policy, signature },
    publicKeyPem: publicKey.export({ format: "pem", type: "spki" }).toString(),
  };
}

describe("operator control contract", () => {
  it("accepts a strict signed Ed25519 policy and preserves canonical bytes", () => {
    const { envelope, publicKeyPem } = signedEnvelope();
    const parsed = parseOperatorControlEnvelope(envelope, NOW);
    expect(canonicalizeOperatorControlPolicy(parsed.policy)).toBe(canonicalizeOperatorControlPolicy(BASE_POLICY));
    expect(verifyOperatorControlSignature(parsed.policy, parsed.signature, publicKeyPem)).toBe(true);
  });

  it("rejects unknown fields, arbitrary tenants and non-canonical timestamps", () => {
    const { envelope } = signedEnvelope();
    expect(() => parseOperatorControlEnvelope({ ...envelope, tenantId: "attacker" }, NOW)).toThrow();
    expect(() => parseOperatorControlEnvelope({
      ...envelope,
      policy: { ...envelope.policy, tenantId: "other" },
    }, NOW)).toThrow("INVALID_OPERATOR_CONTROL_TENANT");
    expect(() => parseOperatorControlEnvelope({
      ...envelope,
      policy: { ...envelope.policy, issuedAt: "2026-07-15T11:59:00Z" },
    }, NOW)).toThrow("INVALID_OPERATOR_CONTROL_ISSUED_AT");
  });

  it("requires a visible notice for restrictions and an expiry for grace", () => {
    const suspended = signedEnvelope({ ...BASE_POLICY, mode: "suspended", notice: null });
    expect(() => parseOperatorControlEnvelope(suspended.envelope, NOW)).toThrow("OPERATOR_CONTROL_NOTICE_REQUIRED");
    const grace = signedEnvelope({ ...BASE_POLICY, expiresAt: null });
    expect(() => parseOperatorControlEnvelope(grace.envelope, NOW)).toThrow("OPERATOR_CONTROL_GRACE_EXPIRY_REQUIRED");
  });

  it("rejects inconsistent reason semantics and tampered signatures", () => {
    const inconsistent = signedEnvelope({ ...BASE_POLICY, mode: "maintenance", reason: "payment_overdue" });
    expect(() => parseOperatorControlEnvelope(inconsistent.envelope, NOW)).toThrow("INCONSISTENT_OPERATOR_CONTROL_REASON");

    const { envelope, publicKeyPem } = signedEnvelope();
    const parsed = parseOperatorControlEnvelope(envelope, NOW);
    expect(verifyOperatorControlSignature({ ...parsed.policy, policyVersion: 8 }, parsed.signature, publicKeyPem)).toBe(false);
  });

  it("rejects non-canonical base64url aliases of the same signature bytes", () => {
    const { envelope } = signedEnvelope();
    const last = envelope.signature.at(-1) || "A";
    const aliases = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
      .split("")
      .filter((candidate) => candidate !== last)
      .map((candidate) => `${envelope.signature.slice(0, -1)}${candidate}`)
      .filter((candidate) => Buffer.from(candidate, "base64url").equals(Buffer.from(envelope.signature, "base64url")));
    expect(aliases.length).toBeGreaterThan(0);
    expect(() => parseOperatorControlEnvelope({ ...envelope, signature: aliases[0] }, NOW))
      .toThrow("INVALID_OPERATOR_CONTROL_SIGNATURE_ENCODING");
  });

  it("rejects unsafe version and time windows", () => {
    const invalidVersion = signedEnvelope({ ...BASE_POLICY, policyVersion: 0 });
    expect(() => parseOperatorControlEnvelope(invalidVersion.envelope, NOW)).toThrow("INVALID_OPERATOR_CONTROL_VERSION");
    const invalidWindow = signedEnvelope({ ...BASE_POLICY, expiresAt: BASE_POLICY.effectiveAt });
    expect(() => parseOperatorControlEnvelope(invalidWindow.envelope, NOW)).toThrow("INVALID_OPERATOR_CONTROL_WINDOW");
  });
});
