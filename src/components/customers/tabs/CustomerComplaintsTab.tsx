import React, { useEffect, useState } from 'react';
import { getCustomerComplaints } from '@/features/customers/customer-card/customerCard.actions';
import { Loader2, FileWarning, ExternalLink, MessageSquareWarning } from 'lucide-react';
import { useOverlayStore } from '@/lib/overlayStore';

export function CustomerComplaintsTab({ customerId }: { customerId: string }) {
  const [complaints, setComplaints] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const openOrder = useOverlayStore(state => state.openOrder);

  useEffect(() => {
    let isMounted = true;
    getCustomerComplaints(customerId).then(res => {
      if (isMounted) {
        if (res.ok) setComplaints(res.data || []);
        setIsLoading(false);
      }
    });
    return () => { isMounted = false; };
  }, [customerId]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold font-serif text-navy-900">Reklamationen & Nacharbeit</h3>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : complaints.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center text-gray-500 flex flex-col items-center">
          <FileWarning className="w-12 h-12 mb-4 opacity-50" />
          <p className="font-semibold">Keine Reklamationen vorhanden.</p>
          <p className="text-sm mt-1">Dieser Kunde hatte bisher keine Beanstandungen.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {complaints.map((item) => {
            const complaint = item.complaints;
            const order = item.orders;
            
            return (
              <div key={complaint.id} className="bg-red-50/30 border border-red-100 rounded-xl p-5 hover:border-red-300 transition-colors flex flex-col sm:flex-row gap-4">
                <div className="mt-1">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                    <MessageSquareWarning className="w-5 h-5" />
                  </div>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap justify-between items-start gap-2">
                    <div>
                      <h4 className="font-bold text-gray-900">{complaint.issue || 'Ohne Titel'}</h4>
                      <div className="flex items-center gap-2 text-xs mt-1">
                        <span className="font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded">{complaint.type || 'Reklamation'}</span>
                        <span className="text-gray-500">{new Date(complaint.createdAt).toLocaleDateString('de-DE')}</span>
                      </div>
                    </div>
                    {order && (
                      <button 
                        onClick={() => openOrder(order.id)}
                        className="text-xs bg-white border border-gray-200 hover:bg-gray-50 px-2 py-1 rounded font-bold flex items-center gap-1"
                      >
                        Auftrag {order.orderNumber} <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  
                  <div className="bg-white rounded-lg p-3 text-sm text-gray-700 border border-gray-100">
                    {complaint.description || 'Keine Beschreibung hinterlegt.'}
                  </div>
                  
                  <div className="flex justify-between items-center pt-2">
                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded ${
                      complaint.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {complaint.status === 'resolved' ? 'Gelöst' : 'Offen'}
                    </span>
                    {complaint.resolution && (
                      <span className="text-xs text-gray-500 truncate max-w-[200px]" title={complaint.resolution}>
                        Lösung: {complaint.resolution}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
