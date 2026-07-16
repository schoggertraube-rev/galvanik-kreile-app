import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenantOperatorControls } from "@/db/schema_operator";
import { DEFAULT_PLAN } from "@/config/license.config";
import type { LicensePlan } from "@/lib/license/types";
import {
  OPERATOR_CONTROL_TENANT,
  canonicalizeOperatorControlPolicy,
  parseOperatorControlEnvelope,
  verifyOperatorControlSignature,
  type OperatorControlMode,
  type OperatorControlReason,
} from "@/lib/operator/controlContract";

export type OperatorControlAvailability =
  | "available"
  | "not_configured"
  | "unavailable"
  | "invalid_signature"
  | "scheduled"
  | "expired";

export type OperatorControlStatus = {
  tenantId: typeof OPERATOR_CONTROL_TENANT;
  availability: OperatorControlAvailability;
  plan: LicensePlan;
  mode: OperatorControlMode;
  reason: OperatorControlReason | null;
  notice: string | null;
  effectiveAt: string | null;
  expiresAt: string | null;
  issuedAt: string | null;
  policyVersion: number | null;
  enforced: boolean;
  accessRestricted: boolean;
};

function fallbackStatus(
  availability: Exclude<OperatorControlAvailability, "available">,
  policyVersion: number | null = null,
): OperatorControlStatus {
  return {
    tenantId: OPERATOR_CONTROL_TENANT,
    availability,
    plan: DEFAULT_PLAN,
    mode: "active",
    reason: null,
    notice: null,
    effectiveAt: null,
    expiresAt: null,
    issuedAt: null,
    policyVersion,
    enforced: false,
    accessRestricted: false,
  };
}

export async function resolveOperatorControlForTenant(
  tenantId: string,
  now = new Date(),
): Promise<OperatorControlStatus> {
  if (tenantId !== OPERATOR_CONTROL_TENANT) return fallbackStatus("not_configured");

  const publicKey = process.env.OPERATOR_CONTROL_PUBLIC_KEY_PEM?.trim();
  if (!publicKey) return fallbackStatus("unavailable");

  let row: typeof tenantOperatorControls.$inferSelect | undefined;
  try {
    const rows = await db
      .select()
      .from(tenantOperatorControls)
      .where(eq(tenantOperatorControls.tenantId, OPERATOR_CONTROL_TENANT));
    row = rows[0];
  } catch {
    return fallbackStatus("unavailable");
  }
  if (!row) return fallbackStatus("not_configured");

  try {
    const envelope = parseOperatorControlEnvelope({
      policy: JSON.parse(row.canonicalPayload),
      signature: row.signature,
    }, now.getTime());
    const canonicalPayload = canonicalizeOperatorControlPolicy(envelope.policy);
    const columnsMatch =
      canonicalPayload === row.canonicalPayload &&
      envelope.policy.tenantId === row.tenantId &&
      envelope.policy.plan === row.plan &&
      envelope.policy.mode === row.mode &&
      envelope.policy.reason === row.reason &&
      envelope.policy.notice === row.notice &&
      envelope.policy.effectiveAt === new Date(row.effectiveAt).toISOString() &&
      envelope.policy.expiresAt === (row.expiresAt ? new Date(row.expiresAt).toISOString() : null) &&
      envelope.policy.issuedAt === new Date(row.issuedAt).toISOString() &&
      envelope.policy.policyVersion === Number(row.policyVersion);
    if (!columnsMatch || !verifyOperatorControlSignature(envelope.policy, envelope.signature, publicKey)) {
      return fallbackStatus("invalid_signature", Number(row.policyVersion) || null);
    }

    const effectiveMs = Date.parse(envelope.policy.effectiveAt);
    const expiresMs = envelope.policy.expiresAt ? Date.parse(envelope.policy.expiresAt) : null;
    if (now.getTime() < effectiveMs) return fallbackStatus("scheduled", envelope.policy.policyVersion);
    if (expiresMs !== null && now.getTime() >= expiresMs) return fallbackStatus("expired", envelope.policy.policyVersion);

    const accessRestricted = envelope.policy.mode === "suspended" || envelope.policy.mode === "maintenance";
    return {
      tenantId: OPERATOR_CONTROL_TENANT,
      availability: "available",
      plan: envelope.policy.plan,
      mode: envelope.policy.mode,
      reason: envelope.policy.reason,
      notice: envelope.policy.notice,
      effectiveAt: envelope.policy.effectiveAt,
      expiresAt: envelope.policy.expiresAt,
      issuedAt: envelope.policy.issuedAt,
      policyVersion: envelope.policy.policyVersion,
      enforced: true,
      accessRestricted,
    };
  } catch {
    return fallbackStatus("invalid_signature", Number(row.policyVersion) || null);
  }
}
