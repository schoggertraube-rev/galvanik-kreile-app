import "server-only";

import { sql } from "drizzle-orm";
import { hasAuthorizationArea, type AuthorizationSnapshot } from "@/lib/server/authorization";
import { getOperationalOrders } from "@/lib/server/operationalOrders";
import { readIntakeDraft } from "@/lib/server/intakeDraft";
import { listMicrosoftGraphInbox } from "@/lib/server/microsoftGraph";
import { withPrivilegedTenantTransaction } from "@/lib/server/privilegedDb";
import { classifyMoneyForToday, defaultTodayLayout, deriveOrderGuidance, deriveTodayReminder, filterTodayLayout, isBundleStationForToday, parseTodayLayout, type TodayLayoutField, type TodayLayoutItem, type TodayOrderGuidance, type TodayReminderMode } from "@/lib/server/todayDashboardPolicy";

export type TodayField = "action" | "today" | "assign" | "money" | "bundle";
export type TodayVisibleField = Exclude<TodayField, "action">;
export type { TodayLayoutItem } from "@/lib/server/todayDashboardPolicy";
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
  bundleSurface?: string;
  dueDate?: string;
  snoozedUntil?: string;
  assignedToName?: string;
  assignmentVersion?: number;
  primaryActionLabel?: TodayOrderGuidance["primaryActionLabel"] | "Erinnern" | "Zahlung bestätigen" | "Bündel öffnen";
};

export type TodayDashboard = {
  items: TodayItem[];
  visibleFields: TodayVisibleField[];
  layout: TodayLayoutItem[];
  defaultLayout: TodayLayoutItem[];
  allowedFields: readonly TodayVisibleField[];
  delegationTargets: Array<{ userId: string; displayName: string }>;
  outlookMessage: string | null;
};

type PreferenceRow = { visible_fields: string[]; layout: unknown | null };
type ReminderRow = { item_key: string; reminder_until: Date | string };
type InvoiceRow = { id: string; invoice_number: string; order_id: string; customer_name: string; customer_country: string | null; due_date: Date | string; open_amount_cents: number | string; payment_mode: string; payment_status: string; station: string };
type PrepaymentRow = { order_id: string; order_number: string; customer_name: string; customer_country: string | null; due_date: Date | string | null; invoice_id: string | null; open_amount_cents: number | string | null; payment_status: string | null; station: string; goods_out_event_count: number | string };
type UserRow = { id: string; full_name: string };
type GraphThreadRow = { source: string };
type AssignmentRow = { order_id: string; assigned_to_name: string; current_order_version: number };

const DEFAULT_FIELDS: TodayVisibleField[] = ["today", "assign", "money", "bundle"];
const STAGE2_TODAY_FEATURES = new Set<"bundle" | "drafts">();
function allowedTodayFields(auth: AuthorizationSnapshot): Set<TodayLayoutField> {
  const allowed = new Set<TodayLayoutField>(["action"]);
  if (hasAuthorizationArea(auth, "auftraege")) {
    allowed.add("today");
    if (STAGE2_TODAY_FEATURES.has("bundle")) allowed.add("bundle");
  }
  if (hasAuthorizationArea(auth, "mails")) allowed.add("assign");
  if (hasAuthorizationArea(auth, "geld")) allowed.add("money");
  return allowed;
}

function dateOnly(value: Date | string) {
  return (value instanceof Date ? value.toISOString() : value).slice(0, 10);
}

function euro(cents: number | string) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(cents) / 100);
}

export async function readTodayDashboard(auth: AuthorizationSnapshot): Promise<TodayDashboard> {
  const ordersAllowed = hasAuthorizationArea(auth, "auftraege");
  const graphAllowed = hasAuthorizationArea(auth, "mails");
  const moneyAllowed = hasAuthorizationArea(auth, "geld");
  const [orders, draft, graph, support] = await Promise.all([
    ordersAllowed ? getOperationalOrders(auth) : Promise.resolve([]),
    STAGE2_TODAY_FEATURES.has("drafts") ? readIntakeDraft(auth) : Promise.resolve({ code: "OK" as const, data: null }),
    graphAllowed ? listMicrosoftGraphInbox() : Promise.resolve({ code: "IN_KLAERUNG" as const, message: "Outlook ist für dieses Profil nicht eingeblendet." }),
    withPrivilegedTenantTransaction(auth, async (tx) => {
      const [preferences, reminders, invoices, prepayments, delegationTargets, graphThreads, assignments] = await Promise.all([
        tx.execute<PreferenceRow>(sql`SELECT preference.visible_fields, to_jsonb(preference)->'layout' AS layout FROM private.today_preferences preference WHERE preference.tenant_id=${auth.tenantId} AND preference.actor_id=${auth.userId}::uuid LIMIT 1`),
        tx.execute<ReminderRow>(sql`SELECT item_key, reminder_until FROM private.today_reminders WHERE tenant_id=${auth.tenantId} AND actor_id=${auth.userId}::uuid`),
        moneyAllowed ? tx.execute<InvoiceRow>(sql`
          SELECT invoice.id, invoice.invoice_number, invoice.order_id, customer.name AS customer_name,
                 customer.country AS customer_country, invoice.due_date,
                 invoice.payment_open_amount_cents AS open_amount_cents,
                 orders.payment_mode, invoice.payment_status, orders.station
          FROM public.invoices invoice
          JOIN public.orders orders ON orders.tenant_id=invoice.tenant_id AND orders.id=invoice.order_id
          JOIN public.customers customer ON customer.tenant_id=invoice.tenant_id AND customer.id=invoice.customer_id
          WHERE invoice.tenant_id=${auth.tenantId} AND invoice.status='issued'
            AND invoice.payment_status IN ('offen', 'teilbezahlt')
            AND invoice.due_date < (statement_timestamp() AT TIME ZONE 'Europe/Berlin')::date
          ORDER BY invoice.due_date, invoice.invoice_number
          LIMIT 20
        `) : Promise.resolve([]),
        moneyAllowed ? tx.execute<PrepaymentRow>(sql`
          SELECT payment.order_id, payment.order_number, customer.name AS customer_name,
                 customer.country AS customer_country, orders.due_date, payment.invoice_id,
                 payment.payment_open_amount_cents AS open_amount_cents,
                 payment.payment_status, payment.station, payment.goods_out_event_count
          FROM private.v_goods_out_ui_state_v1 payment
          JOIN public.orders orders ON orders.tenant_id=payment.tenant_id AND orders.id=payment.order_id
          JOIN public.customers customer ON customer.tenant_id=orders.tenant_id AND customer.id=orders.customer_id
          WHERE payment.tenant_id=${auth.tenantId}
            AND payment.payment_mode='vorkasse'
            AND payment.station='fertig'
            AND payment.goods_out_event_count=0
            AND payment.integrity_ok=true
            AND (payment.invoice_state='not_issued' OR payment.payment_status IN ('offen', 'teilbezahlt'))
          ORDER BY orders.due_date NULLS LAST, payment.order_number
          LIMIT 20
        `) : Promise.resolve([]),
        ordersAllowed ? tx.execute<UserRow>(sql`
          SELECT users.id, users.full_name
          FROM public.app_users users
          WHERE users.tenant_id=${auth.tenantId}
            AND users.active=true
            AND users.id<>${auth.userId}::uuid
            AND EXISTS (
              SELECT 1 FROM public.app_user_rights rights
              WHERE rights.tenant_id=users.tenant_id
                AND rights.user_id=users.id
                AND rights.bereich='auftraege'
            )
          ORDER BY users.full_name, users.id
        `) : Promise.resolve([]),
        graphAllowed ? tx.execute<GraphThreadRow>(sql`SELECT source FROM public.communication_threads WHERE tenant_id=${auth.tenantId} AND source LIKE 'MS_GRAPH_IN:%'`) : Promise.resolve([]),
        ordersAllowed ? tx.execute<AssignmentRow>(sql`
          SELECT order_id, assigned_to_name, current_order_version
          FROM private.v_order_task_assignment_v1
          WHERE tenant_id=${auth.tenantId}
            AND assigned_by=${auth.userId}::uuid
            AND active=true
        `) : Promise.resolve([]),
      ]);
      return { preferences, reminders, invoices, prepayments, delegationTargets, graphThreads, assignments };
    }),
  ]);

  const allowed = allowedTodayFields(auth);
  const suggestedLayout = defaultTodayLayout(auth.role, allowed);
  const storedLayout = parseTodayLayout(support.preferences[0]?.layout);
  const layout = storedLayout ? filterTodayLayout(storedLayout, allowed) : suggestedLayout;
  const selected = layout.map((item) => item.field).filter((field): field is TodayVisibleField => field !== "action");
  const selectedSet = new Set(selected);
  const reminders = new Map(support.reminders.map((row) => [row.item_key, new Date(row.reminder_until).toISOString()]));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const items: TodayItem[] = [];
  const assignments = new Map(support.assignments.map((row) => [row.order_id, row]));
  const add = (item: TodayItem) => items.push({ ...item, field: item.field === "action" || selectedSet.has(item.field as TodayVisibleField) ? item.field : "action", snoozedUntil: reminders.get(item.key) });

  if (STAGE2_TODAY_FEATURES.has("drafts") && draft.code === "OK" && draft.data) add({ key: "draft:intake", field: "action", kind: "draft", title: "Entwurf Neuer Eingang", meta: `Gespeichert ${new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(draft.data.updatedAt))}`, urgency: "decision" });

  for (const order of orders) {
    const guidance = deriveOrderGuidance(order, today);
    if (!guidance) continue;
    const caseTitle = guidance.caseId === "finished_waiting" ? "Fertig und wartet auf Warenausgang" : guidance.caseId === "due" ? "Liefertermin braucht Handlung" : guidance.caseId === "tight" ? "Zeitplan ist knapp" : guidance.caseId === "problem" ? "Gemeldetes Auftragsrisiko" : "Heute fertig zur Übergabe";
    const reason = guidance.reason === "due_today" ? `heute fällig · Station ${order.station}` : guidance.reason === "overdue" ? `überfällig · Station ${order.station}` : guidance.reason === "finished_overdue" ? `Liefertermin überschritten · fertig zur Übergabe` : guidance.reason === "tight_schedule" ? `${order.dueLabel} ${order.dueValue} · noch nicht begonnen` : guidance.reason === "reported_risk" ? `Risiko ${order.risk} · Station ${order.station}` : `${order.dueLabel} ${order.dueValue} · fertig`;
    const assignment = assignments.get(order.id);
    add({ key: `order:${order.id}:${guidance.caseId}:${guidance.reason}`, field: guidance.field, kind: "order", title: `${order.orderNumber} · ${caseTitle}`, meta: `${order.customerName ?? "Kunde"} · ${reason}`, urgency: order.risk === "red" || order.risk === "blocked" ? "conflict" : "warning", orderId: order.id, orderVersion: order.version, dueDate: order.dueDate, assignedToName: assignment?.assigned_to_name, assignmentVersion: assignment?.current_order_version, primaryActionLabel: guidance.primaryActionLabel });
  }

  const importedGraphIds = new Set(support.graphThreads.map((row) => row.source.slice("MS_GRAPH_IN:".length)));
  if (graph.code === "OK") for (const mail of graph.data.filter((entry) => !importedGraphIds.has(entry.id)).slice(0, 5)) add({ key: `mail:${mail.id}`, field: "assign", kind: "mail", title: mail.subject || "Mail ohne Betreff", meta: `${mail.senderName} · ${new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(mail.receivedAt))}`, urgency: "decision", graphMessageId: mail.id });

  for (const invoice of support.invoices) {
    const dueDate = dateOnly(invoice.due_date);
    if (classifyMoneyForToday({ customerCountry: invoice.customer_country, dueDate, goodsOutRecorded: false, paymentMode: invoice.payment_mode, paymentStatus: invoice.payment_status, station: invoice.station }, today) !== "overdue_invoice") continue;
    add({ key: `invoice:${invoice.id}`, field: "money", kind: "invoice", title: `${invoice.invoice_number} · ${invoice.customer_name}`, meta: `${euro(invoice.open_amount_cents)} · fällig ${dueDate}`, urgency: "conflict", invoiceId: invoice.id, orderId: invoice.order_id, dueDate, primaryActionLabel: "Erinnern" });
  }

  for (const prepayment of support.prepayments) {
    const dueDate = prepayment.due_date ? dateOnly(prepayment.due_date) : null;
    if (classifyMoneyForToday({ customerCountry: prepayment.customer_country, dueDate, goodsOutRecorded: Number(prepayment.goods_out_event_count) > 0, paymentMode: "vorkasse", paymentStatus: prepayment.payment_status, station: prepayment.station }, today) !== "open_prepayment") continue;
    const amount = prepayment.open_amount_cents === null ? "Betrag nach Rechnung" : euro(prepayment.open_amount_cents);
    add({ key: `prepayment:${prepayment.order_id}`, field: "money", kind: "order", title: `${prepayment.order_number} · Vorkasse offen`, meta: `${prepayment.customer_name} · ${amount} · Versand gesperrt`, urgency: "warning", orderId: prepayment.order_id, invoiceId: prepayment.invoice_id ?? undefined, dueDate: dueDate ?? undefined, primaryActionLabel: "Zahlung bestätigen" });
  }

  const surfaces = new Map<string, typeof orders>();
  for (const order of orders) {
    if (!isBundleStationForToday(order.station)) continue;
    const surface = order.surfaceRequested?.trim();
    if (!surface) continue;
    const group = surfaces.get(surface) ?? [];
    group.push(order);
    surfaces.set(surface, group);
  }
  const bundle = [...surfaces.entries()].filter(([, group]) => group.length >= 2).sort((a, b) => b[1].length - a[1].length)[0];
  if (STAGE2_TODAY_FEATURES.has("bundle") && bundle) add({ key: `bundle:${bundle[0]}`, field: "bundle", kind: "bundle", title: `${bundle[1].length} Aufträge bündeln`, meta: bundle[0], urgency: "decision", bundleSurface: bundle[0], primaryActionLabel: "Bündel öffnen" });

  return {
    items,
    visibleFields: selected,
    layout,
    defaultLayout: suggestedLayout,
    allowedFields: DEFAULT_FIELDS.filter((field) => allowed.has(field)),
    delegationTargets: support.delegationTargets.map((target) => ({ userId: target.id, displayName: target.full_name })),
    outlookMessage: !graphAllowed || graph.code === "OK" ? null : graph.message,
  };
}

export async function saveTodayPreferences(auth: AuthorizationSnapshot, value: unknown) {
  const normalized = parseTodayLayout(value);
  const allowed = allowedTodayFields(auth);
  if (!normalized || normalized.some((item) => !allowed.has(item.field))) return { code: "VALIDATION_ERROR" as const, message: "Feldanordnung ist ungültig oder nicht erlaubt." };
  const visible = normalized.map((item) => item.field).filter((field): field is TodayVisibleField => field !== "action");
  await withPrivilegedTenantTransaction(auth, (tx) => tx.execute(sql`
    INSERT INTO private.today_preferences (tenant_id, actor_id, visible_fields, layout)
    VALUES (${auth.tenantId}, ${auth.userId}::uuid, ${visible}::text[], ${JSON.stringify(normalized)}::jsonb)
    ON CONFLICT (tenant_id, actor_id) DO UPDATE SET visible_fields=EXCLUDED.visible_fields, layout=EXCLUDED.layout, updated_at=statement_timestamp()
  `));
  return { code: "OK" as const };
}

export async function saveTodayReminder(auth: AuthorizationSnapshot, input: { itemKey: string; mode: TodayReminderMode; dueDate?: string }) {
  if (!input.itemKey || input.itemKey.length > 300 || !["afternoon", "tomorrow", "after_due"].includes(input.mode)) return { code: "VALIDATION_ERROR" as const, message: "Erinnerung ist ungültig." };
  const decision = deriveTodayReminder(input.mode, input.dueDate, new Date());
  if (!decision) return { code: "VALIDATION_ERROR" as const, message: "Diese Erinnerung ist für den aktuellen Termin nicht möglich." };
  await withPrivilegedTenantTransaction(auth, (tx) => tx.execute(sql`
    INSERT INTO private.today_reminders (tenant_id, actor_id, item_key, reminder_until, reminder_mode)
    VALUES (${auth.tenantId}, ${auth.userId}::uuid, ${input.itemKey}, ${decision.until.toISOString()}::timestamptz, ${input.mode})
    ON CONFLICT (tenant_id, actor_id, item_key) DO UPDATE SET reminder_until=EXCLUDED.reminder_until, reminder_mode=EXCLUDED.reminder_mode, updated_at=statement_timestamp()
  `));
  return { code: "OK" as const, message: decision.message, data: { reminderUntil: decision.until.toISOString() } };
}
