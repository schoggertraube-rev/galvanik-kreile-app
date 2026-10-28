"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { requestGlobalCreate } from "@/components/layout/GlobalCreateFlow";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import { useOverlayStore } from "@/lib/overlayStore";
import type { AppRole } from "@/lib/auth/authorizationContract";
import type { TodayDashboard, TodayItem, TodayLayoutItem, TodayVisibleField } from "@/lib/server/todayDashboard";
import { deriveTodayReminder, type TodayReminderMode } from "@/lib/server/todayDashboardPolicy";
import type { OrdersHomeProjection, OrdersHomeSource } from "@/modules/orders/public";
import { Button, Dialog, HandlungsListe, Hinweis, Kachel, Lageleiste, SeitenKopf, Zustand, type Geraet, type HandlungsArt } from "@/ui/kr";

type RolfIdentity = { role: AppRole; canCreateOrder: boolean; canWorkOrders: boolean; canDelegate: boolean; dashboard: TodayDashboard };
export type RolfHomeModel =
  | ({ kind: "data"; projection: OrdersHomeProjection } & RolfIdentity)
  | ({ kind: "empty"; projection: OrdersHomeProjection } & RolfIdentity)
  | { kind: "no_areas" }
  | { kind: "denied"; message: string }
  | { kind: "error"; message: string };
type BasicResult = { code: string; message?: string };
export type RolfHomePorts = {
  savePreferences: (layout: TodayLayoutItem[]) => Promise<BasicResult>;
  saveReminder: (input: { itemKey: string; mode: TodayReminderMode; dueDate?: string }) => Promise<BasicResult>;
  discardDraft: () => Promise<BasicResult>;
  assignOrder: (input: { orderId: string; assigneeUserId: string; expectedVersion: number; clientEventId: string }) => Promise<BasicResult>;
};

const STATUS_LABELS: Record<string, string> = { angenommen: "Angenommen", wareneingang: "Angenommen", galvanik: "In Galvanik", fertig: "Fertig", raus: "Raus / abgeholt", abgeholt: "Raus / abgeholt", versendet: "Raus / abgeholt" };
const FIELD_LABELS: Record<TodayItem["field"], string> = { action: "Handlungsbedarf", today: "Heute fällig", assign: "Zuordnen", money: "Geld einfordern", bundle: "Bündel-Vorschlag" };

export function statusLabel(order: OrdersHomeSource): string { const status = order.statusText?.trim() || order.status; return STATUS_LABELS[status.toLowerCase()] ?? STATUS_LABELS[order.station.toLowerCase()] ?? "Status nicht hinterlegt"; }
export function dayGreeting(hour: number): string { return hour < 12 ? "Guten Morgen" : hour < 18 ? "Guten Tag" : "Guten Abend"; }
function berlinHour(now: Date): number { const hour = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "numeric", hourCycle: "h23" }).formatToParts(now).find((part) => part.type === "hour")?.value; return Number(hour ?? now.getHours()); }
export type DayLine = { salutation: string; urgent: number; other: number };
export function dayLineParts(orders: readonly OrdersHomeSource[], displayName: string, now = new Date()): DayLine { const firstName = displayName.trim().split(/\s+/)[0] || "Rolf"; const urgent = orders.filter((order) => order.risk === "red" || order.risk === "blocked").length; return { salutation: `${dayGreeting(berlinHour(now))}, ${firstName}.`, urgent, other: orders.length - urgent }; }
function readDevice(): Geraet { if (window.innerWidth <= 699) return "handy"; if (window.innerWidth <= 1399 && window.matchMedia?.("(pointer: coarse)").matches) return "tablet"; return "desktop"; }
function subscribeDevice(onChange: () => void) { window.addEventListener("resize", onChange); return () => window.removeEventListener("resize", onChange); }
function actionType(item: TodayItem): HandlungsArt { return item.urgency === "conflict" ? "konflikt" : item.urgency === "warning" ? "warnung" : "entscheidung"; }
function reminderLabel(value: string) { return `Aufgeschoben bis ${new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(value))} · zählt weiter mit`; }

export function RolfHomeClient({ model, ports }: { model: RolfHomeModel; ports: RolfHomePorts }) {
  const openOrder = useOverlayStore((state) => state.openOrder);
  const openInvoice = useOverlayStore((state) => state.openInvoice);
  const { hasArea, loading: permissionsLoading } = usePermissions();
  const router = useRouter();
  const device = useSyncExternalStore(subscribeDevice, readDevice, () => "desktop" as const);
  const [filter, setFilter] = useState<HandlungsArt | "alle">("alle");
  const [later, setLater] = useState<TodayItem | null>(null);
  const [more, setMore] = useState<TodayItem | null>(null);
  const [customize, setCustomize] = useState(false);
  const [layout, setLayout] = useState<TodayLayoutItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  if (model.kind === "no_areas") return <section data-testid="rolf-v11-home"><SeitenKopf titel="Der Tag" /><Zustand art="leer" text="Noch keine Bereiche freigegeben" /></section>;
  if (model.kind === "denied" || model.kind === "error") return <section data-testid="rolf-v11-home"><SeitenKopf titel="Der Tag" /><Zustand art={model.kind === "error" ? "fehler" : "gesperrt"} text={model.kind === "error" ? "Der Tagesbestand ist gerade nicht verfügbar." : "Du kannst den Tagesbestand nicht öffnen."} /></section>;

  const canStartOrder = model.canCreateOrder && !permissionsLoading && hasArea("eingang");
  const canWorkOrders = model.canWorkOrders && !permissionsLoading && hasArea("auftraege");
  const canDelegate = model.canDelegate && canWorkOrders;
  const filtered = filter === "alle" ? model.dashboard.items : model.dashboard.items.filter((item) => actionType(item) === filter);
  const counts = model.dashboard.items.reduce<Record<HandlungsArt, number>>((sum, item) => { sum[actionType(item)] += 1; return sum; }, { konflikt: 0, entscheidung: 0, warnung: 0 });
  const primary = (item: TodayItem) => { if (item.kind === "draft") requestGlobalCreate("DIRECT_INTAKE"); else if (item.kind === "order" && item.orderId) openOrder(item.orderId); else if (item.kind === "mail" && item.graphMessageId) requestGlobalCreate({ intent: "DIRECT_INTAKE", prefill: { sourceMode: "mail", graphMessageId: item.graphMessageId } }); else if (item.kind === "invoice" && item.invoiceId) openInvoice(item.invoiceId); else if (item.kind === "bundle" && item.bundleSurface) router.push(`/warendurchlauf?bundle=1&surface=${encodeURIComponent(item.bundleSurface)}`); };
  const primaryLabel = (item: TodayItem) => item.primaryActionLabel ?? (item.kind === "draft" ? "Weiter bearbeiten" : item.kind === "order" && item.field === "today" ? "Ware raus" : item.kind === "order" ? "Auftrag öffnen" : item.kind === "mail" ? "Zuordnen" : item.kind === "invoice" ? "Geld einfordern" : "Bündel öffnen");
  const discardDraft = async () => { setBusy(true); const result = await ports.discardDraft(); setBusy(false); if (result.code === "OK") router.refresh(); else setMessage(result.message ?? "Entwurf nicht gelöscht."); };
  const entries = (field: TodayItem["field"]) => filtered.filter((item) => item.field === field).map((item) => ({
    key: item.key, art: actionType(item), id: item.kind === "order" ? item.title.split(" · ")[0] : undefined, titel: item.title, meta: item.snoozedUntil ? `${item.meta} · ${reminderLabel(item.snoozedUntil)}` : item.meta, gedimmt: Boolean(item.snoozedUntil), termin: item.dueDate,
    aktionen: [{ text: primaryLabel(item), kurz: "Öffnen", icon: "open" as const, art: "primaer" as const, onClick: () => primary(item) }, ...(item.kind === "draft" ? [{ text: "Löschen", icon: "x" as const, onClick: () => void discardDraft() }] : [{ text: "Später", icon: "clock" as const, spaeter: true, onClick: () => setLater(item) }]), ...(canDelegate && item.kind === "order" && model.dashboard.phillipUserId ? [{ text: "Weitere", icon: "more" as const, onClick: () => setMore(item) }] : [])],
    onOeffnen: () => primary(item), onWeitere: () => setMore(item),
  }));
  const saveReminder = async (mode: TodayReminderMode) => { if (!later) return; setBusy(true); const result = await ports.saveReminder({ itemKey: later.key, mode, dueDate: later.dueDate }); setBusy(false); if (result.code === "OK") { setMessage(result.message ?? "Erinnerung gespeichert"); setLater(null); router.refresh(); } else setMessage(result.message ?? "Erinnerung nicht gespeichert."); };
  const delegate = async () => { if (!more?.orderId || !more.orderVersion || !model.dashboard.phillipUserId) return; setBusy(true); const result = await ports.assignOrder({ orderId: more.orderId, assigneeUserId: model.dashboard.phillipUserId, expectedVersion: more.orderVersion, clientEventId: crypto.randomUUID() }); setBusy(false); if (result.code === "OK") { setMore(null); router.refresh(); } else setMessage(result.message ?? "Zuweisung nicht gespeichert."); };
  const focusField = (["action", "today", "assign", "money", "bundle"] as const).find((field) => entries(field).length > 0);
  const activeLayout = customize ? layout : model.dashboard.layout;
  const moveField = (field: TodayItem["field"], direction: -1 | 1) => setLayout((current) => {
    const index = current.findIndex((item) => item.field === field);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= current.length) return current;
    const next = [...current];
    [next[index], next[target]] = [next[target]!, next[index]!];
    return next.map((item, order) => ({ ...item, order }));
  });
  const removeField = (field: TodayVisibleField) => setLayout((current) => current.filter((item) => item.field !== field).map((item, order) => ({ ...item, order })));
  const addField = (field: TodayVisibleField) => setLayout((current) => [...current, { field, column: model.dashboard.defaultLayout.find((item) => item.field === field)?.column ?? "left", order: current.length }]);
  const fieldCard = (item: TodayLayoutItem) => <Kachel key={item.field} titel={FIELD_LABELS[item.field]} icon={item.field === "money" ? "euro" : item.field === "bundle" ? "layers" : item.field === "assign" ? "mail" : "clock"} iconTon={item.field === "action" ? "warn" : "info"}>
    {customize ? <div className="kr-schnellleiste">
      <Button text="Hoch" icon="arrow" disabled={item.order === 0 || item.order === 1} onClick={() => moveField(item.field, -1)} />
      <Button text="Runter" icon="arrow" disabled={item.field === "action" || item.order === layout.length - 1} onClick={() => moveField(item.field, 1)} />
      {device === "desktop" && item.field !== "action" ? <Button text={item.column === "left" ? "Nach rechts" : "Nach links"} icon="handoff" onClick={() => setLayout((current) => current.map((entry) => entry.field === item.field ? { ...entry, column: entry.column === "left" ? "right" : "left" } : entry))} /> : null}
      {item.field !== "action" ? <Button text="Entfernen" icon="x" onClick={() => removeField(item.field as TodayVisibleField)} /> : null}
    </div> : null}
    {entries(item.field).length ? <HandlungsListe eintraege={entries(item.field)} geraet={device} fokus={item.field === focusField} /> : <Zustand art="leer" text="Keine Einträge." />}
  </Kachel>;

  return <section data-testid="rolf-v11-home">
    <SeitenKopf titel="Der Tag" werkzeug={<div className="kr-schnellleiste"><Button data-spec-id="tag.anpassen" art="leise" icon="grid" text="Anpassen · geplant" disabled onClick={() => { setLayout(model.dashboard.layout); setCustomize(true); setMessage(""); }} /><Button art="leise" icon="layers" text="Bündeln · geplant" disabled /></div>} />
    {model.dashboard.items.length ? <Lageleiste zaehler={counts} filter={filter} onFilter={setFilter} gesund={[]} /> : null}
    {model.dashboard.outlookMessage ? <Hinweis ton="warn">{model.dashboard.outlookMessage}</Hinweis> : null}
    {message ? <Hinweis ton="ok">{message}</Hinweis> : null}
    {customize ? <Kachel titel="Felder zuordnen" icon="grid" iconTon="info"><div className="kr-stapel"><p>Handlungsbedarf bleibt immer Feld 1. Du kannst erlaubte Felder hinzufügen, entfernen, verschieben und am Desktop die Spalte wechseln.</p><div className="kr-schnellleiste">{model.dashboard.allowedFields.filter((field) => !layout.some((item) => item.field === field)).map((field) => <Button key={field} text={`${FIELD_LABELS[field]} hinzufügen`} icon="plus" onClick={() => addField(field)} />)}</div><div className="kr-schnellleiste"><Button data-spec-id="tag.vorschlag-ubernehmen" text="Vorschlag übernehmen" icon="grid" onClick={() => setLayout(model.dashboard.defaultLayout)} /><Button data-spec-id="tag.abbrechen" text="Abbrechen" onClick={() => { setCustomize(false); setLayout([]); }} /><Button data-spec-id="tag.fertig" art="primaer" icon="check" text="Fertig" disabled={busy} onClick={() => void (async () => { setBusy(true); const result = await ports.savePreferences(layout); setBusy(false); if (result.code === "OK") { setCustomize(false); setMessage("Der Tag gespeichert"); router.refresh(); } else setMessage(result.message ?? "Anordnung nicht gespeichert."); })()} /></div></div></Kachel> : null}
    {model.dashboard.items.length === 0 && !customize ? <Zustand art="leer" text="Noch keine Handlungen für dich." aktion={canStartOrder ? { text: "Neuer Eingang", icon: "inbox", onClick: () => requestGlobalCreate("DIRECT_INTAKE") } : undefined} /> : <div className="kr-stapel">
      {device === "desktop" ? <div className="kr-spalten"><div className="kr-stapel">{activeLayout.filter((item) => item.column === "left" && (customize || entries(item.field).length)).map(fieldCard)}</div><div className="kr-stapel">{activeLayout.filter((item) => item.column === "right" && (customize || entries(item.field).length)).map(fieldCard)}</div></div> : activeLayout.filter((item) => customize || entries(item.field).length).map(fieldCard)}
      {device !== "desktop" && (canStartOrder || canWorkOrders) ? <div className="kr-schnellleiste">{canStartOrder ? <Button art="primaer" icon="inbox" text="Neuer Eingang" onClick={() => requestGlobalCreate("DIRECT_INTAKE")} /> : null}{canWorkOrders ? <Button icon="truck" text="Ware raus" onClick={() => router.push("/orders?station=fertig")} /> : null}</div> : null}
    </div>}
    {later ? <Dialog titel="Später erinnern" icon="clock" groesse="schmal" onSchliessen={() => setLater(null)}><div className="kr-stapel">{deriveTodayReminder("afternoon", later.dueDate) ? <Button data-spec-id="spaeter.heute-nachmittag" text="heute Nachmittag" icon="clock" disabled={busy} onClick={() => void saveReminder("afternoon")} /> : null}{deriveTodayReminder("tomorrow", later.dueDate) ? <Button data-spec-id="spaeter.morgen-fruh" text="morgen früh" icon="clock" disabled={busy} onClick={() => void saveReminder("tomorrow")} /> : null}{deriveTodayReminder("after_due", later.dueDate) ? <Button data-spec-id="spaeter.nach-dem-termin" text="nach dem Termin" icon="clock" disabled={busy} onClick={() => void saveReminder("after_due")} /> : null}<Button data-spec-id="spaeter.schliessen" art="leise" text="Schließen" onClick={() => setLater(null)} />{message ? <Hinweis ton="warn">{message}</Hinweis> : null}</div></Dialog> : null}
    {more ? <Dialog titel="Weitere Aktionen" icon="more" groesse="schmal" onSchliessen={() => setMore(null)}><div className="kr-stapel"><Button data-spec-id="hbmehr.an-phillip-delegieren" text="an Phillip delegieren" icon="handoff" disabled={busy} onClick={() => void delegate()} /><Button data-spec-id="hbmehr.schliessen" art="leise" text="Schließen" onClick={() => setMore(null)} />{message ? <Hinweis ton="warn">{message}</Hinweis> : null}</div></Dialog> : null}
  </section>;
}
