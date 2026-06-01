"use client";

import { usePageView } from "@/hooks/usePageView";
import { useState } from "react";
import OrdersPage from "@/app/orders/page";
import CustomersPage from "@/app/customers/page";
import { trackUiEvent } from "@/lib/tracking/tracking";

export default function KundenAuftraegeWrapper() {
  usePageView();
  const [activeTab, setActiveTab] = useState<"orders" | "customers">("orders");

  return (
    <div className="flex flex-col h-full w-full relative">
      <div className="flex bg-white rounded-xl border border-neutral-gray-200 p-1 w-fit mb-6 shadow-sm z-10 sticky top-0">
        <button
          className={`px-6 py-2.5 text-sm font-bold rounded-lg transition-all ${
            activeTab === "orders" 
              ? "bg-navy-900 text-white shadow" 
              : "text-text-muted hover:bg-neutral-gray-100"
          }`}
          onClick={() => { 
            setActiveTab("orders"); 
            trackUiEvent("nav_click", { target: "kunden-auftraege-orders" }); 
          }}
        >
          Alle Aufträge
        </button>
        <button
          className={`px-6 py-2.5 text-sm font-bold rounded-lg transition-all ${
            activeTab === "customers" 
              ? "bg-navy-900 text-white shadow" 
              : "text-text-muted hover:bg-neutral-gray-100"
          }`}
          onClick={() => { 
            setActiveTab("customers"); 
            trackUiEvent("nav_click", { target: "kunden-auftraege-customers" }); 
          }}
        >
          Kundenkartei
        </button>
      </div>

      <div className="flex-1 w-full">
        {activeTab === "orders" ? <OrdersPage /> : <CustomersPage />}
      </div>
    </div>
  );
}
