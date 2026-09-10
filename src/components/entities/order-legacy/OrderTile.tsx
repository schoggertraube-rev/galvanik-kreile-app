"use client";

import React from "react";
import { useOverlayStore } from "@/lib/overlayStore";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { OperationalOrder } from "@/lib/types/operationalOrder";

interface OrderTileProps {
  order: Pick<OperationalOrder, "id" | "orderNumber" | "station" | "title" | "task" | "dueDate" | "risk" | "status"> | null | undefined;
  className?: string;
}

export function OrderTile({ order, className = "" }: OrderTileProps) {
  const pushOrder = useOverlayStore(state => state.pushOrder);

  if (!order) return <div className="p-4 text-center text-gray-500">Noch keine Daten erfasst</div>;

  return (
    <Card 
      onClick={() => pushOrder(order.id)}
      className={`cursor-pointer hover:shadow-md transition-shadow border-[var(--ci-border)] bg-[var(--ci-surface)] ${className}`}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-serif font-bold text-lg text-[var(--ci-ink)]">{order.orderNumber}</span>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider bg-[var(--ci-surface-soft)] text-[var(--ci-ink-2)] border-[var(--ci-border)]">
            {order.station}
          </Badge>
        </div>
        <div className="font-medium text-[var(--ci-ink)] text-sm line-clamp-2">
          {order.title || order.task || "Kein Titel"}
        </div>
        <div className="flex items-center justify-between text-xs text-[var(--ci-ink-3)] pt-2 border-t border-[var(--ci-border)]">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{order.dueDate ? new Date(order.dueDate).toLocaleDateString() : "-"}</span>
          </div>
          {order.risk === 'red' ? (
             <AlertTriangle className="w-3 h-3 text-[var(--ci-danger)]" />
          ) : order.status === 'done' ? (
             <CheckCircle2 className="w-3 h-3 text-[var(--ci-success)]" />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
