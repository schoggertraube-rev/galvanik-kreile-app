import { createPublicKey, verify } from "node:crypto";
import type { LicensePlan } from "@/lib/license/types";

export const OPERATOR_CONTROL_TENANT = "galvanik-kreile" as const;
export const OPERATOR_CONTROL_PLANS = ["basis", "pro", "premium", "enterprise"] as const;
export const OPERATOR_CONTROL_MODES = ["active", "grace", "suspended", "maintenance"] as const;
export const OPERATOR_CONTROL_REASONS = [
  "payment_overdue",
  "contract_ended",
  "maintenance",
  "security_incident",
  "manual_review",
  "restored",
] as const;

export type OperatorControlMode = typeof OPERATOR_CONTROL_MODES[number];
export type OperatorControlReason = typeof OPERATOR_CONTROL_REASONS[number];

export type OperatorControlPolicy = {
  tenantId: typeof OPERATOR_CONTROL_TENANT;
  plan: LicensePlan;
  mode: OperatorControlMode;
  reason: OperatorControlReason;
  notice: string | null;
  effectiveAt: string;
  expiresAt: string | null;
  issuedAt: string;
  policyVersion: number;
};

export type OperatorControlEnvelope = {
  policy: OperatorControlPolicy;
  signature: string;
};

const ENVELOPE_KEYS = ["policy", "signature"] as const;
const POLICY_KEYS = [
  "tenantId",
  "plan",
  "mode",
  "reason",
  "notice",
  "effectiveAt",
  "expiresAt",
  "issuedAt",
  "policyVersion",
] as const;
const ED25519_SIGNATURE = /^[A-Za-z0-9_-]{86}$/;

const ALLOWED_REASONS: Record<OperatorControlMode, readonly OperatorControlReason[]> = {
  active: ["restored"],
  grace: ["payment_overdue", "manual_review"],
  suspended: ["payment_overdue", "contract_ended", "security_incident", "manual_review"],
  maintenance: ["maintenance", "security_incident"],
};

function strictObject(value: unknown, expectedKeys: readonly string[], errorCode: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(errorCode);
  const object = value as Record<string, unknown>;
  const actualKeys = Object.keys(object).sort();
  const wantedKeys = [...expectedKeys].sort();
  if (actualKeys.length !== wantedKeys.length || actualKeys.some((key, index) => key !== wantedKeys[index])) {
    throw new Error(errorCode);
  }
  return object;
}

function canonicalTimestamp(value: unknown, errorCode: string): string {
  if (typeof value !== "string" || value.length < 20 || value.length > 30) throw new Error(errorCode);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new Error(errorCode);
  const canonical = new Date(milliseconds).toISOString();
  if (canonical !== value) throw new Error(errorCode);
  return canonical;
}

export function canonicalizeOperatorControlPolicy(policy: OperatorControlPolicy): string {
  return JSON.stringify({
    tenantId: policy.tenantId,
    plan: policy.plan,
    mode: policy.mode,
    reason: policy.reason,
    notice: policy.notice,
    effectiveAt: policy.effectiveAt,
    expiresAt: policy.expiresAt,
    issuedAt: policy.issuedAt,
    policyVersion: policy.policyVersion,
  });
}

export function parseOperatorControlEnvelope(value: unknown, nowMs = Date.now()): OperatorControlEnvelope {
  const envelope = strictObject(value, ENVELOPE_KEYS, "INVALID_OPERATOR_CONTROL_ENVELOPE");
  const source = strictObject(envelope.policy, POLICY_KEYS, "INVALID_OPERATOR_CONTROL_POLICY");

  if (source.tenantId !== OPERATOR_CONTROL_TENANT) throw new Error("INVALID_OPERATOR_CONTROL_TENANT");
  if (typeof source.plan !== "string" || !OPERATOR_CONTROL_PLANS.includes(source.plan as LicensePlan)) {
    throw new Error("INVALID_OPERATOR_CONTROL_PLAN");
  }
  if (typeof source.mode !== "string" || !OPERATOR_CONTROL_MODES.includes(source.mode as OperatorControlMode)) {
    throw new Error("INVALID_OPERATOR_CONTROL_MODE");
  }
  if (typeof source.reason !== "string" || !OPERATOR_CONTROL_REASONS.includes(source.reason as OperatorControlReason)) {
    throw new Error("INVALID_OPERATOR_CONTROL_REASON");
  }

  const mode = source.mode as OperatorControlMode;
  const reason = source.reason as OperatorControlReason;
  if (!ALLOWED_REASONS[mode].includes(reason)) throw new Error("INCONSISTENT_OPERATOR_CONTROL_REASON");

  let notice: string | null = null;
  if (source.notice !== null) {
    if (
      typeof source.notice !== "string" ||
      source.notice.length < 1 ||
      source.notice.length > 500 ||
      source.notice !== source.notice.trim() ||
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(source.notice)
    ) {
      throw new Error("INVALID_OPERATOR_CONTROL_NOTICE");
    }
    notice = source.notice;
  }
  if (mode !== "active" && notice === null) throw new Error("OPERATOR_CONTROL_NOTICE_REQUIRED");

  const effectiveAt = canonicalTimestamp(source.effectiveAt, "INVALID_OPERATOR_CONTROL_EFFECTIVE_AT");
  const issuedAt = canonicalTimestamp(source.issuedAt, "INVALID_OPERATOR_CONTROL_ISSUED_AT");
  if (Date.parse(issuedAt) > nowMs + 5 * 60 * 1_000) throw new Error("FUTURE_OPERATOR_CONTROL_ISSUED_AT");

  const expiresAt = source.expiresAt === null
    ? null
    : canonicalTimestamp(source.expiresAt, "INVALID_OPERATOR_CONTROL_EXPIRES_AT");
  if (expiresAt !== null && Date.parse(expiresAt) <= Date.parse(effectiveAt)) {
    throw new Error("INVALID_OPERATOR_CONTROL_WINDOW");
  }
  if (mode === "grace" && expiresAt === null) throw new Error("OPERATOR_CONTROL_GRACE_EXPIRY_REQUIRED");

  if (!Number.isSafeInteger(source.policyVersion) || Number(source.policyVersion) < 1) {
    throw new Error("INVALID_OPERATOR_CONTROL_VERSION");
  }
  if (typeof envelope.signature !== "string" || !ED25519_SIGNATURE.test(envelope.signature)) {
    throw new Error("INVALID_OPERATOR_CONTROL_SIGNATURE_ENCODING");
  }
  const signatureBytes = Buffer.from(envelope.signature, "base64url");
  if (
    signatureBytes.length !== 64 ||
    signatureBytes.toString("base64url") !== envelope.signature
  ) {
    throw new Error("INVALID_OPERATOR_CONTROL_SIGNATURE_ENCODING");
  }

  return {
    policy: {
      tenantId: OPERATOR_CONTROL_TENANT,
      plan: source.plan as LicensePlan,
      mode,
      reason,
      notice,
      effectiveAt,
      expiresAt,
      issuedAt,
      policyVersion: Number(source.policyVersion),
    },
    signature: envelope.signature,
  };
}

export function normalizeOperatorPublicKeyPem(value: string): string {
  return value.trim().replace(/\\n/g, "\n");
}

export function verifyOperatorControlSignature(
  policy: OperatorControlPolicy,
  signature: string,
  publicKeyPem: string,
): boolean {
  const key = createPublicKey(normalizeOperatorPublicKeyPem(publicKeyPem));
  if (key.asymmetricKeyType !== "ed25519") throw new Error("OPERATOR_CONTROL_PUBLIC_KEY_NOT_ED25519");
  return verify(
    null,
    Buffer.from(canonicalizeOperatorControlPolicy(policy), "utf8"),
    key,
    Buffer.from(signature, "base64url"),
  );
}
