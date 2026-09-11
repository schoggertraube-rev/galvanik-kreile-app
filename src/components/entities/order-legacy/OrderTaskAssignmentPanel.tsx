"use client";

import { useRef, useState } from "react";
import {
  assignOrderTaskAction,
  getLiveOrderCardAction,
  getOrderTaskAssignmentReceiptAction,
  handBackOrderTaskAction,
} from "@/app/actions/orders.actions";
import type { OrderTaskAssignmentReceipt } from "@/lib/server/commands/orderTaskAssignmentCommand";
import type { LiveOrderCard } from "@/lib/server/orderCardRead";

type Props = {
  order: LiveOrderCard;
  role: string | null;
  onConfirmedCard: (card: LiveOrderCard) => void;
};

function sameReceipt(
  left: OrderTaskAssignmentReceipt,
  right: OrderTaskAssignmentReceipt,
): boolean {
  return left.eventId === right.eventId
    && left.eventType === right.eventType
    && left.clientEventId === right.clientEventId
    && left.correlationId === right.correlationId
    && left.eventSchemaVersion === right.eventSchemaVersion
    && left.orderId === right.orderId
    && left.aggregateVersion === right.aggregateVersion
    && left.station === right.station
    && left.actorId === right.actorId
    && left.occurredAt === right.occurredAt
    && left.assignmentStateId === right.assignmentStateId
    && left.assignedTo === right.assignedTo;
}

function dateLabel(value: string | null): string {
  if (!value) return "ohne Termin";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(date)
    : "Termin nicht verfügbar";
}

export function OrderTaskAssignmentPanel({ order, role, onConfirmedCard }: Props) {
  const canAssign = role === "meister" || role === "admin";
  const [assigneeUserId, setAssigneeUserId] = useState(
    order.assignment?.active ? order.assignment.assignedTo : order.assignmentOptions[0]?.userId ?? "",
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const stableRequest = useRef<{ key: string; clientEventId: string } | null>(null);

  function requestId(key: string): string {
    if (stableRequest.current?.key !== key) {
      stableRequest.current = { key, clientEventId: globalThis.crypto.randomUUID() };
    }
    return stableRequest.current.clientEventId;
  }

  async function confirm(
    eventType: OrderTaskAssignmentReceipt["eventType"],
    clientEventId: string,
    commandReceipt: OrderTaskAssignmentReceipt,
  ) {
    const [receiptRead, cardRead] = await Promise.all([
      getOrderTaskAssignmentReceiptAction({ orderId: order.id, clientEventId }),
      getLiveOrderCardAction({ orderId: order.id }),
    ]);
    const assignment = cardRead.code === "OK" ? cardRead.data.card.assignment : null;
    const stateMatches = eventType === "ORDER_TASK_ASSIGNED_V1"
      ? assignment?.active === true
        && assignment.assignmentStateId === commandReceipt.assignmentStateId
        && assignment.assignedTo === commandReceipt.assignedTo
        && assignment.assignmentVersion === commandReceipt.aggregateVersion
      : assignment?.active === false
        && assignment.assignmentStateId === commandReceipt.assignmentStateId
        && assignment.assignedTo === commandReceipt.assignedTo
        && assignment.assignmentVersion === commandReceipt.aggregateVersion;
    if (
      receiptRead.code !== "OK"
      || !receiptRead.data
      || !sameReceipt(commandReceipt, receiptRead.data)
      || cardRead.code !== "OK"
      || cardRead.data.card.version !== commandReceipt.aggregateVersion
      || !stateMatches
    ) throw new Error("ORDER_TASK_CONFIRMATION_FAILED");
    stableRequest.current = null;
    onConfirmedCard(cardRead.data.card);
  }

  async function assign() {
    if (pending || !canAssign || !assigneeUserId) return;
    const key = JSON.stringify({ action: "assign", version: order.version, assigneeUserId });
    const clientEventId = requestId(key);
    setPending(true);
    setMessage(null);
    try {
      const command = await assignOrderTaskAction({
        orderId: order.id,
        assigneeUserId,
        expectedVersion: order.version,
        clientEventId,
      });
      if (command.code !== "OK") {
        setMessage(command.message);
        return;
      }
      await confirm(command.receipt.eventType, clientEventId, command.receipt);
      setMessage("Zuweisung und gemeinsamer Readback bestätigt.");
    } catch {
      setMessage("Zuweisung wurde nicht sicher bestätigt; Auftragskarte neu laden.");
    } finally {
      setPending(false);
    }
  }

  async function handBack() {
    if (pending || !order.assignment?.isAssignedToCurrentUser || !order.assignment.active) return;
    const key = JSON.stringify({ action: "handback", version: order.version });
    const clientEventId = requestId(key);
    setPending(true);
    setMessage(null);
    try {
      const command = await handBackOrderTaskAction({
        orderId: order.id,
        expectedVersion: order.version,
        clientEventId,
      });
      if (command.code !== "OK") {
        setMessage(command.message);
        return;
      }
      await confirm(command.receipt.eventType, clientEventId, command.receipt);
      setMessage("Rückgabe und gemeinsamer Readback bestätigt.");
    } catch {
      setMessage("Rückgabe wurde nicht sicher bestätigt; Auftragskarte neu laden.");
    } finally {
      setPending(false);
    }
  }

  const assignment = order.assignment;
  return (
    <section aria-label="Aufgabenzuweisung" className="rounded-xl border border-neutral-gray-200 bg-bg-app-soft p-4" data-testid="order-task-assignment-panel">
      <h3 className="text-sm font-semibold text-navy-900">Aufgabenzuweisung</h3>
      {assignment?.active ? (
        <div className="mt-2 rounded-lg border border-neutral-gray-200 bg-white p-3">
          <p className="text-sm font-semibold text-navy-900">
            {assignment.isAssignedToCurrentUser
              ? `Von ${assignment.assignedByName} · wartet auf dich`
              : `Bei ${assignment.assignedToName} · seit ${dateLabel(assignment.assignedAt)}`}
          </p>
          <p className="mt-1 text-xs text-text-muted">Frist: {dateLabel(assignment.dueAt)}</p>
          {assignment.isAssignedToCurrentUser ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => void handBack()}
              className="mt-3 min-h-10 rounded-lg border border-navy-900 bg-white px-4 text-xs font-semibold text-navy-900 disabled:opacity-50"
            >
              {pending ? "Rückgabe wird geprüft…" : "Aufgabe zurückgeben"}
            </button>
          ) : null}
        </div>
      ) : assignment ? (
        <p className="mt-2 text-sm text-text-muted">
          Von {assignment.handedBackByName ?? assignment.assignedToName} zurückgegeben.
        </p>
      ) : (
        <p className="mt-2 text-sm text-text-muted">Noch niemandem zugewiesen.</p>
      )}

      {canAssign ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex-1 text-xs font-semibold text-text-muted">
            Zuständige Person
            <select
              aria-label="Zuständige Person"
              value={assigneeUserId}
              disabled={pending || order.assignmentOptions.length === 0}
              onChange={(event) => setAssigneeUserId(event.target.value)}
              className="mt-1 min-h-10 w-full rounded-lg border border-neutral-gray-200 bg-white px-3 text-sm text-navy-900"
            >
              {order.assignmentOptions.map((option) => (
                <option key={option.userId} value={option.userId}>
                  {option.fullName} · {option.role}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={pending || !assigneeUserId || order.assignmentOptions.length === 0}
            onClick={() => void assign()}
            className="min-h-10 rounded-lg bg-navy-900 px-4 text-xs font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Zuweisung wird geprüft…" : assignment?.active ? "Neu zuweisen" : "Zuweisen"}
          </button>
        </div>
      ) : null}
      {message ? <p className="mt-2 text-xs text-text-muted" role="status">{message}</p> : null}
    </section>
  );
}
