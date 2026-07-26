"use server";

import { createHash } from "node:crypto";
import { and, desc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  appUsers,
  auditLog,
  events,
  inventoryItems,
  items,
  orders,
  stockMovements,
} from "@/db/schema";
import {
  arbeitszeitBuchung,
  captureRequestReceipts,
  kostensatzDefault,
  teileKlassifikator,
  vorlageVerbrauch,
  vorlageZeit,
} from "@/db/schema_erfassung";
import { bildeSchluessel, klassifiziereTeil, normalizeString } from "@/lib/erfassung/klassifikator";
import {
  CAPTURE_TENANT_ID,
  parseCaptureEntityId,
  parseCaptureStation,
  parseMaterialCaptureInput,
  parseStationCompletionCaptureInput,
  parseTemplateCaptureInput,
  parseTimeCaptureInput,
  type MaterialCaptureLine,
} from "@/lib/erfassung/captureContract";
import {
  canTransitionOrderStatus,
  normalizeStoredOrderStatus,
  parseOrderStation,
  type OrderStation,
  type OrderStatus,
} from "@/lib/orders/orderMutationContract";
import { getHomogeneousRouteTransition } from "@/lib/orders/orderRouting";
import { resolveAuthorization, type AuthorizationSnapshot } from "@/lib/server/authorization";
import { readCaptureSchemaCapability } from "@/lib/server/captureWriteCapability";
import { readInventoryWriteCapability } from "@/lib/server/inventoryWriteCapability";
import { readOperationalCoreCapability } from "@/lib/server/operationalCoreCapability";
import { invalidateOperationalOrdersCache } from "@/lib/server/operationalOrders";

export type CaptureErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "CONFIGURATION_MISSING"
  | "CONFLICT"
  | "INSUFFICIENT_STOCK"
  | "STORAGE_UNAVAILABLE";

export type CaptureResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: CaptureErrorCode; message: string };

export type CaptureTemplate = {
  hat_vorlage: boolean;
  schluessel?: string;
  klasse?: string;
  oberflaeche?: string;
  konfidenz?: "aufbauen" | "aktiv" | "stabil";
  n_referenzauftraege?: number;
  zeit?: { id: string; station: string; median_min: number; p25: number; p75: number }[];
  verbrauch?: {
    id: string;
    station: string;
    artikel_id: string;
    artikel_name: string;
    median_menge: number;
    einheit: string;
    haeufigkeit_prozent: number;
  }[];
};

export type CaptureArticle = {
  id: string;
  name: string;
  unit: string | null;
  currentStock: number;
  unitCostEur: number | null;
  suggestedQuantity: number | null;
  suggestedTemplateId: string | null;
  frequencyPercent: number | null;
  source: "template" | "recent" | "catalog";
};

export type CaptureOverview = {
  orderId: string;
  currentStation: string | null;
  selectedStation: string | null;
  selectedRate: { valueEurPerHour: number; source: "employee" | "station_default" } | null;
  writeCapability: {
    available: boolean;
    reason: string | null;
  };
  inventoryCatalog: {
    limit: number;
    truncated: boolean;
  };
  routeExecution: {
    status: "executable" | "blocked";
    nextStation: OrderStation | null;
    reason: string | null;
  };
  template: CaptureTemplate;
  articles: CaptureArticle[];
  timeBookings: {
    id: string;
    station: string;
    minutes: number;
    endedAt: string | null;
    costEur: number;
  }[];
  materialBookings: {
    id: string;
    station: string;
    inventoryItemId: string;
    quantity: number;
    unitCostEur: number | null;
    totalCostEur: number | null;
    createdAt: string | null;
  }[];
  loadedAt: string;
};

export type CaptureMutationReceipt = {
  requestId: string;
  kind: "time" | "material" | "template" | "station_completion";
  orderId: string;
  timeBookingIds: string[];
  movementIds: string[];
  timeCostEur: number;
  materialCostEur: number;
  createdAt: string;
  replayed: boolean;
  completedStation?: string;
  newStation?: string;
  newStatus?: OrderStatus;
  eventId?: string;
};

type RawTimeTemplate = {
  id: string;
  station: string;
  minutes: number;
  p25: number;
  p75: number;
  references: number;
};

type RawMaterialTemplate = {
  id: string;
  station: string;
  inventoryItemId: string;
  quantity: number;
  unit: string;
  frequency: number;
  references: number;
};

type ResolvedTemplate = {
  publicValue: CaptureTemplate;
  timeRows: RawTimeTemplate[];
  materialRows: RawMaterialTemplate[];
};

type CaptureKind = CaptureMutationReceipt["kind"];
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function failure<T>(error: CaptureErrorCode, message: string): CaptureResult<T> {
  return { ok: false, error, message };
}

const CAPTURE_ROLLOUT_REQUIRED = "Der atomare Erfassungs-Rollout ist in dieser Datenbank noch nicht vollständig bestätigt. Lesen bleibt möglich; Schreiben bleibt gesperrt.";
const CAPTURE_INVENTORY_LIMIT = 250;

async function readCaptureWriteCapability(): Promise<CaptureOverview["writeCapability"]> {
  const [operationalCoreAvailable, inventoryAvailable] = await Promise.all([
    readOperationalCoreCapability(),
    readInventoryWriteCapability(),
  ]);
  if (!operationalCoreAvailable || !inventoryAvailable) {
    return { available: false, reason: CAPTURE_ROLLOUT_REQUIRED };
  }
  const available = await readCaptureSchemaCapability();
  return { available, reason: available ? null : CAPTURE_ROLLOUT_REQUIRED };
}

async function requireCaptureWriteCapability(): Promise<CaptureResult<true>> {
  const capability = await readCaptureWriteCapability();
  return capability.available
    ? { ok: true, data: true }
    : failure("CONFIGURATION_MISSING", capability.reason || CAPTURE_ROLLOUT_REQUIRED);
}

async function readCaptureInventoryCatalog(tenantId: string) {
  return db.transaction(async (tx) => {
    const [rows, tenantHealthRows] = await Promise.all([
      tx.select({
        id: inventoryItems.id,
        name: inventoryItems.name,
        unit: inventoryItems.unit,
        einheitNormiert: inventoryItems.einheitNormiert,
        currentStock: inventoryItems.currentStock,
        einkaufspreisEur: inventoryItems.einkaufspreisEur,
      })
        .from(inventoryItems)
        .where(eq(inventoryItems.tenantId, tenantId))
        .orderBy(inventoryItems.name)
        .limit(CAPTURE_INVENTORY_LIMIT + 1),
      tx.execute(sql<{ unassigned_count: number | string }>`
        select count(*)::int as unassigned_count
        from public.inventory_items
        where tenant_id is null or btrim(tenant_id) = ''
      `),
    ]);
    const unassignedCount = Number(tenantHealthRows[0]?.unassigned_count);
    if (!Number.isSafeInteger(unassignedCount) || unassignedCount < 0) throw new Error("INVALID_INVENTORY_TENANT_HEALTH");
    if (unassignedCount > 0) throw new Error("INVENTORY_TENANT_ASSIGNMENT_INCOMPLETE");
    return {
      rows: rows.slice(0, CAPTURE_INVENTORY_LIMIT),
      truncated: rows.length > CAPTURE_INVENTORY_LIMIT,
    };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

async function authorizeCapture(mode: "read" | "write" | "status"): Promise<CaptureResult<AuthorizationSnapshot>> {
  const authorization = await resolveAuthorization();
  if (!authorization.ok) {
    if (authorization.reason === "AUTHORIZATION_UNAVAILABLE") {
      return failure("STORAGE_UNAVAILABLE", authorization.message);
    }
    if (authorization.reason === "TENANT_SUSPENDED" || authorization.reason === "TENANT_MAINTENANCE") {
      return failure("FORBIDDEN", authorization.message);
    }
    return failure("UNAUTHORIZED", authorization.message);
  }
  const permissions = authorization.data.permissions;
  const canRead = permissions.includes("perm_view_leitstand") || permissions.includes("perm_data_orders");
  const canWrite = permissions.includes("perm_op_status") || permissions.includes("perm_data_orders");
  const allowed = mode === "read"
    ? canRead
    : mode === "status"
      ? permissions.includes("perm_op_status")
      : canWrite;
  if (authorization.data.tenantId !== CAPTURE_TENANT_ID || !allowed) {
    return failure("FORBIDDEN", "Keine Berechtigung für die Auftragserfassung.");
  }
  return { ok: true, data: authorization.data };
}

function finiteNumber(value: string | number | null | undefined, code = "INVALID_NUMBER"): number {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
    throw new Error(code);
  }
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(code);
  return number;
}

function roundQuantity(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function requestHash(value: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function safeStation(value: string | null | undefined): string | null {
  try {
    return parseCaptureStation(value);
  } catch {
    return null;
  }
}

async function resolveRate(actor: AuthorizationSnapshot, station: string) {
  const [user] = await db
    .select({ rate: appUsers.kostensatzEurProStunde })
    .from(appUsers)
    .where(and(eq(appUsers.id, actor.userId), eq(appUsers.tenantId, actor.tenantId)))
    .limit(1);
  if (!user) throw new Error("ACTOR_NOT_FOUND");
  if (user.rate !== null) {
    const rate = finiteNumber(user.rate, "RATE_INVALID");
    if (rate < 0) throw new Error("RATE_INVALID");
    return { valueEurPerHour: rate, source: "employee" as const };
  }

  const today = new Date().toISOString().slice(0, 10);
  const [fallback] = await db
    .select({ rate: kostensatzDefault.eurProStunde })
    .from(kostensatzDefault)
    .where(and(
      eq(kostensatzDefault.tenantId, actor.tenantId),
      eq(kostensatzDefault.stationKuerzel, station),
      lte(kostensatzDefault.giltAb, today),
    ))
    .orderBy(desc(kostensatzDefault.giltAb))
    .limit(1);
  if (!fallback) return null;
  const rate = finiteNumber(fallback.rate, "RATE_INVALID");
  if (rate < 0) throw new Error("RATE_INVALID");
  return { valueEurPerHour: rate, source: "station_default" as const };
}

async function resolveRateInTransaction(tx: DbTransaction, actor: AuthorizationSnapshot, station: string) {
  const [user] = await tx
    .select({ rate: appUsers.kostensatzEurProStunde })
    .from(appUsers)
    .where(and(eq(appUsers.id, actor.userId), eq(appUsers.tenantId, actor.tenantId)))
    .limit(1);
  if (!user) throw new Error("ACTOR_NOT_FOUND");
  if (user.rate !== null) {
    const rate = finiteNumber(user.rate, "RATE_INVALID");
    if (rate < 0) throw new Error("RATE_INVALID");
    return { valueEurPerHour: rate, source: "employee" as const };
  }

  const today = new Date().toISOString().slice(0, 10);
  const [fallback] = await tx
    .select({ rate: kostensatzDefault.eurProStunde })
    .from(kostensatzDefault)
    .where(and(
      eq(kostensatzDefault.tenantId, actor.tenantId),
      eq(kostensatzDefault.stationKuerzel, station),
      lte(kostensatzDefault.giltAb, today),
    ))
    .orderBy(desc(kostensatzDefault.giltAb))
    .limit(1);
  if (!fallback) return null;
  const rate = finiteNumber(fallback.rate, "RATE_INVALID");
  if (rate < 0) throw new Error("RATE_INVALID");
  return { valueEurPerHour: rate, source: "station_default" as const };
}

function normalizeTemplateNumber(value: string | number | null | undefined, code: string, integer = false): number {
  const number = finiteNumber(value, code);
  if (number <= 0) throw new Error(code);
  return integer ? Math.round(number) : roundQuantity(number);
}

function normalizeComparableUnit(value: string | null | undefined): string {
  const normalized = value?.trim().toLocaleLowerCase("de-DE") || "";
  if (!normalized) throw new Error("TEMPLATE_INVALID");
  return normalized;
}

async function resolveTemplate(tenantId: string, orderId: string): Promise<ResolvedTemplate> {
  const orderItems = await db
    .select({ name: items.name, surface: items.surfaceRequested })
    .from(items)
    .where(and(eq(items.tenantId, tenantId), eq(items.orderId, orderId)))
    .orderBy(items.id);
  if (orderItems.length === 0) return { publicValue: { hat_vorlage: false }, timeRows: [], materialRows: [] };

  const classifiers = await db
    .select({ klasse: teileKlassifikator.klasse, keywords: teileKlassifikator.keywords })
    .from(teileKlassifikator)
    .where(eq(teileKlassifikator.tenantId, tenantId))
    .orderBy(teileKlassifikator.klasse, teileKlassifikator.id);
  const projectionKeys = new Map<string, { klasse: string; surface: string }>();
  for (const orderItem of orderItems) {
    const surface = normalizeString(orderItem.surface) || "unbekannt";
    const klasse = klassifiziereTeil(orderItem.name, classifiers);
    if (surface.includes("|") || normalizeString(klasse).includes("|")) {
      return { publicValue: { hat_vorlage: false }, timeRows: [], materialRows: [] };
    }
    projectionKeys.set(bildeSchluessel(klasse, surface), { klasse, surface });
  }
  if (projectionKeys.size !== 1) {
    return { publicValue: { hat_vorlage: false }, timeRows: [], materialRows: [] };
  }
  const [[initialKey, projection]] = [...projectionKeys.entries()];
  const { klasse, surface } = projection;
  const key = initialKey;

  const timeRows = await db
    .select()
    .from(vorlageZeit)
    .where(and(
      eq(vorlageZeit.tenantId, tenantId),
      eq(vorlageZeit.schluessel, key),
      eq(vorlageZeit.isActive, true),
    ))
    .orderBy(vorlageZeit.stationKuerzel, vorlageZeit.id);
  const materialRows = await db
    .select()
    .from(vorlageVerbrauch)
    .where(and(
      eq(vorlageVerbrauch.tenantId, tenantId),
      eq(vorlageVerbrauch.schluessel, key),
      eq(vorlageVerbrauch.isActive, true),
    ))
    .orderBy(vorlageVerbrauch.stationKuerzel, vorlageVerbrauch.id);

  if (timeRows.length === 0 && materialRows.length === 0) {
    return { publicValue: { hat_vorlage: false }, timeRows: [], materialRows: [] };
  }

  const rawTime = timeRows.map((row) => ({
    id: row.id,
    station: parseCaptureStation(row.stationKuerzel),
    minutes: normalizeTemplateNumber(row.medianMinuten, "TEMPLATE_INVALID", true),
    p25: row.p25Minuten === null ? normalizeTemplateNumber(row.medianMinuten, "TEMPLATE_INVALID", true) : normalizeTemplateNumber(row.p25Minuten, "TEMPLATE_INVALID", true),
    p75: row.p75Minuten === null ? normalizeTemplateNumber(row.medianMinuten, "TEMPLATE_INVALID", true) : normalizeTemplateNumber(row.p75Minuten, "TEMPLATE_INVALID", true),
    references: row.nReferenzauftraege,
  }));
  const rawMaterial = materialRows.map((row) => ({
    id: row.id,
    station: parseCaptureStation(row.stationKuerzel),
    inventoryItemId: parseCaptureEntityId(row.inventoryItemId),
    quantity: normalizeTemplateNumber(row.medianMenge, "TEMPLATE_INVALID"),
    unit: row.einheitNormiert.trim(),
    frequency: row.haeufigkeitProzent === null ? 0 : finiteNumber(row.haeufigkeitProzent, "TEMPLATE_INVALID"),
    references: row.nReferenzauftraege,
  }));
  if (rawMaterial.some((row) => row.frequency < 0 || row.frequency > 100)) throw new Error("TEMPLATE_INVALID");

  const inventoryIds = [...new Set(rawMaterial.map((row) => row.inventoryItemId))];
  const names = inventoryIds.length === 0
    ? []
    : await db.select({
        id: inventoryItems.id,
        name: inventoryItems.name,
        unit: inventoryItems.unit,
        einheitNormiert: inventoryItems.einheitNormiert,
      }).from(inventoryItems).where(and(
        eq(inventoryItems.tenantId, tenantId),
        inArray(inventoryItems.id, inventoryIds),
      ));
  const inventoryById = new Map(names.map((row) => [row.id, row]));
  for (const row of rawMaterial) {
    const inventory = inventoryById.get(row.inventoryItemId);
    const effectiveUnit = inventory?.unit?.trim() || inventory?.einheitNormiert?.trim() || null;
    if (!inventory || normalizeComparableUnit(row.unit) !== normalizeComparableUnit(effectiveUnit)) {
      throw new Error("TEMPLATE_INVALID");
    }
  }
  const maxReferences = Math.max(0, ...rawTime.map((row) => row.references), ...rawMaterial.map((row) => row.references));
  const confidence: "aufbauen" | "aktiv" | "stabil" = maxReferences < 3 ? "aufbauen" : maxReferences < 10 ? "aktiv" : "stabil";

  return {
    timeRows: rawTime,
    materialRows: rawMaterial,
    publicValue: {
      hat_vorlage: true,
      schluessel: key,
      klasse,
      oberflaeche: surface,
      konfidenz: confidence,
      n_referenzauftraege: maxReferences,
      zeit: rawTime.map((row) => ({ id: row.id, station: row.station, median_min: row.minutes, p25: row.p25, p75: row.p75 })),
      verbrauch: rawMaterial.map((row) => ({
        id: row.id,
        station: row.station,
        artikel_id: row.inventoryItemId,
        artikel_name: inventoryById.get(row.inventoryItemId)?.name || "Artikel nicht im Mandantenbestand",
        median_menge: row.quantity,
        einheit: row.unit,
        haeufigkeit_prozent: row.frequency,
      })),
    },
  };
}

type LockedCaptureOrder = {
  id: string;
  station: string;
  currentStationId: string | null;
  status: string;
};

async function lockCaptureOrder(tx: DbTransaction, tenantId: string, orderId: string): Promise<LockedCaptureOrder> {
  const [order] = await tx
    .select({
      id: orders.id,
      station: orders.station,
      currentStationId: orders.currentStationId,
      status: orders.status,
    })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)))
    .limit(1)
    .for("update");
  if (!order) throw new Error("ORDER_NOT_FOUND");
  return order;
}

function assertActiveOrderAtStation(order: LockedCaptureOrder, requestedStation: string) {
  let storedStation: OrderStation;
  let station: OrderStation;
  try {
    storedStation = parseOrderStation(order.currentStationId || order.station);
    station = parseOrderStation(requestedStation);
  } catch {
    throw new Error("UNKNOWN_ORDER_STATION");
  }
  if (storedStation !== station) throw new Error("STALE_ORDER_STATION");
  if (normalizeStoredOrderStatus(order.status) !== "in_progress") throw new Error("ORDER_NOT_IN_PROGRESS");
}

function replayReceipt(value: Record<string, unknown> | null): CaptureMutationReceipt {
  if (!value || typeof value.requestId !== "string" || typeof value.orderId !== "string" ||
      !["time", "material", "template", "station_completion"].includes(String(value.kind)) ||
      !Array.isArray(value.timeBookingIds) || !value.timeBookingIds.every((id) => typeof id === "string") ||
      !Array.isArray(value.movementIds) || !value.movementIds.every((id) => typeof id === "string") ||
      typeof value.timeCostEur !== "number" || !Number.isFinite(value.timeCostEur) || value.timeCostEur < 0 ||
      typeof value.materialCostEur !== "number" || !Number.isFinite(value.materialCostEur) || value.materialCostEur < 0 ||
      typeof value.createdAt !== "string" || Number.isNaN(new Date(value.createdAt).getTime()) ||
      (value.kind === "station_completion" && (
        typeof value.completedStation !== "string" ||
        typeof value.newStation !== "string" ||
        typeof value.newStatus !== "string" ||
        typeof value.eventId !== "string"
      ))) {
    throw new Error("RECEIPT_INVALID");
  }
  return { ...(value as Omit<CaptureMutationReceipt, "replayed">), replayed: true };
}

async function readCompletedCaptureReplay(input: {
  actor: AuthorizationSnapshot;
  orderId: string;
  station: string | null;
  requestId: string;
  kind: CaptureKind;
  hash: string;
}): Promise<CaptureMutationReceipt | null> {
  let rows;
  try {
    rows = await db
      .select({
        actorId: captureRequestReceipts.actorId,
        orderId: captureRequestReceipts.orderId,
        stationKuerzel: captureRequestReceipts.stationKuerzel,
        requestHash: captureRequestReceipts.requestHash,
        result: captureRequestReceipts.result,
      })
      .from(captureRequestReceipts)
      .where(and(
        eq(captureRequestReceipts.tenantId, input.actor.tenantId),
        eq(captureRequestReceipts.clientRequestId, input.requestId),
        eq(captureRequestReceipts.kind, input.kind),
      ))
      .limit(2);
  } catch (error) {
    const directCode = typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code || "")
      : "";
    const cause = typeof error === "object" && error !== null && "cause" in error
      ? (error as { cause?: unknown }).cause
      : null;
    const causeCode = typeof cause === "object" && cause !== null && "code" in cause
      ? String((cause as { code?: unknown }).code || "")
      : "";
    if (["42P01", "42703", "42501"].includes(directCode || causeCode)) return null;
    throw error;
  }
  if (rows.length > 1) throw new Error("REQUEST_CONFLICT");
  const [existing] = rows;
  if (!existing) return null;
  if (
    existing.actorId !== input.actor.userId
    || existing.orderId !== input.orderId
    || existing.stationKuerzel !== input.station
    || existing.requestHash !== input.hash
  ) {
    throw new Error("REQUEST_CONFLICT");
  }
  if (existing.result === null) throw new Error("REQUEST_IN_PROGRESS");
  return replayReceipt(existing.result);
}

async function beginRequest(tx: DbTransaction, input: {
  actor: AuthorizationSnapshot;
  orderId: string;
  station: string | null;
  requestId: string;
  kind: CaptureKind;
  hash: string;
}): Promise<{ gateId: string; replay: null } | { gateId: null; replay: CaptureMutationReceipt }> {
  const [created] = await tx
    .insert(captureRequestReceipts)
    .values({
      tenantId: input.actor.tenantId,
      clientRequestId: input.requestId,
      kind: input.kind,
      actorId: input.actor.userId,
      orderId: input.orderId,
      stationKuerzel: input.station,
      requestHash: input.hash,
    })
    .onConflictDoNothing({
      target: [captureRequestReceipts.tenantId, captureRequestReceipts.clientRequestId, captureRequestReceipts.kind],
    })
    .returning({ id: captureRequestReceipts.id });
  if (created) return { gateId: created.id, replay: null };

  const [existing] = await tx
    .select()
    .from(captureRequestReceipts)
    .where(and(
      eq(captureRequestReceipts.tenantId, input.actor.tenantId),
      eq(captureRequestReceipts.clientRequestId, input.requestId),
      eq(captureRequestReceipts.kind, input.kind),
    ))
    .limit(1);
  if (!existing || existing.actorId !== input.actor.userId || existing.orderId !== input.orderId ||
      existing.stationKuerzel !== input.station || existing.requestHash !== input.hash) {
    throw new Error("REQUEST_CONFLICT");
  }
  return { gateId: null, replay: replayReceipt(existing.result) };
}

async function completeRequest(
  tx: DbTransaction,
  tenantId: string,
  gateId: string,
  receipt: CaptureMutationReceipt,
) {
  const [updated] = await tx
    .update(captureRequestReceipts)
    .set({
      result: receipt as unknown as Record<string, unknown>,
      completedAt: sql`now()`,
    })
    .where(and(
      eq(captureRequestReceipts.id, gateId),
      eq(captureRequestReceipts.tenantId, tenantId),
      isNull(captureRequestReceipts.result),
      isNull(captureRequestReceipts.completedAt),
    ))
    .returning({ id: captureRequestReceipts.id });
  if (!updated) throw new Error("RECEIPT_NOT_STORED");
}

async function addAudit(tx: DbTransaction, actor: AuthorizationSnapshot, receipt: CaptureMutationReceipt) {
  await tx.insert(auditLog).values({
    tenantId: actor.tenantId,
    clientRequestId: receipt.requestId,
    action: `capture_${receipt.kind}`,
    tableName: "capture_request_receipts",
    recordId: receipt.requestId,
    actorId: actor.userId,
    payload: {
      tenant_id: actor.tenantId,
      order_id: receipt.orderId,
      time_booking_ids: receipt.timeBookingIds,
      movement_ids: receipt.movementIds,
      time_cost_eur: receipt.timeCostEur,
      material_cost_eur: receipt.materialCostEur,
      completed_station: receipt.completedStation,
      new_station: receipt.newStation,
      new_status: receipt.newStatus,
      event_id: receipt.eventId,
    },
  });
}

function mapCaptureError<T>(error: unknown): CaptureResult<T> {
  const code = error instanceof Error ? error.message : "";
  if (code === "INVALID_CAPTURE") return failure("INVALID_INPUT", "Ungültige Erfassungsdaten.");
  if (code === "ORDER_NOT_FOUND") return failure("NOT_FOUND", "Auftrag wurde im angemeldeten Mandanten nicht gefunden.");
  if (code === "NO_TEMPLATE") return failure("CONFIGURATION_MISSING", "Für diesen Auftrag liegt keine belastbare Vorlage vor.");
  if (["RATE_MISSING", "RATE_INVALID", "ACTOR_NOT_FOUND"].includes(code)) {
    return failure("CONFIGURATION_MISSING", "Für diese Station fehlt ein gültiger Kostensatz.");
  }
  if (["PRICE_MISSING", "UNIT_MISSING", "TEMPLATE_INVALID", "INVALID_NUMBER"].includes(code)) {
    return failure("CONFIGURATION_MISSING", "Bestand, Preis oder Vorlage ist nicht vollständig konfiguriert.");
  }
  if (code === "INVENTORY_TENANT_ASSIGNMENT_INCOMPLETE") {
    return failure("CONFIGURATION_MISSING", "Lagerartikel sind noch nicht vollständig dem Mandanten zugeordnet. Die Erfassung zeigt deshalb keinen unvollständigen Bestand.");
  }
  if (code === "ITEM_NOT_FOUND") return failure("NOT_FOUND", "Ein Lagerartikel gehört nicht zum angemeldeten Mandanten.");
  if (code === "INSUFFICIENT_STOCK") return failure("INSUFFICIENT_STOCK", "Der verfügbare Bestand reicht für diese Buchung nicht aus.");
  if (code === "REQUEST_CONFLICT") return failure("CONFLICT", "Diese Anforderungs-ID wurde bereits mit anderen Daten verwendet.");
  if (code === "REQUEST_IN_PROGRESS") return failure("CONFLICT", "Diese Anforderung wird bereits verarbeitet. Bitte den bestehenden Vorgang erneut abrufen.");
  if (code === "STALE_ORDER_STATION") return failure("CONFLICT", "Der Auftrag befindet sich nicht mehr an der erwarteten Station. Bitte neu laden.");
  if (code === "ORDER_NOT_IN_PROGRESS") return failure("CONFLICT", "Nur eine laufende Station kann abgeschlossen werden. Bitte neu laden.");
  if (code === "SHIPPING_RECEIPT_REQUIRED") {
    return failure("CONFLICT", "Warenausgang kann nicht über den generischen Stationsabschluss als versendet markiert werden. Ein bestätigter Übergabe-/Versandbeleg ist erforderlich.");
  }
  if (code === "BATH_PARTICIPATION_REQUIRED") {
    return failure("CONFLICT", "Galvanik kann erst abgeschlossen werden, wenn Bad, betroffene Positionen und Prozesswerte in einem atomaren Badbeteiligungsbeleg bestätigt sind.");
  }
  if (code === "QUALITY_RECEIPT_REQUIRED") {
    return failure("CONFLICT", "Qualitätssicherung kann erst abgeschlossen werden, wenn Prüfer, Ergebnis, betroffene Positionen und Zeitpunkt in einem atomaren QS-Beleg bestätigt sind.");
  }
  if (code === "ORDER_WITHOUT_ITEMS") {
    return failure("CONFLICT", "Ein Auftrag ohne bestätigte Positionen kann nicht abgeschlossen werden.");
  }
  if (code === "ITEM_STATION_DIVERGENCE") {
    return failure("CONFLICT", "Die Auftragspositionen befinden sich nicht einheitlich an dieser Station. Bitte den Positionszustand klären.");
  }
  if (code === "POSITION_ROUTE_REQUIRES_UNIT_ENGINE") {
    return failure("CONFLICT", "Für diesen Auftrag ist keine sicher ausführbare, versionierte Route belegt. Der Abschluss bleibt gesperrt, bis RouteSnapshot und Handling-Unit-Routing angebunden sind.");
  }
  if (["UNKNOWN_ORDER_STATION", "INVALID_ORDER_STATUS_TRANSITION"].includes(code)) {
    return failure("CONFLICT", "Der gespeicherte Prozesszustand erlaubt keinen sicheren Stationsabschluss.");
  }
  console.error("Capture operation failed", error);
  return failure("STORAGE_UNAVAILABLE", "Erfassung konnte nicht belastbar aus der Datenbank bestätigt werden.");
}

export async function getCaptureOverview(orderIdValue: unknown, stationValue?: unknown): Promise<CaptureResult<CaptureOverview>> {
  const actor = await authorizeCapture("read");
  if (!actor.ok) return actor;
  let orderId: string;
  let requestedStation: string | undefined;
  try {
    orderId = parseCaptureEntityId(orderIdValue);
    requestedStation = stationValue === undefined ? undefined : parseCaptureStation(stationValue);
  } catch {
    return failure("INVALID_INPUT", "Ungültiger Auftrag oder Stationsbezug.");
  }

  try {
    const [order] = await db
      .select({ id: orders.id, station: orders.station, currentStationId: orders.currentStationId })
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.tenantId, actor.data.tenantId)))
      .limit(1);
    if (!order) return failure("NOT_FOUND", "Auftrag wurde im angemeldeten Mandanten nicht gefunden.");

    const currentStation = safeStation(order.currentStationId) || safeStation(order.station);
    const selectedStation = requestedStation && requestedStation === currentStation ? requestedStation : currentStation;
    const routeItems = await db.select({
      currentStationId: items.currentStationId,
      stationSequence: items.stationSequence,
      currentStep: items.currentStep,
    }).from(items).where(and(
      eq(items.orderId, orderId),
      eq(items.tenantId, actor.data.tenantId),
    ));
    let routeExecution: CaptureOverview["routeExecution"] = {
      status: "blocked",
      nextStation: null,
      reason: "UNKNOWN_ORDER_STATION",
    };
    if (currentStation === "galvanik") {
      routeExecution = { status: "blocked", nextStation: null, reason: "BATH_PARTICIPATION_REQUIRED" };
    } else if (currentStation === "qualitaetssicherung") {
      routeExecution = { status: "blocked", nextStation: null, reason: "QUALITY_RECEIPT_REQUIRED" };
    } else if (currentStation) {
      try {
        const route = getHomogeneousRouteTransition(routeItems, parseOrderStation(currentStation));
        routeExecution = route.ok
          ? { status: "executable", nextStation: route.data.nextStation, reason: null }
          : { status: "blocked", nextStation: null, reason: route.conflict };
      } catch {
        routeExecution = { status: "blocked", nextStation: null, reason: "UNKNOWN_ORDER_STATION" };
      }
    }
    const [template, timeRows, materialRows, catalog, recentRows, selectedRate, writeCapability] = await Promise.all([
      resolveTemplate(actor.data.tenantId, orderId),
      db.select({
        id: arbeitszeitBuchung.id,
        stationKuerzel: arbeitszeitBuchung.stationKuerzel,
        dauerMinuten: arbeitszeitBuchung.dauerMinuten,
        endZeit: arbeitszeitBuchung.endZeit,
        kostensatzEurProStunde: arbeitszeitBuchung.kostensatzEurProStunde,
      }).from(arbeitszeitBuchung).where(and(
        eq(arbeitszeitBuchung.tenantId, actor.data.tenantId),
        eq(arbeitszeitBuchung.auftragId, orderId),
      )).orderBy(desc(arbeitszeitBuchung.erstelltAm)),
      db.select({
        id: stockMovements.id,
        stationKuerzel: stockMovements.stationKuerzel,
        inventoryItemId: stockMovements.inventoryItemId,
        quantity: stockMovements.quantity,
        snapshotEinkaufspreisEur: stockMovements.snapshotEinkaufspreisEur,
        createdAt: stockMovements.createdAt,
      }).from(stockMovements).where(and(
        eq(stockMovements.tenantId, actor.data.tenantId),
        eq(stockMovements.orderId, orderId),
        inArray(stockMovements.movementType, ["consumption", "verbrauch"]),
      )).orderBy(desc(stockMovements.createdAt)),
      readCaptureInventoryCatalog(actor.data.tenantId),
      db.select({ inventoryItemId: stockMovements.inventoryItemId }).from(stockMovements).where(and(
        eq(stockMovements.tenantId, actor.data.tenantId),
        eq(stockMovements.erfasstVon, actor.data.userId),
        inArray(stockMovements.movementType, ["consumption", "verbrauch"]),
      )).orderBy(desc(stockMovements.createdAt)).limit(20),
      selectedStation ? resolveRate(actor.data, selectedStation) : Promise.resolve(null),
      readCaptureWriteCapability(),
    ]);

    const templateByItem = new Map((template.publicValue.verbrauch || [])
      .filter((row) => row.station === selectedStation)
      .map((row) => [row.artikel_id, row]));
    const recentIds = new Set(recentRows.map((row) => row.inventoryItemId));
    const articles: CaptureArticle[] = catalog.rows.map((row) => {
      const suggestion = templateByItem.get(row.id);
      const stock = finiteNumber(row.currentStock);
      const unitCost = row.einkaufspreisEur === null ? null : finiteNumber(row.einkaufspreisEur);
      const source: CaptureArticle["source"] = suggestion ? "template" : recentIds.has(row.id) ? "recent" : "catalog";
      if (stock < 0 || (unitCost !== null && unitCost < 0)) throw new Error("INVALID_NUMBER");
      return {
        id: row.id,
        name: row.name,
        unit: row.unit?.trim() || row.einheitNormiert?.trim() || null,
        currentStock: stock,
        unitCostEur: unitCost,
        suggestedQuantity: suggestion?.median_menge ?? null,
        suggestedTemplateId: suggestion?.id ?? null,
        frequencyPercent: suggestion?.haeufigkeit_prozent ?? null,
        source,
      };
    }).sort((left, right) => {
      const rank = { template: 0, recent: 1, catalog: 2 } as const;
      return rank[left.source] - rank[right.source]
        || (right.frequencyPercent || 0) - (left.frequencyPercent || 0)
        || left.name.localeCompare(right.name, "de");
    });

    return {
      ok: true,
      data: {
        orderId,
        currentStation,
        selectedStation,
        selectedRate,
        writeCapability,
        inventoryCatalog: {
          limit: CAPTURE_INVENTORY_LIMIT,
          truncated: catalog.truncated,
        },
        routeExecution,
        template: template.publicValue,
        articles,
        timeBookings: timeRows.map((row) => {
          const rate = finiteNumber(row.kostensatzEurProStunde);
          return {
            id: row.id,
            station: row.stationKuerzel,
            minutes: row.dauerMinuten,
            endedAt: row.endZeit?.toISOString() || null,
            costEur: roundMoney((row.dauerMinuten / 60) * rate),
          };
        }),
        materialBookings: materialRows.map((row) => {
          const quantity = Math.abs(finiteNumber(row.quantity));
          const unitCost = row.snapshotEinkaufspreisEur === null ? null : finiteNumber(row.snapshotEinkaufspreisEur);
          return {
            id: row.id,
            station: row.stationKuerzel || "nicht_zugeordnet",
            inventoryItemId: row.inventoryItemId,
            quantity,
            unitCostEur: unitCost,
            totalCostEur: unitCost === null ? null : roundMoney(quantity * unitCost),
            createdAt: row.createdAt?.toISOString() || null,
          };
        }),
        loadedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    return mapCaptureError(error);
  }
}

export async function recordTimeCapture(value: unknown): Promise<CaptureResult<CaptureMutationReceipt>> {
  const actor = await authorizeCapture("write");
  if (!actor.ok) return actor;
  try {
    const input = parseTimeCaptureInput(value);
    const hash = requestHash({
      kind: "time",
      orderId: input.orderId,
      station: input.stationKuerzel,
      minutes: input.minutes,
      templateId: input.templateId || null,
    });
    const replay = await readCompletedCaptureReplay({
      actor: actor.data,
      orderId: input.orderId,
      station: input.stationKuerzel,
      requestId: input.clientRequestId,
      kind: "time",
      hash,
    });
    if (replay) return { ok: true, data: replay };
    const capability = await requireCaptureWriteCapability();
    if (!capability.ok) return capability;
    const receipt = await db.transaction(async (tx) => {
      const request = await beginRequest(tx, {
        actor: actor.data,
        orderId: input.orderId,
        station: input.stationKuerzel,
        requestId: input.clientRequestId,
        kind: "time",
        hash,
      });
      if (request.replay) return request.replay;
      const order = await lockCaptureOrder(tx, actor.data.tenantId, input.orderId);
      assertActiveOrderAtStation(order, input.stationKuerzel);
      if (input.templateId) {
        const [template] = await tx
          .select({ id: vorlageZeit.id, medianMinutes: vorlageZeit.medianMinuten })
          .from(vorlageZeit)
          .where(and(
            eq(vorlageZeit.tenantId, actor.data.tenantId),
            eq(vorlageZeit.id, input.templateId),
            eq(vorlageZeit.stationKuerzel, input.stationKuerzel),
            eq(vorlageZeit.isActive, true),
          ))
          .limit(1);
        if (!template || normalizeTemplateNumber(template.medianMinutes, "TEMPLATE_INVALID", true) !== input.minutes) {
          throw new Error("TEMPLATE_INVALID");
        }
      }
      const rate = await resolveRateInTransaction(tx, actor.data, input.stationKuerzel);
      if (!rate) throw new Error("RATE_MISSING");

      const endedAt = new Date();
      const startedAt = new Date(endedAt.getTime() - input.minutes * 60_000);
      const [booking] = await tx.insert(arbeitszeitBuchung).values({
        tenantId: actor.data.tenantId,
        auftragId: input.orderId,
        employeeId: actor.data.userId,
        kostenstelleKuerzel: input.stationKuerzel,
        stationKuerzel: input.stationKuerzel,
        startZeit: startedAt,
        endZeit: endedAt,
        dauerMinuten: input.minutes,
        kostensatzEurProStunde: String(rate.valueEurPerHour),
        erfasstModus: "direkt",
        warAusVorlage: Boolean(input.templateId),
        vorlageId: input.templateId || null,
        clientRequestId: input.clientRequestId,
      }).returning({ id: arbeitszeitBuchung.id });
      if (!booking) throw new Error("BOOKING_NOT_STORED");

      const createdAt = new Date().toISOString();
      const result: CaptureMutationReceipt = {
        requestId: input.clientRequestId,
        kind: "time",
        orderId: input.orderId,
        timeBookingIds: [booking.id],
        movementIds: [],
        timeCostEur: roundMoney((input.minutes / 60) * rate.valueEurPerHour),
        materialCostEur: 0,
        createdAt,
        replayed: false,
      };
      await addAudit(tx, actor.data, result);
      await completeRequest(tx, actor.data.tenantId, request.gateId, result);
      return result;
    });
    return { ok: true, data: receipt };
  } catch (error) {
    return mapCaptureError(error);
  }
}

async function lockAndConsumeMaterials(tx: DbTransaction, input: {
  actor: AuthorizationSnapshot;
  orderId: string;
  station: string;
  requestId: string;
  lines: MaterialCaptureLine[];
}): Promise<{ movementIds: string[]; materialCostEur: number }> {
  const lines = [...input.lines].sort((left, right) => left.inventoryItemId.localeCompare(right.inventoryItemId));
  for (const line of lines) {
    if (!line.templateId) continue;
    const [template] = await tx
      .select({
        id: vorlageVerbrauch.id,
        medianQuantity: vorlageVerbrauch.medianMenge,
        unit: vorlageVerbrauch.einheitNormiert,
      })
      .from(vorlageVerbrauch)
      .where(and(
        eq(vorlageVerbrauch.tenantId, input.actor.tenantId),
        eq(vorlageVerbrauch.id, line.templateId),
        eq(vorlageVerbrauch.stationKuerzel, input.station),
        eq(vorlageVerbrauch.inventoryItemId, line.inventoryItemId),
        eq(vorlageVerbrauch.isActive, true),
      ))
      .limit(1);
    if (!template || normalizeTemplateNumber(template.medianQuantity, "TEMPLATE_INVALID") !== line.quantity) {
      throw new Error("TEMPLATE_INVALID");
    }
    const [inventory] = await tx
      .select({ unit: inventoryItems.unit, einheitNormiert: inventoryItems.einheitNormiert })
      .from(inventoryItems)
      .where(and(
        eq(inventoryItems.tenantId, input.actor.tenantId),
        eq(inventoryItems.id, line.inventoryItemId),
      ))
      .limit(1);
    const effectiveUnit = inventory?.unit?.trim() || inventory?.einheitNormiert?.trim() || null;
    if (!inventory || normalizeComparableUnit(template.unit) !== normalizeComparableUnit(effectiveUnit)) {
      throw new Error("TEMPLATE_INVALID");
    }
  }
  const movementIds: string[] = [];
  let materialCost = 0;
  for (const line of lines) {
    const [item] = await tx
      .select()
      .from(inventoryItems)
      .where(and(eq(inventoryItems.id, line.inventoryItemId), eq(inventoryItems.tenantId, input.actor.tenantId)))
      .limit(1)
      .for("update");
    if (!item) throw new Error("ITEM_NOT_FOUND");
    if (item.einkaufspreisEur === null) throw new Error("PRICE_MISSING");
    if (!item.unit?.trim() && !item.einheitNormiert?.trim()) throw new Error("UNIT_MISSING");
    const stock = finiteNumber(item.currentStock);
    const price = finiteNumber(item.einkaufspreisEur);
    if (stock < line.quantity) throw new Error("INSUFFICIENT_STOCK");
    if (price < 0) throw new Error("PRICE_MISSING");
    const nextStock = roundQuantity(stock - line.quantity);

    const [updated] = await tx.update(inventoryItems).set({ currentStock: String(nextStock) }).where(and(
      eq(inventoryItems.id, item.id),
      eq(inventoryItems.tenantId, input.actor.tenantId),
    )).returning({ id: inventoryItems.id });
    if (!updated) throw new Error("ITEM_NOT_FOUND");

    const [movement] = await tx.insert(stockMovements).values({
      tenantId: input.actor.tenantId,
      inventoryItemId: item.id,
      movementType: "consumption",
      quantity: String(-line.quantity),
      unit: (item.unit || item.einheitNormiert || "").trim(),
      reason: "Auftragserfassung",
      orderId: input.orderId,
      createdBy: input.actor.userId,
      kostenstelleKuerzel: input.station,
      stationKuerzel: input.station,
      erfasstVon: input.actor.userId,
      warAusVorlage: Boolean(line.templateId),
      vorlageId: line.templateId || null,
      snapshotEinkaufspreisEur: String(price),
      clientRequestId: input.requestId,
    }).returning({ id: stockMovements.id });
    if (!movement) throw new Error("MOVEMENT_NOT_STORED");
    movementIds.push(movement.id);
    materialCost += line.quantity * price;
  }
  return { movementIds, materialCostEur: roundMoney(materialCost) };
}

export async function recordMaterialCapture(value: unknown): Promise<CaptureResult<CaptureMutationReceipt>> {
  const actor = await authorizeCapture("write");
  if (!actor.ok) return actor;
  try {
    const input = parseMaterialCaptureInput(value);
    const sortedLines = [...input.materials].sort((left, right) => left.inventoryItemId.localeCompare(right.inventoryItemId));
    const hash = requestHash({
      kind: "material",
      orderId: input.orderId,
      station: input.stationKuerzel,
      materials: sortedLines,
    });
    const replay = await readCompletedCaptureReplay({
      actor: actor.data,
      orderId: input.orderId,
      station: input.stationKuerzel,
      requestId: input.clientRequestId,
      kind: "material",
      hash,
    });
    if (replay) return { ok: true, data: replay };
    const capability = await requireCaptureWriteCapability();
    if (!capability.ok) return capability;
    const receipt = await db.transaction(async (tx) => {
      const request = await beginRequest(tx, {
        actor: actor.data,
        orderId: input.orderId,
        station: input.stationKuerzel,
        requestId: input.clientRequestId,
        kind: "material",
        hash,
      });
      if (request.replay) return request.replay;
      const order = await lockCaptureOrder(tx, actor.data.tenantId, input.orderId);
      assertActiveOrderAtStation(order, input.stationKuerzel);
      const consumed = await lockAndConsumeMaterials(tx, {
        actor: actor.data,
        orderId: input.orderId,
        station: input.stationKuerzel,
        requestId: input.clientRequestId,
        lines: sortedLines,
      });
      const result: CaptureMutationReceipt = {
        requestId: input.clientRequestId,
        kind: "material",
        orderId: input.orderId,
        timeBookingIds: [],
        movementIds: consumed.movementIds,
        timeCostEur: 0,
        materialCostEur: consumed.materialCostEur,
        createdAt: new Date().toISOString(),
        replayed: false,
      };
      await addAudit(tx, actor.data, result);
      await completeRequest(tx, actor.data.tenantId, request.gateId, result);
      return result;
    });
    try {
      revalidatePath("/items");
      revalidatePath("/lager");
    } catch {
      // Revalidation is unavailable in isolated service tests.
    }
    return { ok: true, data: receipt };
  } catch (error) {
    return mapCaptureError(error);
  }
}

export async function completeStationCapture(value: unknown): Promise<CaptureResult<CaptureMutationReceipt>> {
  const actor = await authorizeCapture("status");
  if (!actor.ok) return actor;
  try {
    const input = parseStationCompletionCaptureInput(value);
    let expectedStation: OrderStation;
    try {
      expectedStation = parseOrderStation(input.expectedStation);
    } catch {
      throw new Error("INVALID_CAPTURE");
    }
    const sortedMaterials = [...input.materials].sort((left, right) =>
      left.inventoryItemId.localeCompare(right.inventoryItemId));
    const hash = requestHash({
      kind: "station_completion",
      orderId: input.orderId,
      expectedStation,
      minutes: input.minutes,
      multiplier: input.multiplier,
      taskType: input.taskType,
      note: input.note || null,
      materials: sortedMaterials,
    });

    const replay = await readCompletedCaptureReplay({
      actor: actor.data,
      orderId: input.orderId,
      station: expectedStation,
      requestId: input.clientRequestId,
      kind: "station_completion",
      hash,
    });
    if (replay) return { ok: true, data: replay };
    const capability = await requireCaptureWriteCapability();
    if (!capability.ok) return capability;

    const receipt = await db.transaction(async (tx) => {
      const request = await beginRequest(tx, {
        actor: actor.data,
        orderId: input.orderId,
        station: expectedStation,
        requestId: input.clientRequestId,
        kind: "station_completion",
        hash,
      });
      if (request.replay) return request.replay;
      const [order] = await tx
        .select()
        .from(orders)
        .where(and(eq(orders.id, input.orderId), eq(orders.tenantId, actor.data.tenantId)))
        .limit(1)
        .for("update");
      if (!order) throw new Error("ORDER_NOT_FOUND");
      if (expectedStation === "warenausgang") throw new Error("SHIPPING_RECEIPT_REQUIRED");
      if (expectedStation === "galvanik") throw new Error("BATH_PARTICIPATION_REQUIRED");
      if (expectedStation === "qualitaetssicherung") throw new Error("QUALITY_RECEIPT_REQUIRED");

      const orderItems = await tx
        .select({
          currentStationId: items.currentStationId,
          stationSequence: items.stationSequence,
          currentStep: items.currentStep,
        })
        .from(items)
        .where(and(eq(items.orderId, order.id), eq(items.tenantId, actor.data.tenantId)))
        .for("update");

      let storedStation;
      try {
        storedStation = parseOrderStation(order.currentStationId || order.station);
      } catch {
        throw new Error("UNKNOWN_ORDER_STATION");
      }
      if (storedStation !== expectedStation) throw new Error("STALE_ORDER_STATION");
      const currentStatus = normalizeStoredOrderStatus(order.status);
      if (currentStatus !== "in_progress") throw new Error("ORDER_NOT_IN_PROGRESS");
      const routing = getHomogeneousRouteTransition(orderItems, expectedStation);
      if (!routing.ok) throw new Error(routing.conflict);

      const rate = input.minutes > 0
        ? await resolveRateInTransaction(tx, actor.data, expectedStation)
        : null;
      if (input.minutes > 0 && !rate) throw new Error("RATE_MISSING");

      const timeBookingIds: string[] = [];
      let timeCostEur = 0;
      if (input.minutes > 0 && rate) {
        const endedAt = new Date();
        const effectiveRate = roundMoney(rate.valueEurPerHour * input.multiplier);
        const bookingNote = [
          input.taskType,
          input.multiplier > 1 ? `Aufwandsfaktor ${input.multiplier}x` : null,
          input.note || null,
        ].filter(Boolean).join(" · ");
        const [booking] = await tx.insert(arbeitszeitBuchung).values({
          tenantId: actor.data.tenantId,
          auftragId: input.orderId,
          employeeId: actor.data.userId,
          kostenstelleKuerzel: expectedStation,
          stationKuerzel: expectedStation,
          startZeit: new Date(endedAt.getTime() - input.minutes * 60_000),
          endZeit: endedAt,
          dauerMinuten: input.minutes,
          kostensatzEurProStunde: String(effectiveRate),
          erfasstModus: "stationsabschluss_atomar",
          warAusVorlage: false,
          bemerkung: bookingNote,
          clientRequestId: input.clientRequestId,
        }).returning({ id: arbeitszeitBuchung.id });
        if (!booking) throw new Error("BOOKING_NOT_STORED");
        timeBookingIds.push(booking.id);
        timeCostEur = roundMoney((input.minutes / 60) * effectiveRate);
      }

      const consumed = sortedMaterials.length > 0
        ? await lockAndConsumeMaterials(tx, {
            actor: actor.data,
            orderId: input.orderId,
            station: expectedStation,
            requestId: input.clientRequestId,
            lines: sortedMaterials,
          })
        : { movementIds: [], materialCostEur: 0 };

      const completed = {
        station: routing.data.nextStation,
        status: "ready" as const,
        eventType: "STATION_COMPLETED" as const,
      };
      if (!canTransitionOrderStatus(currentStatus, completed.status)) {
        throw new Error("INVALID_ORDER_STATUS_TRANSITION");
      }
      const [persistedOrder] = await tx
        .update(orders)
        .set({
          currentStationId: completed.station,
          station: completed.station,
          status: completed.status,
        })
        .where(and(eq(orders.id, order.id), eq(orders.tenantId, actor.data.tenantId)))
        .returning({ id: orders.id });
      if (!persistedOrder) throw new Error("ORDER_TRANSITION_NOT_CONFIRMED");

      await tx
        .update(items)
        .set({ currentStationId: completed.station, currentStep: routing.data.nextStep })
        .where(and(eq(items.orderId, order.id), eq(items.tenantId, actor.data.tenantId)));

      const [costEvent] = await tx.insert(events).values({
        id: crypto.randomUUID(),
        tenantId: actor.data.tenantId,
        clientEventId: input.clientRequestId,
        orderId: order.id,
        eventType: "COSTS_BOOKED",
        station: expectedStation,
        description: `Zeit und Material für ${expectedStation} belastbar gebucht`,
        payload: {
          durationMinutes: input.minutes,
          materialCount: sortedMaterials.length,
          timeCostEur,
          materialCostEur: consumed.materialCostEur,
          multiplier: input.multiplier,
          taskType: input.taskType,
        },
        userId: actor.data.userId,
      }).returning({ id: events.id });
      if (!costEvent) throw new Error("EVENT_NOT_STORED");

      const [transitionEvent] = await tx.insert(events).values({
        id: crypto.randomUUID(),
        tenantId: actor.data.tenantId,
        orderId: order.id,
        eventType: completed.eventType,
        station: expectedStation,
        description: `Station abgeschlossen; Auftrag für ${completed.station} bereit`,
        payload: {
          completedStation: expectedStation,
          nextStation: completed.station,
          routeContractVersion: routing.data.snapshot.contractVersion,
          routeTemplateId: routing.data.snapshot.templateId,
          nextStep: routing.data.nextStep,
          captureRequestId: input.clientRequestId,
        },
        userId: actor.data.userId,
      }).returning({ id: events.id });
      if (!transitionEvent) throw new Error("EVENT_NOT_STORED");

      const result: CaptureMutationReceipt = {
        requestId: input.clientRequestId,
        kind: "station_completion",
        orderId: input.orderId,
        timeBookingIds,
        movementIds: consumed.movementIds,
        timeCostEur,
        materialCostEur: consumed.materialCostEur,
        completedStation: expectedStation,
        newStation: completed.station,
        newStatus: completed.status,
        eventId: transitionEvent.id,
        createdAt: new Date().toISOString(),
        replayed: false,
      };
      await addAudit(tx, actor.data, result);
      await completeRequest(tx, actor.data.tenantId, request.gateId, result);
      return result;
    });
    invalidateOperationalOrdersCache();
    try {
      revalidatePath("/");
      revalidatePath("/orders");
      revalidatePath("/warendurchlauf");
      revalidatePath("/items");
      revalidatePath("/lager");
    } catch {
      // Revalidation is unavailable in isolated service tests.
    }
    return { ok: true, data: receipt };
  } catch (error) {
    return mapCaptureError(error);
  }
}

export async function applyCaptureTemplate(value: unknown): Promise<CaptureResult<CaptureMutationReceipt>> {
  const actor = await authorizeCapture("write");
  if (!actor.ok) return actor;
  try {
    parseTemplateCaptureInput(value);
    return failure(
      "CONFLICT",
      "Erfahrungswerte sind nur Vorschläge. Eine Vorlage darf keine stationsübergreifenden Ist-Zeiten oder Materialverbräuche buchen; bitte die aktuelle Station einzeln erfassen.",
    );
  } catch {
    return failure("INVALID_INPUT", "Ungültiger Auftrag oder ungültige Anforderungs-ID.");
  }
}
