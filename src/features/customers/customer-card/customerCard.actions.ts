"use server";

import { db } from "@/db";
import { customers, orders, events, complaints, priceAgreements, communicationDrafts, phoneNotes } from "@/db/schema";
import { ausgangsrechnung } from "@/db/schema_buchhaltung";
import { eq, desc, and, sql, type InferInsertModel, type InferSelectModel } from "drizzle-orm";
import { checkAppAuth } from "@/lib/server/authHelper";

export type CustomerTimelineEntry = {
  id: string;
  type: "status" | "note" | "email";
  title: string | null;
  subtitle: string | null;
  timestamp: string;
  relatedOrderId?: string;
  severity: "critical" | "neutral";
};

export type CustomerKpiRow = {
  customer_id: string;
  kunde: string;
  classification: string;
  kunde_seit: string;
  umsatz_ltv: number;
  gewinn_ltv: number;
  offene_posten: number;
  aktive_auftraege: number;
  puenktlichkeit_pct: number | null;
  reklamationen: number;
};

export type CustomerItemProfileRow = {
  bezeichnung: string;
  material: string | null;
  oberflaeche: string | null;
  count: number;
  last_seen: string;
  avg_price: null;
};

export type CustomerInvoice = Pick<InferSelectModel<typeof ausgangsrechnung>,
  "id" | "nummer" | "status" | "datum" | "faelligAm" | "brutto"
>;

export type CustomerFinancials = {
  invoices: CustomerInvoice[];
};

export type CustomerPriceAgreement = Pick<InferSelectModel<typeof priceAgreements>,
  "id" | "scope" | "date" | "rate"
>;

type CustomerCorePatch = Pick<InferInsertModel<typeof customers>,
  "shippingPreference" | "paymentPreference" | "classification" | "internalNotes" | "tags" | "name" | "contactPerson" | "email" | "phone"
>;

type CustomerCoreUpdate = Partial<CustomerCorePatch> & Pick<InferInsertModel<typeof customers>, "updatedAt">;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Unbekannter Fehler";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getRows(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  if (isRecord(result) && Array.isArray(result.rows)) return result.rows;
  return [];
}

function getString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function getNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getDateString(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === "string" && Number.isFinite(new Date(value).getTime())) return value;
  return null;
}

function parseCustomerKpi(value: unknown): CustomerKpiRow | null {
  if (!isRecord(value)) return null;

  const customerId = getString(value.customer_id);
  const kunde = getString(value.kunde);
  const kundeSeit = getDateString(value.kunde_seit);
  const umsatzLtv = getNumber(value.umsatz_ltv);
  const gewinnLtv = getNumber(value.gewinn_ltv);
  const offenePosten = getNumber(value.offene_posten);
  const aktiveAuftraege = getNumber(value.aktive_auftraege);
  const reklamationen = getNumber(value.reklamationen);

  if (
    !customerId || !kunde || !kundeSeit || umsatzLtv === null || gewinnLtv === null ||
    offenePosten === null || aktiveAuftraege === null || reklamationen === null
  ) {
    return null;
  }

  return {
    customer_id: customerId,
    kunde,
    classification: getString(value.classification) ?? "B",
    kunde_seit: kundeSeit,
    umsatz_ltv: umsatzLtv,
    gewinn_ltv: gewinnLtv,
    offene_posten: offenePosten,
    aktive_auftraege: aktiveAuftraege,
    puenktlichkeit_pct: getNumber(value.puenktlichkeit_pct),
    reklamationen,
  };
}

function parseCustomerItemProfile(value: unknown): CustomerItemProfileRow | null {
  if (!isRecord(value)) return null;

  const bezeichnung = getString(value.bezeichnung);
  const count = getNumber(value.count);
  const lastSeen = getDateString(value.last_seen);
  if (!bezeichnung || count === null || !lastSeen) return null;

  return {
    bezeichnung,
    material: getString(value.material),
    oberflaeche: getString(value.oberflaeche),
    count,
    last_seen: lastSeen,
    avg_price: null,
  };
}

// 1. Core Customer Data
export async function getCustomerCard(customerId: string) {
  const auth = await checkAppAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  try {
    // 1. Stammdaten
    const [customer] = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
    
    if (!customer) return { ok: false, error: "NOT_FOUND" };

    // 2. KPI aus View (Raw SQL fallback if view not directly accessible via drizzle-orm object without defining it, but we can use sql helper)
    let kpi: CustomerKpiRow | null = null;
    try {
      const kpiResult = await db.execute(sql`SELECT * FROM v_analyse_kunden_kpi WHERE customer_id = ${customerId}`);
      kpi = getRows(kpiResult).map(parseCustomerKpi).find((row): row is CustomerKpiRow => row !== null) ?? null;
    } catch (e) {
      console.warn("Could not fetch KPI view for customer", customerId, e);
      kpi = null;
    }

    // 3. Offene Aufträge (limit 5 for overview)
    const openOrders = await db.select()
      .from(orders)
      .where(and(eq(orders.customerId, customerId), eq(orders.status, 'in_progress')))
      .orderBy(orders.createdAt)
      .limit(5);

    // 4. Tags & Notes are already in customer object
    
    // We'll return everything combined
    return { 
      ok: true, 
      data: {
        ...customer,
        kpi,
        openOrders
      } 
    };
  } catch (err) {
    console.error("getCustomerCard error", err);
    return { ok: false, error: getErrorMessage(err) };
  }
}

// 2. Detailed Orders
export async function getCustomerOrders(customerId: string) {
  const auth = await checkAppAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  try {
    const allOrders = await db.select()
      .from(orders)
      .where(eq(orders.customerId, customerId))
      .orderBy(desc(orders.createdAt));

    return { ok: true, data: allOrders };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}

// 3. Timeline
export async function getCustomerTimeline(customerId: string) {
  const auth = await checkAppAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  try {
    const timeline: CustomerTimelineEntry[] = [];

    // Events
    const dbEvents = await db.select().from(events)
      .innerJoin(orders, eq(events.orderId, orders.id))
      .where(eq(orders.customerId, customerId))
      .orderBy(desc(events.createdAt))
      .limit(50);
      
    for (const e of dbEvents) {
      timeline.push({
        id: e.events.id,
        type: "status",
        title: e.events.eventType,
        subtitle: e.events.description,
        timestamp: e.events.createdAt.toISOString(),
        relatedOrderId: e.events.orderId,
        severity: e.events.status === "error" ? "critical" : "neutral"
      });
    }

    // Phone notes
    const dbNotes = await db.select().from(phoneNotes)
      .where(eq(phoneNotes.customerId, customerId))
      .orderBy(desc(phoneNotes.createdAt))
      .limit(20);

    for (const n of dbNotes) {
      timeline.push({
        id: n.id,
        type: "note",
        title: "Telefonnotiz",
        subtitle: n.rawText,
        timestamp: (n.createdAt || new Date()).toISOString(),
        severity: "neutral"
      });
    }

    // Comm drafts (sent/archived could be considered here)
    const dbComms = await db.select().from(communicationDrafts)
      .where(eq(communicationDrafts.customerId, customerId))
      .orderBy(desc(communicationDrafts.createdAt))
      .limit(20);

    for (const c of dbComms) {
      timeline.push({
        id: c.id,
        type: "email",
        title: c.subject,
        subtitle: c.status,
        timestamp: c.createdAt.toISOString(),
        severity: "neutral"
      });
    }

    // Sort combined timeline desc
    timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return { ok: true, data: timeline };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}

// 4. Financials
export async function getCustomerFinancials(customerId: string) {
  const auth = await checkAppAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  try {
    const invoices: CustomerInvoice[] = await db.select({
      id: ausgangsrechnung.id,
      nummer: ausgangsrechnung.nummer,
      status: ausgangsrechnung.status,
      datum: ausgangsrechnung.datum,
      faelligAm: ausgangsrechnung.faelligAm,
      brutto: ausgangsrechnung.brutto,
    }).from(ausgangsrechnung)
      .where(eq(ausgangsrechnung.kundeId, customerId))
      .orderBy(desc(ausgangsrechnung.datum));

    // We could fetch payments explicitly, but they might be tied to invoices. For now return invoices
    return { ok: true, data: { invoices } };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}

// 5. Similar Orders
export async function getCustomerSimilarOrders(customerId: string, orderId?: string) {
  const auth = await checkAppAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  try {
    const similar = await db.select()
      .from(orders)
      .where(and(
        eq(orders.customerId, customerId),
        eq(orders.status, 'abgeschlossen')
      ))
      .orderBy(desc(orders.createdAt))
      .limit(10);
      
    // Exclude self if provided
    const filtered = orderId ? similar.filter(o => o.id !== orderId) : similar;

    return { ok: true, data: filtered };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}

// 6. Items (Teile)
export async function getCustomerItems(customerId: string) {
  const auth = await checkAppAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  try {
    // The items table has no stored sales price. Keep this profile strictly on the
    // persisted part attributes and expose the unavailable average as null.
    const result = await db.execute(sql`
      SELECT 
        name AS bezeichnung,
        material, 
        surface_requested AS oberflaeche,
        COUNT(id)::int AS count,
        MAX(created_at) as last_seen,
        NULL::numeric AS avg_price
      FROM items 
      WHERE customer_id = ${customerId}
      GROUP BY name, material, surface_requested
      ORDER BY count DESC
    `);
    
    return {
      ok: true,
      data: getRows(result).map(parseCustomerItemProfile).filter((row): row is CustomerItemProfileRow => row !== null),
    };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}

// 7. Prices
export async function getCustomerPrices(customerId: string) {
  const auth = await checkAppAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  try {
    const prices: CustomerPriceAgreement[] = await db.select({
      id: priceAgreements.id,
      scope: priceAgreements.scope,
      date: priceAgreements.date,
      rate: priceAgreements.rate,
    }).from(priceAgreements)
      .where(eq(priceAgreements.customerId, customerId))
      .orderBy(desc(priceAgreements.date));
    
    return { ok: true, data: prices };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}

// 8. Complaints
export async function getCustomerComplaints(customerId: string) {
  const auth = await checkAppAuth();
  if (!auth.ok) return { ok: false, error: auth.error };

  try {
    const data = await db.select().from(complaints)
      .innerJoin(orders, eq(complaints.orderId, orders.id))
      .where(eq(orders.customerId, customerId))
      .orderBy(desc(complaints.createdAt));
    
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}

// 9. Write Functions
export async function updateCustomerCore(customerId: string, patch: Partial<CustomerCorePatch>) {
  const auth = await checkAppAuth("write");
  if (!auth.ok) return { ok: false, error: auth.error };

  try {
    const updateData: CustomerCoreUpdate = { updatedAt: new Date() };
    if (patch.shippingPreference !== undefined) updateData.shippingPreference = patch.shippingPreference;
    if (patch.paymentPreference !== undefined) updateData.paymentPreference = patch.paymentPreference;
    if (patch.classification !== undefined) updateData.classification = patch.classification;
    if (patch.internalNotes !== undefined) updateData.internalNotes = patch.internalNotes;
    if (patch.tags !== undefined) updateData.tags = patch.tags;
    if (patch.name !== undefined) updateData.name = patch.name;
    if (patch.contactPerson !== undefined) updateData.contactPerson = patch.contactPerson;
    if (patch.email !== undefined) updateData.email = patch.email;
    if (patch.phone !== undefined) updateData.phone = patch.phone;

    if (Object.keys(updateData).length > 1) {
      await db.update(customers).set(updateData).where(eq(customers.id, customerId));
    }
    
    return { ok: true };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}

export async function addCustomerTag(customerId: string, tag: string) {
  const auth = await checkAppAuth("write");
  if (!auth.ok) return { ok: false, error: auth.error };

  try {
    const [c] = await db.select({ tags: customers.tags }).from(customers).where(eq(customers.id, customerId));
    if (!c) return { ok: false, error: "NOT_FOUND" };
    
    let currentTags = c.tags as string[] || [];
    if (!currentTags.includes(tag)) {
      currentTags = [...currentTags, tag];
      await db.update(customers).set({ tags: currentTags, updatedAt: new Date() }).where(eq(customers.id, customerId));
    }
    
    return { ok: true };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}

export async function removeCustomerTag(customerId: string, tag: string) {
  const auth = await checkAppAuth("write");
  if (!auth.ok) return { ok: false, error: auth.error };

  try {
    const [c] = await db.select({ tags: customers.tags }).from(customers).where(eq(customers.id, customerId));
    if (!c) return { ok: false, error: "NOT_FOUND" };
    
    let currentTags = c.tags as string[] || [];
    currentTags = currentTags.filter(t => t !== tag);
    await db.update(customers).set({ tags: currentTags, updatedAt: new Date() }).where(eq(customers.id, customerId));
    
    return { ok: true };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}
