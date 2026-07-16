"use server";

import { createHash } from "node:crypto";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  appUsers,
  auditLog,
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
import { bildeSchluessel, klassifiziereTeil } from "@/lib/erfassung/klassifikator";
import {
  CAPTURE_TENANT_ID,
  parseCaptureEntityId,
  parseCaptureStation,
  parseMaterialCaptureInput,
  parseTemplateCaptureInput,
  parseTimeCaptureInput,
  type MaterialCaptureLine,
} from "@/lib/erfassung/captureContract";
import { resolveAuthorization, type AuthorizationSnapshot } from "@/lib/server/authorization";

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
  zeit?: { station: string; median_min: number; p25: number; p75: number }[];
  verbrauch?: {
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
  unit: string;
  currentStock: number;
  unitCostEur: number | null;
  suggestedQuantity: number | null;
  frequencyPercent: number | null;
  source: "template" | "recent" | "catalog";
};

export type CaptureOverview = {
  orderId: string;
  currentStation: string | null;
  selectedStation: string | null;
  selectedRate: { valueEurPerHour: number; source: "employee" | "station_default" } | null;
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
  kind: "time" | "material" | "template";
  orderId: string;
  timeBookingIds: string[];
  movementIds: string[];
  timeCostEur: number;
  materialCostEur: number;
  createdAt: string;
  replayed: boolean;
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

async function authorizeCapture(mode: "read" | "write"): Promise<CaptureResult<AuthorizationSnapshot>> {
  const authorization = await resolveAuthorization();
  if (!authorization.ok) return failure("UNAUTHORIZED", "Anmeldung erforderlich.");
  const permissions = authorization.data.permissions;
  const canRead = permissions.includes("perm_view_leitstand") || permissions.includes("perm_data_orders");
  const canWrite = permissions.includes("perm_op_status") || permissions.includes("perm_data_orders");
  if (authorization.data.tenantId !== CAPTURE_TENANT_ID || (mode === "read" ? !canRead : !canWrite)) {
    return failure("FORBIDDEN", "Keine Berechtigung für die Auftragserfassung.");
  }
  return { ok: true, data: authorization.data };
}

function finiteNumber(value: string | number | null | undefined, code = "INVALID_NUMBER"): number {
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

function normalizeTemplateNumber(value: string | number | null | undefined, code: string, integer = false): number {
  const number = finiteNumber(value, code);
  if (number <= 0) throw new Error(code);
  return integer ? Math.round(number) : roundQuantity(number);
}

async function resolveTemplate(tenantId: string, orderId: string): Promise<ResolvedTemplate> {
  const [orderItem] = await db
    .select({ name: items.name, surface: items.surfaceRequested })
    .from(items)
    .where(and(eq(items.tenantId, tenantId), eq(items.orderId, orderId)))
    .orderBy(items.id)
    .limit(1);
  if (!orderItem) return { publicValue: { hat_vorlage: false }, timeRows: [], materialRows: [] };

  const classifiers = await db
    .select({ klasse: teileKlassifikator.klasse, keywords: teileKlassifikator.keywords })
    .from(teileKlassifikator)
    .where(eq(teileKlassifikator.tenantId, tenantId));
  const surface = orderItem.surface || "";
  const klasse = klassifiziereTeil(orderItem.name, classifiers);
  let key = bildeSchluessel(klasse, surface);

  let timeRows = await db
    .select()
    .from(vorlageZeit)
    .where(and(eq(vorlageZeit.tenantId, tenantId), eq(vorlageZeit.schluessel, key)))
    .orderBy(vorlageZeit.stationKuerzel, vorlageZeit.id);
  let materialRows = await db
    .select()
    .from(vorlageVerbrauch)
    .where(and(eq(vorlageVerbrauch.tenantId, tenantId), eq(vorlageVerbrauch.schluessel, key)))
    .orderBy(vorlageVerbrauch.stationKuerzel, vorlageVerbrauch.id);

  if (timeRows.length === 0 && materialRows.length === 0) {
    const fallbackKey = bildeSchluessel("*", surface);
    const [fallbackTime, fallbackMaterial] = await Promise.all([
      db.select().from(vorlageZeit).where(and(
        eq(vorlageZeit.tenantId, tenantId),
        eq(vorlageZeit.schluessel, fallbackKey),
        gte(vorlageZeit.nReferenzauftraege, 5),
      )).orderBy(vorlageZeit.stationKuerzel, vorlageZeit.id),
      db.select().from(vorlageVerbrauch).where(and(
        eq(vorlageVerbrauch.tenantId, tenantId),
        eq(vorlageVerbrauch.schluessel, fallbackKey),
        gte(vorlageVerbrauch.nReferenzauftraege, 5),
      )).orderBy(vorlageVerbrauch.stationKuerzel, vorlageVerbrauch.id),
    ]);
    if (fallbackTime.length > 0 || fallbackMaterial.length > 0) {
      key = fallbackKey;
      timeRows = fallbackTime;
      materialRows = fallbackMaterial;
    }
  }

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
    unit: row.einheitNormiert,
    frequency: row.haeufigkeitProzent === null ? 0 : finiteNumber(row.haeufigkeitProzent, "TEMPLATE_INVALID"),
    references: row.nReferenzauftraege,
  }));
  if (rawMaterial.some((row) => row.frequency < 0 || row.frequency > 100)) throw new Error("TEMPLATE_INVALID");

  const inventoryIds = [...new Set(rawMaterial.map((row) => row.inventoryItemId))];
  const names = inventoryIds.length === 0
    ? []
    : await db.select({ id: inventoryItems.id, name: inventoryItems.name }).from(inventoryItems).where(and(
        eq(inventoryItems.tenantId, tenantId),
        inArray(inventoryItems.id, inventoryIds),
      ));
  const namesById = new Map(names.map((row) => [row.id, row.name]));
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
      zeit: rawTime.map((row) => ({ station: row.station, median_min: row.minutes, p25: row.p25, p75: row.p75 })),
      verbrauch: rawMaterial.map((row) => ({
        station: row.station,
        artikel_id: row.inventoryItemId,
        artikel_name: namesById.get(row.inventoryItemId) || "Artikel nicht im Mandantenbestand",
        median_menge: row.quantity,
        einheit: row.unit,
        haeufigkeit_prozent: row.frequency,
      })),
    },
  };
}

async function ensureOrder(tx: DbTransaction, tenantId: string, orderId: string) {
  const [order] = await tx
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)))
    .limit(1);
  if (!order) throw new Error("ORDER_NOT_FOUND");
}

function replayReceipt(value: Record<string, unknown> | null): CaptureMutationReceipt {
  if (!value || typeof value.requestId !== "string" || typeof value.orderId !== "string" ||
      !["time", "material", "template"].includes(String(value.kind)) ||
      !Array.isArray(value.timeBookingIds) || !value.timeBookingIds.every((id) => typeof id === "string") ||
      !Array.isArray(value.movementIds) || !value.movementIds.every((id) => typeof id === "string") ||
      typeof value.timeCostEur !== "number" || typeof value.materialCostEur !== "number" ||
      typeof value.createdAt !== "string") {
    throw new Error("RECEIPT_INVALID");
  }
  return { ...(value as Omit<CaptureMutationReceipt, "replayed">), replayed: true };
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
      result: null,
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

async function completeRequest(tx: DbTransaction, gateId: string, receipt: CaptureMutationReceipt) {
  const [updated] = await tx
    .update(captureRequestReceipts)
    .set({
      result: receipt as unknown as Record<string, unknown>,
      completedAt: new Date(receipt.createdAt),
    })
    .where(eq(captureRequestReceipts.id, gateId))
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
  if (["PRICE_MISSING", "TEMPLATE_INVALID", "INVALID_NUMBER"].includes(code)) {
    return failure("CONFIGURATION_MISSING", "Bestand, Preis oder Vorlage ist nicht vollständig konfiguriert.");
  }
  if (code === "ITEM_NOT_FOUND") return failure("NOT_FOUND", "Ein Lagerartikel gehört nicht zum angemeldeten Mandanten.");
  if (code === "INSUFFICIENT_STOCK") return failure("INSUFFICIENT_STOCK", "Der verfügbare Bestand reicht für diese Buchung nicht aus.");
  if (code === "REQUEST_CONFLICT") return failure("CONFLICT", "Diese Anforderungs-ID wurde bereits mit anderen Daten verwendet.");
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
    const selectedStation = requestedStation || currentStation;
    const [template, timeRows, materialRows, catalog, recentRows, selectedRate] = await Promise.all([
      resolveTemplate(actor.data.tenantId, orderId),
      db.select().from(arbeitszeitBuchung).where(and(
        eq(arbeitszeitBuchung.tenantId, actor.data.tenantId),
        eq(arbeitszeitBuchung.auftragId, orderId),
      )).orderBy(desc(arbeitszeitBuchung.erstelltAm)),
      db.select().from(stockMovements).where(and(
        eq(stockMovements.tenantId, actor.data.tenantId),
        eq(stockMovements.orderId, orderId),
        inArray(stockMovements.movementType, ["consumption", "verbrauch"]),
      )).orderBy(desc(stockMovements.createdAt)),
      db.select().from(inventoryItems).where(eq(inventoryItems.tenantId, actor.data.tenantId)).orderBy(inventoryItems.name).limit(250),
      db.select({ inventoryItemId: stockMovements.inventoryItemId }).from(stockMovements).where(and(
        eq(stockMovements.tenantId, actor.data.tenantId),
        eq(stockMovements.erfasstVon, actor.data.userId),
        inArray(stockMovements.movementType, ["consumption", "verbrauch"]),
      )).orderBy(desc(stockMovements.createdAt)).limit(20),
      selectedStation ? resolveRate(actor.data, selectedStation) : Promise.resolve(null),
    ]);

    const templateByItem = new Map((template.publicValue.verbrauch || []).map((row) => [row.artikel_id, row]));
    const recentIds = new Set(recentRows.map((row) => row.inventoryItemId));
    const articles: CaptureArticle[] = catalog.map((row) => {
      const suggestion = templateByItem.get(row.id);
      const stock = finiteNumber(row.currentStock);
      const unitCost = row.einkaufspreisEur === null ? null : finiteNumber(row.einkaufspreisEur);
      const source: CaptureArticle["source"] = suggestion ? "template" : recentIds.has(row.id) ? "recent" : "catalog";
      if (stock < 0 || (unitCost !== null && unitCost < 0)) throw new Error("INVALID_NUMBER");
      return {
        id: row.id,
        name: row.name,
        unit: row.unit || row.einheitNormiert || "Einheit",
        currentStock: stock,
        unitCostEur: unitCost,
        suggestedQuantity: suggestion?.median_menge ?? null,
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
    const rate = await resolveRate(actor.data, input.stationKuerzel);
    if (!rate) throw new Error("RATE_MISSING");
    const hash = requestHash({
      kind: "time",
      orderId: input.orderId,
      station: input.stationKuerzel,
      minutes: input.minutes,
      templateId: input.templateId || null,
    });
    const receipt = await db.transaction(async (tx) => {
      await ensureOrder(tx, actor.data.tenantId, input.orderId);
      const request = await beginRequest(tx, {
        actor: actor.data,
        orderId: input.orderId,
        station: input.stationKuerzel,
        requestId: input.clientRequestId,
        kind: "time",
        hash,
      });
      if (request.replay) return request.replay;

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
      await completeRequest(tx, request.gateId, result);
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
  fromTemplate: boolean;
}): Promise<{ movementIds: string[]; materialCostEur: number }> {
  const lines = [...input.lines].sort((left, right) => left.inventoryItemId.localeCompare(right.inventoryItemId));
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
      reason: "Auftragserfassung",
      orderId: input.orderId,
      kostenstelleKuerzel: input.station,
      stationKuerzel: input.station,
      erfasstVon: input.actor.userId,
      warAusVorlage: input.fromTemplate,
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
    const receipt = await db.transaction(async (tx) => {
      await ensureOrder(tx, actor.data.tenantId, input.orderId);
      const request = await beginRequest(tx, {
        actor: actor.data,
        orderId: input.orderId,
        station: input.stationKuerzel,
        requestId: input.clientRequestId,
        kind: "material",
        hash,
      });
      if (request.replay) return request.replay;
      const consumed = await lockAndConsumeMaterials(tx, {
        actor: actor.data,
        orderId: input.orderId,
        station: input.stationKuerzel,
        requestId: input.clientRequestId,
        lines: sortedLines,
        fromTemplate: sortedLines.some((line) => Boolean(line.templateId)),
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
      await completeRequest(tx, request.gateId, result);
      return result;
    });
    return { ok: true, data: receipt };
  } catch (error) {
    return mapCaptureError(error);
  }
}

export async function applyCaptureTemplate(value: unknown): Promise<CaptureResult<CaptureMutationReceipt>> {
  const actor = await authorizeCapture("write");
  if (!actor.ok) return actor;
  try {
    const input = parseTemplateCaptureInput(value);
    const template = await resolveTemplate(actor.data.tenantId, input.orderId);
    if (!template.publicValue.hat_vorlage || (template.timeRows.length === 0 && template.materialRows.length === 0)) {
      throw new Error("NO_TEMPLATE");
    }
    const stations = [...new Set(template.timeRows.map((row) => row.station))];
    const rates = new Map<string, NonNullable<Awaited<ReturnType<typeof resolveRate>>>>();
    for (const station of stations) {
      const rate = await resolveRate(actor.data, station);
      if (!rate) throw new Error("RATE_MISSING");
      rates.set(station, rate);
    }
    const descriptor = {
      kind: "template",
      orderId: input.orderId,
      templateKey: template.publicValue.schluessel,
      time: template.timeRows.map((row) => ({ id: row.id, station: row.station, minutes: row.minutes })),
      material: template.materialRows.map((row) => ({ id: row.id, station: row.station, inventoryItemId: row.inventoryItemId, quantity: row.quantity })),
    };
    const hash = requestHash(descriptor);
    const receipt = await db.transaction(async (tx) => {
      await ensureOrder(tx, actor.data.tenantId, input.orderId);
      const request = await beginRequest(tx, {
        actor: actor.data,
        orderId: input.orderId,
        station: null,
        requestId: input.clientRequestId,
        kind: "template",
        hash,
      });
      if (request.replay) return request.replay;

      const timeBookingIds: string[] = [];
      let timeCost = 0;
      const now = new Date();
      for (const row of template.timeRows) {
        const rate = rates.get(row.station);
        if (!rate) throw new Error("RATE_MISSING");
        const [booking] = await tx.insert(arbeitszeitBuchung).values({
          tenantId: actor.data.tenantId,
          auftragId: input.orderId,
          employeeId: actor.data.userId,
          kostenstelleKuerzel: row.station,
          stationKuerzel: row.station,
          startZeit: new Date(now.getTime() - row.minutes * 60_000),
          endZeit: now,
          dauerMinuten: row.minutes,
          kostensatzEurProStunde: String(rate.valueEurPerHour),
          erfasstModus: "vorlage_atomar",
          warAusVorlage: true,
          vorlageId: row.id,
          clientRequestId: input.clientRequestId,
        }).returning({ id: arbeitszeitBuchung.id });
        if (!booking) throw new Error("BOOKING_NOT_STORED");
        timeBookingIds.push(booking.id);
        timeCost += (row.minutes / 60) * rate.valueEurPerHour;
      }

      const groupedMaterial = new Map<string, MaterialCaptureLine[]>();
      for (const row of template.materialRows) {
        const group = groupedMaterial.get(row.station) || [];
        group.push({ inventoryItemId: row.inventoryItemId, quantity: row.quantity, templateId: row.id });
        groupedMaterial.set(row.station, group);
      }
      const movementIds: string[] = [];
      let materialCost = 0;
      for (const station of [...groupedMaterial.keys()].sort()) {
        const consumed = await lockAndConsumeMaterials(tx, {
          actor: actor.data,
          orderId: input.orderId,
          station,
          requestId: input.clientRequestId,
          lines: groupedMaterial.get(station) || [],
          fromTemplate: true,
        });
        movementIds.push(...consumed.movementIds);
        materialCost += consumed.materialCostEur;
      }

      const result: CaptureMutationReceipt = {
        requestId: input.clientRequestId,
        kind: "template",
        orderId: input.orderId,
        timeBookingIds,
        movementIds,
        timeCostEur: roundMoney(timeCost),
        materialCostEur: roundMoney(materialCost),
        createdAt: new Date().toISOString(),
        replayed: false,
      };
      await addAudit(tx, actor.data, result);
      await completeRequest(tx, request.gateId, result);
      return result;
    });
    return { ok: true, data: receipt };
  } catch (error) {
    return mapCaptureError(error);
  }
}
