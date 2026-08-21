import "server-only";

import { sql } from "drizzle-orm";
import { resolveAuthorization } from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

const EVENT_SCHEMA_VERSION = 1 as const;
const CATALOG_EVENT_TYPE = "EXTRA_WORK_CATALOG_CONFIGURED_V1";
const RATE_EVENT_TYPE = "EXTRA_WORK_RATE_SET_V1";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type CommandDenial =
  | { code: "UNAUTHENTICATED"; message: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "NOT_FOUND"; message: string }
  | { code: "CONFLICT"; message: string }
  | { code: "VALIDATION_ERROR"; message: string }
  | { code: "UNAVAILABLE"; message: string };

export type ConfigureExtraWorkCatalogInput = {
  positionId: string;
  expectedVersion: number;
  name: string;
  standardMinutes: number;
  active: boolean;
  clientEventId: string;
};

export type ExtraWorkCatalogReceipt = {
  eventId: string;
  clientEventId: string;
  correlationId: string;
  eventSchemaVersion: 1;
  positionId: string;
  aggregateVersion: number;
  name: string;
  standardMinutes: number;
  active: boolean;
  actorId: string;
  occurredAt: string;
};

export type ConfigureExtraWorkCatalogResult =
  | { code: "OK"; receipt: ExtraWorkCatalogReceipt; replayed: boolean }
  | CommandDenial;

export type SetExtraWorkHourlyRateInput = {
  rateId: string;
  expectedVersion: number;
  hourlyRateCents: number;
  clientEventId: string;
};

export type ExtraWorkHourlyRateReceipt = {
  eventId: string;
  clientEventId: string;
  correlationId: string;
  eventSchemaVersion: 1;
  rateId: string;
  aggregateVersion: number;
  hourlyRateCents: number;
  actorId: string;
  occurredAt: string;
};

export type SetExtraWorkHourlyRateResult =
  | { code: "OK"; receipt: ExtraWorkHourlyRateReceipt; replayed: boolean }
  | CommandDenial;

type CatalogStateRow = {
  id: string;
  tenant_id: string;
  name: string;
  standard_minutes: number;
  active: boolean;
  version: number;
};

type RateStateRow = {
  id: string;
  tenant_id: string;
  hourly_rate_cents: number;
  version: number;
};

type CatalogReceiptRow = {
  event_id: string;
  tenant_id: string;
  client_event_id: string;
  correlation_id: string;
  event_schema_version: number;
  aggregate_version: number;
  actor_id: string;
  position_id: string;
  name: string;
  standard_minutes: number;
  active: boolean;
  occurred_at: Date | string;
  integrity_ok: boolean;
};

type RateReceiptRow = {
  event_id: string;
  tenant_id: string;
  client_event_id: string;
  correlation_id: string;
  event_schema_version: number;
  aggregate_version: number;
  actor_id: string;
  rate_id: string;
  hourly_rate_cents: number;
  occurred_at: Date | string;
  integrity_ok: boolean;
};

function hasExactKeys(value: unknown, expected: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return keys.length === sortedExpected.length
    && keys.every((key, index) => key === sortedExpected[index]);
}

function isValidCatalogInput(input: unknown): input is ConfigureExtraWorkCatalogInput {
  return hasExactKeys(input, [
    "active", "clientEventId", "expectedVersion", "name", "positionId", "standardMinutes",
  ])
    && typeof input.positionId === "string"
    && UUID_PATTERN.test(input.positionId)
    && typeof input.clientEventId === "string"
    && UUID_PATTERN.test(input.clientEventId)
    && typeof input.expectedVersion === "number"
    && Number.isSafeInteger(input.expectedVersion)
    && input.expectedVersion >= 0
    && typeof input.name === "string"
    && input.name === input.name.trim()
    && input.name.length >= 2
    && input.name.length <= 100
    && typeof input.standardMinutes === "number"
    && Number.isSafeInteger(input.standardMinutes)
    && input.standardMinutes >= 1
    && input.standardMinutes <= 1440
    && typeof input.active === "boolean";
}

function isValidRateInput(input: unknown): input is SetExtraWorkHourlyRateInput {
  return hasExactKeys(input, ["clientEventId", "expectedVersion", "hourlyRateCents", "rateId"])
    && typeof input.rateId === "string"
    && UUID_PATTERN.test(input.rateId)
    && typeof input.clientEventId === "string"
    && UUID_PATTERN.test(input.clientEventId)
    && typeof input.expectedVersion === "number"
    && Number.isSafeInteger(input.expectedVersion)
    && input.expectedVersion >= 0
    && typeof input.hourlyRateCents === "number"
    && Number.isSafeInteger(input.hourlyRateCents)
    && input.hourlyRateCents >= 1
    && input.hourlyRateCents <= 1_000_000;
}

function toIso(value: unknown): string {
  const parsed = value instanceof Date ? value : new Date(value as string);
  if (!Number.isFinite(parsed.getTime())) throw new Error("EXTRA_WORK_RECEIPT_TIME_INVALID");
  return parsed.toISOString();
}

function mapCatalogReceipt(
  row: CatalogReceiptRow,
  tenantId: string,
  actorId: string,
): ExtraWorkCatalogReceipt {
  if (
    row.integrity_ok !== true
    || row.tenant_id !== tenantId
    || row.actor_id !== actorId
    || row.event_schema_version !== EVENT_SCHEMA_VERSION
    || !UUID_PATTERN.test(row.client_event_id)
    || !UUID_PATTERN.test(row.correlation_id)
    || !UUID_PATTERN.test(row.position_id)
    || !Number.isSafeInteger(row.aggregate_version)
    || row.aggregate_version <= 0
    || !Number.isSafeInteger(row.standard_minutes)
    || row.standard_minutes < 1
    || row.standard_minutes > 1440
    || typeof row.name !== "string"
    || row.name !== row.name.trim()
    || typeof row.active !== "boolean"
  ) throw new Error("EXTRA_WORK_CATALOG_RECEIPT_INVALID");

  return {
    eventId: row.event_id,
    clientEventId: row.client_event_id,
    correlationId: row.correlation_id,
    eventSchemaVersion: 1,
    positionId: row.position_id,
    aggregateVersion: row.aggregate_version,
    name: row.name,
    standardMinutes: row.standard_minutes,
    active: row.active,
    actorId: row.actor_id,
    occurredAt: toIso(row.occurred_at),
  };
}

function mapRateReceipt(
  row: RateReceiptRow,
  tenantId: string,
  actorId: string,
): ExtraWorkHourlyRateReceipt {
  if (
    row.integrity_ok !== true
    || row.tenant_id !== tenantId
    || row.actor_id !== actorId
    || row.event_schema_version !== EVENT_SCHEMA_VERSION
    || !UUID_PATTERN.test(row.client_event_id)
    || !UUID_PATTERN.test(row.correlation_id)
    || !UUID_PATTERN.test(row.rate_id)
    || !Number.isSafeInteger(row.aggregate_version)
    || row.aggregate_version <= 0
    || !Number.isSafeInteger(row.hourly_rate_cents)
    || row.hourly_rate_cents < 1
    || row.hourly_rate_cents > 1_000_000
  ) throw new Error("EXTRA_WORK_RATE_RECEIPT_INVALID");

  return {
    eventId: row.event_id,
    clientEventId: row.client_event_id,
    correlationId: row.correlation_id,
    eventSchemaVersion: 1,
    rateId: row.rate_id,
    aggregateVersion: row.aggregate_version,
    hourlyRateCents: row.hourly_rate_cents,
    actorId: row.actor_id,
    occurredAt: toIso(row.occurred_at),
  };
}

async function resolveAdminAuthorization(): Promise<
  | { ok: true; data: Awaited<ReturnType<typeof resolveAuthorization>> & { ok: true } }
  | { ok: false; result: CommandDenial }
> {
  let authorization;
  try {
    authorization = await resolveAuthorization();
  } catch {
    return { ok: false, result: { code: "UNAVAILABLE", message: "Mehrarbeit-Stammdaten sind derzeit nicht verfügbar." } };
  }
  if (!authorization.ok) {
    return {
      ok: false,
      result: authorization.reason === "AUTHORIZATION_UNAVAILABLE"
        ? { code: "UNAVAILABLE", message: "Mehrarbeit-Stammdaten sind derzeit nicht verfügbar." }
        : { code: "UNAUTHENTICATED", message: "Sitzung oder Berechtigung ist nicht verfügbar." },
    };
  }
  if (authorization.data.role !== "admin") {
    return { ok: false, result: { code: "FORBIDDEN", message: "Mehrarbeit-Stammdaten dürfen nur Admins ändern." } };
  }
  return { ok: true, data: authorization as Awaited<ReturnType<typeof resolveAuthorization>> & { ok: true } };
}

export async function configureExtraWorkCatalogPosition(
  input: ConfigureExtraWorkCatalogInput,
): Promise<ConfigureExtraWorkCatalogResult> {
  if (!isValidCatalogInput(input)) {
    return { code: "VALIDATION_ERROR", message: "Ungültige Katalogposition." };
  }
  const authorization = await resolveAdminAuthorization();
  if (!authorization.ok) return authorization.result;
  const snapshot = authorization.data.data;

  try {
    return await withPrivilegedTenantTransaction(snapshot, async (tx) => {
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended('f1:client-event:' || ${snapshot.tenantId} || ':' || ${input.clientEventId}, 0)
        )
      `);
      const replayRows = await tx.execute<CatalogReceiptRow>(sql`
        SELECT * FROM private.v_extra_work_catalog_receipts_v1
        WHERE client_event_id = ${input.clientEventId}
        LIMIT 2
      `);
      if (replayRows.length > 0) {
        if (replayRows.length !== 1 || !replayRows[0]) {
          return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
        }
        const receipt = mapCatalogReceipt(replayRows[0], snapshot.tenantId, snapshot.userId);
        if (
          receipt.positionId !== input.positionId
          || receipt.aggregateVersion !== input.expectedVersion + 1
          || receipt.name !== input.name
          || receipt.standardMinutes !== input.standardMinutes
          || receipt.active !== input.active
        ) return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
        return { code: "OK", receipt, replayed: true };
      }

      const reusedEvents = await tx.execute<{ id: string }>(sql`
        SELECT id FROM public.events
        WHERE tenant_id = ${snapshot.tenantId} AND client_event_id = ${input.clientEventId}
        LIMIT 1
      `);
      if (reusedEvents.length > 0) {
        return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
      }

      const currentRows = await tx.execute<CatalogStateRow>(sql`
        SELECT id, tenant_id, name, standard_minutes, active, version
        FROM private.extra_work_catalog_positions
        WHERE tenant_id = ${snapshot.tenantId} AND id = ${input.positionId}::uuid
        FOR UPDATE
      `);
      if (currentRows.length > 1) throw new Error("EXTRA_WORK_CATALOG_AMBIGUOUS");
      const current = currentRows[0];
      if ((current?.version ?? 0) !== input.expectedVersion) {
        return { code: "CONFLICT", message: "Katalogposition wurde bereits geändert." };
      }
      const duplicateNames = await tx.execute<{ id: string }>(sql`
        SELECT id::text AS id
        FROM private.extra_work_catalog_positions
        WHERE tenant_id = ${snapshot.tenantId}
          AND lower(name) = lower(${input.name})
          AND id <> ${input.positionId}::uuid
        LIMIT 1
      `);
      if (duplicateNames.length > 0) {
        return { code: "CONFLICT", message: "Dieser Katalogname ist bereits vergeben." };
      }

      const nextVersion = input.expectedVersion + 1;
      const changedRows = current
        ? await tx.execute<CatalogStateRow>(sql`
            UPDATE private.extra_work_catalog_positions
            SET name = ${input.name},
                standard_minutes = ${input.standardMinutes},
                active = ${input.active},
                version = ${nextVersion},
                updated_by = ${snapshot.userId}::uuid,
                updated_at = clock_timestamp()
            WHERE tenant_id = ${snapshot.tenantId}
              AND id = ${input.positionId}::uuid
              AND version = ${input.expectedVersion}
            RETURNING id::text AS id, tenant_id, name, standard_minutes, active, version
          `)
        : await tx.execute<CatalogStateRow>(sql`
            INSERT INTO private.extra_work_catalog_positions (
              id, tenant_id, name, standard_minutes, active, version,
              created_by, updated_by, created_at, updated_at
            ) VALUES (
              ${input.positionId}::uuid, ${snapshot.tenantId}, ${input.name},
              ${input.standardMinutes}, ${input.active}, 1,
              ${snapshot.userId}::uuid, ${snapshot.userId}::uuid,
              clock_timestamp(), clock_timestamp()
            )
            RETURNING id::text AS id, tenant_id, name, standard_minutes, active, version
          `);
      if (changedRows.length !== 1 || changedRows[0]?.version !== nextVersion) {
        throw new Error("EXTRA_WORK_CATALOG_WRITE_FAILED");
      }

      await tx.execute(sql`
        INSERT INTO public.events (
          id, tenant_id, order_id, item_id, event_type, description, payload,
          status, user_id, station, created_at, client_event_id,
          event_schema_version, correlation_id, aggregate_version, from_station
        ) VALUES (
          gen_random_uuid()::text, ${snapshot.tenantId}, NULL, NULL,
          ${CATALOG_EVENT_TYPE}, 'Extra-work catalog position configured',
          ${JSON.stringify({
            positionId: input.positionId,
            name: input.name,
            standardMinutes: input.standardMinutes,
            active: input.active,
            positionVersion: nextVersion,
          })}::jsonb,
          'success', ${snapshot.userId}::uuid, NULL,
          clock_timestamp() AT TIME ZONE 'UTC', ${input.clientEventId}::uuid,
          ${EVENT_SCHEMA_VERSION}, gen_random_uuid(), ${nextVersion}, NULL
        )
      `);
      const receiptRows = await tx.execute<CatalogReceiptRow>(sql`
        SELECT * FROM private.v_extra_work_catalog_receipts_v1
        WHERE client_event_id = ${input.clientEventId}
        LIMIT 2
      `);
      if (receiptRows.length !== 1 || !receiptRows[0]) throw new Error("EXTRA_WORK_CATALOG_RECEIPT_MISSING");
      const receipt = mapCatalogReceipt(receiptRows[0], snapshot.tenantId, snapshot.userId);
      if (
        receipt.positionId !== input.positionId
        || receipt.aggregateVersion !== nextVersion
        || receipt.name !== input.name
        || receipt.standardMinutes !== input.standardMinutes
        || receipt.active !== input.active
      ) throw new Error("EXTRA_WORK_CATALOG_RECEIPT_MISMATCH");
      return { code: "OK", receipt, replayed: false };
    });
  } catch {
    return { code: "UNAVAILABLE", message: "Katalogposition konnte nicht sicher gespeichert werden." };
  }
}

export async function setExtraWorkHourlyRate(
  input: SetExtraWorkHourlyRateInput,
): Promise<SetExtraWorkHourlyRateResult> {
  if (!isValidRateInput(input)) {
    return { code: "VALIDATION_ERROR", message: "Ungültiger Stundensatz." };
  }
  const authorization = await resolveAdminAuthorization();
  if (!authorization.ok) return authorization.result;
  const snapshot = authorization.data.data;

  try {
    return await withPrivilegedTenantTransaction(snapshot, async (tx) => {
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended('f1:client-event:' || ${snapshot.tenantId} || ':' || ${input.clientEventId}, 0)
        )
      `);
      const replayRows = await tx.execute<RateReceiptRow>(sql`
        SELECT * FROM private.v_extra_work_rate_receipts_v1
        WHERE client_event_id = ${input.clientEventId}
        LIMIT 2
      `);
      if (replayRows.length > 0) {
        if (replayRows.length !== 1 || !replayRows[0]) {
          return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
        }
        const receipt = mapRateReceipt(replayRows[0], snapshot.tenantId, snapshot.userId);
        if (
          receipt.rateId !== input.rateId
          || receipt.aggregateVersion !== input.expectedVersion + 1
          || receipt.hourlyRateCents !== input.hourlyRateCents
        ) return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
        return { code: "OK", receipt, replayed: true };
      }

      const reusedEvents = await tx.execute<{ id: string }>(sql`
        SELECT id FROM public.events
        WHERE tenant_id = ${snapshot.tenantId} AND client_event_id = ${input.clientEventId}
        LIMIT 1
      `);
      if (reusedEvents.length > 0) {
        return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
      }

      const currentRows = await tx.execute<RateStateRow>(sql`
        SELECT id::text AS id, tenant_id, hourly_rate_cents, version
        FROM private.extra_work_hourly_rates
        WHERE tenant_id = ${snapshot.tenantId}
        ORDER BY version DESC
        LIMIT 1
        FOR UPDATE
      `);
      const currentVersion = currentRows[0]?.version ?? 0;
      if (currentVersion !== input.expectedVersion) {
        return { code: "CONFLICT", message: "Stundensatz wurde bereits geändert." };
      }
      const nextVersion = currentVersion + 1;
      const insertedRates = await tx.execute<RateStateRow>(sql`
        INSERT INTO private.extra_work_hourly_rates (
          id, tenant_id, hourly_rate_cents, version, created_by, effective_at
        ) VALUES (
          ${input.rateId}::uuid, ${snapshot.tenantId}, ${input.hourlyRateCents},
          ${nextVersion}, ${snapshot.userId}::uuid, clock_timestamp()
        )
        RETURNING id::text AS id, tenant_id, hourly_rate_cents, version
      `);
      if (
        insertedRates.length !== 1
        || insertedRates[0]?.id !== input.rateId
        || insertedRates[0]?.version !== nextVersion
      ) throw new Error("EXTRA_WORK_RATE_WRITE_FAILED");

      await tx.execute(sql`
        INSERT INTO public.events (
          id, tenant_id, order_id, item_id, event_type, description, payload,
          status, user_id, station, created_at, client_event_id,
          event_schema_version, correlation_id, aggregate_version, from_station
        ) VALUES (
          gen_random_uuid()::text, ${snapshot.tenantId}, NULL, NULL,
          ${RATE_EVENT_TYPE}, 'Extra-work hourly rate set',
          ${JSON.stringify({
            rateId: input.rateId,
            hourlyRateCents: input.hourlyRateCents,
            rateVersion: nextVersion,
          })}::jsonb,
          'success', ${snapshot.userId}::uuid, NULL,
          clock_timestamp() AT TIME ZONE 'UTC', ${input.clientEventId}::uuid,
          ${EVENT_SCHEMA_VERSION}, gen_random_uuid(), ${nextVersion}, NULL
        )
      `);
      const receiptRows = await tx.execute<RateReceiptRow>(sql`
        SELECT * FROM private.v_extra_work_rate_receipts_v1
        WHERE client_event_id = ${input.clientEventId}
        LIMIT 2
      `);
      if (receiptRows.length !== 1 || !receiptRows[0]) throw new Error("EXTRA_WORK_RATE_RECEIPT_MISSING");
      const receipt = mapRateReceipt(receiptRows[0], snapshot.tenantId, snapshot.userId);
      if (
        receipt.rateId !== input.rateId
        || receipt.aggregateVersion !== nextVersion
        || receipt.hourlyRateCents !== input.hourlyRateCents
      ) throw new Error("EXTRA_WORK_RATE_RECEIPT_MISMATCH");
      return { code: "OK", receipt, replayed: false };
    });
  } catch {
    return { code: "UNAVAILABLE", message: "Stundensatz konnte nicht sicher gespeichert werden." };
  }
}
