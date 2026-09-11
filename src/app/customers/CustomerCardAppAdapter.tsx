"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCustomerSummaryAction } from "@/app/actions/customers.actions";
import { CustomerCardView, type CustomerCardState } from "@/modules/customers/public";
import { useOverlayStore } from "@/lib/overlayStore";

export function CustomerCardAppAdapter({ customerId, onOpenOrder, onClose, fallbackHref }: { customerId: string; onOpenOrder?: (orderId: string) => void; onClose?: () => void; fallbackHref?: "/customers" }) {
  const router = useRouter();
  const storeOpenOrder = useOverlayStore((state) => state.openOrder);
  const storeClose = useOverlayStore((state) => state.pop);
  const [state, setState] = useState<CustomerCardState>({ kind: "loading" });
  useEffect(() => {
    let active = true;
    void getCustomerSummaryAction({ customerId }).then((result) => {
      if (!active) return;
      if (result.code !== "OK") {
        const kind = result.code === "FORBIDDEN" || result.code === "UNAUTHENTICATED" ? "denied" : result.code === "NOT_FOUND" ? "not-found" : result.code === "VALIDATION_ERROR" ? "conflict" : "error";
        setState({ kind, message: result.message });
        return;
      }
      const card = result.data;
      setState({ kind: "data", card: {
        id: card.id, customerNumber: card.customerNumber, name: card.name, companyName: card.companyName, type: card.type,
        contactPerson: card.contactPerson, email: card.email, phone: card.phone, address: card.street ?? card.address,
        zipCode: card.zipCode, city: card.city, country: card.country, classification: card.classification, notes: card.internalNotes,
        tags: card.tags, createdAt: card.createdAt, updatedAt: card.updatedAt, orderCount: card.orderCount,
        wareImHausCount: card.wareImHausCount, orders: card.orders,
      } });
    }).catch(() => { if (active) setState({ kind: "error", message: "Kundenkarte konnte nicht sicher geladen werden." }); });
    return () => { active = false; };
  }, [customerId]);
  const close = onClose ?? (fallbackHref ? () => router.replace(fallbackHref) : storeClose);
  return <CustomerCardView state={state} onOpenOrder={onOpenOrder ?? storeOpenOrder} onClose={close} />;
}
