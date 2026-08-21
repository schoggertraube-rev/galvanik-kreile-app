import "server-only";

import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  resolveAuthorization,
  type AuthorizationSnapshot,
} from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

const EVENT_TYPE = "USER_LAST_SEEN_RECORDED_V1";
const EVENT_SCHEMA_VERSION = 1;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type UserLastSeenSnapshot = {
  userId: string;
  lastSeenAt: string | null;
  version: number;
};

export type UserLastSeenReceipt = {
  eventId: string;
  clientEventId: string;
  correlationId: string;
  eventSchemaVersion: 1;
  actorId: string;
  aggregateVersion: number;
  previousSeenAt: string | null;
  lastSeenAt: string;
};

export type MarkUserLastSeenInput = {
  expectedVersion: number;
  clientEventId: string;
};

type CommandDenial =
  | { code: "UNAUTHENTICATED"; message: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "NOT_FOUND"; message: string }
  | { code: "CONFLICT"; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "UNAVAILABLE"; message: string };

export type MarkUserLastSeenResult =
  | { code: "OK"; receipt: UserLastSeenReceipt; replayed: boolean }
  | CommandDenial;

export type ReadUserLastSeenResult =
  | { code: "OK"; data: UserLastSeenSnapshot }
  | { code: "FORBIDDEN"; message: string }
  | { code: "UNAVAILABLE"; message: string };

export type ReadUserLastSeenReceiptResult =
  | { code: "OK"; data: UserLastSeenReceipt | null }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "UNAVAILABLE"; message: string };

type StateRow = {
  tenant_id: string;
  user_id: string;
  last_seen_at: Date | string;
  version: number;
  integrity_ok?: boolean;
};

type ReceiptRow = {
  event_id: string;
  tenant_id: string;
  actor_id: string;
  client_event_id: string;
  correlation_id: string;
  event_schema_version: number;
  aggregate_version: number;
  previous_seen_at: string | null;
  last_seen_at: Date | string;
  integrity_ok: boolean;
  event_type?: string;
};

function hasExactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isValidInput(input: unknown): input is MarkUserLastSeenInput {
  return hasExactKeys(input, ["clientEventId", "expectedVersion"])
    && typeof input.expectedVersion === "number"
    && Number.isSafeInteger(input.expectedVersion)
    && input.expectedVersion >= 0
    && typeof input.clientEventId === "string"
    && UUID_PATTERN.test(input.clientEventId);
}

function toIso(value: unknown): string {
  const date = value instanceof Date ? value : new Date(value as string);
  if (!Number.isFinite(date.getTime())) throw new Error("USER_LAST_SEEN_TIME_INVALID");
  return date.toISOString();
}

function toNullableIso(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return toIso(value);
}

function mapReceipt(row: ReceiptRow, authorization: AuthorizationSnapshot): UserLastSeenReceipt {
  if (
    row.integrity_ok !== true
    || row.tenant_id !== authorization.tenantId
    || row.actor_id !== authorization.userId
    || row.event_schema_version !== EVENT_SCHEMA_VERSION
    || !Number.isSafeInteger(row.aggregate_version)
    || row.aggregate_version <= 0
    || !UUID_PATTERN.test(row.client_event_id)
    || !UUID_PATTERN.test(row.correlation_id)
    || !row.event_id
  ) {
    throw new Error("USER_LAST_SEEN_RECEIPT_INVALID");
  }

  return {
    eventId: row.event_id,
    clientEventId: row.client_event_id,
    correlationId: row.correlation_id,
    eventSchemaVersion: 1,
    actorId: row.actor_id,
    aggregateVersion: row.aggregate_version,
    previousSeenAt: toNullableIso(row.previous_seen_at),
    lastSeenAt: toIso(row.last_seen_at),
  };
}

function receiptMatchesIntent(
  receipt: UserLastSeenReceipt,
  authorization: AuthorizationSnapshot,
  input: MarkUserLastSeenInput,
): boolean {
  return receipt.actorId === authorization.userId
    && receipt.clientEventId === input.clientEventId
    && receipt.aggregateVersion === input.expectedVersion + 1;
}

export async function readUserLastSeen(
  authorization: AuthorizationSnapshot,
): Promise<ReadUserLastSeenResult> {
  try {
    const data = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows = await tx.execute<StateRow>(sql`
        SELECT tenant_id, user_id, last_seen_at, version, integrity_ok
        FROM private.v_user_last_seen_v1
        WHERE user_id = ${authorization.userId}
        LIMIT 2
      `);

      if (rows.length === 0) {
        return { userId: authorization.userId, lastSeenAt: null, version: 0 };
      }

      const row = rows[0];
      if (
        rows.length !== 1
        || !row
        || row.integrity_ok !== true
        || row.tenant_id !== authorization.tenantId
        || row.user_id !== authorization.userId
        || !Number.isSafeInteger(row.version)
        || row.version <= 0
      ) {
        throw new Error("USER_LAST_SEEN_STATE_INVALID");
      }

      return {
        userId: row.user_id,
        lastSeenAt: toIso(row.last_seen_at),
        version: row.version,
      };
    });

    return { code: "OK", data };
  } catch {
    return { code: "UNAVAILABLE", message: "Letzter Blick konnte nicht sicher geladen werden." };
  }
}

export async function readUserLastSeenReceipt(
  authorization: AuthorizationSnapshot,
  clientEventId: string,
): Promise<ReadUserLastSeenReceiptResult> {
  if (!UUID_PATTERN.test(clientEventId)) {
    return { code: "VALIDATION_ERROR", message: "Ungültige Anfragekennung." };
  }

  try {
    const data = await withPrivilegedTenantTransaction(authorization, async (tx) => {
      const rows = await tx.execute<ReceiptRow>(sql`
        SELECT *
        FROM private.v_user_last_seen_receipts_v1
        WHERE actor_id = ${authorization.userId}
          AND client_event_id = ${clientEventId}
        LIMIT 2
      `);
      if (rows.length === 0) return null;
      if (rows.length !== 1 || !rows[0]) throw new Error("USER_LAST_SEEN_RECEIPT_AMBIGUOUS");
      return mapReceipt(rows[0], authorization);
    });
    return { code: "OK", data };
  } catch {
    return { code: "UNAVAILABLE", message: "Blick-Receipt konnte nicht sicher geladen werden." };
  }
}

export async function markUserLastSeen(
  input: MarkUserLastSeenInput,
): Promise<MarkUserLastSeenResult> {
  if (!isValidInput(input)) {
    return { code: "VALIDATION_ERROR", message: "Ungültige Version oder Anfragekennung." };
  }

  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE", message: "Letzter Blick konnte nicht gespeichert werden." };
  }

  if (!authorization.ok) {
    if (authorization.reason === "AUTHORIZATION_UNAVAILABLE") {
      return { code: "UNAVAILABLE", message: "Letzter Blick konnte nicht gespeichert werden." };
    }
    return { code: "UNAUTHENTICATED", message: "Sitzung oder Berechtigung ist nicht verfügbar." };
  }

  try {
    return await withPrivilegedTenantTransaction(authorization.data, async (tx) => {
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended(
            'f1:user-last-seen:' || ${authorization.data.tenantId} || ':' || ${authorization.data.userId},
            0
          )
        )
      `);

      const existingReceipts = await tx.execute<ReceiptRow>(sql`
        SELECT receipt.*
        FROM private.v_user_last_seen_receipts_v1 receipt
        WHERE receipt.client_event_id = ${input.clientEventId}
        LIMIT 2
      `);

      if (existingReceipts.length > 0) {
        if (existingReceipts.length !== 1 || !existingReceipts[0]) {
          return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
        }
        const receipt = mapReceipt(existingReceipts[0], authorization.data);
        if (!receiptMatchesIntent(receipt, authorization.data, input)) {
          return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
        }
        return { code: "OK", receipt, replayed: true };
      }

      const foreignEvents = await tx.execute<{ event_type: string }>(sql`
        SELECT event_type
        FROM public.events
        WHERE tenant_id = ${authorization.data.tenantId}
          AND client_event_id = ${input.clientEventId}
        LIMIT 2
      `);
      if (foreignEvents.length > 0) {
        return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
      }

      const lockedStates = await tx.execute<StateRow>(sql`
        SELECT tenant_id, user_id, last_seen_at, version
        FROM private.user_last_seen
        WHERE tenant_id = ${authorization.data.tenantId}
          AND user_id = ${authorization.data.userId}
        FOR UPDATE
      `);
      const current = lockedStates[0];
      if (lockedStates.length > 1) throw new Error("USER_LAST_SEEN_STATE_AMBIGUOUS");

      const currentVersion = current?.version ?? 0;
      if (currentVersion !== input.expectedVersion) {
        return { code: "CONFLICT", message: "Letzter Blick wurde bereits geändert." };
      }

      const previousSeenAt = current ? toIso(current.last_seen_at) : null;
      const nextVersion = currentVersion + 1;

      const updatedStates = current
        ? await tx.execute<StateRow>(sql`
            UPDATE private.user_last_seen
            SET last_seen_at = clock_timestamp(),
                version = ${nextVersion},
                updated_at = clock_timestamp()
            WHERE tenant_id = ${authorization.data.tenantId}
              AND user_id = ${authorization.data.userId}
              AND version = ${currentVersion}
            RETURNING tenant_id, user_id, last_seen_at, version
          `)
        : await tx.execute<StateRow>(sql`
            INSERT INTO private.user_last_seen (
              tenant_id, user_id, last_seen_at, version, created_at, updated_at
            ) VALUES (
              ${authorization.data.tenantId},
              ${authorization.data.userId},
              clock_timestamp(),
              1,
              clock_timestamp(),
              clock_timestamp()
            )
            ON CONFLICT (tenant_id, user_id) DO NOTHING
            RETURNING tenant_id, user_id, last_seen_at, version
          `);

      const updated = updatedStates[0];
      if (
        updatedStates.length !== 1
        || !updated
        || updated.tenant_id !== authorization.data.tenantId
        || updated.user_id !== authorization.data.userId
        || updated.version !== nextVersion
      ) {
        throw new Error("USER_LAST_SEEN_UPDATE_FAILED");
      }
      const lastSeenAt = toIso(updated.last_seen_at);

      await tx.execute(sql`
        INSERT INTO public.events (
          id,
          tenant_id,
          order_id,
          item_id,
          event_type,
          description,
          payload,
          status,
          user_id,
          station,
          created_at,
          client_event_id,
          event_schema_version,
          correlation_id,
          aggregate_version,
          from_station
        ) VALUES (
          gen_random_uuid()::text,
          ${authorization.data.tenantId},
          NULL,
          NULL,
          ${EVENT_TYPE},
          'Authenticated user view recorded',
          ${JSON.stringify({ previousSeenAt })}::jsonb,
          'success',
          ${authorization.data.userId},
          NULL,
          (${lastSeenAt}::timestamptz AT TIME ZONE 'UTC'),
          ${input.clientEventId},
          ${EVENT_SCHEMA_VERSION},
          gen_random_uuid(),
          ${nextVersion},
          NULL
        )
      `);

      const readbackRows = await tx.execute<ReceiptRow>(sql`
        SELECT *
        FROM private.v_user_last_seen_receipts_v1
        WHERE actor_id = ${authorization.data.userId}
          AND client_event_id = ${input.clientEventId}
        LIMIT 2
      `);
      if (readbackRows.length !== 1 || !readbackRows[0]) {
        throw new Error("USER_LAST_SEEN_RECEIPT_READBACK_MISSING");
      }
      const receipt = mapReceipt(readbackRows[0], authorization.data);
      if (
        !receiptMatchesIntent(receipt, authorization.data, input)
        || receipt.previousSeenAt !== previousSeenAt
        || receipt.lastSeenAt !== lastSeenAt
      ) {
        throw new Error("USER_LAST_SEEN_RECEIPT_READBACK_INVALID");
      }

      return { code: "OK", receipt, replayed: false };
    });
  } catch {
    return { code: "UNAVAILABLE", message: "Letzter Blick konnte nicht gespeichert werden." };
  }
}

/**
 * Records exactly one confirmed login view without accepting tenant, actor or
 * version data from the client. The canonical session is resolved first; a
 * single optimistic retry covers two concurrent logins for the same user.
 */
export async function recordUserLastSeenForLogin(): Promise<MarkUserLastSeenResult> {
  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { code: "UNAVAILABLE", message: "Letzter Blick konnte nicht gespeichert werden." };
  }
  if (!authorization.ok) {
    return authorization.reason === "AUTHORIZATION_UNAVAILABLE"
      ? { code: "UNAVAILABLE", message: "Letzter Blick konnte nicht gespeichert werden." }
      : { code: "UNAUTHENTICATED", message: "Sitzung oder Berechtigung ist nicht verfügbar." };
  }

  const clientEventId = randomUUID();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const current = await readUserLastSeen(authorization.data);
    if (current.code !== "OK") {
      return { code: "UNAVAILABLE", message: "Letzter Blick konnte nicht gespeichert werden." };
    }
    const result = await markUserLastSeen({
      expectedVersion: current.data.version,
      clientEventId,
    });
    if (result.code !== "CONFLICT" || attempt === 1) return result;
  }

  return { code: "UNAVAILABLE", message: "Letzter Blick konnte nicht gespeichert werden." };
}
