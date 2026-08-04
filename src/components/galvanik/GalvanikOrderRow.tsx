"use client";

import { useState } from "react";
import { format } from "date-fns";
import { EntityDecisionOverlay } from "@/components/entities/EntityDecisionOverlay";
import { FocusOverlay } from "@/components/entities/FocusOverlay";
import { OrderFocusView } from "@/components/entities/OrderFocusView";
import { CustomerFocusView } from "@/components/entities/CustomerFocusView";
import type { OperationalOrder } from "@/lib/types/operationalOrder";
import { getUrgency } from "@/lib/orders/getUrgency";

interface GalvanikOrderRowProps {
  order: OperationalOrder;
}

export function GalvanikOrderRow({ order }: GalvanikOrderRowProps) {
  const [showDecision, setShowDecision] = useState(false);
  const [focusType, setFocusType] = useState<"order" | "customer" | null>(null);

  // Dringlichkeitslogik
  const urgencyLevel = getUrgency(order.dueDate);
  const due = order.dueDate ? new Date(order.dueDate) : null;

  const urgencyColors = {
    kritisch: "bg-danger-red",
    gefaehrdet: "bg-accent-orange",
    im_plan: "bg-success-green"
  };

  return (
    <>
      <div 
        onClick={() => setShowDecision(true)}
        className="flex items-center gap-4 bg-white border border-neutral-gray-100 rounded-2xl p-4 shadow-sm hover:border-neutral-gray-300 transition-colors cursor-pointer active:scale-[0.98]"
      >
        <div className={`w-3 h-3 rounded-full shrink-0 ${urgencyColors[urgencyLevel]}`} />
        
        <div className="flex-1 flex justify-between items-center min-w-0">
          <div className="flex items-center gap-4 truncate">
            <span className="font-bold text-navy-900 text-sm whitespace-nowrap">
              #{order.id.slice(0, 8).toUpperCase()}
            </span>
            <span className="text-sm text-text-muted truncate">
              {order.customerName || "Unbekannt"}
            </span>
          </div>
          
          <div className="text-xs font-bold text-navy-500 whitespace-nowrap shrink-0 ml-4">
            {due ? format(due, "dd.MM.yy") : "Kein Datum"}
          </div>
        </div>
      </div>

      {showDecision && (
        <EntityDecisionOverlay 
          onClose={() => setShowDecision(false)}
          onSelectOrder={() => {
            setShowDecision(false);
            setFocusType("order");
          }}
          onSelectCustomer={() => {
            setShowDecision(false);
            setFocusType("customer");
          }}
          customerName={order.customerName || "Kunde"}
          orderId={order.id}
        />
      )}

      {focusType && (
        <FocusOverlay isOpen={true} onClose={() => setFocusType(null)}>
          {focusType === "order" ? (
            <OrderFocusView order={order} onSave={async () => {}} onClose={() => setFocusType(null)} />
          ) : (
            <CustomerFocusView customer={{ id: order.customerId, name: order.customerName || "Kunde", type: "Privat", city: "", address: "", phone: "", email: "", prefComm: "E-Mail", risk: "Niedrig", notes: "", priceAgreements: [], orders: [], feedbacks: [] }} onSave={async () => {}} onClose={() => setFocusType(null)} />
          )}
        </FocusOverlay>
      )}
    </>
  );
}
