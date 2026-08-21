"use client";

import { useRef, useState } from "react";
import {
  changeOrderItemExtraWorkAction,
  getLiveOrderCardAction,
  getOrderItemExtraWorkReceiptAction,
} from "@/app/actions/orders.actions";
import type {
  ExtraWorkMasterData,
  LiveOrderCard,
  OrderCardExtraWork,
  OrderCardItem,
} from "@/lib/server/orderCardRead";
import type { OrderItemExtraWorkReceipt } from "@/lib/server/commands/orderExtraWorkCommand";

type Props = {
  order: LiveOrderCard;
  item: OrderCardItem;
  masterData: ExtraWorkMasterData;
  onConfirmedCard: (card: LiveOrderCard) => void;
};

function sameReceipt(left: OrderItemExtraWorkReceipt, right: OrderItemExtraWorkReceipt): boolean {
  return left.eventId === right.eventId
    && left.clientEventId === right.clientEventId
    && left.correlationId === right.correlationId
    && left.eventSchemaVersion === right.eventSchemaVersion
    && left.orderId === right.orderId
    && left.itemId === right.itemId
    && left.lineId === right.lineId
    && left.catalogPositionId === right.catalogPositionId
    && left.minutes === right.minutes
    && left.active === right.active
    && left.lineVersion === right.lineVersion
    && left.aggregateVersion === right.aggregateVersion
    && left.actorId === right.actorId
    && left.occurredAt === right.occurredAt;
}

function ExtraWorkLineEditor({
  order,
  item,
  line,
  onConfirmedCard,
}: {
  order: LiveOrderCard;
  item: OrderCardItem;
  line: OrderCardExtraWork;
  onConfirmedCard: (card: LiveOrderCard) => void;
}) {
  const [minutes, setMinutes] = useState(String(line.minutes));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const stableRequest = useRef<{ key: string; clientEventId: string } | null>(null);

  function requestId(key: string): string {
    if (stableRequest.current?.key !== key) {
      stableRequest.current = { key, clientEventId: globalThis.crypto.randomUUID() };
    }
    return stableRequest.current.clientEventId;
  }

  async function persist(active: boolean) {
    if (pending) return;
    const parsedMinutes = Number(minutes);
    if (!Number.isSafeInteger(parsedMinutes) || parsedMinutes < 1 || parsedMinutes > 1440) {
      setMessage("Zeit muss zwischen 1 und 1440 Minuten liegen.");
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const key = JSON.stringify({
        orderVersion: order.version,
        lineVersion: line.lineVersion,
        lineId: line.lineId,
        minutes: parsedMinutes,
        active,
      });
      const clientEventId = requestId(key);
      const command = await changeOrderItemExtraWorkAction({
        lineId: line.lineId,
        orderId: order.id,
        itemId: item.id,
        catalogPositionId: line.catalogPositionId,
        minutes: parsedMinutes,
        active,
        expectedLineVersion: line.lineVersion,
        expectedOrderVersion: order.version,
        clientEventId,
      });
      if (command.code !== "OK") {
        setMessage(command.message);
        return;
      }
      const [receiptRead, cardRead] = await Promise.all([
        getOrderItemExtraWorkReceiptAction({ orderId: order.id, clientEventId }),
        getLiveOrderCardAction({ orderId: order.id }),
      ]);
      if (
        receiptRead.code !== "OK"
        || !receiptRead.data
        || !sameReceipt(command.receipt, receiptRead.data)
        || cardRead.code !== "OK"
        || cardRead.data.card.version !== command.receipt.aggregateVersion
      ) {
        setMessage("Mehrarbeit wurde nicht bestätigt; Auftragskarte neu laden.");
        return;
      }
      const nextItem = cardRead.data.card.items.find((candidate) => candidate.id === item.id);
      const nextLine = nextItem?.extraWork.find((candidate) => candidate.lineId === line.lineId);
      if ((active && (
        nextLine?.lineVersion !== command.receipt.lineVersion
        || nextLine.minutes !== command.receipt.minutes
      )) || (!active && nextLine !== undefined)) {
        setMessage("Mehrarbeit wurde nicht bestätigt; Auftragskarte neu laden.");
        return;
      }
      stableRequest.current = null;
      onConfirmedCard(cardRead.data.card);
      setMessage(active ? "Mehrarbeit bestätigt." : "Mehrarbeit entfernt und bestätigt.");
    } catch {
      setMessage("Mehrarbeit ist derzeit nicht verfügbar.");
    } finally {
      setPending(false);
    }
  }

  return (
    <li className="grid gap-2 rounded-xl border border-neutral-gray-200 bg-white p-3 md:grid-cols-[1fr_110px_auto] md:items-end" data-testid="order-extra-work-line">
      <div>
        <p className="text-sm font-semibold text-navy-900">{line.catalogPositionName}</p>
        <p className="text-xs text-text-muted">
          {(line.hourlyRateCents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}/h ·{" "}
          {(line.amountCents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
        </p>
      </div>
      <label className="text-xs font-semibold text-text-muted">
        Minuten
        <input
          aria-label={`Minuten für ${line.catalogPositionName}`}
          type="number"
          min={1}
          max={1440}
          value={minutes}
          disabled={pending}
          onChange={(event) => setMinutes(event.target.value)}
          className="mt-1 min-h-10 w-full rounded-lg border border-neutral-gray-200 px-3 text-sm text-navy-900"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending || Number(minutes) === line.minutes}
          onClick={() => void persist(true)}
          className="min-h-10 rounded-lg bg-navy-900 px-3 text-xs font-semibold text-white disabled:opacity-50"
        >
          Speichern
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => void persist(false)}
          className="min-h-10 rounded-lg border border-[#c0392b]/40 px-3 text-xs font-semibold text-[#c0392b] disabled:opacity-50"
        >
          Entfernen
        </button>
      </div>
      {message ? <p className="text-xs text-text-muted md:col-span-3" role="status">{message}</p> : null}
    </li>
  );
}

export function OrderExtraWorkEditor({ order, item, masterData, onConfirmedCard }: Props) {
  const activeCatalog = masterData.catalog.filter((position) => position.active);
  const usedCatalogIds = new Set(item.extraWork.map((line) => line.catalogPositionId));
  const availableCatalog = activeCatalog.filter((position) => !usedCatalogIds.has(position.id));
  const [catalogId, setCatalogId] = useState(availableCatalog[0]?.id ?? "");
  const selectedCatalog = availableCatalog.find((position) => position.id === catalogId) ?? availableCatalog[0];
  const [minutes, setMinutes] = useState(String(selectedCatalog?.standardMinutes ?? 1));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const stableRequest = useRef<{
    key: string;
    lineId: string;
    clientEventId: string;
  } | null>(null);

  async function addLine() {
    if (pending || !selectedCatalog) return;
    const parsedMinutes = Number(minutes);
    if (!Number.isSafeInteger(parsedMinutes) || parsedMinutes < 1 || parsedMinutes > 1440) {
      setMessage("Zeit muss zwischen 1 und 1440 Minuten liegen.");
      return;
    }
    const key = JSON.stringify({
      orderVersion: order.version,
      itemId: item.id,
      catalogId: selectedCatalog.id,
      minutes: parsedMinutes,
    });
    if (stableRequest.current?.key !== key) {
      stableRequest.current = {
        key,
        lineId: globalThis.crypto.randomUUID(),
        clientEventId: globalThis.crypto.randomUUID(),
      };
    }
    const request = stableRequest.current;
    setPending(true);
    setMessage(null);
    try {
      const command = await changeOrderItemExtraWorkAction({
        lineId: request.lineId,
        orderId: order.id,
        itemId: item.id,
        catalogPositionId: selectedCatalog.id,
        minutes: parsedMinutes,
        active: true,
        expectedLineVersion: 0,
        expectedOrderVersion: order.version,
        clientEventId: request.clientEventId,
      });
      if (command.code !== "OK") {
        setMessage(command.message);
        return;
      }
      const [receiptRead, cardRead] = await Promise.all([
        getOrderItemExtraWorkReceiptAction({ orderId: order.id, clientEventId: request.clientEventId }),
        getLiveOrderCardAction({ orderId: order.id }),
      ]);
      const nextLine = cardRead.code === "OK"
        ? cardRead.data.card.items.find((candidate) => candidate.id === item.id)?.extraWork
          .find((candidate) => candidate.lineId === request.lineId)
        : undefined;
      if (
        receiptRead.code !== "OK"
        || !receiptRead.data
        || !sameReceipt(command.receipt, receiptRead.data)
        || cardRead.code !== "OK"
        || cardRead.data.card.version !== command.receipt.aggregateVersion
        || nextLine?.lineVersion !== command.receipt.lineVersion
        || nextLine.minutes !== command.receipt.minutes
      ) {
        setMessage("Mehrarbeit wurde nicht bestätigt; Auftragskarte neu laden.");
        return;
      }
      stableRequest.current = null;
      const nextUsedCatalogIds = new Set(
        cardRead.data.card.items.find((candidate) => candidate.id === item.id)?.extraWork
          .map((candidate) => candidate.catalogPositionId) ?? [],
      );
      const nextCatalog = activeCatalog.find((position) => !nextUsedCatalogIds.has(position.id));
      setCatalogId(nextCatalog?.id ?? "");
      setMinutes(String(nextCatalog?.standardMinutes ?? 1));
      setMessage("Mehrarbeit bestätigt.");
      onConfirmedCard(cardRead.data.card);
    } catch {
      setMessage("Mehrarbeit ist derzeit nicht verfügbar.");
    } finally {
      setPending(false);
    }
  }

  if (order.freeze) {
    return (
      <ul className="space-y-2">
        {item.extraWork.length === 0 ? (
          <li className="text-xs text-text-muted">Keine Mehrarbeit eingefroren.</li>
        ) : item.extraWork.map((line) => (
          <li key={line.lineId} className="rounded-xl border border-neutral-gray-200 bg-white p-3 text-sm">
            <strong>{line.catalogPositionName}</strong> · {line.minutes} Min ·{" "}
            {(line.amountCents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-3">
      {item.extraWork.length > 0 ? (
        <ul className="space-y-2">
          {item.extraWork.map((line) => (
            <ExtraWorkLineEditor
              key={line.lineId}
              order={order}
              item={item}
              line={line}
              onConfirmedCard={onConfirmedCard}
            />
          ))}
        </ul>
      ) : <p className="text-xs text-text-muted">Noch keine Mehrarbeit erfasst.</p>}

      {masterData.currentRate === null ? (
        <p className="rounded-lg bg-[#fdf0ee] p-3 text-xs text-[#c0392b]" role="status">
          Stundensatz ist noch nicht konfiguriert.
        </p>
      ) : availableCatalog.length === 0 ? (
        <p className="text-xs text-text-muted">Keine weitere aktive Katalogposition verfügbar.</p>
      ) : (
        <div className="grid gap-2 rounded-xl border border-dashed border-neutral-gray-300 p-3 md:grid-cols-[1fr_110px_auto] md:items-end" data-testid="order-extra-work-add">
          <label className="text-xs font-semibold text-text-muted">
            Katalogposition
            <select
              value={selectedCatalog?.id ?? ""}
              disabled={pending}
              aria-label="Katalogposition"
              onChange={(event) => {
                const nextId = event.target.value;
                const next = availableCatalog.find((position) => position.id === nextId);
                setCatalogId(nextId);
                if (next) setMinutes(String(next.standardMinutes));
              }}
              className="mt-1 min-h-10 w-full rounded-lg border border-neutral-gray-200 bg-white px-3 text-sm text-navy-900"
            >
              {availableCatalog.map((position) => (
                <option key={position.id} value={position.id}>{position.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-text-muted">
            Minuten
            <input
              type="number"
              min={1}
              max={1440}
              value={minutes}
              disabled={pending}
              onChange={(event) => setMinutes(event.target.value)}
              className="mt-1 min-h-10 w-full rounded-lg border border-neutral-gray-200 px-3 text-sm text-navy-900"
            />
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={() => void addLine()}
            className="min-h-10 rounded-lg bg-navy-900 px-4 text-xs font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Prüfe…" : "Hinzufügen"}
          </button>
          {message ? <p className="text-xs text-text-muted md:col-span-3" role="status">{message}</p> : null}
        </div>
      )}
    </div>
  );
}
