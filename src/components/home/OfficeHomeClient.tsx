"use client";
import dynamic from 'next/dynamic';
const CommunicationPanel=dynamic(()=>import('@/components/communication/CommunicationPanel').then(module=>module.CommunicationPanel));
import {V45_TEXT,INVOICE_DELIVERY_COPY,PAGE_READ_COPY,TODAY_MODEL_COPY} from '@/ui/situationCatalog';
import {MAIL_IMPORT_COPY,INTAKE_MAIL_ADDRESS_MISSING_COPY} from "@/ui/situationCatalog";

import { Suspense,use,useCallback,useEffect,useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { confirmInvoiceHandoverAction,listOutlookInboxAction } from "@/app/actions/communications.actions";
import { requestGlobalCreate } from "@/components/layout/GlobalCreateFlow";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import { useOverlayStore } from "@/lib/overlayStore";
import type { AppRole } from "@/lib/auth/authorizationContract";
import type { TodayDashboard, TodayItem, TodayLayoutItem, TodayVisibleField } from "@/lib/server/todayDashboard";
import { deriveTodayReminder, type TodayReminderMode } from "@/lib/today/todayDashboardPolicy";
import type { OrdersHomeProjection, OrdersHomeSource } from "@/modules/orders/public";
import { IntakeDraftList } from "@/modules/eingang/public";
import { getIntakeDraftsAction, discardIntakeDraftAction } from "@/app/actions/eingang.actions";
import { Button, Dialog, Fakten, HandlungsListe, Hinweis, Kachel, Lageleiste, SeitenKopf, sortHandlungsEintraege, useListenTastatur, Zustand, type Geraet, type HandlungsArt } from "@/ui/kr";

type OfficeIdentity = { cacheLoginScope?:string; role: AppRole; canCreateOrder: boolean; canWorkOrders: boolean; canDelegate: boolean; dashboard: TodayDashboard;modelRead?:{source:'modell'|'live';pending:boolean;incomplete:boolean;pollMs:number;maxPollMs?:number;rebuild:boolean;revision?:string;revisions?:Record<string,string>} };
export type OfficeHomeModel =
  | ({ kind: "data"; projection: OrdersHomeProjection } & OfficeIdentity)
  | ({ kind: "empty"; projection: OrdersHomeProjection } & OfficeIdentity)
  | ({ kind: "partial"; projection: null } & OfficeIdentity)
  | { kind: "no_areas" }
  | { kind: "denied"; message: string }
  | { kind: "error"; message: string };
export type TodayHomePart='week'|'stock'|'notices'|'counts';
export type TodayHomePartResult={code:'SOURCE_INCOMPLETE';part:TodayHomePart}|{code:'OK';part:'week';data:{weekStart:string;weekEndExclusive:string;netCents:number;currentlyUnpricedItemCount:number}}|{code:'OK';part:'notices';missing:string[]}|{code:'OK';part:'counts'};
export type TodayHomeStreams=Record<TodayHomePart,Promise<TodayHomePartResult>>;
type BasicResult = { code: string; message?: string };
type AssignmentResult = BasicResult & { receipt?: { aggregateVersion: number } };
type MailPreview = { id: string; subject: string; senderName: string; senderAddress: string|null; receivedAt: string|null; preview: string; body: string };
export type OfficeHomePorts = {
  savePreferences: (layout: TodayLayoutItem[]) => Promise<BasicResult>;
  saveReminder: (input: { itemKey: string; mode: TodayReminderMode; dueDate?: string }) => Promise<BasicResult>;
  assignOrder: (input: { orderId: string; assigneeUserId: string; expectedVersion: number; clientEventId: string }) => Promise<AssignmentResult>;
  handBackOrder: (input: { orderId: string; expectedVersion: number; clientEventId: string }) => Promise<AssignmentResult>;
};

const STATUS_LABELS: Record<string, string> = { angenommen: "Angenommen", wareneingang: "Angenommen", galvanik: "In Galvanik", fertig: "Fertig", raus: "Raus / abgeholt", abgeholt: "Raus / abgeholt", versendet: "Raus / abgeholt" };
const FIELD_LABELS: Record<TodayItem["field"], string> = { action: "Heute zu tun", today: "Heute fällig", assign: "Zuordnen", money: "Geld einfordern", bundle: "Bündel-Vorschlag" };

export function statusLabel(order: OrdersHomeSource): string { const status = order.statusText?.trim() || order.status; return STATUS_LABELS[status.toLowerCase()] ?? STATUS_LABELS[order.station.toLowerCase()] ?? "Status nicht hinterlegt"; }
export function dayGreeting(hour: number): string { return hour < 12 ? "Guten Morgen" : hour < 18 ? "Guten Tag" : "Guten Abend"; }
function berlinHour(now: Date): number { const hour = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "numeric", hourCycle: "h23" }).formatToParts(now).find((part) => part.type === "hour")?.value; return Number(hour ?? now.getHours()); }
export type DayLine = { salutation: string; urgent: number; other: number };
export function dayLineParts(orders: readonly OrdersHomeSource[], displayName: string, now = new Date()): DayLine { const firstName = displayName.trim().split(/\s+/)[0] ?? ""; const urgent = orders.filter((order) => order.risk === "red" || order.risk === "blocked").length; return { salutation: firstName ? `${dayGreeting(berlinHour(now))}, ${firstName}.` : `${dayGreeting(berlinHour(now))}.`, urgent, other: orders.length - urgent }; }
function readDevice(): Geraet { if (window.innerWidth <= 699) return "handy"; if (window.innerWidth <= 1399 && window.matchMedia?.("(pointer: coarse)").matches) return "tablet"; return "desktop"; }
function subscribeDevice(onChange: () => void) { window.addEventListener("resize", onChange); return () => window.removeEventListener("resize", onChange); }
function actionType(item: TodayItem): HandlungsArt { return item.urgency === "conflict" ? "konflikt" : item.urgency === "warning" ? "warnung" : "entscheidung"; }
function reminderLabel(value: string) { return `Aufgeschoben bis ${new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(value))} · zählt weiter mit`; }
function assignmentDeadline(value?: string) { return value ? `Frist ${new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`))}` : "bis erledigt"; }

export function OfficeHomeClient({ model:initialModel, ports }: { model: OfficeHomeModel; ports: OfficeHomePorts }) {
  const [polled,setPolled]=useState<{base:OfficeHomeModel;value:OfficeHomeModel}|null>(null);
  const model=polled?.base===initialModel?polled.value:initialModel;
  const openOrder = useOverlayStore((state) => state.openOrder);
  const openInvoice = useOverlayStore((state) => state.openInvoice);
  const { hasArea, loading: permissionsLoading } = usePermissions();
  // SyncProvider refreshes U3 through its canonical Action with a pre-request
  // generation fence. An RSC model must never adopt a newer cache generation.
  const router = useRouter();
  const device = useSyncExternalStore(subscribeDevice, readDevice, () => "desktop" as const);
  const [filter, setFilter] = useState<HandlungsArt | "alle">("alle");
  const [later, setLater] = useState<TodayItem | null>(null);
  const [more, setMore] = useState<TodayItem | null>(null);
  const [customize, setCustomize] = useState(false);
  const [layout, setLayout] = useState<TodayLayoutItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [delegated, setDelegated] = useState<Record<string, { name: string; version: number; dueDate?: string }>>({});
  const [invoiceMail,setInvoiceMail]=useState<NonNullable<TodayItem['invoiceMail']>|null>(null);
  const invoiceHandoverRequests=useRef(new Map<string,{key:string;busy:boolean}>());
  const [mailId, setMailId] = useState<string | null>(null);
  const [mailPreview, setMailPreview] = useState<MailPreview | null>(null);
  const [mailMessage, setMailMessage] = useState("");
  const modelPoll=useRef<((changed?:boolean)=>Promise<void>)|null>(null);
  useEffect(()=>{
    if(!('dashboard'in initialModel)||!initialModel.modelRead||!initialModel.cacheLoginScope)return;
    const scope=initialModel.cacheLoginScope,controller=new AbortController();
    let stopped=false,running=false,rerun=false,timer:ReturnType<typeof setTimeout>|undefined,revision=initialModel.modelRead.revision;
    const baseDelay=initialModel.modelRead.pollMs,maxDelay=Math.max(baseDelay,initialModel.modelRead.maxPollMs??baseDelay);
    let nextDelay=baseDelay,pending=initialModel.modelRead.pending;
    const poll=async(changed=false)=>{
      if(stopped)return;if(running){if(changed)rerun=true;return;}
      running=true;if(timer)clearTimeout(timer);
      let again=pending;
      try{
      try{
        const response=await fetch('/api/heute/modell?nur=veraltet',{credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{'X-Kreile-Login-Scope':scope,...(revision?{'If-None-Match':'"'+revision+'"'}:{})}});
        if(response.status===401||response.status===403){again=false;return;}
        if(response.status===304){nextDelay=Math.min(maxDelay,Math.max(baseDelay,nextDelay*2));return;}
        if(!response.ok)throw Error('TODAY_MODEL_READ_UNAVAILABLE');
        const result=await response.json() as {code?:string;model?:OfficeHomeModel};
        if(stopped)return;
        if(result.code!=='OK'||!result.model||!('dashboard'in result.model))throw Error('TODAY_MODEL_RESPONSE_INCOMPLETE');
        if(result.model.cacheLoginScope!==scope){again=false;return;}
        const next=result.model;
        revision=next.modelRead?.revision;
        setPolled({base:initialModel,value:next});
        pending=again=next.modelRead?.pending===true;
        nextDelay=baseDelay;
      }catch{
        if(stopped||controller.signal.aborted)return;
        setMessage(PAGE_READ_COPY.sourceIncomplete);
        nextDelay=Math.min(maxDelay,Math.max(baseDelay,nextDelay*2));
      }
      }finally{if(!stopped&&again)timer=setTimeout(()=>{void poll();},nextDelay);running=false;if(rerun&&!stopped){rerun=false;queueMicrotask(()=>{void poll();});}}
    };
    modelPoll.current=poll;
    const resume=()=>{if(document.visibilityState==='visible')void poll(true);};
    window.addEventListener('focus',resume);document.addEventListener('visibilitychange',resume);
    if(initialModel.modelRead.pending)timer=setTimeout(()=>{void poll();},baseDelay);
    return ()=>{window.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume);stopped=true;controller.abort();if(timer)clearTimeout(timer);if(modelPoll.current===poll)modelPoll.current=null;};
  },[initialModel]);
  const refreshToday=()=>{if(modelPoll.current)void modelPoll.current(true);else router.refresh();};
  const openMail = async (graphMessageId: string) => {
    setMailId(graphMessageId);
    setMailPreview(null);
    setMailMessage("");
    try {
      const result = await listOutlookInboxAction();
      if (result.code !== "OK") {
        setMailMessage(result.message);
        return;
      }
      const found = result.data.find((mail) => mail.id === graphMessageId);
      if (!found) {
        setMailMessage("Die ausgewählte Mail ist nicht mehr im Postfach verfügbar.");
        return;
      }
      setMailPreview(found);
    } catch (error) {
      console.error("[TODAY_MAIL_READ_FAILED]", { graphMessageId, error });
      setMailMessage("Die Mail konnte nicht sicher gelesen werden.");
    }
  };
  const primary = (item: TodayItem) => { if(item.key.startsWith('source-order:')&&item.primaryActionLabel===TODAY_MODEL_COPY.reload){if(modelPoll.current)void modelPoll.current();else router.refresh();return;} if(item.invoiceMail){setInvoiceMail(item.invoiceMail);}else if((item.kind==='complaint'||item.kind==='task')&&item.target){const handled=!window.dispatchEvent(new CustomEvent('kreile:oeffne',{cancelable:true,detail:{ziel:item.target.screen,arg:item.target.arg}}));if(!handled)setMessage(item.kind==='task'?'Aufgabe konnte nicht geöffnet werden · sie bleibt gespeichert.':'Aktion konnte nicht geöffnet werden · Reklamation bleibt offen.');}else if (item.kind === "order" && item.orderId) { if(item.surfaceAssignments?.length) openOrder(item.orderId,"surface"); else openOrder(item.orderId); } else if (item.kind === "mail" && item.graphMessageId) void openMail(item.graphMessageId); else if (item.kind === "invoice" && item.invoiceId) openInvoice(item.invoiceId); else if (item.kind === "bundle" && item.bundleSurface) router.push(`/warendurchlauf?bundle=1&surface=${encodeURIComponent(item.bundleSurface)}`); };
  const dashboardItems = model.kind === "data" || model.kind === "empty" || model.kind==='partial' ? model.dashboard.items : [];
  const keyboardItems = sortHandlungsEintraege(dashboardItems.filter((item) => item.field === "action" && !item.assignedToName && !delegated[item.key] && (filter === "alle" || actionType(item) === filter)).map((item) => ({ item, art: actionType(item), gedimmt: Boolean(item.snoozedUntil), termin: item.dueDate })));
  const keyboardSelection = useListenTastatur({
    anzahl: keyboardItems.length,
    aktiv: device === "desktop" && !later && !more && !customize && (model.kind === "data" || model.kind === "empty" || model.kind==='partial'),
    onHaupt: (index) => { const item = keyboardItems[index]?.item; if (item) primary(item); },
    onSpaeter: (index) => { const item = keyboardItems[index]?.item; if (item) setLater(item); },
  });
  if (model.kind === "no_areas") return <section data-testid="rolf-v11-home"><SeitenKopf titel="Der Tag" /><Zustand art="leer" text="Noch keine Bereiche freigegeben" /></section>;
  if (model.kind === "denied" || model.kind === "error") return <section data-testid="rolf-v11-home"><SeitenKopf titel="Der Tag" /><Zustand art={model.kind === "error" ? "fehler" : "gesperrt"} text={model.kind === "error" ? "Aufträge konnten nicht geladen werden" : "Du kannst den Tagesbestand nicht öffnen."} aktion={model.kind === "error" ? { text: "Erneut laden", onClick: () => router.refresh() } : undefined} /></section>;

  const canStartOrder = model.canCreateOrder && !permissionsLoading && hasArea("eingang");
  const canWorkOrders = model.canWorkOrders && !permissionsLoading && hasArea("auftraege");
  const canDelegate = model.canDelegate && canWorkOrders;
  const companyHasOrders = model.projection===null?null:model.projection.orders.length > 0;
  const filtered = filter === "alle" ? model.dashboard.items : model.dashboard.items.filter((item) => actionType(item) === filter);
  const collectionNotices = model.dashboard.collectionNotices ?? [];
  const dashboardHasVisibleContent = model.dashboard.items.length > 0 || collectionNotices.length > 0;
  const counts = model.dashboard.items.filter((item) => item.field === "action" && !item.assignedToName && !delegated[item.key]).reduce<Record<HandlungsArt, number>>((sum, item) => { sum[actionType(item)] += 1; return sum; }, { konflikt: 0, entscheidung: 0, warnung: 0 });
  const primaryLabel = (item: TodayItem) => item.primaryActionLabel ?? (item.kind === "order" && item.field === "today" ? "Ware raus" : item.kind === "order" ? "Auftrag öffnen" : item.kind === "mail" ? "Mail ansehen" : item.kind === "invoice" ? "Geld einfordern" : "Bündel öffnen");
  const undoDelegation = async (item: TodayItem, version: number) => { if (!item.orderId) return; setBusy(true); const result = await ports.handBackOrder({ orderId: item.orderId, expectedVersion: version, clientEventId: crypto.randomUUID() }); setBusy(false); if (result.code === "OK") { setDelegated((current) => { const next = { ...current }; delete next[item.key]; return next; }); setMessage("Zurückgeholt"); router.refresh(); } else setMessage(result.message ?? "Weitergabe nicht zurückgeholt."); };
  const confirmInvoiceHandover=async(item:TodayItem)=>{
    if(!item.invoiceMail)return;
    const id=item.invoiceMail.documentId,prior=invoiceHandoverRequests.current.get(id);
    if(prior?.busy)return;
    const request={key:prior?.key??crypto.randomUUID(),busy:true};invoiceHandoverRequests.current.set(id,request);
    try{const result=await confirmInvoiceHandoverAction({invoiceId:id,clientRequestId:request.key});setMessage(result.message);if(result.code==='OK')refreshToday();}
    catch{setMessage(INVOICE_DELIVERY_COPY.manualHandoverFailed);}
    finally{request.busy=false;}
  };
  const entries = (field: TodayItem["field"]) => filtered.filter((item) => item.field === field).map((item) => { const assignment = delegated[item.key] ?? (item.assignedToName ? { name: item.assignedToName, version: item.assignmentVersion ?? item.orderVersion ?? 1, dueDate: item.dueDate } : null); return ({
    key: item.key, art: actionType(item), id: item.kind === "order" ? item.title.split(" · ")[0] : undefined, titel: item.title, meta: item.snoozedUntil ? `${item.meta} · ${reminderLabel(item.snoozedUntil)}` : item.meta, gedimmt: Boolean(item.snoozedUntil || assignment), termin: item.dueDate, status: assignment ? { text: `bei ${assignment.name} · ${assignmentDeadline(assignment.dueDate)}`, ton: "info" as const, icon: "handoff" as const, aktion: { text: "Rückgängig", specId: "hbmehr.zuruckholen", onClick: () => void undoDelegation(item, assignment.version) } } : undefined,
    aktionen: [{ text: primaryLabel(item), kurz: "Öffnen", icon: "open" as const, art: "primaer" as const, specId: item.kind === "order" ? "hbmehr.auftrag-offnen" : undefined, onClick: () => primary(item) }, ...(item.invoiceMail?[{text:INVOICE_DELIVERY_COPY.manualHandover,icon:"check" as const,onClick:()=>void confirmInvoiceHandover(item)}]:[]), { text: "Später", icon: "clock" as const, spaeter: true, onClick: () => setLater(item) }, ...(canDelegate && item.kind === "order" && model.dashboard.delegationTargets.length > 0 ? [{ text: "Weitere", icon: "more" as const, onClick: () => setMore(item) }] : [])],
    onOeffnen: () => primary(item), onWeitere: () => setMore(item),
  }); });
  const saveReminder = async (mode: TodayReminderMode) => { if (!later) return; setBusy(true); const result = await ports.saveReminder({ itemKey: later.key, mode, dueDate: later.dueDate }); setBusy(false); if (result.code === "OK") { setMessage(result.message ?? "Erinnerung gespeichert"); setLater(null); refreshToday(); } else setMessage(result.message ?? "Erinnerung nicht gespeichert."); };
  const delegate = async (target: TodayDashboard["delegationTargets"][number]) => {
    if (!more?.orderId || !more.orderVersion) return;
    const { key, orderId, orderVersion, dueDate } = more;
    setBusy(true);
    const result = await ports.assignOrder({ orderId, assigneeUserId: target.userId, expectedVersion: orderVersion, clientEventId: crypto.randomUUID() });
    setBusy(false);
    if (result.code === "OK") {
      setDelegated((current) => ({ ...current, [key]: { name: target.displayName, version: result.receipt?.aggregateVersion ?? orderVersion + 1, dueDate } }));
      setMessage(`Bei ${target.displayName} · ${assignmentDeadline(dueDate)} · Rückgängig`);
      setMore(null);
      refreshToday();
    } else setMessage(result.message ?? "Zuweisung nicht gespeichert.");
  };
  const fieldHasContent = (field: TodayItem["field"]) => entries(field).length > 0 || (field === "money" && collectionNotices.length > 0);
  const focusField = (["action", "today", "assign", "money", "bundle"] as const).find((field) => fieldHasContent(field));
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
  const partialMailState = <Hinweis ton="warn"><span>Mails nicht erreichbar · Zuordnen ohne Mails</span><Button data-spec-id="tag.erneut-laden" art="leise" icon="refresh" text="Erneut laden" onClick={() => router.refresh()} /></Hinweis>;
  const fieldCard = (item: TodayLayoutItem) => {
    const fieldEntries = entries(item.field);
    const hasCollectionNotices = item.field === "money" && collectionNotices.length > 0;
    return <Kachel key={item.field} titel={FIELD_LABELS[item.field]} icon={item.field === "money" ? "euro" : item.field === "bundle" ? "layers" : item.field === "assign" ? "mail" : "clock"} iconTon={item.field === "action" ? "warn" : "info"}>
    {customize ? <div className="kr-schnellleiste">
      <Button text="Hoch" icon="arrow" disabled={item.order === 0 || item.order === 1} onClick={() => moveField(item.field, -1)} />
      <Button text="Runter" icon="arrow" disabled={item.field === "action" || item.order === layout.length - 1} onClick={() => moveField(item.field, 1)} />
      {device === "desktop" && item.field !== "action" ? <Button text={item.column === "left" ? "Nach rechts" : "Nach links"} icon="handoff" onClick={() => setLayout((current) => current.map((entry) => entry.field === item.field ? { ...entry, column: entry.column === "left" ? "right" : "left" } : entry))} /> : null}
      {item.field !== "action" ? <Button text="Entfernen" icon="x" onClick={() => removeField(item.field as TodayVisibleField)} /> : null}
    </div> : null}
    {item.field === "assign" && model.dashboard.outlookMessage ? partialMailState : null}
    {fieldEntries.length ? <HandlungsListe eintraege={fieldEntries} geraet={device} fokus={item.field === focusField} auswahl={item.field === "action" ? keyboardSelection : -1} /> : null}
    {hasCollectionNotices ? <div className="kr-stapel">
      {collectionNotices.map((notice) => <div key={notice.id} className="kr-zeile r36-k--geplant" data-spec-id="tag.sammelrechnung-erstellen" aria-label={`Sammelrechnung ${notice.customerName} ${notice.month} · ${notice.orderCount} Aufträge · kommt mit Rechnungen`}>
        <div className="kr-zeile-main"><p className="kr-zeile-s">Sammelrechnung {notice.customerName} {notice.month} · {notice.orderCount} Aufträge · kommt mit Rechnungen</p></div>
      </div>)}
    </div> : null}
    {!fieldEntries.length && !hasCollectionNotices && (item.field === "assign" && model.dashboard.outlookMessage ? null : <Zustand art="leer" text="Keine Einträge." />)}
  </Kachel>;
  };

  return <section data-testid="rolf-v11-home" data-spec-id="tag">
    {model.kind==='partial'?<Hinweis ton="warn">{PAGE_READ_COPY.partial}<Button art="leise" icon="refresh" text={PAGE_READ_COPY.reload} onClick={()=>router.refresh()}/></Hinweis>:null}
    <IntakeDraftList readDrafts={getIntakeDraftsAction} discardDraft={discardIntakeDraftAction} />
    <SeitenKopf titel="Der Tag" werkzeug={<div className="kr-schnellleiste"><Button data-spec-id="tag.anpassen" art="leise" icon="grid" text="Anpassen · geplant" disabled onClick={() => { setLayout(model.dashboard.layout); setCustomize(true); setMessage(""); }} /><Button art="leise" icon="layers" text="Bündeln · geplant" disabled /></div>} />
    {model.dashboard.items.length ? <Lageleiste zaehler={counts} filter={filter} onFilter={setFilter} gesund={[]} /> : null}
    {model.dashboard.outlookMessage && !activeLayout.some((item) => item.field === "assign") ? partialMailState : null}
    {message ? <Hinweis ton="ok">{message}</Hinweis> : null}
    {customize ? <Kachel titel="Felder zuordnen" icon="grid" iconTon="info"><div className="kr-stapel"><p>Heute zu tun bleibt immer Feld 1. Du kannst erlaubte Felder hinzufügen, entfernen, verschieben und am Desktop die Spalte wechseln.</p><div className="kr-schnellleiste">{model.dashboard.allowedFields.filter((field) => !layout.some((item) => item.field === field)).map((field) => <Button key={field} text={`${FIELD_LABELS[field]} hinzufügen`} icon="plus" onClick={() => addField(field)} />)}</div><div className="kr-schnellleiste"><Button data-spec-id="tag.vorschlag-ubernehmen" text="Vorschlag übernehmen" icon="grid" onClick={() => setLayout(model.dashboard.defaultLayout)} /><Button data-spec-id="tag.abbrechen" text="Abbrechen" onClick={() => { setCustomize(false); setLayout([]); }} /><Button data-spec-id="tag.fertig" art="primaer" icon="check" text="Fertig" disabled={busy} onClick={() => void (async () => { setBusy(true); const result = await ports.savePreferences(layout); setBusy(false); if (result.code === "OK") { setCustomize(false); setMessage("Der Tag gespeichert"); refreshToday(); } else setMessage(result.message ?? "Anordnung nicht gespeichert."); })()} /></div></div></Kachel> : null}
    {!dashboardHasVisibleContent && !customize && !model.dashboard.outlookMessage && model.kind!=="partial" ? <Zustand art="leer" text={companyHasOrders ? "Nichts offen" : "Noch keine Aufträge erfasst."} aktion={!companyHasOrders && canStartOrder ? { text: "Neu erfassen", icon: "inbox", onClick: () => requestGlobalCreate("DIRECT_INTAKE") } : undefined} /> : <div className="kr-stapel">
      {device === "desktop" ? <div className="kr-spalten"><div className="kr-stapel">{activeLayout.filter((item) => item.column === "left" && (customize || fieldHasContent(item.field) || (item.field === "assign" && model.dashboard.outlookMessage))).map(fieldCard)}</div><div className="kr-stapel">{activeLayout.filter((item) => item.column === "right" && (customize || fieldHasContent(item.field) || (item.field === "assign" && model.dashboard.outlookMessage))).map(fieldCard)}</div></div> : activeLayout.filter((item) => customize || fieldHasContent(item.field) || (item.field === "assign" && model.dashboard.outlookMessage)).map(fieldCard)}
      {device !== "desktop" && (canStartOrder || canWorkOrders) ? <div className="kr-schnellleiste">{canStartOrder ? <Button art="primaer" icon="inbox" text="Neu erfassen" onClick={() => requestGlobalCreate("DIRECT_INTAKE")} /> : null}{canWorkOrders ? <Button icon="truck" text="Ware raus" onClick={() => router.push("/orders?station=fertig")} /> : null}</div> : null}
    </div>}
    {later ? <Dialog titel="Später erinnern" icon="clock" groesse="schmal" onSchliessen={() => setLater(null)}><div className="kr-stapel">{deriveTodayReminder("afternoon", later.dueDate) ? <Button data-spec-id="spaeter.heute-nachmittag" text="heute Nachmittag" icon="clock" disabled={busy} onClick={() => void saveReminder("afternoon")} /> : null}{deriveTodayReminder("tomorrow", later.dueDate) ? <Button data-spec-id="spaeter.morgen-fruh" text="morgen früh" icon="clock" disabled={busy} onClick={() => void saveReminder("tomorrow")} /> : null}{deriveTodayReminder("after_due", later.dueDate) ? <Button data-spec-id="spaeter.nach-dem-termin" text="nach dem Termin" icon="clock" disabled={busy} onClick={() => void saveReminder("after_due")} /> : null}<Button data-spec-id="spaeter.schliessen" art="leise" text="Schließen" onClick={() => setLater(null)} />{message ? <Hinweis ton="warn">{message}</Hinweis> : null}</div></Dialog> : null}
    {invoiceMail?<Dialog titel={V45_TEXT.out$action$unsent({invoice:invoiceMail.number,name:invoiceMail.customerName})} icon="mail" groesse="breit" onSchliessen={()=>setInvoiceMail(null)}><CommunicationPanel key={invoiceMail.documentId} targetType="CUSTOMER" targetId={invoiceMail.customerId} invoiceOriginal={invoiceMail}/></Dialog>:null}
    {mailId ? <Dialog titel="Mail" icon="mail" groesse="breit" onSchliessen={() => setMailId(null)}><div className="kr-stapel">
      {!mailPreview && !mailMessage ? <Hinweis>Mail wird gelesen …</Hinweis> : null}
      {mailMessage ? <Hinweis ton="warn">{mailMessage}</Hinweis> : null}
      {mailPreview ? <><Fakten zeilen={[{ k: "Von", v: `${mailPreview.senderName} · ${mailPreview.senderAddress??INTAKE_MAIL_ADDRESS_MISSING_COPY}` }, { k: "Eingegangen", v: mailPreview.receivedAt===null?MAIL_IMPORT_COPY.timeUnknown:new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(mailPreview.receivedAt)) }]} /><h3>{mailPreview.subject || "Mail ohne Betreff"}</h3><p>{mailPreview.body || mailPreview.preview || "Keine lesbare Nachricht vorhanden."}</p></> : null}
    </div></Dialog> : null}
    {more ? <Dialog titel="Weitere Aktionen" icon="more" groesse="schmal" onSchliessen={() => setMore(null)}><div className="kr-stapel">{more.invoiceMail?<Button text={INVOICE_DELIVERY_COPY.manualHandover} icon="check" onClick={()=>{setMore(null);void confirmInvoiceHandover(more);}}/>:model.dashboard.delegationTargets.map((target) => <Button key={target.userId} data-spec-id="hbmehr.weitergeben" text={`an ${target.displayName} geben`} icon="handoff" disabled={busy} onClick={() => void delegate(target)} />)}<Button data-spec-id="hbmehr.schliessen" art="leise" text="Schließen" onClick={() => setMore(null)} />{message ? <Hinweis ton="warn">{message}</Hinweis> : null}</div></Dialog> : null}
  </section>;
}

function TodayRegionFrame({part,children}:{part:TodayHomePart;children:React.ReactNode}){
 return <div data-today-region={part} style={{minBlockSize:'8rem'}}><Kachel titel={TODAY_MODEL_COPY.regionTitles[part]}>{children}</Kachel></div>;
}
export function TodayStreamedRegion(props:{part:TodayHomePart;source:Promise<TodayHomePartResult>;revision?:string;scope?:string;knownCounts?:boolean;children?:React.ReactNode}){
 return <Suspense fallback={<TodayRegionFrame part={props.part}><p role="status">{TODAY_MODEL_COPY.partLoading}</p><Button text={TODAY_MODEL_COPY.partReload} disabled/></TodayRegionFrame>}><TodayRegionRead {...props}/></Suspense>;
}
function TodayRegionRead({part,source,revision,scope,knownCounts,children}:{part:TodayHomePart;source:Promise<TodayHomePartResult>;revision?:string;scope?:string;knownCounts?:boolean;children?:React.ReactNode}){
 const original=use(source);
 const [entry,setEntry]=useState<{source:typeof source;value:TodayHomePartResult}|null>(null),[pending,setPending]=useState(false);
 const value=entry?.source===source?entry.value:original;
 const running=useRef<AbortController|null>(null),previous=useRef({source,revision}),etag=useRef(revision),wanted=useRef(revision);
 useLayoutEffect(()=>{wanted.current=revision;},[revision]);
 const nextRead=useRef<()=>void>(()=>{});
 const reload=useCallback(async()=>{
  if(running.current||!scope)return;
  const controller=new AbortController(),requested=wanted.current;running.current=controller;setPending(true);
  try{
   const headers:Record<string,string>={'X-Kreile-Login-Scope':scope};if(etag.current)headers['If-None-Match']='"'+etag.current+'"';
   const response=await fetch('/api/heute/modell?nur=veraltet&bereich='+part,{credentials:'same-origin',cache:'no-store',headers,signal:controller.signal});
   if(controller.signal.aborted)return;
   if(response.status===304)return;
   if(!response.ok)throw Error('TODAY_REGION_SOURCE_INCOMPLETE');
   const result=await response.json() as {code?:string;scope?:string;revision?:string;result?:TodayHomePartResult};
   if(controller.signal.aborted||result.scope!==scope||requested!==wanted.current)return;
   const candidate=result.result;
   if(result.code!=='OK'||!candidate||candidate.part!==part||!['OK','SOURCE_INCOMPLETE'].includes(candidate.code)
    ||candidate.code==='OK'&&candidate.part==='week'&&(!Number.isSafeInteger(candidate.data?.netCents)||!Number.isSafeInteger(candidate.data?.currentlyUnpricedItemCount))
    ||candidate.code==='OK'&&candidate.part==='notices'&&(!Array.isArray(candidate.missing)||!candidate.missing.every(item=>typeof item==='string')))throw Error('TODAY_REGION_RESPONSE_INCOMPLETE');
   etag.current=result.revision;setEntry({source,value:candidate});
  }catch{
   if(!controller.signal.aborted)setEntry({source,value:{code:'SOURCE_INCOMPLETE',part}});
  }finally{if(running.current===controller){running.current=null;setPending(false);if(!controller.signal.aborted&&requested!==wanted.current)queueMicrotask(()=>nextRead.current());}}
 },[part,source,scope]);
 useLayoutEffect(()=>{nextRead.current=()=>{void reload();};},[reload]);
 useEffect(()=>()=>{running.current?.abort();running.current=null;},[source,scope]);
 useEffect(()=>{
  if(previous.current.source!==source){previous.current={source,revision};etag.current=revision;return;}
  if(revision&&previous.current.revision!==revision){previous.current.revision=revision;void reload();}
 },[source,revision,reload]);
 let content:React.ReactNode;
 if(value.code!=='OK')content=<>{part==='counts'&&knownCounts?children:null}<p role="status">{TODAY_MODEL_COPY.partFailed}</p><Button text={TODAY_MODEL_COPY.partReload} disabled={pending} onClick={()=>void reload()}/></>;
 else if(value.part==='week')content=<><p>{new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(value.data.netCents/100)}</p>{value.data.currentlyUnpricedItemCount>0?<p>{TODAY_MODEL_COPY.unpriced(value.data.currentlyUnpricedItemCount)}</p>:null}</>;
 else if(value.part==='notices')content=<p>{value.missing.length?PAGE_READ_COPY.partial:TODAY_MODEL_COPY.noNotices}</p>;
 else content=children;
 return <TodayRegionFrame part={part}>{content}</TodayRegionFrame>;
}
