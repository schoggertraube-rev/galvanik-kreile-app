"use server";

import { and, desc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { inquiries, marketingTouchpoints, orders, qs } from "@/db/schema";
import { ausgangsrechnung } from "@/db/schema_buchhaltung";
import { resolveAuthorization } from "@/lib/server/authorization";

const TENANT_ID = "galvanik-kreile";
const ENTITY_ID = /^[A-Za-z0-9_-]{1,100}$/;

export type OrderConnections = {
  quality: {
    id: string;
    result: string;
    examiner: string | null;
    inspectedAt: string;
    note: string | null;
  } | null;
  invoice: {
    id: string;
    number: string;
    status: string;
    issuedAt: string;
    grossEur: number;
  } | null;
  marketing: {
    inquiryId: string;
    sourceType: string;
    sourceLabel: string;
    confidencePercent: number | null;
    touchpoint: { id: string; channel: string; title: string | null } | null;
  } | null;
  warnings: string[];
  loadedAt: string;
};

export type OrderConnectionsResult =
  | { ok: true; data: OrderConnections }
  | { ok: false; error: "UNAUTHORIZED" | "FORBIDDEN" | "INVALID_INPUT" | "NOT_FOUND" | "DB_ERROR"; message: string };

export async function getOrderConnections(orderIdValue: unknown): Promise<OrderConnectionsResult> {
  const authorization = await resolveAuthorization();
  if (!authorization.ok) return { ok: false, error: "UNAUTHORIZED", message: "Anmeldung erforderlich." };
  if (
    authorization.data.tenantId !== TENANT_ID
    || (!authorization.data.permissions.includes("perm_view_leitstand") && !authorization.data.permissions.includes("perm_data_orders"))
  ) {
    return { ok: false, error: "FORBIDDEN", message: "Keine Berechtigung für Auftragsverknüpfungen." };
  }
  if (typeof orderIdValue !== "string" || !ENTITY_ID.test(orderIdValue)) {
    return { ok: false, error: "INVALID_INPUT", message: "Ungültige Auftrags-ID." };
  }

  try {
    const [order] = await db.select({
      id: orders.id,
      inquiryId: orders.inquiryId,
    }).from(orders).where(and(
      eq(orders.id, orderIdValue),
      eq(orders.tenantId, authorization.data.tenantId),
    )).limit(1);
    if (!order) return { ok: false, error: "NOT_FOUND", message: "Auftrag wurde im angemeldeten Mandanten nicht gefunden." };

    const [qualityRows, invoiceRows] = await Promise.all([
      db.select().from(qs).where(and(
        eq(qs.tenantId, authorization.data.tenantId),
        eq(qs.orderId, order.id),
      )).orderBy(desc(qs.datum), desc(qs.createdAt)).limit(1),
      db.select().from(ausgangsrechnung).where(and(
        eq(ausgangsrechnung.tenantId, authorization.data.tenantId),
        eq(ausgangsrechnung.orderId, order.id),
        or(eq(ausgangsrechnung.isDemo, false), isNull(ausgangsrechnung.isDemo)),
      )).orderBy(desc(ausgangsrechnung.erstelltAm)).limit(1),
    ]);

    const warnings: string[] = [];
    let marketing: OrderConnections["marketing"] = null;
    if (order.inquiryId) {
      const [inquiry] = await db.select().from(inquiries).where(and(
        eq(inquiries.tenantId, authorization.data.tenantId),
        eq(inquiries.id, order.inquiryId),
      )).limit(1);
      if (!inquiry) {
        warnings.push("Die gespeicherte Anfrageverknüpfung zeigt auf keinen Datensatz im aktuellen Mandanten.");
      } else {
        let touchpoint: NonNullable<OrderConnections["marketing"]>["touchpoint"] = null;
        if (inquiry.quelleTouchpointId) {
          const [row] = await db.select().from(marketingTouchpoints).where(and(
            eq(marketingTouchpoints.id, inquiry.quelleTouchpointId),
            eq(marketingTouchpoints.tenantId, authorization.data.tenantId),
          )).limit(1);
          if (row) {
            touchpoint = { id: row.id, channel: row.kanal, title: row.titel };
          } else {
            warnings.push("Der gespeicherte Marketing-Touchpoint ist im aktuellen Mandanten nicht vorhanden.");
          }
        }
        const rawConfidence = inquiry.quelleKonfidenz === null ? null : Number(inquiry.quelleKonfidenz);
        const confidencePercent = rawConfidence !== null && Number.isFinite(rawConfidence) && rawConfidence >= 0 && rawConfidence <= 1
          ? Math.round(rawConfidence * 10_000) / 100
          : null;
        if (inquiry.quelleKonfidenz !== null && confidencePercent === null) {
          warnings.push("Die gespeicherte Quellenkonfidenz liegt außerhalb des erwarteten Bereichs 0 bis 1.");
        }
        marketing = {
          inquiryId: inquiry.id,
          sourceType: inquiry.quelleTyp,
          sourceLabel: inquiry.quelleManuell?.trim() || touchpoint?.title || touchpoint?.channel || inquiry.quelleTyp,
          confidencePercent,
          touchpoint,
        };
      }
    }

    const quality = qualityRows[0];
    const invoice = invoiceRows[0];
    const gross = invoice ? Number(invoice.brutto) : null;
    if (invoice && (gross === null || !Number.isFinite(gross))) throw new Error("INVALID_INVOICE_AMOUNT");
    return {
      ok: true,
      data: {
        quality: quality ? {
          id: quality.id,
          result: quality.ergebnis,
          examiner: quality.pruefer,
          inspectedAt: quality.datum.toISOString(),
          note: quality.bemerkung,
        } : null,
        invoice: invoice ? {
          id: invoice.id,
          number: invoice.nummer,
          status: invoice.status,
          issuedAt: invoice.datum,
          grossEur: gross as number,
        } : null,
        marketing,
        warnings,
        loadedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("Order connections read failed", error);
    return { ok: false, error: "DB_ERROR", message: "Auftragsverknüpfungen konnten nicht bestätigt werden." };
  }
}
