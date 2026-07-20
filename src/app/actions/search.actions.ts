"use server";

import { db } from "@/db";
import { appUsers, baeder, customers, inventoryItems, items, orders } from "@/db/schema";
import { ausgangsrechnung, beleg, kostenposten, lieferant } from "@/db/schema_buchhaltung";
import { and, eq, ilike, or } from "drizzle-orm";
import { resolveAuthorization } from "@/lib/server/authorization";

export interface SearchResult {
  id: string;
  type: "customer" | "order" | "item" | "beleg" | "rechnung" | "lieferant" | "bad" | "lager" | "kostenposten";
  title: string;
  subtitle: string;
  url: string;
}

export async function globalSearch(query: unknown): Promise<{ ok: boolean; results?: SearchResult[]; error?: string }> {
  const authorization = await resolveAuthorization();
  if (!authorization.ok) return { ok: false, error: authorization.message };
  if (
    authorization.data.tenantId !== "galvanik-kreile"
    || (!authorization.data.permissions.includes("perm_view_leitstand") && !authorization.data.permissions.includes("perm_view_customers"))
  ) {
    return { ok: false, error: "Keine Berechtigung für die globale Suche." };
  }

  if (typeof query !== "string") return { ok: false, error: "Ungültige Suchanfrage." };
  const normalized = query.trim();
  if (normalized.length < 2) {
    return { ok: true, results: [] };
  }
  if (normalized.length > 100 || /[\u0000-\u001F\u007F]/.test(normalized)) {
    return { ok: false, error: "Ungültige Suchanfrage." };
  }

  const q = `%${normalized.replace(/[\\%_]/g, "\\$&")}%`;
  const tenantId = authorization.data.tenantId;
  const canViewFinance = authorization.data.permissions.includes("perm_view_prices");
  const results: SearchResult[] = [];

  try {
    const [foundCustomers, foundOrders, foundItems, foundBaths, foundInventory] = await Promise.all([
      db
        .select({ id: customers.id, name: customers.name, city: customers.city })
        .from(customers)
        .where(and(
          eq(customers.tenantId, tenantId),
          or(ilike(customers.name, q), ilike(customers.city, q), ilike(customers.companyName, q)),
        ))
        .limit(3),
      db
        .select({ id: orders.id, orderNumber: orders.orderNumber, title: orders.title, customerName: customers.name })
        .from(orders)
        .leftJoin(customers, and(eq(orders.customerId, customers.id), eq(customers.tenantId, tenantId)))
        .where(and(
          eq(orders.tenantId, tenantId),
          or(ilike(orders.orderNumber, q), ilike(orders.title, q)),
        ))
        .limit(3),
      db
        .select({ id: items.id, name: items.name, material: items.material, orderId: orders.id, orderNumber: orders.orderNumber })
        .from(items)
        .innerJoin(orders, and(eq(items.orderId, orders.id), eq(orders.tenantId, tenantId)))
        .where(and(
          eq(items.tenantId, tenantId),
          or(ilike(items.name, q), ilike(items.material, q)),
        ))
        .limit(3),
      db
        .select({ id: baeder.id, name: baeder.name, status: baeder.status })
        .from(baeder)
        .where(and(eq(baeder.tenantId, tenantId), ilike(baeder.name, q)))
        .limit(3),
      db
        .select({ id: inventoryItems.id, name: inventoryItems.name, category: inventoryItems.category })
        .from(inventoryItems)
        .where(and(
          eq(inventoryItems.tenantId, tenantId),
          or(ilike(inventoryItems.name, q), ilike(inventoryItems.category, q)),
        ))
        .limit(3),
    ]);

    results.push(
      ...foundCustomers.map((customer) => ({
        id: customer.id,
        type: "customer" as const,
        title: customer.name,
        subtitle: customer.city || "Ort nicht erfasst",
        url: `/customers?id=${encodeURIComponent(customer.id)}`,
      })),
      ...foundOrders.map((order) => ({
        id: order.id,
        type: "order" as const,
        title: order.orderNumber,
        subtitle: `${order.title}${order.customerName ? ` (${order.customerName})` : ""}`,
        url: `/orders?id=${encodeURIComponent(order.id)}`,
      })),
      ...foundItems.map((item) => ({
        id: item.id,
        type: "item" as const,
        title: item.name,
        subtitle: `Auftrag ${item.orderNumber}${item.material ? ` · ${item.material}` : ""}`,
        url: `/orders?id=${encodeURIComponent(item.orderId)}`,
      })),
      ...foundBaths.map((bath) => ({
        id: bath.id,
        type: "bad" as const,
        title: bath.name,
        subtitle: bath.status,
        url: "/baeder",
      })),
      ...foundInventory.map((inventoryItem) => ({
        id: inventoryItem.id,
        type: "lager" as const,
        title: inventoryItem.name,
        subtitle: inventoryItem.category || "Kategorie nicht erfasst",
        url: `/items?item=${encodeURIComponent(inventoryItem.id)}`,
      })),
    );

    if (canViewFinance) {
      const [foundReceipts, foundInvoices, foundSuppliers, foundCosts] = await Promise.all([
        db
          .select({
            id: beleg.id,
            supplier: beleg.lieferantText,
            invoiceNumber: beleg.rechnungsnummerExtern,
            status: beleg.status,
          })
          .from(beleg)
          .innerJoin(appUsers, and(eq(beleg.erstelltVon, appUsers.id), eq(appUsers.tenantId, tenantId)))
          .where(or(ilike(beleg.lieferantText, q), ilike(beleg.rechnungsnummerExtern, q)))
          .limit(3),
        db
          .select({ id: ausgangsrechnung.id, number: ausgangsrechnung.nummer, status: ausgangsrechnung.status })
          .from(ausgangsrechnung)
          .where(and(
            eq(ausgangsrechnung.tenantId, tenantId),
            eq(ausgangsrechnung.isDemo, false),
            ilike(ausgangsrechnung.nummer, q),
          ))
          .limit(3),
        db
          .selectDistinct({ id: lieferant.id, name: lieferant.name, address: lieferant.adresse })
          .from(lieferant)
          .innerJoin(beleg, eq(beleg.lieferantId, lieferant.id))
          .innerJoin(appUsers, and(eq(beleg.erstelltVon, appUsers.id), eq(appUsers.tenantId, tenantId)))
          .where(ilike(lieferant.name, q))
          .limit(3),
        db
          .select({ id: kostenposten.id, name: kostenposten.bezeichnung, kind: kostenposten.art })
          .from(kostenposten)
          .innerJoin(beleg, eq(kostenposten.belegId, beleg.id))
          .innerJoin(appUsers, and(eq(beleg.erstelltVon, appUsers.id), eq(appUsers.tenantId, tenantId)))
          .where(and(eq(kostenposten.isDemo, false), ilike(kostenposten.bezeichnung, q)))
          .limit(3),
      ]);
      results.push(
        ...foundReceipts.map((receipt) => ({
          id: receipt.id,
          type: "beleg" as const,
          title: receipt.supplier || "Lieferant nicht erfasst",
          subtitle: receipt.invoiceNumber || receipt.status,
          url: `/buchhaltung/belege/${encodeURIComponent(receipt.id)}`,
        })),
        ...foundInvoices.map((invoice) => ({
          id: invoice.id,
          type: "rechnung" as const,
          title: invoice.number,
          subtitle: invoice.status,
          url: `/buchhaltung/rechnungen/${encodeURIComponent(invoice.id)}`,
        })),
        ...foundSuppliers.map((supplier) => ({
          id: supplier.id,
          type: "lieferant" as const,
          title: supplier.name,
          subtitle: supplier.address || "Adresse nicht erfasst",
          url: `/lieferanten/${encodeURIComponent(supplier.id)}`,
        })),
        ...foundCosts.map((cost) => ({
          id: cost.id,
          type: "kostenposten" as const,
          title: cost.name,
          subtitle: cost.kind,
          url: `/buchhaltung/kosten/${encodeURIComponent(cost.id)}`,
        })),
      );
    }

    return { ok: true, results };
  } catch (error) {
    console.error("Global search failed:", error);
    return { ok: false, error: "Suche konnte nicht ausgeführt werden." };
  }
}
