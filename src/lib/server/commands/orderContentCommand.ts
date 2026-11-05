import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { normaliseOrderPositionSurface, normaliseOrderPositionUnit, orderPositionQuantityError, orderPositionSurfaceLabel, orderPositionUnitLabel } from "@/lib/orderPositionContract";
import {
  getAuthorizationActionGrants,
  hasAuthorizationArea,
  resolveAuthorization,
} from "@/lib/server/authorization";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const VAT = new Set([0, 700, 1900]);

export type OrderContentItemInput = {
  id: string;
  catalogServiceId: string | null;
  name: string;
  quantity: number;
  material: string | null;
  surface: string;
  unit: string | null;
  unitPriceCents: number | null;
  vatRateBasisPoints: 0 | 700 | 1900 | null;
};

export type ChangeOrderContentInput = {
  orderId: string;
  expectedVersion: number;
  clientEventId: string;
  note: string | null;
  items: OrderContentItemInput[];
};

export type SetOrderItemFinishedInput = {
  orderId: string;
  itemId: string;
  expectedVersion: number;
  clientEventId: string;
  finished: boolean;
};

export type OrderContentResult =
  | { code: "OK"; receipt: { eventId: string; aggregateVersion: number; actorId: string; occurredAt: string }; replayed: boolean }
  | { code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION_ERROR" | "UNAVAILABLE"; message: string };

type OrderRow = { id: string; customer_id: string; version: number; station: string; status: string };
type ItemRow = { id: string; catalog_service_id: string | null };
type CatalogRow = { id: string; name: string; surface: string; unit: string; net_price_cents: number; vat_rate_basis_points: number; active: boolean };
type EventRow = { id: string; user_id: string; aggregate_version: number; created_at: Date | string; payload: unknown; event_type: string; order_id: string };

type PickupRow={id:string;version:number;station:string;status:string;pickup_by_name:string|null;pickup_by_note:string|null;pickup_by_source:string|null;pickup_by_at:Date|string|null;pickup_by_login:string|null;ausgabe_frei:boolean};

export async function readOrderPickupNotice(input:unknown){
  if(!input||typeof input!=="object"||Array.isArray(input)||typeof (input as Record<string,unknown>).orderId!=="string")return {code:"VALIDATION_ERROR" as const,message:"Auftragskennung fehlt."};
  const orderId=(input as {orderId:string}).orderId;
  const auth=await resolveAuthorization();
  if(!auth.ok)return {code:"UNAUTHENTICATED" as const,message:auth.message};
  if(!hasAuthorizationArea(auth.data,"eingang")&&!hasAuthorizationArea(auth.data,"auftraege"))return {code:"FORBIDDEN" as const,message:"Abholmitteilung ist nicht freigegeben."};
  try{
    const rows=await withPrivilegedTenantTransaction(auth.data,tx=>tx.execute<PickupRow>(sql`SELECT id,version,station,status,pickup_by_name,pickup_by_note,pickup_by_source,pickup_by_at,pickup_by_login::text,ausgabe_frei
      FROM public.orders WHERE tenant_id=${auth.data.tenantId} AND id=${orderId}`));
    if(rows.length!==1)return {code:"NOT_FOUND" as const,message:"Auftrag nicht verfügbar."};
    return {code:"OK" as const,data:rows[0]};
  }catch(error){console.error("[ORDER_PICKUP_READ_FAILED]",error);return {code:"UNAVAILABLE" as const,message:"Abholmitteilung konnte nicht geladen werden. Fehlercode: ORDER_PICKUP_READ_FAILED."};}
}

/** DA01/DA02: one explicit confirmation replaces the notice; the event preserves its predecessor. */
export async function changeOrderPickupNotice(input:unknown){
  if(!input||typeof input!=="object"||Array.isArray(input))return {code:"VALIDATION_ERROR" as const,message:"Abholmitteilung ist ungültig."};
  const value=input as Record<string,unknown>;
  if(Object.keys(value).sort().join(",")!=="clientEventId,expectedVersion,name,note,orderId,source"
    ||!validBase({orderId:value.orderId,expectedVersion:value.expectedVersion,clientEventId:value.clientEventId})
    ||!(value.name===null||typeof value.name==="string"&&value.name===value.name.trim()&&value.name.length>=1&&value.name.length<=160)
    ||!(value.note===null||typeof value.note==="string"&&value.note===value.note.trim()&&value.note.length<=120)
    ||!['mail','telefon','persoenlich','notiz'].includes(value.source as string))return {code:"VALIDATION_ERROR" as const,message:"Abholmitteilung ist unvollständig oder ungültig."};
  const auth=await resolveAuthorization();if(!auth.ok)return {code:"UNAUTHENTICATED" as const,message:auth.message};
  if(!hasAuthorizationArea(auth.data,"eingang")&&!hasAuthorizationArea(auth.data,"auftraege"))return {code:"FORBIDDEN" as const,message:"Abholmitteilung darf nicht geändert werden."};
  const requestHash=hash({orderId:value.orderId,expectedVersion:value.expectedVersion,name:value.name,note:value.note,source:value.source});
  try{
    return await withPrivilegedTenantTransaction(auth.data,async tx=>{
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('order-pickup:'||${auth.data.tenantId}||':'||${value.clientEventId},0))`);
      const prior=await tx.execute<EventRow>(sql`SELECT id,user_id::text,aggregate_version,created_at,payload,event_type,order_id FROM public.events
        WHERE tenant_id=${auth.data.tenantId} AND client_event_id=${value.clientEventId}::uuid LIMIT 2`);
      if(prior.length){const row=prior[0];return prior.length===1&&row.user_id===auth.data.userId&&row.event_type==='ORDER_PICKUP_NOTICE_CHANGED_V1'&&row.order_id===value.orderId
        &&(row.payload as {requestHash?:unknown})?.requestHash===requestHash?{code:"OK" as const,receipt:receipt(row),replayed:true}
        :{code:"CONFLICT" as const,message:"Diese Kennung wurde bereits anders verwendet."};}
      const rows=await tx.execute<PickupRow>(sql`SELECT id,version,station,status,pickup_by_name,pickup_by_note,pickup_by_source,pickup_by_at,pickup_by_login::text,ausgabe_frei
        FROM public.orders WHERE tenant_id=${auth.data.tenantId} AND id=${value.orderId} FOR UPDATE`);
      const row=rows[0];if(rows.length!==1||!row)return {code:"NOT_FOUND" as const,message:"Auftrag nicht verfügbar."};
      if(row.version!==value.expectedVersion)return {code:"CONFLICT" as const,message:"Abholmitteilung wurde inzwischen geändert. Bitte abgleichen und erneut bestätigen.",current:row};
      if(row.station==='abgeholt'||row.status==='storniert')return {code:"CONFLICT" as const,message:"Dieser Auftrag ist bereits abgeschlossen."};
      const updated=await tx.execute<{version:number}>(sql`UPDATE public.orders SET pickup_by_name=${value.name},pickup_by_note=${value.note},pickup_by_source=${value.source},
        pickup_by_at=statement_timestamp(),pickup_by_login=${auth.data.userId}::uuid,version=version+1
        WHERE tenant_id=${auth.data.tenantId} AND id=${value.orderId} AND version=${value.expectedVersion} RETURNING version`);
      if(updated.length!==1)throw Error('ORDER_PICKUP_VERSION_CONFLICT');
      const events=await tx.execute<EventRow>(sql`INSERT INTO public.events(id,tenant_id,order_id,event_type,description,payload,status,user_id,client_event_id,event_schema_version,aggregate_version,correlation_id)
        VALUES(gen_random_uuid()::text,${auth.data.tenantId},${value.orderId},'ORDER_PICKUP_NOTICE_CHANGED_V1','Abholmitteilung geändert',
          ${JSON.stringify({requestHash,before:{name:row.pickup_by_name,note:row.pickup_by_note,source:row.pickup_by_source},after:{name:value.name,note:value.note,source:value.source}})}::jsonb,
          'success',${auth.data.userId}::uuid,${value.clientEventId}::uuid,1,${updated[0].version},gen_random_uuid())
        RETURNING id,user_id::text,aggregate_version,created_at,payload,event_type,order_id`);
      if(events.length!==1)throw Error('ORDER_PICKUP_EVENT_MISSING');
      return {code:"OK" as const,receipt:receipt(events[0]),replayed:false};
    });
  }catch(error){console.error("[ORDER_PICKUP_WRITE_FAILED]",error);return {code:"UNAVAILABLE" as const,message:"Abholmitteilung konnte nicht sicher gespeichert werden. Fehlercode: ORDER_PICKUP_WRITE_FAILED."};}
}

function text(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length >= min && normalized.length <= max ? normalized : null;
}

function optionalText(value: unknown, max: number): string | null | undefined {
  if (value === null || value === "") return null;
  const normalized = text(value, 1, max);
  return normalized ?? undefined;
}

function validBase(input: { orderId: unknown; expectedVersion: unknown; clientEventId: unknown }) {
  return typeof input.orderId === "string" && input.orderId.trim() === input.orderId && input.orderId.length >= 1 && input.orderId.length <= 128
    && typeof input.expectedVersion === "number" && Number.isSafeInteger(input.expectedVersion) && input.expectedVersion > 0
    && typeof input.clientEventId === "string" && UUID.test(input.clientEventId);
}

function normalizeItems(value: unknown): OrderContentItemInput[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) return null;
  const items: OrderContentItemInput[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const item = raw as Record<string, unknown>;
    if (Object.keys(item).sort().join(",") !== "catalogServiceId,id,material,name,quantity,surface,unit,unitPriceCents,vatRateBasisPoints") return null;
    const name = text(item.name, 2, 160);
    const material = optionalText(item.material, 120);
    const surface = normaliseOrderPositionSurface(item.surface);
    const unit = item.unit===null?null:normaliseOrderPositionUnit(item.unit);
    if (!UUID.test(String(item.id)) || (item.catalogServiceId !== null && !UUID.test(String(item.catalogServiceId)))
      || !name || material === undefined || !surface
      || typeof item.quantity !== "number" || orderPositionQuantityError(item.quantity,unit)!==null
      || item.unit!==null&&unit===null
      || (item.unitPriceCents !== null && (typeof item.unitPriceCents !== "number" || !Number.isSafeInteger(item.unitPriceCents) || item.unitPriceCents < 0 || item.unitPriceCents > 999_999_999))
      || (item.vatRateBasisPoints !== null && !VAT.has(Number(item.vatRateBasisPoints)))) return null;
    items.push({
      id: String(item.id), catalogServiceId: item.catalogServiceId === null ? null : String(item.catalogServiceId),
      name, quantity: item.quantity, material, surface, unit,
      unitPriceCents: item.unitPriceCents as number | null,
      vatRateBasisPoints: item.vatRateBasisPoints as 0 | 700 | 1900 | null,
    });
  }
  return new Set(items.map((item) => item.id)).size === items.length ? items : null;
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function iso(value: Date | string) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error("ORDER_CONTENT_EVENT_TIME_INVALID");
  return parsed.toISOString();
}

async function authorization(permission: "content" | "status") {
  const result = await resolveAuthorization();
  if (!result.ok) return { ok: false as const, result: result.reason === "AUTHORIZATION_UNAVAILABLE"
    ? { code: "UNAVAILABLE" as const, message: result.message }
    : { code: "UNAUTHENTICATED" as const, message: result.message } };
  const allowed = permission === "content"
    ? getAuthorizationActionGrants(result.data).editOrderContent
    : result.data.permissions.includes("perm_op_status");
  if (!allowed) return { ok: false as const, result: { code: "FORBIDDEN" as const, message: permission === "content" ? "Diese Rolle darf Auftragsdaten nicht ändern." : "Diese Rolle darf den Teilstatus nicht ändern." } };
  return { ok: true as const, data: result.data };
}

function receipt(row: EventRow) {
  return { eventId: row.id, aggregateVersion: row.aggregate_version, actorId: row.user_id, occurredAt: iso(row.created_at) };
}

export async function changeOrderContent(input: ChangeOrderContentInput): Promise<OrderContentResult> {
  if (!validBase(input)) return { code: "VALIDATION_ERROR", message: "Auftrag und Änderungsstand sind ungültig." };
  const note = optionalText(input.note, 2000);
  const items = normalizeItems(input.items);
  if (note === undefined || !items) return { code: "VALIDATION_ERROR", message: "Notiz oder Positionen sind unvollständig oder ungültig." };
  const auth = await authorization("content");
  if (!auth.ok) return auth.result;
  const requestHash = hash({ orderId: input.orderId, expectedVersion: input.expectedVersion, note,
    items:items.map(item=>({...item,surface:orderPositionSurfaceLabel(item.surface),unit:item.unit===null?null:orderPositionUnitLabel(item.unit)})) });

  try {
    return await withPrivilegedTenantTransaction(auth.data, async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('order-content:' || ${auth.data.tenantId} || ':' || ${input.clientEventId}, 0))`);
      const replay = await tx.execute<EventRow>(sql`SELECT id, user_id::text AS user_id, aggregate_version, created_at, payload, event_type, order_id FROM public.events WHERE tenant_id=${auth.data.tenantId} AND client_event_id=${input.clientEventId}::uuid LIMIT 2`);
      if (replay.length) {
        const row = replay[0];
        const payload = row?.payload as { requestHash?: unknown } | null;
        return replay.length === 1 && row && row.event_type === "ORDER_CONTENT_CHANGED_V1" && row.order_id === input.orderId && payload?.requestHash === requestHash
          ? { code: "OK" as const, receipt: receipt(row), replayed: true }
          : { code: "CONFLICT" as const, message: "Anfragekennung wurde bereits anders verwendet." };
      }

      const orders = await tx.execute<OrderRow>(sql`SELECT id, customer_id, version, station, status FROM public.orders WHERE tenant_id=${auth.data.tenantId} AND id=${input.orderId} FOR UPDATE`);
      const order = orders[0];
      if (orders.length !== 1 || !order) return { code: "NOT_FOUND" as const, message: "Auftrag nicht verfügbar." };
      if (order.version !== input.expectedVersion) return { code: "CONFLICT" as const, message: "Auftrag wurde bereits geändert." };
      if (order.status === "fertig" || order.station === "abgeholt") return { code: "CONFLICT" as const, message: "Ein abgeschlossener Auftrag kann nicht inhaltlich geändert werden." };

      const existing = await tx.execute<ItemRow>(sql`SELECT id, catalog_service_id::text AS catalog_service_id FROM public.items WHERE tenant_id=${auth.data.tenantId} AND order_id=${input.orderId} FOR UPDATE`);
      if (existing.some((row) => !items.some((item) => item.id === row.id))) return { code: "VALIDATION_ERROR" as const, message: "Positionen dürfen hier nicht gelöscht werden." };
      const catalogIds = [...new Set(items.flatMap((item) => item.catalogServiceId ? [item.catalogServiceId] : []))];
      const catalog = catalogIds.length ? await tx.execute<CatalogRow>(sql`SELECT id::text AS id, name, surface, unit, net_price_cents, vat_rate_basis_points, active FROM public.catalog_services WHERE tenant_id=${auth.data.tenantId} AND id = ANY(${catalogIds}::uuid[])`) : [];
      if (catalog.length !== catalogIds.length) return { code: "VALIDATION_ERROR" as const, message: "Eine gewählte Katalogleistung ist nicht verfügbar." };
      const services = new Map(catalog.map((service) => [service.id, service]));
      const normalized = items.map((item) => {
        const service = item.catalogServiceId ? services.get(item.catalogServiceId) : null;
        if (item.catalogServiceId && (!service || (!service.active && !existing.some((row) => row.id === item.id && row.catalog_service_id === service.id)))) throw new Error("ORDER_CONTENT_CATALOG_INVALID");
        return service ? { ...item, name: service.name, surface: service.surface, unit: service.unit, unitPriceCents: service.net_price_cents, vatRateBasisPoints: service.vat_rate_basis_points as 0 | 700 | 1900 } : item;
      });

      for (const item of normalized) {
        if (existing.some((row) => row.id === item.id)) {
          await tx.execute(sql`UPDATE public.items SET name=${item.name}, quantity=${item.quantity}, material=${item.material}, surface_requested=${item.surface}, catalog_service_id=${item.catalogServiceId}::uuid, unit=${item.unit}, preis_netto=${item.unitPriceCents === null ? null : item.unitPriceCents / 100}, vat_rate_basis_points=${item.vatRateBasisPoints} WHERE tenant_id=${auth.data.tenantId} AND order_id=${input.orderId} AND id=${item.id}`);
        } else {
          await tx.execute(sql`INSERT INTO public.items (id, tenant_id, order_id, customer_id, name, quantity, material, surface_requested, catalog_service_id, unit, preis_netto, vat_rate_basis_points, current_station_id) VALUES (${item.id}, ${auth.data.tenantId}, ${input.orderId}, ${order.customer_id}, ${item.name}, ${item.quantity}, ${item.material}, ${item.surface}, ${item.catalogServiceId}::uuid, ${item.unit}, ${item.unitPriceCents === null ? null : item.unitPriceCents / 100}, ${item.vatRateBasisPoints}, ${order.station})`);
        }
      }
      const updated = await tx.execute<{ version: number }>(sql`UPDATE public.orders SET task=${note}, version=version+1 WHERE tenant_id=${auth.data.tenantId} AND id=${input.orderId} AND version=${input.expectedVersion} RETURNING version`);
      if (updated.length !== 1 || updated[0]?.version !== input.expectedVersion + 1) throw new Error("ORDER_CONTENT_VERSION_INVALID");
      const eventId = randomUUID();
      const payload = JSON.stringify({ requestHash, note, items: normalized.map(({ surface, ...item }, index) => ({ ...item, surfaceRequested: surface, position: index + 1 })) });
      const events = await tx.execute<EventRow>(sql`INSERT INTO public.events (id, tenant_id, order_id, event_type, description, payload, status, user_id, station, client_event_id, event_schema_version, aggregate_version) VALUES (${eventId}, ${auth.data.tenantId}, ${input.orderId}, 'ORDER_CONTENT_CHANGED_V1', 'Auftragsinhalt geändert', ${payload}::jsonb, 'success', ${auth.data.userId}::uuid, ${order.station}, ${input.clientEventId}::uuid, 1, ${updated[0]!.version}) RETURNING id, user_id::text AS user_id, aggregate_version, created_at, payload, event_type, order_id`);
      if (events.length !== 1 || !events[0]) throw new Error("ORDER_CONTENT_EVENT_MISSING");
      return { code: "OK" as const, receipt: receipt(events[0]), replayed: false };
    });
  } catch {
    return { code: "UNAVAILABLE", message: "Auftragsinhalt konnte nicht sicher gespeichert werden." };
  }
}

export async function setOrderItemFinished(input: SetOrderItemFinishedInput): Promise<OrderContentResult> {
  if (!validBase(input) || !UUID.test(input.itemId) || typeof input.finished !== "boolean") return { code: "VALIDATION_ERROR", message: "Teilstatus ist ungültig." };
  const auth = await authorization("status");
  if (!auth.ok) return auth.result;
  const requestHash = hash(input);
  try {
    return await withPrivilegedTenantTransaction(auth.data, async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('order-item-finished:' || ${auth.data.tenantId} || ':' || ${input.clientEventId}, 0))`);
      const replay = await tx.execute<EventRow>(sql`SELECT id, user_id::text AS user_id, aggregate_version, created_at, payload, event_type, order_id FROM public.events WHERE tenant_id=${auth.data.tenantId} AND client_event_id=${input.clientEventId}::uuid LIMIT 2`);
      if (replay.length) {
        const row = replay[0]; const payload = row?.payload as { requestHash?: unknown } | null;
        return replay.length === 1 && row && row.event_type === "ORDER_ITEM_FINISHED_CHANGED_V1" && row.order_id === input.orderId && payload?.requestHash === requestHash
          ? { code: "OK" as const, receipt: receipt(row), replayed: true }
          : { code: "CONFLICT" as const, message: "Anfragekennung wurde bereits anders verwendet." };
      }
      const orders = await tx.execute<OrderRow>(sql`SELECT id, customer_id, version, station, status FROM public.orders WHERE tenant_id=${auth.data.tenantId} AND id=${input.orderId} FOR UPDATE`);
      const order = orders[0];
      if (orders.length !== 1 || !order) return { code: "NOT_FOUND" as const, message: "Auftrag nicht verfügbar." };
      if (order.version !== input.expectedVersion) return { code: "CONFLICT" as const, message: "Auftrag wurde bereits geändert." };
      if (order.status === "fertig" || order.station === "abgeholt") return { code: "CONFLICT" as const, message: "Der Teilstatus ist bereits abgeschlossen." };
      const changed = await tx.execute<{ id: string }>(sql`UPDATE public.items SET current_station_id=${input.finished ? "fertig" : order.station} WHERE tenant_id=${auth.data.tenantId} AND order_id=${input.orderId} AND id=${input.itemId} RETURNING id`);
      if (changed.length !== 1) return { code: "NOT_FOUND" as const, message: "Teil nicht verfügbar." };
      const updated = await tx.execute<{ version: number }>(sql`UPDATE public.orders SET version=version+1 WHERE tenant_id=${auth.data.tenantId} AND id=${input.orderId} AND version=${input.expectedVersion} RETURNING version`);
      if (updated.length !== 1 || updated[0]?.version !== input.expectedVersion + 1) throw new Error("ORDER_ITEM_FINISHED_VERSION_INVALID");
      const eventId = randomUUID(); const payload = JSON.stringify({ requestHash, itemId: input.itemId, finished: input.finished });
      const events = await tx.execute<EventRow>(sql`INSERT INTO public.events (id, tenant_id, order_id, item_id, event_type, description, payload, status, user_id, station, client_event_id, event_schema_version, aggregate_version) VALUES (${eventId}, ${auth.data.tenantId}, ${input.orderId}, ${input.itemId}, 'ORDER_ITEM_FINISHED_CHANGED_V1', ${input.finished ? "Teil fertig gemeldet" : "Teil wieder geöffnet"}, ${payload}::jsonb, 'success', ${auth.data.userId}::uuid, ${order.station}, ${input.clientEventId}::uuid, 1, ${updated[0]!.version}) RETURNING id, user_id::text AS user_id, aggregate_version, created_at, payload, event_type, order_id`);
      if (events.length !== 1 || !events[0]) throw new Error("ORDER_ITEM_FINISHED_EVENT_MISSING");
      return { code: "OK" as const, receipt: receipt(events[0]), replayed: false };
    });
  } catch {
    return { code: "UNAVAILABLE", message: "Teilstatus konnte nicht sicher gespeichert werden." };
  }
}
