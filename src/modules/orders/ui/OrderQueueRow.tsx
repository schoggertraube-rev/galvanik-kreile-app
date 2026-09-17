"use client";

import { ArrowRight } from "lucide-react";

export type OrderQueueRowModel = {
  id: string;
  orderNumber: string;
  customerName: string;
  title: string;
  detail: string | null;
  station: string;
  dueLabel: string;
  risk: string;
};

export function OrderQueueRow({
  order,
  onOpen,
}: {
  order: OrderQueueRowModel;
  onOpen: (orderId: string) => void;
}) {
  return (
    <button
      type="button"
      data-order-id={order.id}
      data-risk={order.risk}
      onClick={() => onOpen(order.id)}
      className="flex min-h-16 w-full min-w-0 max-w-full items-center gap-3 rounded-[14px] border border-[#d8d0c4] bg-white px-4 py-3 text-left transition hover:border-[#c8922a] hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a6b38]"
    >
      <span className="min-w-0 flex-1">
        <small className="block font-mono text-[11px] font-bold text-[#5e5850]">
          {order.orderNumber}
        </small>
        <strong className="block truncate text-sm text-[#1a1a1a]">
          {order.customerName}
        </strong>
        <span className="block truncate text-xs text-[#5e5850]">
          {order.title}
        </span>
        {order.detail ? (
          <span className="block truncate text-[11px] text-[#7a7369]">
            {order.detail}
          </span>
        ) : null}
      </span>
      <span className="min-w-0 max-w-[42%] shrink text-right">
        <b className="block truncate text-xs text-[#1a6b38]">
          {order.station}
        </b>
        <small className="block truncate text-[11px] text-[#5e5850]">
          {order.dueLabel}
        </small>
      </span>
      <ArrowRight
        className="h-5 w-5 shrink-0 text-[#c8922a]"
        aria-hidden="true"
      />
    </button>
  );
}
