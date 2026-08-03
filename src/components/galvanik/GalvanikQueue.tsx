"use client";

import { useState, useMemo } from "react";
import { Order } from "@/lib/repositories/ordersRepository";
import { GalvanikOrderRow } from "./GalvanikOrderRow";
import { getUrgency } from "@/lib/orders/getUrgency";
import { ArrowUpDown, Users } from "lucide-react";

interface GalvanikQueueProps {
  orders: Order[];
}

type SortMode = "dueDate" | "customer";

export function GalvanikQueue({ orders }: GalvanikQueueProps) {
  const [sortMode, setSortMode] = useState<SortMode>("dueDate");
  const [search, setSearch] = useState("");

  const filteredOrders = useMemo(() => {
    if (!search) return orders;
    const lower = search.toLowerCase();
    return orders.filter(o => 
      o.id.toLowerCase().includes(lower) || 
      (o.customerName && o.customerName.toLowerCase().includes(lower))
    );
  }, [orders, search]);

  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      if (sortMode === "dueDate") {
        // Sort: critical -> warning -> ok, dann nach Datum aufsteigend
        const getUrgencyScore = (o: Order) => {
          const u = getUrgency(o.dueDate);
          return { "kritisch": 1, "gefaehrdet": 2, "im_plan": 3 }[u] || 3;
        };

        const urgA = getUrgencyScore(a);
        const urgB = getUrgencyScore(b);
        if (urgA !== urgB) return urgA - urgB;

        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      } else {
        // Sort: nach Kunde, dann Datum
        const custA = a.customerName || "";
        const custB = b.customerName || "";
        if (custA !== custB) return custA.localeCompare(custB);

        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
    });
  }, [filteredOrders, sortMode]);

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto">
      {/* Header Info */}
      <div className="flex items-center justify-between text-xs text-text-muted font-semibold px-1">
        <span>{filteredOrders.length} Aufträge in der Galvanik</span>
        <span>Minimalansicht (Nach Dringlichkeit)</span>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-2xl border border-neutral-gray-100 shadow-sm">
        <input 
          type="text"
          placeholder="Suchen nach Kunde oder ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-bg-app-soft border-2 border-neutral-gray-200 rounded-xl px-4 h-12 text-sm font-semibold outline-none focus:border-navy-700 transition-colors"
        />
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSortMode("dueDate")}
            className={`flex items-center gap-2 h-12 px-5 rounded-xl text-sm font-bold transition-all active:scale-95 ${
              sortMode === "dueDate" 
                ? "bg-navy-900 text-white shadow-md" 
                : "bg-white border-2 border-neutral-gray-200 text-text-muted hover:border-navy-700 hover:text-navy-900"
            }`}
          >
            <ArrowUpDown className="w-4 h-4" />
            Fälligkeit
          </button>
          
          <button
            onClick={() => setSortMode("customer")}
            className={`flex items-center gap-2 h-12 px-5 rounded-xl text-sm font-bold transition-all active:scale-95 ${
              sortMode === "customer" 
                ? "bg-navy-900 text-white shadow-md" 
                : "bg-white border-2 border-neutral-gray-200 text-text-muted hover:border-navy-700 hover:text-navy-900"
            }`}
          >
            <Users className="w-4 h-4" />
            Kunde
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex flex-col gap-3">
        {sortedOrders.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-neutral-gray-100 shadow-sm text-text-muted text-sm font-medium">
            Keine Aufträge in der Galvanik gefunden.
          </div>
        ) : sortMode === "customer" ? (
          Object.entries(
            sortedOrders.reduce((acc, order) => {
              const cust = order.customerName || "Unbekannt";
              if (!acc[cust]) acc[cust] = [];
              acc[cust].push(order);
              return acc;
            }, {} as Record<string, Order[]>)
          ).map(([customer, custOrders]) => (
            <div key={customer} className="space-y-3 mb-4">
              <h3 className="font-bold text-lg text-navy-900 border-b-2 border-neutral-gray-100 pb-2 pl-2">{customer}</h3>
              <div className="flex flex-col gap-3">
                {custOrders.map(order => (
                  <GalvanikOrderRow key={order.id} order={order} />
                ))}
              </div>
            </div>
          ))
        ) : (
          sortedOrders.map(order => (
            <GalvanikOrderRow key={order.id} order={order} />
          ))
        )}
      </div>
    </div>
  );
}
