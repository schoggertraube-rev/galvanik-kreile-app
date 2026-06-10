import React, { useEffect, useState } from 'react';
import { getCustomerSimilarOrders } from '@/features/customers/customer-card/customerCard.actions';
import { useOverlayStore } from '@/lib/overlayStore';
import { Loader2, History, ChevronRight } from 'lucide-react';

export function CustomerHistorySimilarTab({ customerId }: { customerId: string }) {
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const openOrder = useOverlayStore(state => state.openOrder);

  useEffect(() => {
    let isMounted = true;
    getCustomerSimilarOrders(customerId).then(res => {
      if (isMounted) {
        if (res.ok) setHistory(res.data || []);
        setIsLoading(false);
      }
    });
    return () => { isMounted = false; };
  }, [customerId]);

  return (
    <div className="space-y-6 animate-fade-in">
      <h3 className="text-lg font-bold font-serif text-navy-900">Werkstattgedächtnis (Abgeschlossene Aufträge)</h3>
      
      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : history.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center text-gray-500 flex flex-col items-center">
          <History className="w-12 h-12 mb-4 opacity-50" />
          <p className="font-semibold">Kein Werkstattgedächtnis vorhanden.</p>
          <p className="text-sm mt-1">Dieser Kunde hat noch keine abgeschlossenen Aufträge.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {history.map((order) => (
            <button
              key={order.id}
              onClick={() => openOrder(order.id)}
              className="text-left bg-white border border-gray-200 p-4 rounded-xl hover:border-[var(--ci-blue)] hover:shadow-md transition-all group"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="font-mono text-xs font-bold bg-gray-100 px-2 py-1 rounded text-[var(--ci-blue)]">
                  {order.orderNumber}
                </span>
                <span className="text-xs text-gray-500 font-medium">
                  {new Date(order.createdAt).toLocaleDateString('de-DE')}
                </span>
              </div>
              <h4 className="font-bold text-gray-900 text-sm mb-1 line-clamp-2">{order.task || 'Unbenannter Auftrag'}</h4>
              <div className="flex justify-between items-center mt-4">
                <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Erfolgreich abgeschlossen</span>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[var(--ci-blue)] transition-colors" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
