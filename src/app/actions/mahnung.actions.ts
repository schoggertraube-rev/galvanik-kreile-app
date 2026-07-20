"use server";

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { communications, customers } from "@/db/schema";
import { ausgangsrechnung, bhAuditLog } from "@/db/schema_buchhaltung";
import { requireFinanceWrite } from "@/lib/server/financeAuthorization";
import { readStatusEmailLedgerCapability } from "@/lib/server/statusEmailCapability";

const TENANT_ID = "galvanik-kreile";
const ENTITY_ID = /^[A-Za-z0-9_-]{1,100}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
const OPEN_STATUSES = new Set(["offen", "teilbezahlt", "ueberfaellig", "gemahnt", "mahnung"]);

type DraftKind = "payment_reminder" | "dunning";
type ManualDraftResult =
  | {
      success: true;
      modus: "manuell";
      draftId: string;
      text: string;
      empfaenger_email: string | null;
      vorgeschlageneMahnstufe: number | null;
      replayed: boolean;
      hinweis: string;
    }
  | { success: false; code: string; message: string };

function failure(code: string, message: string): ManualDraftResult {
  return { success: false, code, message };
}

function parseInput(invoiceId: unknown, clientRequestId: unknown): { invoiceId: string; clientRequestId: string } {
  if (typeof invoiceId !== "string" || !ENTITY_ID.test(invoiceId)) throw new Error("INVALID_INPUT");
  if (typeof clientRequestId !== "string" || !UUID.test(clientRequestId)) throw new Error("INVALID_INPUT");
  return { invoiceId, clientRequestId };
}

function cents(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1_000_000_000) return null;
  const scaled = Math.round(number * 100);
  return Math.abs(number * 100 - scaled) <= 1e-7 && Number.isSafeInteger(scaled) ? scaled : null;
}

function formatMoney(valueCents: number): string {
  return (valueCents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatIsoDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });
}

function berlinToday(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function replayLevel(templateKey: string | null, kind: DraftKind): number | null {
  if (kind === "payment_reminder") return templateKey === "manual_payment_reminder" ? null : Number.NaN;
  const match = templateKey?.match(/^manual_dunning_level_(\d{1,3})$/);
  return match ? Number(match[1]) : Number.NaN;
}

async function createManualDraft(
  kind: DraftKind,
  invoiceIdValue: unknown,
  clientRequestIdValue: unknown,
): Promise<ManualDraftResult> {
  let actor;
  try {
    actor = await requireFinanceWrite();
  } catch {
    return failure("FORBIDDEN", "Keine Schreibberechtigung für kaufmännische Kommunikationsentwürfe.");
  }
  if (actor.tenantId !== TENANT_ID) return failure("FORBIDDEN", "Mandant ist für diese Funktion nicht freigegeben.");

  let input: ReturnType<typeof parseInput>;
  try {
    input = parseInput(invoiceIdValue, clientRequestIdValue);
  } catch {
    return failure("INVALID_INPUT", "Ungültige Rechnungs- oder Anforderungs-ID.");
  }

  const capability = await readStatusEmailLedgerCapability();
  if (!capability.available) {
    return failure("CONFIGURATION_MISSING", capability.reason || "Der Kommunikationsbeleg ist noch nicht ausgerollt.");
  }

  const idempotencyKey = `${kind === "payment_reminder" ? "payment-reminder" : "dunning"}/${input.invoiceId}/${input.clientRequestId}`;
  try {
    return await db.transaction(async (tx): Promise<ManualDraftResult> => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${input.clientRequestId}, 0))`);
      const [existing] = await tx.select({
        id: communications.id,
        tenantId: communications.tenantId,
        invoiceId: communications.invoiceId,
        createdBy: communications.createdBy,
        recipient: communications.recipient,
        templateKey: communications.templateKey,
        idempotencyKey: communications.idempotencyKey,
        subject: communications.subject,
        body: communications.body,
        type: communications.type,
        channelType: communications.channelType,
        status: communications.status,
      }).from(communications).where(eq(communications.id, input.clientRequestId)).limit(1);
      if (existing) {
        const level = replayLevel(existing.templateKey, kind);
        if (
          existing.tenantId !== actor.tenantId
          || existing.invoiceId !== input.invoiceId
          || existing.createdBy !== actor.userId
          || existing.idempotencyKey !== idempotencyKey
          || existing.type !== "email_draft"
          || existing.channelType !== "manual"
          || existing.status !== "draft"
          || !existing.subject?.trim()
          || !existing.body?.trim()
          || Number.isNaN(level)
        ) return failure("REQUEST_CONFLICT", "Diese Anforderungs-ID gehört zu einem anderen Kommunikationsentwurf.");
        return {
          success: true,
          modus: "manuell",
          draftId: existing.id,
          text: existing.body,
          empfaenger_email: existing.recipient,
          vorgeschlageneMahnstufe: level,
          replayed: true,
          hinweis: "Der bereits bestätigte manuelle Entwurf wurde erneut geladen; es wurde keine Mahnstufe und kein Versand behauptet.",
        };
      }

      const [invoice] = await tx.select({
        id: ausgangsrechnung.id,
        number: ausgangsrechnung.nummer,
        customerId: ausgangsrechnung.kundeId,
        orderId: ausgangsrechnung.orderId,
        invoiceDate: ausgangsrechnung.datum,
        dueDate: ausgangsrechnung.faelligAm,
        gross: ausgangsrechnung.brutto,
        paid: ausgangsrechnung.bezahltBetragEur,
        status: ausgangsrechnung.status,
        dunningLevel: ausgangsrechnung.mahnstufe,
        customerName: customers.name,
        companyName: customers.companyName,
        contactName: customers.contactPerson,
        customerEmail: customers.email,
      }).from(ausgangsrechnung).innerJoin(customers, and(
        eq(customers.id, ausgangsrechnung.kundeId),
        eq(customers.tenantId, actor.tenantId),
      )).where(and(
        eq(ausgangsrechnung.id, input.invoiceId),
        eq(ausgangsrechnung.tenantId, actor.tenantId),
      )).limit(1).for("update");
      if (!invoice) return failure("NOT_FOUND", "Rechnung und Kunde wurden im angemeldeten Mandanten nicht gemeinsam gefunden.");
      if (!OPEN_STATUSES.has(invoice.status)) return failure("INVOICE_NOT_OPEN", "Für eine bezahlte, stornierte oder unbekannte Rechnung wird kein Mahnentwurf erzeugt.");

      const grossCents = cents(invoice.gross);
      const paidCents = invoice.paid === null ? 0 : cents(invoice.paid);
      const invoiceDate = formatIsoDate(invoice.invoiceDate);
      const dueDate = invoice.dueDate ? formatIsoDate(invoice.dueDate) : null;
      if (grossCents === null || paidCents === null || !invoiceDate || !dueDate || paidCents > grossCents) {
        return failure("INVALID_INVOICE_DATA", "Rechnungsbetrag, Zahlung oder Fälligkeit ist nicht belastbar.");
      }
      if (invoice.dueDate! >= berlinToday()) return failure("INVOICE_NOT_DUE", "Die Rechnung ist noch nicht überfällig.");
      const outstandingCents = grossCents - paidCents;
      if (outstandingCents <= 0) return failure("INVOICE_NOT_OPEN", "Für diese Rechnung ist kein offener Betrag bestätigt.");

      const customerName = invoice.contactName?.trim() || invoice.companyName?.trim() || invoice.customerName.trim();
      const recipient = invoice.customerEmail?.trim().toLowerCase() || null;
      const confirmedRecipient = recipient && EMAIL.test(recipient) ? recipient : null;
      const currentLevel = invoice.dunningLevel || 0;
      if (!Number.isSafeInteger(currentLevel) || currentLevel < 0 || currentLevel > 999) {
        return failure("INVALID_INVOICE_DATA", "Die gespeicherte Mahnstufe ist ungültig.");
      }
      const suggestedLevel = kind === "dunning" ? currentLevel + 1 : null;
      const subject = kind === "payment_reminder"
        ? `Zahlungserinnerung Rechnung ${invoice.number}`
        : `Mahnungsentwurf Stufe ${suggestedLevel} Rechnung ${invoice.number}`;
      const body = kind === "payment_reminder"
        ? `Guten Tag ${customerName},\n\nwir möchten Sie an den offenen Betrag von ${formatMoney(outstandingCents)} € aus der Rechnung ${invoice.number} vom ${invoiceDate} erinnern. Die Fälligkeit war am ${dueDate}.\n\nBitte prüfen Sie den Zahlungsvorgang.\n\nMit freundlichen Grüßen\nGalvanik Kreile`
        : `Guten Tag ${customerName},\n\nzu der Rechnung ${invoice.number} vom ${invoiceDate} ist weiterhin ein offener Betrag von ${formatMoney(outstandingCents)} € bestätigt. Die Fälligkeit war am ${dueDate}. Dieser Text ist ein manueller Mahnungsentwurf der Stufe ${suggestedLevel}; Versand und Mahnstufe werden erst nach einem gesonderten Beleg bestätigt.\n\nMit freundlichen Grüßen\nGalvanik Kreile`;
      const templateKey = kind === "payment_reminder" ? "manual_payment_reminder" : `manual_dunning_level_${suggestedLevel}`;

      const [draft] = await tx.insert(communications).values({
        id: input.clientRequestId,
        tenantId: actor.tenantId,
        customerId: invoice.customerId,
        orderId: invoice.orderId,
        invoiceId: invoice.id,
        createdBy: actor.userId,
        recipient: confirmedRecipient,
        templateKey,
        idempotencyKey,
        subject,
        body,
        type: "email_draft",
        channelType: "manual",
        status: "draft",
      }).returning({ id: communications.id });
      if (!draft) throw new Error("DRAFT_RECEIPT_MISSING");

      const [audit] = await tx.insert(bhAuditLog).values({
        benutzer: actor.userId,
        entitaet: "communication_draft",
        entitaetId: draft.id,
        aktion: kind === "payment_reminder" ? "create_payment_reminder_draft" : "create_dunning_draft",
        vorher: { invoiceId: invoice.id, dunningLevel: currentLevel },
        nachher: {
          draftId: draft.id,
          invoiceId: invoice.id,
          suggestedDunningLevel: suggestedLevel,
          recipientConfirmed: confirmedRecipient !== null,
          sent: false,
        },
      }).returning({ id: bhAuditLog.id });
      if (!audit) throw new Error("AUDIT_RECEIPT_MISSING");

      return {
        success: true,
        modus: "manuell",
        draftId: draft.id,
        text: body,
        empfaenger_email: confirmedRecipient,
        vorgeschlageneMahnstufe: suggestedLevel,
        replayed: false,
        hinweis: confirmedRecipient
          ? "Manueller Entwurf gespeichert. Versand und Mahnstufe sind noch nicht bestätigt."
          : "Manueller Entwurf gespeichert; beim Kunden ist keine bestätigte E-Mail-Adresse hinterlegt. Versand und Mahnstufe sind nicht bestätigt.",
      };
    });
  } catch (error) {
    console.error("Manual payment communication draft failed", error);
    return failure("STORAGE_UNAVAILABLE", "Der manuelle Kommunikationsentwurf konnte nicht belastbar gespeichert werden.");
  }
}

export async function erstelleZahlungserinnerungsEntwurf(
  rechnungId: unknown,
  clientRequestId: unknown,
): Promise<ManualDraftResult> {
  return createManualDraft("payment_reminder", rechnungId, clientRequestId);
}

export async function erstelleMahnungsEntwurf(
  rechnungId: unknown,
  clientRequestId: unknown,
): Promise<ManualDraftResult> {
  return createManualDraft("dunning", rechnungId, clientRequestId);
}
