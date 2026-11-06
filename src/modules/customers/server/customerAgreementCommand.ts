import "server-only";

import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { type PrivilegedTenantTransaction, withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import {
  CUSTOMER_AGREEMENT_TYPES,
  type CustomerAgreementCommandResult,
  type CustomerAgreementRecord,
  type CustomerAgreementType,
  type CustomerCommandContext,
} from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TYPES = new Set<string>(CUSTOMER_AGREEMENT_TYPES);

type AgreementRow = {
  id: string;
  customer_id: string;
  order_id: string | null;
  position: number;
  typ: string | null;
  ziel_tage: number | null;
  gueltig_bis: Date | string | null;
  grund: string | null;
  version: number;
  widerrufen_am: Date | string | null;
  widerrufen_von: string | null;
  widerruf_grund: string | null;
  created_at: Date | string;
  created_by: string | null;
};

type MutationRow = {
  result_code: string;
  agreement_id: string | null;
  replayed: boolean | null;
  result_message: string | null;
};

type SaveEnvelope = {
  clientKey: string;
  customerId: string;
  orderId: string | null;
  type: string;
  targetDays: number | null;
  validUntil: string | null;
  reason: string;
  version: number | null;
};

type RevokeEnvelope = {
  clientKey: string;
  agreementId: string;
  reason: string;
  version: number;
};

function object(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object" && !Array.isArray(input);
}

function onlyKeys(input: Record<string, unknown>, allowed: readonly string[]) {
  return Object.keys(input).every((key) => allowed.includes(key));
}

function uuid(value: unknown): string | null {
  return typeof value === "string" && UUID.test(value) ? value : null;
}

function id(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= 128 ? value.trim() : null;
}

function optionalId(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  return id(value) ?? undefined;
}

function date(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !DATE.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value ? undefined : value;
}

function integerOrNull(value: unknown): number | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  return Number.isSafeInteger(value) ? value as number : undefined;
}

function parseSaveEnvelope(input: unknown): SaveEnvelope | null {
  if (!object(input) || !onlyKeys(input, ["clientKey", "customerId", "orderId", "type", "targetDays", "validUntil", "reason", "version"])) return null;
  const clientKey = uuid(input.clientKey);
  const customerId = id(input.customerId);
  const orderId = optionalId(input.orderId);
  const targetDays = integerOrNull(input.targetDays);
  const validUntil = date(input.validUntil);
  const version = integerOrNull(input.version);
  if (!clientKey || !customerId || orderId === undefined || targetDays === undefined || validUntil === undefined || version === undefined || typeof input.type !== "string" || typeof input.reason !== "string" || (version !== null && version < 1)) return null;
  return { clientKey, customerId, orderId, type: input.type, targetDays, validUntil, reason: input.reason.trim(), version };
}

function parseRevokeEnvelope(input: unknown): RevokeEnvelope | null {
  if (!object(input) || !onlyKeys(input, ["clientKey", "agreementId", "reason", "version"])) return null;
  const clientKey = uuid(input.clientKey);
  const agreementId = uuid(input.agreementId);
  if (!clientKey || !agreementId || typeof input.reason !== "string" || !Number.isSafeInteger(input.version) || (input.version as number) < 1) return null;
  return { clientKey, agreementId, reason: input.reason.trim(), version: input.version as number };
}

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}

function day(value: Date | string | null): string | null {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return DATE.test(value) ? value : null;
}

function record(row: AgreementRow): CustomerAgreementRecord {
  if (!UUID.test(row.id) || !id(row.customer_id) || !Number.isInteger(row.position) || row.position < 1 || row.position > 20 || !row.typ || !TYPES.has(row.typ) || !Number.isInteger(row.version) || row.version < 1) {
    throw new Error("CUSTOMER_AGREEMENT_ROW_INVALID");
  }
  const createdAt = iso(row.created_at);
  const validUntil = day(row.gueltig_bis);
  const revokedAt = iso(row.widerrufen_am);
  if (!createdAt || (row.gueltig_bis !== null && !validUntil)) throw new Error("CUSTOMER_AGREEMENT_DATE_INVALID");
  return {
    id: row.id,
    customerId: row.customer_id,
    orderId: row.order_id,
    position: row.position,
    type: row.typ as CustomerAgreementType,
    targetDays: row.ziel_tage,
    validUntil,
    reason: row.grund ?? "",
    version: row.version,
    revokedAt,
    revokedBy: row.widerrufen_von,
    revokeReason: row.widerruf_grund,
    createdAt,
    createdBy: row.created_by,
  };
}

function intentHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

async function readAgreement(tx: PrivilegedTenantTransaction, context: CustomerCommandContext, agreementId: string): Promise<CustomerAgreementRecord> {
  const rows = await tx.execute<AgreementRow>(sql`
    SELECT id::text, customer_id, order_id, position, typ, ziel_tage, gueltig_bis,
      grund, version, widerrufen_am, widerrufen_von::text, widerruf_grund,
      created_at, created_by::text
    FROM public.customer_agreements
    WHERE tenant_id = ${context.tenantId} AND id = ${agreementId}::uuid
    LIMIT 2
  `);
  if (rows.length !== 1 || !rows[0]) throw new Error("CUSTOMER_AGREEMENT_READBACK_MISSING");
  return record(rows[0]);
}

async function finishMutation(
  tx: PrivilegedTenantTransaction,
  context: CustomerCommandContext,
  row: MutationRow | undefined,
): Promise<CustomerAgreementCommandResult> {
  if (!row || !["OK", "FORBIDDEN", "CONFLICT", "VALIDATION_ERROR", "NOT_FOUND"].includes(row.result_code)) {
    throw new Error("CUSTOMER_AGREEMENT_RESULT_INVALID");
  }
  if (row.result_code !== "OK") {
    return {
      code: row.result_code as Exclude<CustomerAgreementCommandResult["code"], "OK" | "UNAVAILABLE">,
      message: row.result_message ?? "Absprache konnte nicht verarbeitet werden.",
    };
  }
  if (!row.agreement_id || !UUID.test(row.agreement_id)) throw new Error("CUSTOMER_AGREEMENT_RESULT_ID_INVALID");
  return { code: "OK", agreement: await readAgreement(tx, context, row.agreement_id), replayed: row.replayed === true };
}

export async function saveCustomerAgreementCommand(context: CustomerCommandContext, input: unknown): Promise<CustomerAgreementCommandResult> {
  if (!context.capabilities.canManageMoney) return { code: "FORBIDDEN", message: "Zahlungsabsprachen benötigen den Bereich Geld." };
  const value = parseSaveEnvelope(input);
  if (!value) return { code: "VALIDATION_ERROR", message: "Absprache ist ungültig." };
  try {
    return await withPrivilegedTenantTransaction(context, async (tx) => {
      const rows = await tx.execute<MutationRow>(sql`
        SELECT * FROM private.save_customer_agreement_v1(
          ${context.tenantId}, ${context.userId}::uuid, ${value.clientKey}::uuid,
          ${value.customerId}, ${value.orderId}, ${value.type}, ${value.targetDays}::integer,
          ${value.validUntil}::date, ${value.reason}, ${value.version}::integer, ${intentHash(value)}
        )
      `);
      if (rows.length !== 1) throw new Error("CUSTOMER_AGREEMENT_SAVE_RESULT_AMBIGUOUS");
      return finishMutation(tx, context, rows[0]);
    });
  } catch (error) {
    console.error("[CUSTOMER_AGREEMENT_SAVE_FAILED]", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return { code: "UNAVAILABLE", message: "Absprache konnte nicht sicher gespeichert werden. Code: CUSTOMER_AGREEMENT_SAVE_FAILED." };
  }
}

export async function revokeCustomerAgreementCommand(context: CustomerCommandContext, input: unknown): Promise<CustomerAgreementCommandResult> {
  if (!context.capabilities.canManageMoney) return { code: "FORBIDDEN", message: "Zahlungsabsprachen benötigen den Bereich Geld." };
  const value = parseRevokeEnvelope(input);
  if (!value) return { code: "VALIDATION_ERROR", message: "Widerruf ist ungültig." };
  try {
    return await withPrivilegedTenantTransaction(context, async (tx) => {
      const rows = await tx.execute<MutationRow>(sql`
        SELECT * FROM private.revoke_customer_agreement_v1(
          ${context.tenantId}, ${context.userId}::uuid, ${value.clientKey}::uuid,
          ${value.agreementId}::uuid, ${value.reason}, ${value.version}::integer, ${intentHash(value)}
        )
      `);
      if (rows.length !== 1) throw new Error("CUSTOMER_AGREEMENT_REVOKE_RESULT_AMBIGUOUS");
      return finishMutation(tx, context, rows[0]);
    });
  } catch (error) {
    console.error("[CUSTOMER_AGREEMENT_REVOKE_FAILED]", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return { code: "UNAVAILABLE", message: "Absprache konnte nicht sicher widerrufen werden. Code: CUSTOMER_AGREEMENT_REVOKE_FAILED." };
  }
}
