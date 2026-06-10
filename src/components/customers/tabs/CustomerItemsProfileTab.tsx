import React, { useEffect, useState } from 'react';
import { getCustomerItems } from '@/features/customers/customer-card/customerCard.actions';
import { Box, Loader2, AlertTriangle, FileText } from 'lucide-react';

export function CustomerItemsProfileTab({ customerId }: { customerId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    getCustomerItems(customerId).then(res => {
      if (isMounted) {
        if (res.ok) setItems(res.data || []);
        setIsLoading(false);
      }
    });
    return () => { isMounted = false; };
  }, [customerId]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Items */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-bold font-serif text-navy-900">Wiederkehrende Teile</h3>
          
          {isLoading ? (
            <div className="flex items-center justify-center p-12 text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center text-gray-500 flex flex-col items-center">
              <Box className="w-12 h-12 mb-4 opacity-50" />
              <p className="font-semibold">Keine Teile erfasst.</p>
              <p className="text-sm mt-1">Dieser Kunde hat noch keine Aufträge mit Teilen.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {items.map((item, idx) => (
                <div key={idx} className="bg-white shadow-sm border border-gray-200 rounded-xl p-4 space-y-3 hover:border-[var(--ci-blue)] transition-colors">
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="font-bold text-gray-900 text-sm">{item.bezeichnung || 'Unbenannt'}</h4>
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-bold whitespace-nowrap">
                      {item.count}x bestellt
                    </span>
                  </div>
                  
                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex justify-between border-b border-gray-100 pb-1">
                      <span>Oberfläche:</span>
                      <span className="font-semibold text-gray-900">{item.oberflaeche || '-'}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-1">
                      <span>Material:</span>
                      <span className="font-semibold text-gray-900">{item.material || '-'}</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span>Ø Netto-Preis:</span>
                      <span className="font-semibold text-[var(--ci-blue)]">
                        {item.avg_price ? `${Number(item.avg_price).toFixed(2)} €` : '-'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-[10px] text-gray-400 text-right pt-2">
                    Zuletzt: {new Date(item.last_seen).toLocaleDateString('de-DE')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Col: Technical Profile */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold font-serif text-navy-900">Technisches Profil</h3>
          
          <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl space-y-2">
            <h4 className="text-sm font-bold text-orange-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Risikohinweise
            </h4>
            <p className="text-xs text-orange-900">
              Es liegen derzeit keine spezifischen technischen Warnungen für diesen Kunden vor.
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-2">
            <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Verpackungsvorgaben
            </h4>
            <p className="text-xs text-gray-600">
              Standardverpackung. Keine besonderen Vorgaben hinterlegt.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
