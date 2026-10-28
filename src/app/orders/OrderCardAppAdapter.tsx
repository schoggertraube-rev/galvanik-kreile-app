"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  issueInvoiceAction,
  getInvoiceReceiptAction,
  setInvoiceItemPricesAction,
} from "@/app/actions/invoices.actions";
import { recordGoodsOutAction } from "@/app/actions/goodsOut.actions";
import { getActiveCatalogAction } from "@/app/actions/catalog.actions";
import {
  changeOrderContentAction,
  changeOrderPromisedDueDateAction,
  freezeOrderAction,
  getExtraWorkMasterDataAction,
  getLiveOrderCardAction,
  getOrderFrozenReceiptAction,
  setOrderItemFinishedAction,
  transitionWareneingangToGalvanikAction,
} from "@/app/actions/orders.actions";
import {
  confirmPaymentAction,
  getOrderPaymentStateAction,
} from "@/app/actions/payments.actions";
import {
  finalizeGalvanikHandoffAttachmentAction,
  getGalvanikHandoffAttachmentOriginalAction,
  getGalvanikHandoffAttachmentsAction,
  getOrderStationReceiptAction,
  reserveGalvanikHandoffAttachmentAction,
  createOrderIntakeAction,
} from "@/app/warendurchlauf/actions";
import { uploadSignedOrderAttachment } from "@/app/warendurchlauf/galvanik/GalvanikHandoffAttachmentAppAdapter";
import { DomainAttachmentPanel } from "@/components/attachments/DomainAttachmentPanel";
import { CommunicationPanel } from "@/components/communication/CommunicationPanel";
import { requestGlobalCreate } from "@/components/layout/GlobalCreateFlow";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import { useOverlayStore } from "@/lib/overlayStore";
import type {
  ExtraWorkMasterData,
  LiveOrderCard,
} from "@/lib/server/orderCardRead";
import type { EvidenceReadRecord } from "@/lib/server/evidenceRead";
import type { OrderPaymentState } from "@/lib/server/paymentContract";
import {
  OrderCardView,
  OrderStationAttachmentPanel,
  type OrderCardActionFeedback,
  type OrderCardActionPorts,
  type OrderCardModel,
  type OrderCardPaymentContext,
  type OrderCardState,
  type OrderStationAttachmentPorts,
} from "@/modules/orders/public";

type Snapshot = {
  card: LiveOrderCard;
  master: ExtraWorkMasterData | null;
  payment: OrderPaymentState | null;
  catalog: NonNullable<OrderCardModel["catalog"]>;
};

type OrderCardLoadCode =
  | "ORDER_CARD_ACTION_FAILED"
  | "ORDER_CARD_EXTRA_WORK_ACTION_FAILED"
  | "ORDER_CARD_PAYMENT_ACTION_FAILED"
  | "ORDER_CARD_CATALOG_ACTION_FAILED";

class OrderCardLoadError extends Error {
  constructor(readonly code: OrderCardLoadCode) {
    super(code);
    this.name = "OrderCardLoadError";
  }
}

async function invokeOrderCardLoadStep<T>(
  code: OrderCardLoadCode,
  action: () => Promise<T>,
): Promise<T> {
  try {
    return await action();
  } catch {
    throw new OrderCardLoadError(code);
  }
}

function failure(result: {
  code: string;
  message: string;
}): Exclude<OrderCardState, { kind: "loading" | "data" }> {
  const kind =
    result.code === "FORBIDDEN" || result.code === "UNAUTHENTICATED"
      ? "denied"
      : result.code === "NOT_FOUND"
        ? "not-found"
        : result.code === "VALIDATION_ERROR"
          ? "conflict"
          : "error";
  return { kind, message: result.message };
}
function paymentContext(
  result: Awaited<ReturnType<typeof getOrderPaymentStateAction>>,
  card: LiveOrderCard,
): OrderCardPaymentContext | { conflict: string } {
  if (result.code !== "OK")
    return result.code === "FORBIDDEN"
      ? {
          kind: "restricted",
          message: "Zahlungsdetails sind für diese Rolle nicht freigegeben.",
        }
      : { kind: "unavailable", message: result.message };
  if (
    result.data.orderId !== card.id ||
    result.data.orderNumber !== card.orderNumber ||
    result.data.orderVersion !== card.version ||
    result.data.physicalStatus !== card.station
  )
    return {
      conflict:
        "Auftrags-, Zahlungs- und Ausgangsstand stimmen nicht überein. Bitte neu laden.",
    };
  const v = result.data;
  return {
    kind: "available",
    value: {
      mode: v.mode,
      invoiceState: v.invoiceState,
      invoiceId: v.payment?.invoiceId ?? null,
      invoiceNumber: v.payment?.invoiceNumber ?? null,
      status: v.payment?.status ?? null,
      openAmountCents: v.payment?.openAmountCents ?? null,
      goodsOutAllowed: v.goodsOutAllowed,
      goodsOut: v.goodsOut
        ? {
            eventId: v.goodsOut.eventId,
            actorId: v.goodsOut.actorId,
            occurredAt: v.goodsOut.occurredAt,
            mode: v.goodsOut.mode,
          }
        : null,
    },
  };
}
function mapCard(
  card: LiveOrderCard,
  evidence: EvidenceReadRecord[],
  payment: OrderCardPaymentContext,
  catalog: NonNullable<OrderCardModel["catalog"]>,
): OrderCardModel {
  return {
    id: card.id,
    version: card.version,
    orderNumber: card.orderNumber,
    customerId: card.customerId,
    customerName: card.customerName,
    customerPhone: card.customerPhone,
    title: card.title,
    note: card.note,
    station: card.station,
    status: card.status,
    dueAt: card.dueAt,
    intakeAt: card.intakeAt,
    assignedTo: card.assignment?.assignedToName ?? null,
    dueDateChanges: card.dueDateChanges,
    items: card.items.map((item) => ({
      id: item.id,
      position: item.position,
      name: item.name,
      quantity: item.quantity,
      material: item.material,
      surface: item.surfaceRequested,
      catalogServiceId: item.catalogServiceId,
      unit: item.unit,
      unitPriceCents: item.unitPriceCents,
      vatRateBasisPoints: item.vatRateBasisPoints,
      finished: item.finished,
      extraWork: item.extraWork.map((line) => ({
        lineId: line.lineId,
        name: line.catalogPositionName,
        minutes: line.minutes,
        amountCents: line.amountCents,
        frozen: line.frozen,
      })),
    })),
    evidence: evidence.map((record) => ({
      key: record.evidenceKey,
      source: record.source,
      state: record.original.state,
      recordedAt: record.recordedAt,
      itemIds: record.targets
        .filter((target) => target.targetType === "ORDER_ITEM")
        .map((target) => target.targetId),
    })),
    frozenAt: card.freeze?.frozenAt ?? null,
    totalAmountCents: card.freeze?.totalAmountCents ?? null,
    payment,
    catalog,
  };
}
function availability(
  visible: boolean,
  enabled: boolean,
  reason: string | null = null,
) {
  return { visible, enabled, reason };
}

export function OrderCardAppAdapter({
  orderId,
  onOpenCustomer,
  onClose,
  fallbackHref,
}: {
  orderId: string;
  onOpenCustomer?: (id: string) => void;
  onClose?: () => void;
  fallbackHref?: "/orders";
}) {
  const router = useRouter();
  const storeCustomer = useOverlayStore((s) => s.openCustomer);
  const storeClose = useOverlayStore((s) => s.pop);
  const { canAction, hasPermission } = usePermissions();
  const [state, setState] = useState<OrderCardState>({ kind: "loading" });
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [feedback, setFeedback] = useState<OrderCardActionFeedback>({
    kind: "idle",
    message: "",
  });
  const requests = useRef<Record<string, string>>({});
  const load = useCallback(
    async (preserve = false): Promise<Snapshot | null> => {
      setState({ kind: "loading" });
      if (!preserve) setFeedback({ kind: "idle", message: "" });
      try {
        const result = await invokeOrderCardLoadStep(
          "ORDER_CARD_ACTION_FAILED",
          () => getLiveOrderCardAction({ orderId }),
        );
        if (result.code !== "OK") {
          setSnapshot(null);
          setState(failure(result));
          return null;
        }
        const card = result.data.card;
        const [masterResult, paymentResult, catalogResult] = await Promise.all([
          invokeOrderCardLoadStep(
            "ORDER_CARD_EXTRA_WORK_ACTION_FAILED",
            getExtraWorkMasterDataAction,
          ),
          invokeOrderCardLoadStep(
            "ORDER_CARD_PAYMENT_ACTION_FAILED",
            () => getOrderPaymentStateAction({ orderId }),
          ),
          invokeOrderCardLoadStep(
            "ORDER_CARD_CATALOG_ACTION_FAILED",
            getActiveCatalogAction,
          ),
        ]);
        const context = paymentContext(paymentResult, card);
        if ("conflict" in context) {
          setSnapshot(null);
          setState({ kind: "conflict", message: context.conflict });
          return null;
        }
        const next = {
          card,
          master: masterResult.code === "OK" ? masterResult.data : null,
          payment: paymentResult.code === "OK" ? paymentResult.data : null,
          catalog: catalogResult.code === "OK" ? catalogResult.services : [],
        };
        setSnapshot(next);
        setState({
          kind: "data",
          card: mapCard(card, result.data.evidence, context, next.catalog),
        });
        return next;
      } catch (error) {
        const code = error instanceof OrderCardLoadError
          ? error.code
          : "ORDER_CARD_LOAD_UNEXPECTED";
        console.error("[ORDER_CARD_LOAD_ERROR]", { code, orderId });
        setSnapshot(null);
        setState({
          kind: "error",
          message: `Auftragskarte konnte nicht sicher geladen werden. Fehlercode: ${code}.`,
        });
        return null;
      }
    },
    [orderId],
  );
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const fail = useCallback(
    async (result: { code: string; message: string }) => {
      if (result.code === "CONFLICT") await load(true);
      setFeedback({
        kind: result.code === "CONFLICT" ? "conflict" : "error",
        message:
          result.code === "CONFLICT"
            ? `${result.message} Der Auftrag wurde neu geladen.`
            : result.message,
      });
    },
    [load],
  );
  const success = useCallback(
    (
      kind:
        "handoff" | "evidence" | "freeze" | "invoice" | "payment" | "goods-out" | "due-date" | "content" | "item-finished" | "duplicate",
      receipt: {
        actorId: string;
        occurredAt: string;
        eventId: string;
        receiptId: string;
      },
      message: string,
    ) => {
      delete requests.current[kind];
      setFeedback({ kind: "success", message, receipt: { kind, ...receipt } });
    },
    [],
  );
  const onChangeDueDate = useCallback(async (dueDate: string, reason: string) => {
    if (!snapshot) return;
    setFeedback({
      kind: "submitting",
      message: "Liefertermin und Grund werden sicher gespeichert.",
    });
    const clientEventId = (requests.current.dueDate ??= crypto.randomUUID());
    const result = await changeOrderPromisedDueDateAction({
      orderId,
      expectedVersion: snapshot.card.version,
      dueDate,
      reason,
      clientEventId,
    });
    if (result.code !== "OK") {
      await fail(result);
      return;
    }
    const fresh = await load(true);
    if (
      fresh?.card.version !== result.receipt.aggregateVersion
      || fresh.card.dueAt?.slice(0, 10) !== result.receipt.dueDate
      || fresh.card.dueDateChanges[0]?.eventId !== result.receipt.eventId
    ) {
      setFeedback({
        kind: "error",
        message: "Die Terminänderung konnte nicht sicher bestätigt werden. Bitte neu laden.",
      });
      return;
    }
    delete requests.current.dueDate;
    success(
      "due-date",
      {
        actorId: result.receipt.actorId,
        occurredAt: result.receipt.occurredAt,
        eventId: result.receipt.eventId,
        receiptId: `due-date://${orderId}/${result.receipt.aggregateVersion}`,
      },
      "Liefertermin und Grund wurden gespeichert.",
    );
  }, [fail, load, orderId, snapshot, success]);
  const onHandoff = useCallback(async () => {
    if (!snapshot) return;
    setFeedback({
      kind: "submitting",
      message: "Übergabe an die Galvanik wird sicher gespeichert.",
    });
    const clientEventId = (requests.current.handoff ??= crypto.randomUUID());
    const result = await transitionWareneingangToGalvanikAction({
      orderId,
      expectedVersion: snapshot.card.version,
      clientEventId,
    });
    if (result.code !== "OK") {
      await fail(result);
      return;
    }
    const [receipt, fresh] = await Promise.all([
      getOrderStationReceiptAction({ orderId, clientEventId }),
      load(true),
    ]);
    if (
      !receipt.ok ||
      !receipt.data ||
      receipt.data.eventId !== result.receipt.eventId ||
      fresh?.card.station !== "galvanik" ||
      fresh.card.version !== result.receipt.aggregateVersion
    ) {
      setFeedback({
        kind: "error",
        message:
          "Die Übergabe konnte nicht sicher bestätigt werden. Bitte den Auftragsstand neu laden.",
      });
      return;
    }
    success(
      "handoff",
      {
        actorId: result.receipt.actorId,
        occurredAt: result.receipt.occurredAt,
        eventId: result.receipt.eventId,
        receiptId: `station://${orderId}/${result.receipt.aggregateVersion}`,
      },
      "Übergabe an die Galvanik bestätigt.",
    );
  }, [fail, load, orderId, snapshot, success]);
  const onFreeze = useCallback(async () => {
    if (!snapshot) return;
    setFeedback({
      kind: "submitting",
      message: "Fertigstellung wird sicher gespeichert.",
    });
    const clientEventId = (requests.current.freezeEvent ??=
      crypto.randomUUID());
    const freezeId = (requests.current.freezeId ??= crypto.randomUUID());
    const result = await freezeOrderAction({
      orderId,
      expectedVersion: snapshot.card.version,
      clientEventId,
      freezeId,
    });
    if (result.code !== "OK") {
      await fail(result);
      return;
    }
    const [receipt, fresh] = await Promise.all([
      getOrderFrozenReceiptAction({ orderId, clientEventId }),
      load(true),
    ]);
    if (
      receipt.code !== "OK" ||
      !receipt.data ||
      receipt.data.eventId !== result.receipt.eventId ||
      fresh?.card.station !== "fertig" ||
      fresh.card.version !== result.receipt.aggregateVersion ||
      fresh.card.freeze?.freezeId !== result.receipt.freezeId
    ) {
      setFeedback({
        kind: "error",
        message:
          "Die Fertigstellung konnte nicht sicher bestätigt werden. Bitte den Auftragsstand neu laden.",
      });
      return;
    }
    delete requests.current.freezeEvent;
    delete requests.current.freezeId;
    success(
      "freeze",
      {
        actorId: result.receipt.actorId,
        occurredAt: result.receipt.occurredAt,
        eventId: result.receipt.eventId,
        receiptId: `freeze://${result.receipt.freezeId}`,
      },
      "Fertigstellung und Freeze bestätigt.",
    );
  }, [fail, load, orderId, snapshot, success]);
  const onIssueInvoice = useCallback(async (
    prices: Array<{ itemId: string; unitPriceCents: number }> = [],
  ) => {
    if (!snapshot) return;
    setFeedback({
      kind: "submitting",
      message: prices.length
        ? "Preise werden gespeichert und die Rechnung wird ausgestellt."
        : "Rechnung wird sicher ausgestellt.",
    });
    let expectedVersion = snapshot.card.version;
    if (prices.length > 0) {
      const priceClientEventId = (requests.current.invoicePrices ??= crypto.randomUUID());
      const priceResult = await setInvoiceItemPricesAction({
        orderId,
        expectedVersion,
        clientEventId: priceClientEventId,
        prices,
      });
      if (priceResult.code !== "OK") {
        await fail(priceResult);
        return;
      }
      expectedVersion = priceResult.receipt.aggregateVersion;
      delete requests.current.invoicePrices;
    }
    const clientEventId = (requests.current.invoice ??= crypto.randomUUID());
    const result = await issueInvoiceAction({
      orderId,
      expectedVersion,
      clientEventId,
    });
    if (result.code !== "OK") {
      if (prices.length > 0) await load(true);
      await fail(result);
      return;
    }
    const [receipt, fresh] = await Promise.all([
      getInvoiceReceiptAction({ orderId, clientEventId }),
      load(true),
    ]);
    const confirmed =
      result.receipt.eventSchemaVersion === 1
        ? receipt.code === "OK" &&
          receipt.data?.eventId === result.receipt.eventId
        : fresh?.payment?.invoiceState === "issued" &&
          fresh.payment.payment?.invoiceId === result.receipt.invoiceId;
    if (!confirmed) {
      setFeedback({
        kind: "error",
        message:
          "Die Rechnung konnte nicht sicher bestätigt werden. Bitte den Auftragsstand neu laden.",
      });
      return;
    }
    success(
      "invoice",
      {
        actorId: result.receipt.issuedBy,
        occurredAt: result.receipt.issuedAt,
        eventId: result.receipt.eventId,
        receiptId: `invoice://${result.receipt.invoiceId}/${result.receipt.aggregateVersion}`,
      },
      `Rechnung ${result.receipt.invoiceNumber} wurde unveränderlich ausgestellt.`,
    );
  }, [fail, load, orderId, snapshot, success]);
  const onConfirmPayment = useCallback(
    async (method: "bar" | "ueberweisung" | "karte") => {
      const invoice = snapshot?.payment?.payment;
      if (!invoice || invoice.openAmountCents <= 0) return;
      setFeedback({
        kind: "submitting",
        message: "Zahlung wird sicher bestätigt.",
      });
      const clientEventId = (requests.current.payment ??= crypto.randomUUID());
      const result = await confirmPaymentAction({
        invoiceId: invoice.invoiceId,
        amount: invoice.openAmountCents,
        method,
        expectedVersion: invoice.paymentVersion,
        clientEventId,
      });
      if (result.code !== "OK") {
        await fail(result);
        return;
      }
      const fresh = await load(true);
      const persisted = fresh?.payment?.payment;
      if (
        !persisted ||
        persisted.eventId !== result.receipt.eventId ||
        persisted.receiptId !== result.receipt.receiptId ||
        persisted.paymentVersion !== result.receipt.paymentVersion
      ) {
        setFeedback({
          kind: "error",
          message:
            "Die Zahlung konnte nicht sicher bestätigt werden. Bitte den Zahlungsstand neu laden.",
        });
        return;
      }
      success(
        "payment",
        {
          actorId: result.receipt.confirmedBy,
          occurredAt: result.receipt.confirmedAt,
          eventId: result.receipt.eventId,
          receiptId: result.receipt.receiptId,
        },
        "Zahlung wurde sicher bestätigt.",
      );
    },
    [fail, load, snapshot, success],
  );
  const onRecordGoodsOut = useCallback(
    async (mode: "versand" | "abholung") => {
      if (!snapshot) return;
      setFeedback({
        kind: "submitting",
        message: "Warenausgang wird sicher gebucht.",
      });
      const clientEventId = (requests.current.goodsOut ??= crypto.randomUUID());
      const result = await recordGoodsOutAction({
        orderId,
        expectedVersion: snapshot.card.version,
        mode,
        clientEventId,
      });
      if (result.code !== "OK") {
        await fail(result);
        return;
      }
      const fresh = await load(true);
      if (
        fresh?.card.station !== "abgeholt" ||
        fresh.card.version !== result.receipt.orderVersion ||
        fresh.payment?.goodsOut?.eventId !== result.receipt.eventId
      ) {
        setFeedback({
          kind: "error",
          message:
            "Der Warenausgang konnte nicht sicher bestätigt werden. Bitte den Auftragsstand neu laden.",
        });
        return;
      }
      success(
        "goods-out",
        {
          actorId: result.receipt.actorId,
          occurredAt: result.receipt.occurredAt,
          eventId: result.receipt.eventId,
          receiptId: `goods-out://${orderId}/${result.receipt.orderVersion}`,
        },
        "Warenausgang wurde sicher bestätigt.",
      );
    },
    [fail, load, orderId, snapshot, success],
  );
  const onSaveContent = useCallback(async (input: Parameters<NonNullable<OrderCardActionPorts["onSaveContent"]>>[0]) => {
    if (!snapshot) return;
    setFeedback({ kind: "submitting", message: "Auftragsinhalt wird sicher gespeichert." });
    const clientEventId = (requests.current.content ??= crypto.randomUUID());
    const result = await changeOrderContentAction({ orderId, expectedVersion: snapshot.card.version, clientEventId, ...input });
    if (result.code !== "OK") { await fail(result); return; }
    const fresh = await load(true);
    if (fresh?.card.version !== result.receipt.aggregateVersion) {
      setFeedback({ kind: "error", message: "Die Änderung konnte nicht sicher bestätigt werden. Bitte neu laden." });
      return;
    }
    delete requests.current.content;
    success("content", { ...result.receipt, receiptId: `order-content://${orderId}/${result.receipt.aggregateVersion}` }, "Auftragsinhalt wurde gespeichert.");
  }, [fail, load, orderId, snapshot, success]);
  const onToggleItemFinished = useCallback(async (itemId: string, finished: boolean) => {
    if (!snapshot) return;
    setFeedback({ kind: "submitting", message: finished ? "Teil wird fertig gemeldet." : "Teil wird wieder geöffnet." });
    const key = `item:${itemId}:${finished}`;
    const clientEventId = (requests.current[key] ??= crypto.randomUUID());
    const result = await setOrderItemFinishedAction({ orderId, itemId, expectedVersion: snapshot.card.version, clientEventId, finished });
    if (result.code !== "OK") { await fail(result); return; }
    const fresh = await load(true);
    if (fresh?.card.version !== result.receipt.aggregateVersion) {
      setFeedback({ kind: "error", message: "Der Teilstatus konnte nicht sicher bestätigt werden. Bitte neu laden." });
      return;
    }
    delete requests.current[key];
    success("item-finished", { ...result.receipt, receiptId: `order-item://${itemId}/${result.receipt.aggregateVersion}` }, finished ? "Teil ist fertig." : "Teil ist wieder offen.");
  }, [fail, load, orderId, snapshot, success]);
  const onDuplicate = useCallback(async () => {
    if (!snapshot?.card.dueAt) {
      setFeedback({ kind: "error", message: "Duplizieren benötigt einen bestätigten Liefertermin." });
      return;
    }
    const items = snapshot.card.items.map((item) => ({ catalogServiceId: item.catalogServiceId ?? null, name: item.name, quantity: item.quantity, material: item.material, surfaceRequested: item.surfaceRequested, unit: item.unit ?? null, unitPriceCents: item.unitPriceCents ?? null, vatRateBasisPoints: item.vatRateBasisPoints ?? null }));
    setFeedback({ kind: "submitting", message: "Auftrag wird als neuer Eingang dupliziert." });
    const clientEventId = (requests.current.duplicate ??= crypto.randomUUID());
    const result = await createOrderIntakeAction({
      clientEventId,
      customer: { mode: "EXISTING", customerId: snapshot.card.customerId },
      dueDate: snapshot.card.dueAt.slice(0, 10),
      handoverMode: "pickup",
      paymentMode: snapshot.payment?.mode ?? "vorkasse",
      note: snapshot.card.note,
      items,
    });
    if (result.code !== "OK") { await fail(result); return; }
    delete requests.current.duplicate;
    success("duplicate", { actorId: result.receipt.actorId, occurredAt: result.receipt.recordedAt, eventId: result.receipt.eventId, receiptId: result.receipt.receiptId }, `Auftrag wurde als ${result.receipt.orderNumber} dupliziert.`);
  }, [fail, snapshot, success]);
  const attachmentPorts = useMemo<OrderStationAttachmentPorts>(
    () => ({
      read: getGalvanikHandoffAttachmentsAction,
      reserve: reserveGalvanikHandoffAttachmentAction,
      finalize: finalizeGalvanikHandoffAttachmentAction,
      readOriginal: getGalvanikHandoffAttachmentOriginalAction,
      uploadSigned: uploadSignedOrderAttachment,
    }),
    [],
  );
  const attachmentVisible = snapshot?.card.station === "galvanik";
  const actions = useMemo<OrderCardActionPorts>(() => {
    const card = snapshot?.card;
    const payment = snapshot?.payment;
    const operate = hasPermission("perm_op_status");
    const finance = hasPermission("perm_view_prices");
    const goods = operate;
    const editDueDate = operate;
    const editContent = canAction("editOrderContent");
    const canConfirmPayment = canAction("confirmPayment");
    const canPhoto = hasPermission("perm_op_photos");
    const invoiceAfter =
      payment?.mode === "rechnung" &&
      payment.invoiceState === "not_issued" &&
      payment.physicalStatus === "abgeholt" &&
      payment.goodsOut?.eventSchemaVersion === 2;
    const invoiceReady =
      payment?.invoiceState === "not_issued"
      && Boolean(card?.freeze)
      && (card?.station === "fertig" || invoiceAfter);
    const paymentReady =
      payment?.invoiceState === "issued" &&
      Boolean(payment.payment && payment.payment.openAmountCents > 0);
    const goodsGate =
      payment?.mode === "rechnung" ||
      payment?.mode === "abholung" ||
      payment?.payment?.status === "bezahlt";
    return {
      content: availability(Boolean(card), editContent && !card?.freeze, !editContent ? "Ihre Rolle darf Auftragsinhalte nicht ändern." : card?.freeze ? "Der Auftrag ist bereits fertig gemeldet." : null),
      itemStatus: availability(Boolean(card), canPhoto && !card?.freeze, !canPhoto ? "Ihre Rolle darf den Teilstatus nicht ändern." : card?.freeze ? "Der Auftrag ist bereits fertig gemeldet." : null),
      contact: availability(Boolean(card?.customerPhone), Boolean(card?.customerPhone), card?.customerPhone ? null : "Keine Telefonnummer hinterlegt."),
      photo: availability(Boolean(card), canPhoto, canPhoto ? null : "Ihre Rolle darf keine Fotos oder Dokumente hinzufügen."),
      dueDate: availability(
        Boolean(card) && card?.station !== "abgeholt",
        editDueDate,
        editDueDate ? null : "Ihre Rolle darf den Liefertermin nicht ändern.",
      ),
      handoff: availability(
        card?.station === "angenommen",
        operate,
        operate ? null : "Ihre Rolle darf den Ortsübergang nicht auslösen.",
      ),
      evidence: availability(
        card?.station === "galvanik",
        operate,
        operate ? null : "Ihre Rolle darf keinen Zustandsbeleg hinzufügen.",
      ),
      freeze: availability(
        card?.station === "galvanik",
        operate && Boolean(snapshot?.master?.currentRate),
        !operate
          ? "Ihre Rolle darf den Abschluss nicht auslösen."
          : !snapshot?.master?.currentRate
            ? "Ein gültiger Stundensatz fehlt."
            : null,
      ),
      invoice: availability(
        invoiceReady,
        finance,
        finance ? null : "Ihre Rolle darf keine Rechnung ausstellen.",
      ),
      payment: availability(
        paymentReady,
        canConfirmPayment,
        canConfirmPayment ? null : "Ihre Rolle darf keine Zahlung bestätigen.",
      ),
      goodsOut: availability(
        card?.station === "fertig",
        goods && Boolean(goodsGate),
        !goods
          ? "Ihre Rolle darf keinen Warenausgang buchen."
          : !goodsGate
            ? "Der Zahlungsstand erlaubt den Warenausgang noch nicht."
            : null,
      ),
      feedback,
      onSaveContent,
      onToggleItemFinished,
      onOpenStatusMail: () => document.getElementById(`order-communication-${orderId}`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
      onCallCustomer: () => { if (card?.customerPhone) window.location.href = `tel:${card.customerPhone}`; },
      onOpenPhoto: () => document.getElementById(`order-documents-${orderId}`)?.querySelector<HTMLInputElement>('input[type="file"]')?.click(),
      onOpenDocument: () => document.getElementById(`order-documents-${orderId}`)?.querySelector<HTMLInputElement>('input[type="file"]')?.click(),
      onOpenQuote: () => { if (card) requestGlobalCreate({ intent: "QUOTE", prefill: { customerQuery: card.customerName } }); },
      onDuplicate,
      onChangeDueDate,
      onHandoff,
      onFreeze,
      onIssueInvoice,
      onConfirmPayment,
      onRecordGoodsOut,
      onReload: async () => {
        await load();
      },
    };
  }, [
    feedback,
    load,
    onConfirmPayment,
    onChangeDueDate,
    onDuplicate,
    onFreeze,
    onHandoff,
    onIssueInvoice,
    onRecordGoodsOut,
    onSaveContent,
    onToggleItemFinished,
    orderId,
    canAction,
    hasPermission,
    snapshot,
  ]);
  const close =
    onClose ?? (fallbackHref ? () => router.replace(fallbackHref) : storeClose);
  return (
    <OrderCardView
      state={state}
      actions={actions}
      attachmentPanel={
        state.kind === "data" && attachmentVisible ? (
          <OrderStationAttachmentPanel
            orderId={state.card.id}
            expectedVersion={state.card.version}
            items={state.card.items.map((item) => ({
              id: item.id,
              name: item.name,
            }))}
            ports={attachmentPorts}
          />
        ) : null
      }
      documentsPanel={state.kind === "data" ? <><div id={`order-documents-${state.card.id}`}><DomainAttachmentPanel targetType="ORDER" targetId={state.card.id} /></div><div id={`order-communication-${state.card.id}`}><CommunicationPanel targetType="ORDER" targetId={state.card.id} /></div></> : null}
      onOpenCustomer={onOpenCustomer ?? storeCustomer}
      onClose={close}
    />
  );
}
