"use client";

import { useEffect, useState } from "react";
import { getLiveOrderCardAction } from "@/app/actions/orders.actions";
import { getOrderPaymentStateAction } from "@/app/actions/payments.actions";
import { OrderCardView, type OrderCardPayment, type OrderCardState } from "@/modules/orders/public";
import { useOverlayStore } from "@/lib/overlayStore";

function failureState(result: { code: string; message: string }): Exclude<OrderCardState, { kind: "loading" | "data" }> {
  const kind = result.code === "FORBIDDEN" || result.code === "UNAUTHENTICATED" ? "denied" : result.code === "NOT_FOUND" ? "not-found" : result.code === "VALIDATION_ERROR" ? "conflict" : "error";
  return { kind, message: result.message };
}

export function OrderCardAppAdapter({ orderId, onOpenCustomer, onClose }: { orderId: string; onOpenCustomer?: (customerId: string) => void; onClose?: () => void }) {
  const storeOpenCustomer = useOverlayStore((value) => value.openCustomer);
  const storeClose = useOverlayStore((value) => value.pop);
  const [state, setState] = useState<OrderCardState>({ kind: "loading" });
  useEffect(() => {
    let active = true;
    void (async () => {
      const cardResult = await getLiveOrderCardAction({ orderId });
      if (!active) return;
      if (cardResult.code !== "OK") { setState(failureState(cardResult)); return; }
      const card = cardResult.data.card;
      let payment: OrderCardPayment | null = null;
      if (card.station === "fertig" || card.station === "abgeholt") {
        const paymentResult = await getOrderPaymentStateAction({ orderId });
        if (!active) return;
        if (paymentResult.code !== "OK") { setState(failureState(paymentResult)); return; }
        if (paymentResult.data.orderId !== card.id || paymentResult.data.orderNumber !== card.orderNumber || paymentResult.data.orderVersion !== card.version || paymentResult.data.physicalStatus !== card.station) {
          setState({ kind: "conflict", message: "Auftrags-, Zahlungs- und Ausgangsstand stimmen nicht überein. Bitte neu laden." });
          return;
        }
        const value = paymentResult.data;
        payment = { mode: value.mode, invoiceState: value.invoiceState, status: value.payment?.status ?? null, openAmountCents: value.payment?.openAmountCents ?? null, goodsOutAllowed: value.goodsOutAllowed, goodsOut: value.goodsOut ? { eventId: value.goodsOut.eventId, actorId: value.goodsOut.actorId, occurredAt: value.goodsOut.occurredAt, mode: value.goodsOut.mode } : null };
      }
      setState({ kind: "data", card: {
        id: card.id, version: card.version, orderNumber: card.orderNumber, customerId: card.customerId, customerName: card.customerName,
        title: card.title, note: card.note, station: card.station, status: card.status, dueAt: card.dueAt, intakeAt: card.intakeAt,
        assignedTo: card.assignment?.assignedToName ?? null,
        items: card.items.map((item) => ({ id: item.id, position: item.position, name: item.name, quantity: item.quantity, material: item.material, surface: item.surfaceRequested, extraWork: item.extraWork.map((line) => ({ lineId: line.lineId, name: line.catalogPositionName, minutes: line.minutes, amountCents: line.amountCents, frozen: line.frozen })) })),
        evidence: cardResult.data.evidence.map((record) => ({ key: record.evidenceKey, source: record.source, state: record.original.state, recordedAt: record.recordedAt, itemIds: record.targets.filter((target) => target.targetType === "ORDER_ITEM").map((target) => target.targetId) })),
        frozenAt: card.freeze?.frozenAt ?? null, totalAmountCents: card.freeze?.totalAmountCents ?? null, payment,
      } });
    })().catch(() => { if (active) setState({ kind: "error", message: "Auftragskarte konnte nicht sicher geladen werden." }); });
    return () => { active = false; };
  }, [orderId]);
  return <OrderCardView state={state} onOpenCustomer={onOpenCustomer ?? storeOpenCustomer} onClose={onClose ?? storeClose} />;
}
