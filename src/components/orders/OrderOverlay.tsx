"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, CreditCard, Loader2, PackageCheck, Truck, UserRound } from "lucide-react";
import { confirmPaymentAction, getOrderPaymentStateAction } from "@/app/actions/payments.actions";
import { recordGoodsOutAction } from "@/app/actions/goodsOut.actions";
import {
  getExtraWorkMasterDataAction,
  getLiveOrderCardAction,
} from "@/app/actions/orders.actions";
import { AppOverlayPortal } from "@/components/ui/AppOverlayPortal";
import { ExtraWorkAdminPanel } from "@/components/orders/ExtraWorkAdminPanel";
import { OrderExtraWorkEditor } from "@/components/orders/OrderExtraWorkEditor";
import { OrderFreezeButton } from "@/components/orders/OrderFreezeButton";
import { OrderFreezeCorrectionButton } from "@/components/orders/OrderFreezeCorrectionButton";
import { OrderImmutableInvoiceButton } from "@/components/orders/OrderImmutableInvoiceButton";
import { OrderTaskAssignmentPanel } from "@/components/orders/OrderTaskAssignmentPanel";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import { useOverlayStore } from "@/lib/overlayStore";
import type { EvidenceReadRecord } from "@/lib/server/evidenceRead";
import type { ExtraWorkMasterData, LiveOrderCard } from "@/lib/server/orderCardRead";
import type { PaymentMethod, OrderPaymentState } from "@/lib/server/paymentContract";
import type { ConfirmPaymentReceipt } from "@/lib/server/commands/confirmPaymentCommand";
import type { GoodsOutMode, GoodsOutReceipt } from "@/lib/server/commands/recordGoodsOutCommand";

type DataState = "loading" | "data" | "empty" | "denied" | "error";
type FlowState = "loading" | "data" | "empty" | "denied" | "error";
type MutationState = "idle" | "submitting" | "success" | "conflict" | "error";
type FlowReceipt =
  | { kind: "payment"; receipt: ConfirmPaymentReceipt }
  | { kind: "goods-out"; receipt: GoodsOutReceipt };
const STATIONS = ["angenommen", "galvanik", "fertig", "abgeholt"] as const;

function moneyLabel(value: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value / 100);
}

function timestampLabel(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(date)
    : "Nicht verfügbar";
}

function dateLabel(value: string | null): string {
  if (!value) return "Nicht erfasst";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(date)
    : "Nicht verfügbar";
}

function EvidenceList({ evidence }: { evidence: EvidenceReadRecord[] }) {
  if (evidence.length === 0) {
    return <p className="text-xs text-text-muted">Noch keine Nachweise erfasst.</p>;
  }
  return (
    <ul className="grid gap-2 md:grid-cols-2">
      {evidence.map((record) => (
        <li key={record.evidenceKey} className="rounded-xl border border-neutral-gray-200 bg-white p-3">
          <p className="text-xs font-semibold text-navy-900">
            {record.source === "ORDER_INTAKE_ATTACHMENT" ? "Annahme-Original" : record.source === "ORDER_STATION_ATTACHMENT" ? "Stationsfoto" : "Alt-Nachweis"}
          </p>
          <p className="mt-1 text-[11px] text-text-muted">
            {record.original.state} · {dateLabel(record.recordedAt)}
          </p>
          {record.original.hash ? (
            <p className="mt-1 truncate font-mono text-[10px] text-text-muted" title={record.original.hash}>
              SHA-256 {record.original.hash}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function OrderOverlay() {
  const stack = useOverlayStore((state) => state.stack);
  const orderStack = useOverlayStore((state) => state.orderStack);
  const popOrder = useOverlayStore((state) => state.popOrder);
  const openCustomer = useOverlayStore((state) => state.openCustomer);
  const currentOrderId = orderStack.at(-1);
  const { role } = usePermissions();
  const [dataState, setDataState] = useState<DataState>("loading");
  const [message, setMessage] = useState("Auftragskarte wird geladen.");
  const [card, setCard] = useState<LiveOrderCard | null>(null);
  const [evidence, setEvidence] = useState<EvidenceReadRecord[]>([]);
  const [masterData, setMasterData] = useState<ExtraWorkMasterData | null>(null);
  const [paymentState, setPaymentState] = useState<FlowState>("loading");
  const [paymentMessage, setPaymentMessage] = useState("Zahlungs- und Warenausgangsstatus wird geladen.");
  const [payment, setPayment] = useState<OrderPaymentState | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bar");
  const [goodsOutMode, setGoodsOutMode] = useState<GoodsOutMode | null>(null);
  const [mutationState, setMutationState] = useState<MutationState>("idle");
  const [mutationMessage, setMutationMessage] = useState("");
  const [flowReceipt, setFlowReceipt] = useState<FlowReceipt | null>(null);

  const load = useCallback(async (orderId: string, preserveMutation = false) => {
    setDataState("loading");
    setMessage("Auftragskarte wird geladen.");
    setCard(null);
    setEvidence([]);
    setPaymentState("loading");
    setPaymentMessage("Zahlungs- und Warenausgangsstatus wird geladen.");
    setPayment(null);
    if (!preserveMutation) {
      setMutationState("idle");
      setMutationMessage("");
      setFlowReceipt(null);
      setGoodsOutMode(null);
    }
    try {
      const [cardResult, masterResult, paymentResult] = await Promise.all([
        getLiveOrderCardAction({ orderId }),
        getExtraWorkMasterDataAction(),
        getOrderPaymentStateAction({ orderId }),
      ]);
      if (cardResult.code !== "OK") {
        setMessage(cardResult.message);
        setDataState(
          cardResult.code === "UNAUTHENTICATED" || cardResult.code === "FORBIDDEN"
            ? "denied"
            : cardResult.code === "NOT_FOUND" ? "empty" : "error",
        );
        return null;
      }
      if (masterResult.code !== "OK") {
        setMessage(masterResult.message);
        setDataState(
          masterResult.code === "UNAUTHENTICATED" || masterResult.code === "FORBIDDEN"
            ? "denied" : "error",
        );
        return null;
      }
      setCard(cardResult.data.card);
      setEvidence(cardResult.data.evidence);
      setMasterData(masterResult.data);
      if (paymentResult.code === "OK") {
        setPayment(paymentResult.data);
        setPaymentState("data");
      } else {
        setPaymentMessage(paymentResult.message);
        setPaymentState(
          paymentResult.code === "UNAUTHENTICATED" || paymentResult.code === "FORBIDDEN"
            ? "denied"
            : paymentResult.code === "NOT_FOUND" ? "empty" : "error",
        );
      }
      setDataState("data");
      return { card: cardResult.data.card, payment: paymentResult.code === "OK" ? paymentResult.data : null };
    } catch {
      setMessage("Auftragskarte konnte nicht sicher geladen werden.");
      setDataState("error");
      setPaymentMessage("Zahlungs- und Warenausgangsstatus konnte nicht sicher geladen werden.");
      setPaymentState("error");
      return null;
    }
  }, []);

  useEffect(() => {
    if (!currentOrderId) return;
    const timer = window.setTimeout(() => void load(currentOrderId), 0);
    return () => window.clearTimeout(timer);
  }, [currentOrderId, load]);

  const confirmOutstandingPayment = useCallback(async () => {
    const invoice = payment?.payment;
    if (!currentOrderId || !invoice || invoice.openAmountCents <= 0) return;
    setMutationState("submitting");
    setMutationMessage("Zahlung wird bestätigt und anschließend neu geladen.");
    setFlowReceipt(null);
    const result = await confirmPaymentAction({
      invoiceId: invoice.invoiceId,
      amount: invoice.openAmountCents,
      method: paymentMethod,
      expectedVersion: invoice.paymentVersion,
      clientEventId: crypto.randomUUID(),
    }).catch(() => ({ code: "UNAVAILABLE" as const, message: "Zahlung konnte nicht sicher bestätigt werden." }));
    if (result.code !== "OK") {
      if (result.code === "CONFLICT") await load(currentOrderId, true);
      setMutationState(result.code === "CONFLICT" ? "conflict" : "error");
      setMutationMessage(result.code === "CONFLICT" ? `${result.message} Der Auftrag wurde neu geladen.` : result.message);
      return;
    }
    const readback = await load(currentOrderId, true);
    const persisted = readback?.payment?.payment;
    if (
      !persisted
      || persisted.eventId !== result.receipt.eventId
      || persisted.receiptId !== result.receipt.receiptId
      || persisted.paymentVersion !== result.receipt.paymentVersion
    ) {
      setMutationState("error");
      setMutationMessage("Die Zahlung wurde nicht durch einen eindeutigen Readback bestätigt.");
      return;
    }
    setFlowReceipt({ kind: "payment", receipt: result.receipt });
    setMutationState("success");
    setMutationMessage("Zahlung bestätigt und aus der Datenbank zurückgelesen.");
  }, [currentOrderId, load, payment, paymentMethod]);

  const reloadGoodsOutState = useCallback(async (orderId: string) => {
    const readback = await getOrderPaymentStateAction({ orderId }).catch(() => ({
      code: "UNAVAILABLE" as const,
      message: "Der Warenausgang konnte nicht sicher zurückgelesen werden.",
    }));
    if (readback.code !== "OK") return readback;
    setPayment(readback.data);
    setPaymentState("data");
    setCard((current) => current ? {
      ...current,
      station: readback.data.physicalStatus,
      status: readback.data.physicalStatus,
      version: readback.data.orderVersion,
    } : current);
    return readback;
  }, []);

  const recordGoodsOut = useCallback(async () => {
    if (!currentOrderId || !card || !goodsOutMode) return;
    setMutationState("submitting");
    setMutationMessage("Warenausgang wird gebucht und anschließend neu geladen.");
    setFlowReceipt(null);
    const result = await recordGoodsOutAction({
      orderId: currentOrderId,
      mode: goodsOutMode,
      expectedVersion: card.version,
      clientEventId: crypto.randomUUID(),
    }).catch(() => ({ code: "UNAVAILABLE" as const, message: "Warenausgang konnte nicht sicher gebucht werden." }));
    if (result.code !== "OK") {
      if (result.code === "CONFLICT") await reloadGoodsOutState(currentOrderId);
      setMutationState(result.code === "CONFLICT" ? "conflict" : "error");
      setMutationMessage(result.code === "CONFLICT" ? `${result.message} Der Auftrag wurde neu geladen.` : result.message);
      return;
    }
    const readback = await reloadGoodsOutState(currentOrderId);
    if (
      readback.code !== "OK"
      || readback.data.physicalStatus !== "abgeholt"
      || readback.data.orderVersion !== result.receipt.orderVersion
      || readback.data.goodsOut?.eventId !== result.receipt.eventId
    ) {
      setMutationState("error");
      setMutationMessage("Der Warenausgang wurde nicht durch einen eindeutigen Readback bestätigt.");
      return;
    }
    setFlowReceipt({ kind: "goods-out", receipt: result.receipt });
    setMutationState("success");
    setMutationMessage("Warenausgang bestätigt und aus der Datenbank zurückgelesen.");
  }, [card, currentOrderId, goodsOutMode, reloadGoodsOutState]);

  if (!currentOrderId) return null;

  const stackIndex = stack.findLastIndex((item) => item.type === "order" && item.id === currentOrderId);
  const zIndex = stackIndex >= 0 ? 1010 + stackIndex * 10 : 1010;
  const currentStationIndex = card ? STATIONS.indexOf(card.station as (typeof STATIONS)[number]) : -1;
  const canConfirmPayment = role === "buero" || role === "meister" || role === "admin";
  const canRecordGoodsOut = role === "werkstatt" || role === "meister" || role === "admin";
  const invoice = payment?.payment ?? null;
  const paymentSettled = invoice?.status === "bezahlt";
  const paymentGateOpen = payment?.mode === "rechnung" || paymentSettled;
  const physicalReady = card?.station === "fertig" && card.status === "fertig";
  const goodsOutBlockedReason = !physicalReady
    ? "Nur ein fertig gemeldeter Auftrag kann ausgegeben werden."
    : !canRecordGoodsOut
      ? "Ihre Rolle darf keinen Warenausgang buchen."
      : payment?.mode !== "rechnung" && !invoice
        ? "Für Vorkasse oder Abholung fehlt die kanonische Rechnung."
        : !paymentGateOpen
          ? payment?.mode === "abholung"
            ? "Zahlung muss bei der Übergabe zuerst vollständig bestätigt werden."
            : "Vorkasse ist noch nicht vollständig bestätigt."
          : null;

  return (
    <AppOverlayPortal>
      <div className="fixed inset-0 z-[1000]">
        <button aria-label="Auftragskarte schließen" className="absolute inset-0 h-full w-full cursor-default bg-black/35 backdrop-blur-sm" data-testid="order-overlay-backdrop" onClick={popOrder} type="button" />
        <div className="relative flex h-full w-full items-center justify-center p-0 sm:p-3" style={{ zIndex }}>
          <section aria-label="Lebende Auftragskarte" className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[94dvh] sm:max-w-6xl sm:rounded-2xl" data-testid="live-order-card" onClick={(event) => event.stopPropagation()}>
            <header className="flex shrink-0 items-center justify-between border-b border-neutral-gray-200 bg-bg-app-soft px-4 py-4 md:px-6">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Lebende Auftragskarte</p>
                <h2 className="truncate text-xl font-bold text-navy-900">{card ? `${card.orderNumber} · ${card.title}` : "Auftrag"}</h2>
              </div>
              <button aria-label="Auftragskarte schließen" className="min-h-11 min-w-11 rounded-full border border-neutral-gray-200 bg-white text-xl text-navy-900" onClick={popOrder} type="button">×</button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 pb-8 md:p-6">
              {dataState === "loading" ? (
                <div className="flex min-h-64 flex-col items-center justify-center text-text-muted" role="status">
                  <Loader2 className="mb-3 h-7 w-7 animate-spin" />
                  <p>{message}</p>
                </div>
              ) : dataState === "denied" ? (
                <div className="mx-auto max-w-xl rounded-xl bg-[#fdf0ee] p-5 text-center text-[#c0392b]" role="status">
                  <AlertTriangle className="mx-auto mb-2 h-6 w-6" />
                  <strong>Zugriff nicht erlaubt</strong>
                  <p className="mt-1 text-sm">{message}</p>
                </div>
              ) : dataState === "empty" ? (
                <div className="mx-auto max-w-xl rounded-xl border border-dashed border-neutral-gray-300 p-6 text-center text-text-muted" role="status">
                  <PackageCheck className="mx-auto mb-2 h-6 w-6" />
                  <p>Auftrag wurde nicht gefunden oder gehört nicht zu diesem Mandanten.</p>
                </div>
              ) : dataState === "error" || !card || !masterData ? (
                <div className="mx-auto max-w-xl rounded-xl bg-[#fdf0ee] p-5 text-center text-[#c0392b]" role="status">
                  <AlertTriangle className="mx-auto mb-2 h-6 w-6" />
                  <p>{message}</p>
                  <button type="button" onClick={() => void load(currentOrderId)} className="mt-3 min-h-10 rounded-lg border border-[#c0392b]/40 bg-white px-4 text-sm font-semibold">Erneut laden</button>
                </div>
              ) : (
                <div className="space-y-6">
                  <section className="grid gap-3 md:grid-cols-3">
                    <button type="button" data-testid="order-customer-trigger" onClick={() => openCustomer(card.customerId)} className="flex min-h-20 items-center gap-3 rounded-xl border border-neutral-gray-200 bg-white p-4 text-left hover:border-navy-900">
                      <UserRound className="h-5 w-5 text-text-muted" />
                      <span><span className="block text-xs text-text-muted">Kunde</span><strong className="text-sm text-navy-900">{card.customerName}</strong></span>
                    </button>
                    <div className="flex min-h-20 items-center gap-3 rounded-xl border border-neutral-gray-200 bg-white p-4">
                      <CalendarDays className="h-5 w-5 text-text-muted" />
                      <span><span className="block text-xs text-text-muted">Termin</span><strong className="text-sm text-navy-900">{dateLabel(card.dueAt)}</strong></span>
                    </div>
                    <div className="min-h-20 rounded-xl border border-neutral-gray-200 bg-white p-4">
                      <span className="block text-xs text-text-muted">Annahme</span><strong className="text-sm text-navy-900">{dateLabel(card.intakeAt)}</strong>
                    </div>
                  </section>

                  <section aria-label="Ortskette" className="rounded-xl border border-neutral-gray-200 bg-bg-app-soft p-4">
                    <div className="grid grid-cols-4 gap-2">
                      {STATIONS.map((station, index) => (
                        <div key={station} className={`rounded-lg px-2 py-3 text-center text-xs font-semibold ${index <= currentStationIndex ? "bg-navy-900 text-white" : "bg-white text-text-muted"}`}>
                          {station[0]?.toUpperCase()}{station.slice(1)}
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-text-muted">Ort ist der physische Werkstattzustand. Rechnung und Zahlung werden darunter getrennt und ohne erfundene Werte geführt.</p>
                  </section>

                  <OrderTaskAssignmentPanel
                    order={card}
                    role={role}
                    onConfirmedCard={setCard}
                  />

                  {card.note ? <section className="rounded-xl border border-neutral-gray-200 bg-white p-4"><h3 className="text-sm font-semibold text-navy-900">Notiz</h3><p className="mt-1 whitespace-pre-wrap text-sm text-text-muted">{card.note}</p></section> : null}

                  <section>
                    <h3 className="mb-3 text-base font-bold text-navy-900">Teile und Mehrarbeit</h3>
                    <div className="space-y-4">
                      {card.items.map((item) => (
                        <article key={item.id} className="rounded-2xl border border-neutral-gray-200 bg-bg-app-soft p-4">
                          <div className="mb-3 grid gap-2 md:grid-cols-[auto_1fr_auto] md:items-center">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white">{item.position}</span>
                            <div><h4 className="font-semibold text-navy-900">{item.name}</h4><p className="text-xs text-text-muted">{item.quantity} Stück · {item.material ?? "Material nicht erfasst"} · {item.surfaceRequested}</p></div>
                            <span className="text-xs font-semibold text-text-muted">6 Intake-Felder bestätigt</span>
                          </div>
                          <OrderExtraWorkEditor
                            order={card}
                            item={item}
                            masterData={masterData}
                            onConfirmedCard={setCard}
                          />
                        </article>
                      ))}
                    </div>
                  </section>

                  <section><h3 className="mb-3 text-base font-bold text-navy-900">Nachweise</h3><EvidenceList evidence={evidence} /></section>

                  <section className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-dashed border-neutral-gray-300 p-4"><p className="text-xs text-text-muted">Geplanter Kennzahlen-Steckplatz</p><strong className="text-sm text-navy-900">Deckungsbeitrag: —</strong></div>
                    <div className="rounded-xl border border-dashed border-neutral-gray-300 p-4"><p className="text-xs text-text-muted">Geplanter Kennzahlen-Steckplatz</p><strong className="text-sm text-navy-900">Durchlaufkennzahl: —</strong></div>
                  </section>

                  {role === "admin" ? (
                    <ExtraWorkAdminPanel
                      masterData={masterData}
                      onConfirmed={setMasterData}
                    />
                  ) : null}

                  <OrderFreezeButton order={card} rateConfigured={masterData.currentRate !== null} onConfirmedCard={setCard} />

                  <OrderImmutableInvoiceButton order={card} />

                  <OrderFreezeCorrectionButton
                    order={card}
                    role={role}
                    onConfirmedCard={setCard}
                  />

                  <section aria-labelledby="goods-out-title" className="overflow-hidden rounded-2xl border border-neutral-gray-200 bg-white shadow-sm" data-testid="f1-5-flow">
                    <div className="bg-navy-900 px-4 py-4 text-white md:px-5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"><Truck className="h-5 w-5" /></span>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">Zahlung und Warenausgang</p>
                          <h3 id="goods-out-title" className="font-serif text-xl font-bold">Ware sicher übergeben</h3>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 p-4 md:p-5">
                      {paymentState === "loading" ? (
                        <div className="flex min-h-24 items-center justify-center gap-2 text-sm text-text-muted" role="status"><Loader2 className="h-5 w-5 animate-spin" />{paymentMessage}</div>
                      ) : paymentState === "denied" ? (
                        <div className="rounded-xl bg-[#fdf0ee] p-4 text-sm text-[#c0392b]" role="status"><strong>Zugriff nicht erlaubt</strong><p className="mt-1">{paymentMessage}</p></div>
                      ) : paymentState === "empty" ? (
                        <div className="rounded-xl border border-dashed border-neutral-gray-300 p-4 text-sm text-text-muted" role="status"><strong>Keine Ausgangsdaten</strong><p className="mt-1">{paymentMessage}</p></div>
                      ) : paymentState === "error" || !payment ? (
                        <div className="rounded-xl bg-[#fdf0ee] p-4 text-sm text-[#c0392b]" role="status">
                          <strong>Status nicht sicher verfügbar</strong><p className="mt-1">{paymentMessage}</p>
                          <button className="mt-3 min-h-11 rounded-lg border border-[#c0392b]/40 bg-white px-4 font-semibold" onClick={() => void load(currentOrderId)} type="button">Neu laden</button>
                        </div>
                      ) : (
                        <>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-xl border border-neutral-gray-200 bg-bg-app-soft p-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Physischer Status</p>
                              <p className="mt-1 text-lg font-bold capitalize text-navy-900" data-testid="f1-5-physical-status">{payment.physicalStatus}</p>
                              <p className="mt-1 text-xs text-text-muted">Ortsversion {payment.orderVersion}</p>
                            </div>
                            <div className="rounded-xl border border-neutral-gray-200 bg-bg-app-soft p-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Rechnung und Zahlung</p>
                              <p className="mt-1 text-lg font-bold text-navy-900" data-testid="f1-5-payment-mode">
                                {payment.mode === "vorkasse" ? "Vorkasse" : payment.mode === "abholung" ? "Zahlung bei Abholung" : "Rechnung / Stammkunde"}
                              </p>
                              <p className="mt-1 text-xs text-text-muted" data-testid="f1-5-invoice-state">
                                {payment.invoiceState === "not_issued" ? "Noch keine Rechnung ausgestellt" : `Rechnung ${invoice?.invoiceNumber}`}
                              </p>
                            </div>
                          </div>

                          {invoice ? (
                            <div className="grid gap-3 rounded-xl border border-neutral-gray-200 p-4 sm:grid-cols-3" data-testid="f1-5-payment-values">
                              <div><p className="text-xs text-text-muted">Zahlungsstatus</p><strong className="text-sm text-navy-900" data-testid="f1-5-payment-status">{invoice.status}</strong></div>
                              <div><p className="text-xs text-text-muted">Bestätigt</p><strong className="text-sm text-navy-900">{moneyLabel(invoice.paidAmountCents)}</strong></div>
                              <div><p className="text-xs text-text-muted">Offen</p><strong className="text-sm text-navy-900">{moneyLabel(invoice.openAmountCents)}</strong></div>
                            </div>
                          ) : (
                            <div className="rounded-xl border border-[#d8c9ad] bg-[#fbf6ec] p-4 text-sm text-navy-900" data-testid="f1-5-no-invoice-values">
                              Vor Rechnungsstellung werden weder Betrag noch Zahlungsstatus oder offener Betrag behauptet.
                            </div>
                          )}

                          {(payment.mode === "vorkasse" || payment.mode === "abholung") && invoice && !paymentSettled ? (
                            <div className="rounded-xl border border-[#e0b45c] bg-[#fff8e8] p-4">
                              <div className="flex items-start gap-3"><CreditCard className="mt-0.5 h-5 w-5 text-[#8a5a00]" /><div className="min-w-0 flex-1">
                                <strong className="text-sm text-navy-900">{payment.mode === "abholung" ? "Zahlung bei Übergabe bestätigen" : "Vollzahlung bestätigen"}</strong>
                                <p className="mt-1 text-xs text-text-muted">Offen: {moneyLabel(invoice.openAmountCents)}. Erst der bestätigte Readback öffnet das Ausgangs-Gate.</p>
                                <label className="mt-3 block text-xs font-semibold text-navy-900" htmlFor="f1-5-payment-method">Zahlungsart</label>
                                <select id="f1-5-payment-method" className="mt-1 min-h-11 w-full rounded-lg border border-neutral-gray-300 bg-white px-3 text-sm" onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)} value={paymentMethod}>
                                  <option value="bar">Bar</option><option value="karte">Karte</option><option value="ueberweisung">Überweisung</option>
                                </select>
                                {canConfirmPayment ? (
                                  <button className="mt-3 min-h-12 w-full rounded-xl bg-navy-900 px-4 font-semibold text-white disabled:opacity-50" data-testid="f1-5-payment-action" disabled={mutationState === "submitting"} onClick={() => void confirmOutstandingPayment()} type="button">{mutationState === "submitting" ? "Wird bestätigt …" : `${moneyLabel(invoice.openAmountCents)} bestätigen`}</button>
                                ) : <p className="mt-3 text-xs font-semibold text-[#8a5a00]">Ihre Rolle darf die Zahlung nicht bestätigen.</p>}
                              </div></div>
                            </div>
                          ) : null}

                          {physicalReady ? (
                            <div className="rounded-xl border border-neutral-gray-200 p-4">
                              <p className="text-sm font-semibold text-navy-900">Wie verlässt die Ware den Betrieb?</p>
                              <div className="mt-3 grid gap-2 sm:grid-cols-2" role="group" aria-label="Physischer Übergabemodus">
                                {(["versand", "abholung"] as const).map((mode) => (
                                  <button key={mode} type="button" data-testid={`f1-5-goods-out-mode-${mode}`} aria-pressed={goodsOutMode === mode} onClick={() => setGoodsOutMode(mode)} className={`min-h-12 rounded-xl border px-4 text-sm font-semibold ${goodsOutMode === mode ? "border-navy-900 bg-navy-900 text-white" : "border-neutral-gray-300 bg-white text-navy-900"}`}>
                                    {mode === "versand" ? "Versand bestätigen" : "Abholung bestätigen"}
                                  </button>
                                ))}
                              </div>
                              {goodsOutBlockedReason ? <p className="mt-3 rounded-lg bg-[#fff8e8] p-3 text-xs font-semibold text-[#8a5a00]" data-testid="f1-5-blocked">{goodsOutBlockedReason}</p> : null}
                              <button className="mt-3 min-h-12 w-full rounded-xl bg-gradient-to-r from-[#c4a15a] to-[#e0c788] px-4 font-bold text-navy-900 disabled:cursor-not-allowed disabled:opacity-50" data-testid="f1-5-goods-out-action" disabled={!goodsOutMode || Boolean(goodsOutBlockedReason) || mutationState === "submitting"} onClick={() => void recordGoodsOut()} type="button">{mutationState === "submitting" ? "Wird gebucht …" : "Warenausgang verbindlich buchen"}</button>
                            </div>
                          ) : payment.goodsOut ? (
                            <div className="rounded-xl border border-[#8db59b] bg-[#edf7f0] p-4 text-sm text-[#225c35]">
                              <strong>Ware ist {payment.goodsOut.mode === "versand" ? "im Versand" : "abgeholt"}.</strong>
                              <p className="mt-1">Der persistierte Ausgangsbeleg wurde erneut geladen.</p>
                            </div>
                          ) : <p className="rounded-xl bg-[#fff8e8] p-4 text-sm font-semibold text-[#8a5a00]" data-testid="f1-5-blocked">Nur ein fertig gemeldeter Auftrag kann ausgegeben werden.</p>}

                          {mutationState === "conflict" || mutationState === "error" ? (
                            <div className="rounded-xl bg-[#fdf0ee] p-4 text-sm text-[#c0392b]" role="alert"><AlertTriangle className="mb-2 h-5 w-5" /><strong>{mutationState === "conflict" ? "Zwischenstand geändert" : "Aktion nicht bestätigt"}</strong><p className="mt-1">{mutationMessage}</p></div>
                          ) : mutationState === "success" && flowReceipt ? (
                            <div className="rounded-xl border border-[#8db59b] bg-[#edf7f0] p-4 text-sm text-[#225c35]" data-testid="f1-5-receipt" role="status">
                              <CheckCircle2 className="mb-2 h-5 w-5" /><strong>{mutationMessage}</strong>
                              <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                                <div><dt className="font-semibold">Akteur</dt><dd className="break-all font-mono">{flowReceipt.kind === "payment" ? flowReceipt.receipt.confirmedBy : flowReceipt.receipt.actorId}</dd></div>
                                <div><dt className="font-semibold">Zeitpunkt</dt><dd>{timestampLabel(flowReceipt.kind === "payment" ? flowReceipt.receipt.confirmedAt : flowReceipt.receipt.occurredAt)}</dd></div>
                                <div><dt className="font-semibold">Receipt</dt><dd className="break-all font-mono">{flowReceipt.kind === "payment" ? flowReceipt.receipt.receiptId : `goods-out://${flowReceipt.receipt.orderId}/${flowReceipt.receipt.orderVersion}`}</dd></div>
                                <div><dt className="font-semibold">Event-ID</dt><dd className="break-all font-mono">{flowReceipt.receipt.eventId}</dd></div>
                              </dl>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  </section>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </AppOverlayPortal>
  );
}
