import React, { useEffect, useState } from 'react';
import { getCustomerOrders } from '@/features/customers/customer-card/customerCard.actions';
import { useOverlayStore } from '@/lib/overlayStore';
import { ChevronRight, FileSearch, Sparkles, Loader2 } from 'lucide-react';

export function CustomerOrdersTab({ customerId }: { customerId: string }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const openOrder = useOverlayStore(state => state.openOrder);

  useEffect(() => {
    let isMounted = true;
    getCustomerOrders(customerId).then(res => {
      if (isMounted) {
        if (res.ok) setOrders(res.data || []);
        setIsLoading(false);
      }
    });
    return () => { isMounted = false; };
  }, [customerId]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold font-serif text-navy-900">Auftragshistorie</h3>
        <button 
          onClick={() => openOrder('new')}
          className="bg-white border border-gray-200 text-[var(--ci-orange)] hover:bg-gray-50 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
        >
          <Sparkles className="w-4 h-4" /> Neuer Auftrag
        </button>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center text-gray-500 flex flex-col items-center">
          <FileSearch className="w-12 h-12 mb-4 opacity-50" />
          <p className="font-semibold">Keine Aufträge vorhanden.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const isDone = order.status === "abgeschlossen";
            const isCritical = order.status === "storniert" || order.status === "fehler";
            
            let badgeColor = "bg-gray-100 text-gray-700 border-gray-200";
            let borderLeft = "border-l-gray-300";
            
            if (isDone) {
              badgeColor = "bg-green-50 text-green-700 border-green-200";
              borderLeft = "border-l-green-500 border-l-4";
            } else if (isCritical) {
              badgeColor = "bg-red-50 text-red-700 border-red-200";
              borderLeft = "border-l-red-500 border-l-4";
            } else {
              badgeColor = "bg-orange-50 text-orange-700 border-orange-200";
              borderLeft = "border-l-orange-500 border-l-4";
            }

            return (
              <button 
                key={order.id} 
                onClick={() => openOrder(order.id)}
                className={`w-full text-left p-4 bg-white hover:bg-gray-50 transition-colors border border-gray-200 rounded-xl ${borderLeft} flex flex-col md:flex-row md:items-center justify-between gap-4`}
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono font-bold text-[var(--ci-blue)]">{order.orderNumber}</span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-500">Eingang: {new Date(order.createdAt).toLocaleDateString('de-DE')}</span>
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm font-serif">{order.task || 'Ohne Bezeichnung'}</h4>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] px-2 py-1 rounded font-extrabold tracking-wider border ${badgeColor}`}>
                    {order.status.toUpperCase()}
                  </span>
                  <div className="h-8 w-8 rounded flex items-center justify-center text-gray-400 group-hover:text-[var(--ci-blue)]">
                    <ChevronRight className="h-5 w-5" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
