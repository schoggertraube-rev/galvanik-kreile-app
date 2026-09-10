"use client";

import React from "react";
import { useOrderModal } from "@/components/entities/order-legacy/OrderModalProvider";

interface OrderModalTriggerProps {
  orderId: string;
  className?: string;
  children: React.ReactNode;
}

export function OrderModalTrigger({ orderId, className, children }: OrderModalTriggerProps) {
  const { openOrder } = useOrderModal();
  
  return (
    <button 
      onClick={(e) => {
        e.preventDefault();
        openOrder(orderId);
      }}
      className={className || "hover:underline"}
    >
      {children}
    </button>
  );
}
