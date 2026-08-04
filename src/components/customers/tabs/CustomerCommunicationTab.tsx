import React, { useEffect, useState } from 'react';
import { getCustomerTimeline, type CustomerTimelineEntry } from '@/features/customers/customer-card/customerCard.actions';
import { Loader2, MessageSquare, Phone, Mail, Activity, ExternalLink } from 'lucide-react';
import { useOverlayStore } from '@/lib/overlayStore';

export function CustomerCommunicationTab({ customerId }: { customerId: string }) {
  const [timeline, setTimeline] = useState<CustomerTimelineEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const openOrder = useOverlayStore(state => state.openOrder);

  useEffect(() => {
    let isMounted = true;
    getCustomerTimeline(customerId).then(res => {
      if (isMounted) {
        if (res.ok) setTimeline(res.data || []);
        setIsLoading(false);
      }
    });
    return () => { isMounted = false; };
  }, [customerId]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold font-serif text-navy-900">Kommunikation & Historie</h3>
        <button className="bg-white border border-gray-200 text-[var(--ci-blue)] hover:bg-gray-50 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
          <Phone className="w-4 h-4" /> Neue Notiz
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : timeline.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center text-gray-500 flex flex-col items-center">
          <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
          <p className="font-semibold">Keine Einträge vorhanden.</p>
          <p className="text-sm mt-1">Hier erscheinen E-Mails, Telefonnotizen und Statusänderungen.</p>
        </div>
      ) : (
        <div className="relative pl-6 border-l-2 border-gray-100 space-y-6 ml-2 mt-4">
          {timeline.map((event, idx) => {
            const relatedOrderId = event.relatedOrderId;
            let Icon = Activity;
            let iconColor = "bg-gray-100 text-gray-500";
            
            if (event.type === 'note') {
              Icon = Phone;
              iconColor = "bg-orange-100 text-orange-600 border-orange-200";
            } else if (event.type === 'email') {
              Icon = Mail;
              iconColor = "bg-blue-100 text-[var(--ci-blue)] border-blue-200";
            } else if (event.type === 'status') {
              Icon = Activity;
              iconColor = event.severity === 'critical' ? "bg-red-100 text-red-600 border-red-200" : "bg-green-100 text-green-600 border-green-200";
            }

            return (
              <div key={`${event.type}-${event.id}-${idx}`} className="relative">
                <div className={`absolute -left-[37px] top-1 h-8 w-8 rounded-full border flex items-center justify-center ${iconColor}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-gray-900 text-sm">{event.title}</h4>
                    <span className="text-[10px] text-gray-500 font-bold whitespace-nowrap ml-2">
                      {new Date(event.timestamp).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{event.subtitle}</p>
                  
                  {relatedOrderId && (
                    <button 
                      onClick={() => openOrder(relatedOrderId)}
                      className="mt-3 text-xs font-bold text-[var(--ci-blue)] hover:underline flex items-center gap-1"
                    >
                      Zum Auftrag <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
