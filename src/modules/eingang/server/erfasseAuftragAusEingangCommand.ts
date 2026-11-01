import "server-only";

import { sql } from "drizzle-orm";
import {
  hasAuthorizationArea,
  resolveAuthorization,
  type AuthorizationSnapshot,
} from "@/lib/server/authorization";
import {
  createOrderIntake,
  type OrderIntakeItemInput,
} from "@/lib/server/commands/orderIntakeCommand";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import type { PaymentMode } from "@/lib/server/paymentContract";
import type {
  ErfasseAuftragResult,
} from "../types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type NormalizedInput = {
  clientKey: string;
  text: string | null;
  customer: { mode: "EXISTING"; customerId: string };
  dueDate: string;
  items: OrderIntakeItemInput[];
  handoverMode: "pickup" | "shipping" | undefined;
  paymentMode: PaymentMode | undefined;
};

type IntakeRow = {
  id: string;
  tenant_id: string;
  client_key: string;
  kunde_id: string | null;
  text: string | null;
  kanal: string;
  richtung: string;
  quelle: string;
  zuordnung: string;
  vorgang_art: string | null;
  vorgang_id: string | null;
  erstellt_von: string;
};

type ErfasseAuftragFailure = Exclude<ErfasseAuftragResult, { code: "OK" }>;

type EingangAuthorization =
  | { ok: true; data: AuthorizationSnapshot }
  | { ok: false; result: ErfasseAuftragResult };

function plainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeInput(input: unknown): NormalizedInput | null {
  if (!plainObject(input) || typeof input.clientKey !== "string" || !UUID_PATTERN.test(input.clientKey)) return null;
  if (input.text !== null && typeof input.text !== "string") return null;
  const text = typeof input.text === "string" ? input.text.trim() : null;
  if (text && text.length > 20_000) return null;
  if (!plainObject(input.customer) || input.customer.mode !== "EXISTING"
    || typeof input.customer.customerId !== "string" || input.customer.customerId.trim().length === 0) return null;
  if (typeof input.dueDate !== "string" || !Array.isArray(input.items)) return null;
  if (input.handoverMode !== undefined && input.handoverMode !== "pickup" && input.handoverMode !== "shipping") return null;
  if (input.paymentMode !== undefined
    && input.paymentMode !== "vorkasse"
    && input.paymentMode !== "abholung"
    && input.paymentMode !== "rechnung") return null;
  return {
    clientKey: input.clientKey,
    text: text || null,
    customer: { mode: "EXISTING", customerId: input.customer.customerId.trim() },
    dueDate: input.dueDate,
    items: input.items as OrderIntakeItemInput[],
    handoverMode: input.handoverMode,
    paymentMode: input.paymentMode,
  };
}

async function authorizeEingang(): Promise<EingangAuthorization> {
  const authorization = await resolveAuthorization();
  if (!authorization.ok) {
    return authorization.reason === "AUTHORIZATION_UNAVAILABLE"
      ? {
          ok: false,
          result: {
            code: "CONFLICT",
            message: "Eingang konnte nicht sicher gespeichert werden. Fehlercode: EINGANG_AUTH_UNAVAILABLE.",
          },
        }
      : {
          ok: false,
          result: { code: "UNAUTHENTICATED", message: "Sitzung ist nicht verfügbar." },
        };
  }
  if (!hasAuthorizationArea(authorization.data, "eingang")) {
    return {
      ok: false,
      result: { code: "FORBIDDEN", message: "Eingang ist für diesen Login nicht freigegeben." },
    };
  }
  return { ok: true, data: authorization.data };
}

function matchesIntake(row: IntakeRow, authorization: AuthorizationSnapshot, input: NormalizedInput): boolean {
  return row.tenant_id === authorization.tenantId
    && row.client_key === input.clientKey
    && row.kunde_id === input.customer.customerId
    && row.text === input.text
    && row.kanal === "notiz"
    && row.richtung === "rein"
    && row.quelle === "geraet"
    && row.erstellt_von === authorization.userId;
}

async function ensureOpenIntake(
  authorization: AuthorizationSnapshot,
  input: NormalizedInput,
): Promise<{ code: "OK"; row: IntakeRow } | ErfasseAuftragFailure> {
  try {
    return await withPrivilegedTenantTransaction(authorization, async (tx) => {
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(hashtextextended(
          'ap01:intake:' || ${authorization.tenantId} || ':' || ${input.clientKey}, 0
        ))
      `);
      await tx.execute(sql`
        INSERT INTO public.intake_item (
          tenant_id, client_key, kanal, richtung, quelle, erstellt_von,
          text, kunde_id, zuordnung
        ) VALUES (
          ${authorization.tenantId}, ${input.clientKey}, 'notiz', 'rein', 'geraet',
          ${authorization.userId}::uuid, ${input.text}, ${input.customer.customerId}, 'hand'
        )
        ON CONFLICT (tenant_id, client_key) DO NOTHING
      `);
      const rows = await tx.execute<IntakeRow>(sql`
        SELECT
          id::text, tenant_id, client_key, kunde_id, text, kanal, richtung, quelle,
          zuordnung, vorgang_art, vorgang_id, erstellt_von::text
        FROM public.intake_item
        WHERE tenant_id = ${authorization.tenantId} AND client_key = ${input.clientKey}
        LIMIT 2
        FOR UPDATE
      `);
      const row = rows.length === 1 ? rows[0] : null;
      if (!row || !matchesIntake(row, authorization, input)) {
        return { code: "CONFLICT", message: "Anfragekennung wurde bereits anders verwendet." };
      }
      await tx.execute(sql`
        INSERT INTO public.intake_event (
          tenant_id, item_id, art, befehl_id, von, vorher, nachher
        )
        SELECT
          ${authorization.tenantId}, ${row.id}::uuid, 'angelegt', ${input.clientKey}::uuid,
          ${authorization.userId}, NULL, ${JSON.stringify({ kanal: "notiz", quelle: "geraet" })}::jsonb
        WHERE NOT EXISTS (
          SELECT 1 FROM public.intake_event
          WHERE tenant_id = ${authorization.tenantId}
            AND item_id = ${row.id}::uuid
            AND art = 'angelegt'
            AND befehl_id = ${input.clientKey}::uuid
        )
      `);
      return { code: "OK", row };
    });
  } catch (error) {
    console.error("[EINGANG_AP01_INTAKE_CREATE_FAILED]", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : "Unbekannter Serverfehler",
    });
    return {
      code: "CONFLICT",
      message: "Eingang konnte nicht sicher gespeichert werden. Fehlercode: EINGANG_INTAKE_CREATE_FAILED.",
    };
  }
}

async function assignIntake(
  authorization: AuthorizationSnapshot,
  input: NormalizedInput,
  intakeItemId: string,
  orderNumber: string,
): Promise<{ code: "OK" } | ErfasseAuftragFailure> {
  try {
    return await withPrivilegedTenantTransaction(authorization, async (tx) => {
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(hashtextextended(
          'ap01:intake:' || ${authorization.tenantId} || ':' || ${input.clientKey}, 0
        ))
      `);
      const rows = await tx.execute<IntakeRow>(sql`
        SELECT
          id::text, tenant_id, client_key, kunde_id, text, kanal, richtung, quelle,
          zuordnung, vorgang_art, vorgang_id, erstellt_von::text
        FROM public.intake_item
        WHERE tenant_id = ${authorization.tenantId}
          AND id = ${intakeItemId}::uuid
          AND client_key = ${input.clientKey}
        LIMIT 2
        FOR UPDATE
      `);
      const row = rows.length === 1 ? rows[0] : null;
      if (!row || !matchesIntake(row, authorization, input)) {
        return { code: "CONFLICT", message: "Eingang konnte nicht eindeutig zugeordnet werden." };
      }
      if (row.vorgang_art !== null || row.vorgang_id !== null) {
        if (row.vorgang_art !== "auftrag" || row.vorgang_id !== orderNumber) {
          return { code: "CONFLICT", message: "Eingang ist bereits einem anderen Vorgang zugeordnet." };
        }
      } else {
        const updated = await tx.execute<{ id: string }>(sql`
          UPDATE public.intake_item
          SET
            vorgang_art = 'auftrag',
            vorgang_id = ${orderNumber},
            zuordnung = 'hand',
            geaendert_von = ${authorization.userId}::uuid,
            geaendert_am = statement_timestamp(),
            updated_at = statement_timestamp(),
            version = version + 1
          WHERE tenant_id = ${authorization.tenantId}
            AND id = ${intakeItemId}::uuid
            AND vorgang_art IS NULL
            AND vorgang_id IS NULL
          RETURNING id::text AS id
        `);
        if (updated.length !== 1 || updated[0]?.id !== intakeItemId) {
          return { code: "CONFLICT", message: "Eingang wurde zwischenzeitlich verändert." };
        }
      }
      await tx.execute(sql`
        INSERT INTO public.intake_event (
          tenant_id, item_id, art, befehl_id, von, vorher, nachher
        )
        SELECT
          ${authorization.tenantId}, ${intakeItemId}::uuid, 'zugeordnet', ${input.clientKey}::uuid,
          ${authorization.userId}, NULL,
          ${JSON.stringify({ vorgangArt: "auftrag", vorgangId: orderNumber })}::jsonb
        WHERE NOT EXISTS (
          SELECT 1 FROM public.intake_event
          WHERE tenant_id = ${authorization.tenantId}
            AND item_id = ${intakeItemId}::uuid
            AND art = 'zugeordnet'
            AND befehl_id = ${input.clientKey}::uuid
        )
      `);
      return { code: "OK" };
    });
  } catch (error) {
    console.error("[EINGANG_AP01_ASSIGN_FAILED]", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : "Unbekannter Serverfehler",
    });
    return {
      code: "CONFLICT",
      message: "Eingang konnte nicht sicher zugeordnet werden. Fehlercode: EINGANG_ASSIGN_FAILED.",
    };
  }
}

export async function erfasseAuftragAusEingangCommand(input: unknown): Promise<ErfasseAuftragResult> {
  const normalized = normalizeInput(input);
  if (!normalized) {
    return { code: "VALIDATION_ERROR", message: "Eingangsdaten sind unvollständig oder ungültig." };
  }

  const createAuthorization = await authorizeEingang();
  if (!createAuthorization.ok) return createAuthorization.result;
  const intake = await ensureOpenIntake(createAuthorization.data, normalized);
  if (intake.code !== "OK") return intake;

  const orderAuthorization = await authorizeEingang();
  if (!orderAuthorization.ok) return orderAuthorization.result;
  const order = await createOrderIntake({
    clientEventId: normalized.clientKey,
    customer: normalized.customer,
    dueDate: normalized.dueDate,
    handoverMode: normalized.handoverMode,
    intakeSource: "persoenlich",
    items: normalized.items,
    note: normalized.text,
    ...(hasAuthorizationArea(orderAuthorization.data, "geld") && normalized.paymentMode
      ? { paymentMode: normalized.paymentMode }
      : {}),
  });
  if (order.code !== "OK") {
    if (order.code === "UNAVAILABLE") {
      console.error("[EINGANG_AP01_ORDER_WRITE_FAILED]", { message: order.message });
      return {
        code: "CONFLICT",
        message: "Auftrag konnte nicht sicher gespeichert werden. Fehlercode: EINGANG_ORDER_WRITE_FAILED.",
      };
    }
    if (order.code === "NOT_FOUND") {
      return { code: "VALIDATION_ERROR", message: order.message };
    }
    return order;
  }

  const assignAuthorization = await authorizeEingang();
  if (!assignAuthorization.ok) return assignAuthorization.result;
  const assignment = await assignIntake(
    assignAuthorization.data,
    normalized,
    intake.row.id,
    order.receipt.orderNumber,
  );
  if (assignment.code !== "OK") return assignment;

  return {
    code: "OK",
    orderNumber: order.receipt.orderNumber,
    orderId: order.receipt.orderId,
    intakeItemId: intake.row.id,
    replayed: order.replayed,
  };
}
