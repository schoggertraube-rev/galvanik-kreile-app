import React, { useEffect, useState } from 'react';
import { getCustomerOrders } from '@/features/customers/customer-card/customerCard.actions';
import { useOverlayStore } from '@/lib/overlayStore';
import { useErfassung } from '@/components/erfassung/ErfassungProvider';
import { FileSearch, Sparkles, Loader2 } from 'lucide-react';
import { OrderWideCard, UrgencyType } from '@/components/orders/OrderWideCard';

export function CustomerOrdersTab({ customerId }: { customerId: string }) {
  const [orders, setOrders] = useState<Record<string, any>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const openOrder = useOverlayStore(state => state.openOrder);
  const { openErfassung } = useErfassung();

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
          onClick={() => openErfassung({ mode: "order", intent: "create_order", source: "customer", customerId })}
          className="bg-white border border-gray-200 text-(--ci-orange) hover:bg-gray-50 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
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
            let urgency: UrgencyType = "ok";
            let dueValue = "Offen";
            let dueLabel = "STATUS";
            
            if (order.status === "storniert" || order.status === "fehler") {
              urgency = "crit";
              dueValue = order.status.toUpperCase();
              dueLabel = "KRITISCH";
            } else if (order.status === "abgeschlossen") {
              urgency = "ok";
              dueValue = "Fertig";
              dueLabel = "STATUS";
            } else {
              urgency = "wait";
              dueValue = "In Arbeit";
              dueLabel = "STATUS";
            }
            
            // If we have a real due date, parse it. But customer view usually doesn't have it directly exposed here or we can try order.dueDate
            if (order.dueDate) {
              const date = new Date(order.dueDate);
              dueValue = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
              dueLabel = "FÄLLIG";
              if (date < new Date() && order.status !== "abgeschlossen") urgency = "crit";
            }

            return (
              <OrderWideCard
                key={order.id}
                id={order.id}
                orderNumber={order.orderNumber || order.id}
                customerName={order.task || 'Ohne Bezeichnung'}
                article={`Eingang: ${new Date(order.createdAt).toLocaleDateString('de-DE')}`}
                surface={order.status.toUpperCase()}
                surfaceKey={order.status === "abgeschlossen" ? "chrom" : order.status === "storniert" ? "kupfer" : "offen"}
                urgency={urgency}
                dueValue={dueValue}
                dueLabel={dueLabel}
                onClick={() => openOrder(order.id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
