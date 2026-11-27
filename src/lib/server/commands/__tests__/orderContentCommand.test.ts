import { beforeEach, describe, expect, it, vi } from "vitest";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import {PgDialect} from 'drizzle-orm/pg-core';

const { execute, resolveAuthorization } = vi.hoisted(() => ({ execute: vi.fn(), resolveAuthorization: vi.fn() }));

vi.mock("@/lib/server/authorization", async () => ({
  ...(await import('@/lib/auth/authorizationContract')),
  resolveAuthorization,
  getAuthorizationActionGrants: (authorization: { permissions: readonly string[] }) => ({
    confirmPayment: false,
    editOrderContent: authorization.permissions.includes("perm_data_orders"),
    createCustomer: false,
    createQuote: false,
  }),
}));
vi.mock("@/lib/server/privilegedDb", () => ({
  withPrivilegedTenantTransaction: vi.fn(async (_context, work) => work({ execute })),
}));

import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import type { PrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { changeOrderContent, setOrderItemFinished, setOrderItemFinishedInTransaction } from "../orderContentCommand";

const actor = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const itemId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const serviceId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const clientEventId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

describe("order content command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAuthorization.mockResolvedValue({ ok: true, data: { userId: actor, tenantId: KREILE_TENANT_SLUG, role: "meister", permissions: ["perm_data_orders"],areas:['eingang','preise'], active: true, displayName: "Rolf" } });
  });

  it("writes a version-bound catalog-backed content change and an event receipt", async () => {
    execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "order-1", customer_id: "customer-1", version: 1, station: "angenommen", status: "in_progress",title:'TEST Kunde · Alter Titel' }])
      .mockResolvedValueOnce([{ id: itemId, catalog_service_id: serviceId }])
      .mockResolvedValueOnce([{ id: serviceId, name: "Vernickeln", surface: "vernickeln", unit: "stueck", net_price_cents: 1250, vat_rate_basis_points: 1900, active: true }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ version: 2 }])
      .mockResolvedValueOnce([{ id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", user_id: actor, aggregate_version: 2, created_at: "2026-10-27T04:00:00.000Z", payload: {}, event_type: "ORDER_CONTENT_CHANGED_V1", order_id: "order-1" }])
      .mockResolvedValueOnce([{has_quote:false}])
      .mockResolvedValueOnce([]); // No previously unpriced completed position to value.

    const result = await changeOrderContent({
      orderId: "order-1", expectedVersion: 1, clientEventId, note: "Sichtflächen schützen",
      items: [{ id: itemId, catalogServiceId: serviceId, name: "Clientwert", quantity: 2, material: "Stahl", surface: "Verchromen", unit: "kg", unitPriceCents: 1, vatRateBasisPoints: 0 }],
    },async()=>({companyName:'TEST Kunde',name:'TEST Kunde'}));

    expect(result).toMatchObject({ code: "OK", replayed: false, receipt: { aggregateVersion: 2, actorId: actor } });
    expect(execute).toHaveBeenCalledTimes(10);
  });

  it('TEST B1 order-only surface correction preserves the hidden price when the different surface detaches the former catalog service',async()=>{
    resolveAuthorization.mockResolvedValue({ok:true,data:{userId:actor,tenantId:KREILE_TENANT_SLUG,role:'werkstatt',areas:['auftraege'],permissions:['perm_data_orders'],active:true,displayName:'TEST Werkstatt'}});
    execute.mockResolvedValueOnce([]).mockResolvedValueOnce([])
      .mockResolvedValueOnce([{id:'order-1',customer_id:'customer-1',version:1,station:'angenommen',status:'in_progress',title:'TEST Kunde · Alt'}])
      .mockResolvedValueOnce([{id:itemId,catalog_service_id:serviceId,unit_price_cents:10000,vat_rate_basis_points:1900}])
      .mockResolvedValueOnce([]).mockResolvedValueOnce([{version:2}])
      .mockResolvedValueOnce([{id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',user_id:actor,aggregate_version:2,created_at:'2026-10-27T04:00:00.000Z',payload:{},event_type:'ORDER_CONTENT_CHANGED_V1',order_id:'order-1'}])
      .mockResolvedValueOnce([{has_quote:false}]).mockResolvedValueOnce([]);
    const result=await changeOrderContent({orderId:'order-1',expectedVersion:1,clientEventId,note:null,items:[{id:itemId,catalogServiceId:null,name:'TEST Teil',quantity:2,material:'Stahl',surface:'Vernickeln',unit:'stueck',unitPriceCents:null,vatRateBasisPoints:null}]},async()=>({companyName:'TEST Kunde',name:'TEST Kunde'}));
    expect(result).toMatchObject({code:'OK',replayed:false});
    const updates=execute.mock.calls.map(([query])=>new PgDialect().sqlToQuery(query)).filter(query=>query.sql.startsWith('UPDATE public.items'));
    expect(updates).toHaveLength(1);
    expect(updates[0].params.slice(6,8)).toEqual([100,1900]);
  });
  it("fails closed without order write permission", async () => {
    resolveAuthorization.mockResolvedValue({ ok: true, data: { userId: actor, tenantId: KREILE_TENANT_SLUG, role: "readonly", permissions: [], active: true, displayName: "Leser" } });
    await expect(setOrderItemFinished({ orderId: "order-1", itemId, expectedVersion: 1, clientEventId, finished: true })).resolves.toEqual({ code: "FORBIDDEN", message: "Diese Rolle darf den Teilstatus nicht ändern." });
    expect(execute).not.toHaveBeenCalled();
  });

  it("uses the same readable rejection for an invalid individual or bundle position", async () => {
    const auth: AuthorizationSnapshot = {
      userId: actor, tenantId: KREILE_TENANT_SLUG, permissions: ["perm_op_status"], active: true,
      role: "werkstatt", displayName: "TEST Werkstatt", areas: ["auftraege"],
    };
    const input = { orderId: "TEST-order-1", itemId: "TEST-ungueltig", expectedVersion: 1, clientEventId, finished: true };
    const antwort = { code: "VALIDATION_ERROR", message: "Teilstatus ist ungültig." };
    const transaktion = { execute } as unknown as PrivilegedTenantTransaction;

    await expect(setOrderItemFinished(input)).resolves.toEqual(antwort);
    await expect(setOrderItemFinishedInTransaction(transaktion, auth, input)).resolves.toEqual(antwort);
    expect(resolveAuthorization).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it("uses the supplied transaction and rejects a stale order version before writing a completion", async () => {
    const auth: AuthorizationSnapshot = {
      userId: actor, tenantId: KREILE_TENANT_SLUG, permissions: ["perm_op_status"], active: true,
      role: "werkstatt", displayName: "TEST Werkstatt", areas: ["auftraege"],
    };
    const laufExecute = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "TEST-order-1", version: 2 }]);
    const laufTransaktion = { execute: laufExecute } as unknown as PrivilegedTenantTransaction;
    await expect(setOrderItemFinishedInTransaction(laufTransaktion, auth, {
      orderId: "TEST-order-1", itemId, expectedVersion: 1, clientEventId, finished: true,
    })).resolves.toMatchObject({ code: "CONFLICT" });
    expect(laufExecute).toHaveBeenCalledTimes(3);
    expect(resolveAuthorization).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });
});
