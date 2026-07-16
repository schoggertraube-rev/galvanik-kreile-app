"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import type { Order } from "@/lib/repositories/ordersRepository";

export function OrderProfitabilityCard({ order }: { order: Order }) {
  return (
    <div className="bg-white border-2 border-neutral-gray-300 rounded-3xl p-6 md:p-8 shadow-sm">
      <div className="flex justify-between items-center mb-6 border-b border-neutral-gray-100 pb-4">
        <h3 className="text-sm font-extrabold text-navy-500 uppercase tracking-widest pl-1">Wirtschaftlichkeit</h3>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
          Nicht berechenbar
        </span>
      </div>
      <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-xl flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="block mb-1">Keine fingierte Kalkulation für {order.orderNumber}.</strong>
          Ein belastbarer Auftragsergebnis-Snapshot benötigt bestätigten Nettoerlös sowie vollständige Zeit-, Material-, Bad-, Energie- und Gemeinkostenbelege. Solange diese Quellen nicht gemeinsam versioniert vorliegen, werden weder Marge noch Profitabilitätsstatus angezeigt.
        </p>
      </div>
    </div>
  );
}
