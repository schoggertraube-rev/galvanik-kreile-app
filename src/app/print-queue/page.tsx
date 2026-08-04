"use client";

import { usePageView } from "@/hooks/usePageView";
import { useState, useEffect } from "react";
import { Printer, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ordersRepository, type Order } from "@/lib/repositories/ordersRepository";
import { BulkLabelPrintView } from "@/components/orders/BulkLabelPrintView";

export default function PrintQueuePage() {
  usePageView();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBulkPrint, setShowBulkPrint] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadOrders() {
      try {
        const allOrders = await ordersRepository.getAll();
        // Assume unprinted orders are 'new' or 'in_progress' in wareneingang
        const unprinted = allOrders.filter(o => 
          (o.status === "new" || o.status === "in_progress") && 
          o.station === "wareneingang"
        );
        // Sort newest first
        // unprinted.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setOrders(unprinted);
        // Pre-select all
        setSelectedIds(new Set(unprinted.map(o => o.id)));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadOrders();
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePrintComplete = () => {
    setShowBulkPrint(false);
    // Ideally we would mark them as printed in DB, here we just remove them from UI
    setOrders(prev => prev.filter(o => !selectedIds.has(o.id)));
    setSelectedIds(new Set());
  };

  if (loading) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-navy-500" />
      </div>
    );
  }

  const selectedOrders = orders.filter(o => selectedIds.has(o.id));

  return (
    <div className="flex-1 p-8 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-navy-900 tracking-tight">Druck-Warteschlange</h1>
          <p className="text-text-muted mt-2">Drucken Sie Etiketten für neu eingegangene Aufträge im Stapel.</p>
        </div>
        <Button 
          disabled={selectedIds.size === 0}
          onClick={() => setShowBulkPrint(true)}
          className="h-14 px-8 rounded-2xl bg-gold-600 hover:bg-gold-500 text-navy-900 font-black shadow-lg shadow-gold-600/20 active:scale-95 transition-all flex gap-3 text-lg"
        >
          <Printer className="w-6 h-6" />
          {selectedIds.size} Etiketten drucken
        </Button>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-3xl border border-neutral-gray-100 p-16 text-center shadow-sm">
          <div className="w-24 h-24 bg-bg-app-soft rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-12 h-12 text-success-green" />
          </div>
          <h2 className="text-2xl font-bold text-navy-900 mb-2">Alles erledigt!</h2>
          <p className="text-text-muted text-lg">Es gibt aktuell keine neuen Aufträge, für die ein Etikett gedruckt werden muss.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-neutral-gray-100 shadow-sm overflow-hidden">
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-neutral-gray-100 bg-bg-app-soft text-xs font-bold text-text-muted uppercase tracking-wider">
            <div className="col-span-1 text-center">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded border-gray-300 accent-gold-600 cursor-pointer"
                checked={selectedIds.size === orders.length && orders.length > 0}
                onChange={(e) => {
                  if (e.target.checked) setSelectedIds(new Set(orders.map(o => o.id)));
                  else setSelectedIds(new Set());
                }}
              />
            </div>
            <div className="col-span-3">Auftragsnummer</div>
            <div className="col-span-3">Kunde</div>
            <div className="col-span-3">Bezeichnung</div>
            <div className="col-span-2">Eingang</div>
          </div>
          <div className="divide-y divide-neutral-gray-100">
            {orders.map(order => (
              <div 
                key={order.id} 
                onClick={() => toggleSelect(order.id)}
                className={`grid grid-cols-12 gap-4 p-4 items-center cursor-pointer transition-colors ${selectedIds.has(order.id) ? 'bg-gold-50/50' : 'hover:bg-bg-app-soft'}`}
              >
                <div className="col-span-1 text-center">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-gray-300 accent-gold-600 cursor-pointer"
                    checked={selectedIds.has(order.id)}
                    readOnly
                  />
                </div>
                <div className="col-span-3 font-bold text-navy-900">{order.orderNumber}</div>
                <div className="col-span-3 text-sm font-medium text-navy-700">{order.customerName || "Unbekannt"}</div>
                <div className="col-span-3 text-sm text-text-muted">{order.task || order.title}</div>
                <div className="col-span-2 text-sm text-text-muted">{order.intakeDate}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showBulkPrint && (
        <BulkLabelPrintView 
          orders={selectedOrders} 
          onClose={() => setShowBulkPrint(false)} 
          onPrintComplete={handlePrintComplete}
        />
      )}
    </div>
  );
}
