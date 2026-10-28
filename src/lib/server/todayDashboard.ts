import "server-only";

import { sql } from "drizzle-orm";
import type { AuthorizationSnapshot } from "@/lib/server/authorization";
import { getOperationalOrders } from "@/lib/server/operationalOrders";
import { readIntakeDraft } from "@/lib/server/intakeDraft";
import { listMicrosoftGraphInbox } from "@/lib/server/microsoftGraph";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { classifyOrderForToday } from "@/lib/server/todayDashboardPolicy";

export type TodayField = "action" | "today" | "assign" | "money" | "bundle";
export type TodayVisibleField = Exclude<TodayField, "action">;
export type TodayItem = {
  key: string;
  field: TodayField;
  kind: "draft" | "order" | "mail" | "invoice" | "bundle";
  title: string;
  meta: string;
  urgency: "conflict" | "decision" | "warning";
  orderId?: string;
  orderVersion?: number;
  invoiceId?: string;
  graphMessageId?: string;
  dueDate?: string;
  snoozedUntil?: string;
};

export type TodayDashboard = {
  items: TodayItem[];
  visibleFields: TodayVisibleField[];
  phillipUserId: string | null;
  outlookMessage: string | null;
};

type PreferenceRow = { visible_fields: string[] };
type ReminderRow = { item_key: string; reminder_until: Date | string };
type InvoiceRow = { id: string; invoice_number: string; order_id: string; customer_name: string; due_date: Date | string; gross_amount_cents: number | string };
type UserRow = { id: string };
type GraphThreadRow = { source: string };

const DEFAULT_FIELDS: TodayVisibleField[] = ["today", "assign", "money", "bundle"];
const FIELD_SET = new Set<TodayVisibleField>(DEFAULT_FIELDS);

function dateOnly(value: Date | string) {
  return (value instanceof Date ? value.toISOString() : value).slice(0, 10);
}

function euro(cents: number | string) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(cents) / 100);
}

function visibleFields(value: unknown): TodayVisibleField[] {
  if (!Array.isArray(value)) return DEFAULT_FIELDS;
  return value.filter((field): field is TodayVisibleField => typeof field === "string" && FIELD_SET.has(field as TodayVisibleField));
}

export async function readTodayDashboard(auth: AuthorizationSnapshot): Promise<TodayDashboard> {
  const graphAllowed = auth.role === "meister" || auth.role === "buero";
  const [orders, draft, graph, support] = await Promise.all([
    getOperationalOrders(auth),
    readIntakeDraft(auth),
    graphAllowed ? listMicrosoftGraphInbox() : Promise.resolve({ code: "IN_KLAERUNG" as const, message: "Outlook ist für dieses Profil nicht eingeblendet." }),
    withPrivilegedTenantTransaction(auth, async (tx) => {
      const [preferences, reminders, invoices, phillip, graphThreads] = await Promise.all([
        tx.execute<PreferenceRow>(sql`SELECT visible_fields FROM private.today_preferences WHERE tenant_id=${auth.tenantId} AND actor_id=${auth.userId}::uuid LIMIT 1`),
        tx.execute<ReminderRow>(sql`SELECT item_key, reminder_until FROM private.today_reminders WHERE tenant_id=${auth.tenantId} AND actor_id=${auth.userId}::uuid`),
        auth.permissions.includes("perm_view_prices") ? tx.execute<InvoiceRow>(sql`
          SELECT invoice.id, invoice.invoice_number, invoice.order_id, customer.name AS customer_name,
                 invoice.due_date, invoice.gross_amount_cents
          FROM public.invoices invoice
          JOIN public.customers customer ON customer.tenant_id=invoice.tenant_id AND customer.id=invoice.customer_id
          WHERE invoice.tenant_id=${auth.tenantId} AND invoice.status='issued'
            AND invoice.payment_status IN ('offen', 'teilbezahlt')
          ORDER BY invoice.due_date, invoice.invoice_number
          LIMIT 20
        `) : Promise.resolve([]),
        tx.execute<UserRow>(sql`SELECT id FROM public.app_users WHERE tenant_id=${auth.tenantId} AND active=true AND role='werkstatt' ORDER BY display_name LIMIT 1`),
        tx.execute<GraphThreadRow>(sql`SELECT source FROM public.communication_threads WHERE tenant_id=${auth.tenantId} AND source LIKE 'MS_GRAPH_IN:%'`),
      ]);
      return { preferences, reminders, invoices, phillip, graphThreads };
    }),
  ]);

  const selected = visibleFields(support.preferences[0]?.visible_fields);
  const selectedSet = new Set(selected);
  const reminders = new Map(support.reminders.map((row) => [row.item_key, new Date(row.reminder_until).toISOString()]));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const items: TodayItem[] = [];
  const add = (item: TodayItem) => items.push({ ...item, field: item.field === "action" || selectedSet.has(item.field as TodayVisibleField) ? item.field : "action", snoozedUntil: reminders.get(item.key) });

  if (draft.code === "OK" && draft.data) add({ key: "draft:intake", field: "action", kind: "draft", title: "Entwurf Neuer Eingang", meta: `Gespeichert ${new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(draft.data.updatedAt))}`, urgency: "decision" });

  for (const order of orders) {
    const field = classifyOrderForToday(order, today);
    if (!field) continue;
    add({ key: `order:${order.id}`, field, kind: "order", title: `${order.orderNumber} · ${order.customerName ?? "Kunde"}`, meta: `${order.itemDescription ?? order.title} · ${order.dueLabel} ${order.dueValue}`, urgency: order.risk === "red" || order.risk === "blocked" ? "conflict" : "warning", orderId: order.id, orderVersion: order.version, dueDate: order.dueDate });
  }

  const importedGraphIds = new Set(support.graphThreads.map((row) => row.source.slice("MS_GRAPH_IN:".length)));
  if (graph.code === "OK") for (const mail of graph.data.filter((entry) => !importedGraphIds.has(entry.id)).slice(0, 5)) add({ key: `mail:${mail.id}`, field: "assign", kind: "mail", title: mail.subject || "Mail ohne Betreff", meta: `${mail.senderName} · ${new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(mail.receivedAt))}`, urgency: "decision", graphMessageId: mail.id });

  for (const invoice of support.invoices) add({ key: `invoice:${invoice.id}`, field: "money", kind: "invoice", title: `${invoice.invoice_number} · ${invoice.customer_name}`, meta: `${euro(invoice.gross_amount_cents)} · fällig ${dateOnly(invoice.due_date)}`, urgency: dateOnly(invoice.due_date) < today ? "conflict" : "warning", invoiceId: invoice.id, orderId: invoice.order_id, dueDate: dateOnly(invoice.due_date) });

  const surfaces = new Map<string, typeof orders>();
  for (const order of orders) {
    const surface = order.surfaceRequested?.trim();
    if (!surface) continue;
    const group = surfaces.get(surface) ?? [];
    group.push(order);
    surfaces.set(surface, group);
  }
  const bundle = [...surfaces.entries()].filter(([, group]) => group.length >= 2).sort((a, b) => b[1].length - a[1].length)[0];
  if (bundle) add({ key: `bundle:${bundle[0]}`, field: "bundle", kind: "bundle", title: `${bundle[1].length} Aufträge bündeln`, meta: bundle[0], urgency: "decision" });

  return { items, visibleFields: selected, phillipUserId: support.phillip[0]?.id ?? null, outlookMessage: !graphAllowed || graph.code === "OK" ? null : graph.message };
}

export async function saveTodayPreferences(auth: AuthorizationSnapshot, fields: unknown) {
  const normalized = visibleFields(fields);
  if (!Array.isArray(fields) || normalized.length !== fields.length) return { code: "VALIDATION_ERROR" as const, message: "Feldauswahl ist ungültig." };
  await withPrivilegedTenantTransaction(auth, (tx) => tx.execute(sql`
    INSERT INTO private.today_preferences (tenant_id, actor_id, visible_fields)
    VALUES (${auth.tenantId}, ${auth.userId}::uuid, ${normalized}::text[])
    ON CONFLICT (tenant_id, actor_id) DO UPDATE SET visible_fields=EXCLUDED.visible_fields, updated_at=statement_timestamp()
  `));
  return { code: "OK" as const };
}

export async function saveTodayReminder(auth: AuthorizationSnapshot, input: { itemKey: string; mode: "afternoon" | "tomorrow" | "after_due"; dueDate?: string }) {
  if (!input.itemKey || input.itemKey.length > 300 || !["afternoon", "tomorrow", "after_due"].includes(input.mode)) return { code: "VALIDATION_ERROR" as const, message: "Erinnerung ist ungültig." };
  const now = new Date();
  let until: Date;
  if (input.mode === "afternoon") {
    until = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(now) + "T14:00:00+01:00");
    if (until <= now) until = new Date(now.getTime() + 60 * 60 * 1000);
  } else if (input.mode === "tomorrow") until = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  else {
    if (!input.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) return { code: "VALIDATION_ERROR" as const, message: "Termin für die Erinnerung fehlt." };
    until = new Date(`${input.dueDate}T18:00:00+01:00`);
  }
  await withPrivilegedTenantTransaction(auth, (tx) => tx.execute(sql`
    INSERT INTO private.today_reminders (tenant_id, actor_id, item_key, reminder_until, reminder_mode)
    VALUES (${auth.tenantId}, ${auth.userId}::uuid, ${input.itemKey}, ${until.toISOString()}::timestamptz, ${input.mode})
    ON CONFLICT (tenant_id, actor_id, item_key) DO UPDATE SET reminder_until=EXCLUDED.reminder_until, reminder_mode=EXCLUDED.reminder_mode, updated_at=statement_timestamp()
  `));
  return { code: "OK" as const, data: { reminderUntil: until.toISOString() } };
}
