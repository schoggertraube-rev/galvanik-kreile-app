"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { issueInvoiceAction, getInvoiceReceiptAction } from "@/app/actions/invoices.actions";
import { recordGoodsOutAction } from "@/app/actions/goodsOut.actions";
import {
  freezeOrderAction,
  getExtraWorkMasterDataAction,
  getLiveOrderCardAction,
  getOrderFrozenReceiptAction,
  transitionWareneingangToGalvanikAction,
} from "@/app/actions/orders.actions";
import { confirmPaymentAction, getOrderPaymentStateAction } from "@/app/actions/payments.actions";
import {
  finalizeGalvanikHandoffAttachmentAction,
  getGalvanikHandoffAttachmentsAction,
  getOrderStationReceiptAction,
  reserveGalvanikHandoffAttachmentAction,
} from "@/app/warendurchlauf/actions";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import { useOverlayStore } from "@/lib/overlayStore";
import type { ExtraWorkMasterData, LiveOrderCard } from "@/lib/server/orderCardRead";
import type { EvidenceReadRecord } from "@/lib/server/evidenceRead";
import type { OrderPaymentState } from "@/lib/server/paymentContract";
import { supabase } from "@/lib/supabase/client";
import {
  OrderCardView,
  type OrderCardActionFeedback,
  type OrderCardActionPorts,
  type OrderCardModel,
  type OrderCardPaymentContext,
  type OrderCardState,
} from "@/modules/orders/public";

const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MIME_EXTENSION = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
type AcceptedMime = keyof typeof MIME_EXTENSION;
type Snapshot = { card: LiveOrderCard; master: ExtraWorkMasterData | null; payment: OrderPaymentState | null };

function failureState(result: { code: string; message: string }): Exclude<OrderCardState, { kind: "loading" | "data" }> {
  const kind = result.code === "FORBIDDEN" || result.code === "UNAUTHENTICATED" ? "denied" : result.code === "NOT_FOUND" ? "not-found" : result.code === "VALIDATION_ERROR" ? "conflict" : "error";
  return { kind, message: result.message };
}

function paymentContext(result: Awaited<ReturnType<typeof getOrderPaymentStateAction>>, card: LiveOrderCard): OrderCardPaymentContext | { conflict: string } {
  if (result.code !== "OK") {
    return result.code === "FORBIDDEN" ? { kind: "restricted", message: "Zahlungsdetails sind für diese Rolle nicht freigegeben." } : { kind: "unavailable", message: result.message };
  }
  if (result.data.orderId !== card.id || result.data.orderNumber !== card.orderNumber || result.data.orderVersion !== card.version || result.data.physicalStatus !== card.station) {
    return { conflict: "Auftrags-, Zahlungs- und Ausgangsstand stimmen nicht überein. Bitte neu laden." };
  }
  const value = result.data;
  return { kind: "available", value: { mode: value.mode, invoiceState: value.invoiceState, status: value.payment?.status ?? null, openAmountCents: value.payment?.openAmountCents ?? null, goodsOutAllowed: value.goodsOutAllowed, goodsOut: value.goodsOut ? { eventId: value.goodsOut.eventId, actorId: value.goodsOut.actorId, occurredAt: value.goodsOut.occurredAt, mode: value.goodsOut.mode } : null } };
}

function mapCard(card: LiveOrderCard, evidence: EvidenceReadRecord[], payment: OrderCardPaymentContext): OrderCardModel {
  return {
    id: card.id, version: card.version, orderNumber: card.orderNumber, customerId: card.customerId, customerName: card.customerName,
    title: card.title, note: card.note, station: card.station, status: card.status, dueAt: card.dueAt, intakeAt: card.intakeAt,
    assignedTo: card.assignment?.assignedToName ?? null,
    items: card.items.map((item) => ({ id: item.id, position: item.position, name: item.name, quantity: item.quantity, material: item.material, surface: item.surfaceRequested, extraWork: item.extraWork.map((line) => ({ lineId: line.lineId, name: line.catalogPositionName, minutes: line.minutes, amountCents: line.amountCents, frozen: line.frozen })) })),
    evidence: evidence.map((record) => ({ key: record.evidenceKey, source: record.source, state: record.original.state, recordedAt: record.recordedAt, itemIds: record.targets.filter((target) => target.targetType === "ORDER_ITEM").map((target) => target.targetId) })),
    frozenAt: card.freeze?.frozenAt ?? null, totalAmountCents: card.freeze?.totalAmountCents ?? null, payment,
  };
}

function available(visible: boolean, enabled: boolean, reason: string | null = null) {
  return { visible, enabled, reason };
}

export function OrderCardAppAdapter({ orderId, onOpenCustomer, onClose, fallbackHref }: { orderId: string; onOpenCustomer?: (customerId: string) => void; onClose?: () => void; fallbackHref?: "/orders" }) {
  const router = useRouter();
  const storeOpenCustomer = useOverlayStore((value) => value.openCustomer);
  const storeClose = useOverlayStore((value) => value.pop);
  const { role } = usePermissions();
  const [state, setState] = useState<OrderCardState>({ kind: "loading" });
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [feedback, setFeedback] = useState<OrderCardActionFeedback>({ kind: "idle", message: "" });
  const requests = useRef<Record<string, string>>({});

  const load = useCallback(async (preserveFeedback = false): Promise<Snapshot | null> => {
    setState({ kind: "loading" });
    if (!preserveFeedback) setFeedback({ kind: "idle", message: "" });
    try {
      const cardResult = await getLiveOrderCardAction({ orderId });
      if (cardResult.code !== "OK") { setSnapshot(null); setState(failureState(cardResult)); return null; }
      const card = cardResult.data.card;
      const [masterResult, paymentResult] = await Promise.all([getExtraWorkMasterDataAction(), getOrderPaymentStateAction({ orderId })]);
      const context = paymentContext(paymentResult, card);
      if ("conflict" in context) { setSnapshot(null); setState({ kind: "conflict", message: context.conflict }); return null; }
      const next = { card, master: masterResult.code === "OK" ? masterResult.data : null, payment: paymentResult.code === "OK" ? paymentResult.data : null };
      setSnapshot(next);
      setState({ kind: "data", card: mapCard(card, cardResult.data.evidence, context) });
      return next;
    } catch {
      setSnapshot(null);
      setState({ kind: "error", message: "Auftragskarte konnte nicht sicher geladen werden." });
      return null;
    }
  }, [orderId]);

  useEffect(() => { let active = true; const timer = window.setTimeout(() => { if (active) void load(); }, 0); return () => { active = false; window.clearTimeout(timer); }; }, [load]);

  const fail = useCallback(async (result: { code: string; message: string }) => {
    if (result.code === "CONFLICT") await load(true);
    setFeedback({ kind: result.code === "CONFLICT" ? "conflict" : "error", message: result.code === "CONFLICT" ? `${result.message} Der Auftrag wurde neu geladen.` : result.message });
  }, [load]);

  const success = useCallback((kind: "handoff" | "evidence" | "freeze" | "invoice" | "payment" | "goods-out", receipt: { actorId: string; occurredAt: string; eventId: string; receiptId: string }, message: string) => {
    delete requests.current[kind];
    setFeedback({ kind: "success", message, receipt: { kind, ...receipt } });
  }, []);

  const onHandoff = useCallback(async () => {
    if (!snapshot) return;
    setFeedback({ kind: "submitting", message: "Übergabe wird geschrieben und zurückgelesen." });
    const clientEventId = requests.current.handoff ??= crypto.randomUUID();
    const result = await transitionWareneingangToGalvanikAction({ orderId, expectedVersion: snapshot.card.version, clientEventId });
    if (result.code !== "OK") { await fail(result); return; }
    const [receipt, fresh] = await Promise.all([getOrderStationReceiptAction({ orderId, clientEventId }), load(true)]);
    if (!receipt.ok || !receipt.data || receipt.data.eventId !== result.receipt.eventId || fresh?.card.station !== "galvanik" || fresh.card.version !== result.receipt.aggregateVersion) { setFeedback({ kind: "error", message: "Übergabe wurde nicht eindeutig zurückgelesen." }); return; }
    success("handoff", { actorId: result.receipt.actorId, occurredAt: result.receipt.occurredAt, eventId: result.receipt.eventId, receiptId: `station://${orderId}/${result.receipt.aggregateVersion}` }, "Übergabe an die Galvanik bestätigt.");
  }, [fail, load, orderId, snapshot, success]);

  const onFreeze = useCallback(async () => {
    if (!snapshot) return;
    setFeedback({ kind: "submitting", message: "Fertigstellung und Freeze werden geschrieben und zurückgelesen." });
    const clientEventId = requests.current.freezeEvent ??= crypto.randomUUID();
    const freezeId = requests.current.freezeId ??= crypto.randomUUID();
    const result = await freezeOrderAction({ orderId, expectedVersion: snapshot.card.version, clientEventId, freezeId });
    if (result.code !== "OK") { await fail(result); return; }
    const [receipt, fresh] = await Promise.all([getOrderFrozenReceiptAction({ orderId, clientEventId }), load(true)]);
    if (receipt.code !== "OK" || !receipt.data || receipt.data.eventId !== result.receipt.eventId || fresh?.card.station !== "fertig" || fresh.card.version !== result.receipt.aggregateVersion || fresh.card.freeze?.freezeId !== result.receipt.freezeId) { setFeedback({ kind: "error", message: "Fertigstellung wurde nicht eindeutig zurückgelesen." }); return; }
    delete requests.current.freezeEvent; delete requests.current.freezeId;
    success("freeze", { actorId: result.receipt.actorId, occurredAt: result.receipt.occurredAt, eventId: result.receipt.eventId, receiptId: `freeze://${result.receipt.freezeId}` }, "Fertigstellung und Freeze bestätigt.");
  }, [fail, load, orderId, snapshot, success]);

  const onIssueInvoice = useCallback(async () => {
    if (!snapshot) return;
    setFeedback({ kind: "submitting", message: "Rechnung wird ausgestellt und zurückgelesen." });
    const clientEventId = requests.current.invoice ??= crypto.randomUUID();
    const result = await issueInvoiceAction({ orderId, expectedVersion: snapshot.card.version, clientEventId });
    if (result.code !== "OK") { await fail(result); return; }
    const [receipt, fresh] = await Promise.all([getInvoiceReceiptAction({ orderId, clientEventId }), load(true)]);
    const readConfirmed = result.receipt.eventSchemaVersion === 1 ? receipt.code === "OK" && receipt.data?.eventId === result.receipt.eventId : fresh?.payment?.invoiceState === "issued" && fresh.payment.payment?.invoiceId === result.receipt.invoiceId;
    if (!readConfirmed) { setFeedback({ kind: "error", message: "Rechnung wurde nicht eindeutig zurückgelesen." }); return; }
    success("invoice", { actorId: result.receipt.issuedBy, occurredAt: result.receipt.issuedAt, eventId: result.receipt.eventId, receiptId: `invoice://${result.receipt.invoiceId}/${result.receipt.aggregateVersion}` }, `Rechnung ${result.receipt.invoiceNumber} wurde unveränderlich ausgestellt.`);
  }, [fail, load, orderId, snapshot, success]);

  const onConfirmPayment = useCallback(async (method: "bar" | "ueberweisung" | "karte") => {
    const invoice = snapshot?.payment?.payment;
    if (!invoice || invoice.openAmountCents <= 0) return;
    setFeedback({ kind: "submitting", message: "Zahlung wird bestätigt und zurückgelesen." });
    const clientEventId = requests.current.payment ??= crypto.randomUUID();
    const result = await confirmPaymentAction({ invoiceId: invoice.invoiceId, amount: invoice.openAmountCents, method, expectedVersion: invoice.paymentVersion, clientEventId });
    if (result.code !== "OK") { await fail(result); return; }
    const fresh = await load(true);
    const persisted = fresh?.payment?.payment;
    if (!persisted || persisted.eventId !== result.receipt.eventId || persisted.receiptId !== result.receipt.receiptId || persisted.paymentVersion !== result.receipt.paymentVersion) { setFeedback({ kind: "error", message: "Zahlung wurde nicht eindeutig zurückgelesen." }); return; }
    success("payment", { actorId: result.receipt.confirmedBy, occurredAt: result.receipt.confirmedAt, eventId: result.receipt.eventId, receiptId: result.receipt.receiptId }, "Zahlung wurde bestätigt und aus der Datenbank zurückgelesen.");
  }, [fail, load, snapshot, success]);

  const onRecordGoodsOut = useCallback(async (mode: "versand" | "abholung") => {
    if (!snapshot) return;
    setFeedback({ kind: "submitting", message: "Warenausgang wird gebucht und zurückgelesen." });
    const clientEventId = requests.current.goodsOut ??= crypto.randomUUID();
    const result = await recordGoodsOutAction({ orderId, expectedVersion: snapshot.card.version, mode, clientEventId });
    if (result.code !== "OK") { await fail(result); return; }
    const fresh = await load(true);
    if (fresh?.card.station !== "abgeholt" || fresh.card.version !== result.receipt.orderVersion || fresh.payment?.goodsOut?.eventId !== result.receipt.eventId) { setFeedback({ kind: "error", message: "Warenausgang wurde nicht eindeutig zurückgelesen." }); return; }
    success("goods-out", { actorId: result.receipt.actorId, occurredAt: result.receipt.occurredAt, eventId: result.receipt.eventId, receiptId: `goods-out://${orderId}/${result.receipt.orderVersion}` }, "Warenausgang wurde bestätigt und aus der Datenbank zurückgelesen.");
  }, [fail, load, orderId, snapshot, success]);

  const onUploadEvidence = useCallback(async (itemId: string, file: File) => {
    if (!snapshot || !(file.type in MIME_EXTENSION) || file.size < 1 || file.size > MAX_FILE_BYTES) { setFeedback({ kind: "error", message: "Nur JPG, PNG oder WebP bis 12 MiB sind erlaubt." }); return; }
    setFeedback({ kind: "submitting", message: "Original wird geprüft, gespeichert und zurückgelesen." });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const contentSha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const clientRequestId = requests.current.evidence ??= crypto.randomUUID();
    const before = await getGalvanikHandoffAttachmentsAction({ orderId, itemId });
    if (before.code !== "OK" || !before.data.canOperate || !before.data.currentActorId) { await fail(before.code === "OK" ? { code: "FORBIDDEN", message: "Diese Rolle darf keinen Zustandsbeleg hinzufügen." } : before); return; }
    const reserved = await reserveGalvanikHandoffAttachmentAction({ orderId, itemId, expectedVersion: snapshot.card.version, clientRequestId, mimeType: file.type as AcceptedMime, fileBytes: file.size, contentSha256 });
    if (reserved.code !== "OK") { await fail(reserved); return; }
    const receipt = reserved.data.receipt;
    if (receipt.state !== "PENDING" || !reserved.data.upload || receipt.actorId !== before.data.currentActorId || receipt.contentSha256 !== contentSha256) { setFeedback({ kind: "error", message: "Uploadfreigabe war nicht exakt gebunden." }); return; }
    const expectedPath = `order-station-evidence/v1/${receipt.reservationId}.${MIME_EXTENSION[file.type as AcceptedMime]}`;
    if (reserved.data.upload.path !== expectedPath) { setFeedback({ kind: "error", message: "Uploadpfad war nicht exakt gebunden." }); return; }
    const uploaded = await supabase.storage.from("item-photos").uploadToSignedUrl(reserved.data.upload.path, reserved.data.upload.token, bytes, { contentType: file.type, upsert: false });
    if (uploaded.error || uploaded.data?.path !== expectedPath) { setFeedback({ kind: "error", message: "Original konnte nicht sicher gespeichert werden." }); return; }
    const finalized = await finalizeGalvanikHandoffAttachmentAction({ reservationId: receipt.reservationId });
    if (finalized.code !== "OK") { await fail(finalized); return; }
    const readback = await getGalvanikHandoffAttachmentsAction({ orderId, itemId });
    const persisted = readback.code === "OK" ? readback.data.receipts.find((entry) => entry.reservationId === receipt.reservationId) : null;
    if (!persisted || persisted.state !== "FINALIZED" || !persisted.receiptId || persisted.contentSha256 !== contentSha256 || persisted.actorId !== before.data.currentActorId || !(await load(true))) { setFeedback({ kind: "error", message: "Zustandsbeleg wurde nicht eindeutig zurückgelesen." }); return; }
    success("evidence", { actorId: persisted.actorId, occurredAt: persisted.verifiedAt ?? persisted.reservedAt, eventId: persisted.transitionEventId, receiptId: persisted.receiptId }, "Zustandsfoto wurde unverändert gespeichert und zurückgelesen.");
  }, [fail, load, orderId, snapshot, success]);

  const actions = useMemo<OrderCardActionPorts>(() => {
    const card = snapshot?.card;
    const payment = snapshot?.payment;
    const canOperateStation = role === "buero" || role === "werkstatt" || role === "meister" || role === "admin";
    const canFinance = role === "buero" || role === "meister" || role === "admin";
    const canGoodsOut = role === "werkstatt" || role === "meister" || role === "admin";
    const invoiceAfterGoodsOut = payment?.mode === "rechnung" && payment.invoiceState === "not_issued" && payment.physicalStatus === "abgeholt" && payment.goodsOut?.eventSchemaVersion === 2;
    const invoiceReady = Boolean(card?.freeze) && (card?.station === "fertig" || invoiceAfterGoodsOut);
    const paymentReady = payment?.invoiceState === "issued" && Boolean(payment.payment && payment.payment.openAmountCents > 0);
    const goodsOutGate = payment?.mode === "rechnung" || payment?.payment?.status === "bezahlt";
    return {
      handoff: available(card?.station === "angenommen", canOperateStation, canOperateStation ? null : "Ihre Rolle darf den Ortsübergang nicht auslösen."),
      evidence: available(card?.station === "galvanik", canOperateStation, canOperateStation ? null : "Ihre Rolle darf keinen Zustandsbeleg hinzufügen."),
      freeze: available(card?.station === "galvanik", canOperateStation && Boolean(snapshot?.master?.currentRate), !canOperateStation ? "Ihre Rolle darf den Abschluss nicht auslösen." : !snapshot?.master?.currentRate ? "Vorher muss ein gültiger Stundensatz konfiguriert sein." : null),
      invoice: available(invoiceReady, canFinance, canFinance ? null : "Ihre Rolle darf keine Rechnung ausstellen."),
      payment: available(paymentReady, canFinance, canFinance ? null : "Ihre Rolle darf keinen Zahlungseingang bestätigen."),
      goodsOut: available(card?.station === "fertig", canGoodsOut && Boolean(goodsOutGate), !canGoodsOut ? "Ihre Rolle darf keinen Warenausgang buchen." : !goodsOutGate ? "Das kanonische Zahlungsgate ist noch nicht erfüllt." : null),
      feedback, onHandoff, onUploadEvidence, onFreeze, onIssueInvoice, onConfirmPayment, onRecordGoodsOut, onReload: async () => { await load(); },
    };
  }, [feedback, load, onConfirmPayment, onFreeze, onHandoff, onIssueInvoice, onRecordGoodsOut, onUploadEvidence, role, snapshot]);

  const close = onClose ?? (fallbackHref ? () => router.replace(fallbackHref) : storeClose);
  return <OrderCardView state={state} actions={actions} onOpenCustomer={onOpenCustomer ?? storeOpenCustomer} onClose={close} />;
}
