import React, { useEffect, useState } from 'react';
import { getCustomerFinancials } from '@/features/customers/customer-card/customerCard.actions';
import { Loader2, Receipt, Search, ExternalLink } from 'lucide-react';

export function CustomerInvoicesTab({ customerId }: { customerId: string }) {
  const [financials, setFinancials] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    getCustomerFinancials(customerId).then(res => {
      if (isMounted) {
        if (res.ok) setFinancials(res.data);
        setIsLoading(false);
      }
    });
    return () => { isMounted = false; };
  }, [customerId]);

  const invoices = financials?.invoices || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold font-serif text-navy-900">Rechnungen & Zahlungen</h3>
        <button className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
          <Search className="w-4 h-4" /> Alle durchsuchen
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center text-gray-500 flex flex-col items-center">
          <Receipt className="w-12 h-12 mb-4 opacity-50" />
          <p className="font-semibold">Keine Rechnungen vorhanden.</p>
          <p className="text-sm mt-1">Dieser Kunde hat noch keine Rechnungen erhalten.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv: any) => {
            const isPaid = inv.status === 'bezahlt';
            const isOverdue = inv.status === 'ueberfaellig';
            
            let badgeColor = "bg-gray-100 text-gray-700";
            if (isPaid) badgeColor = "bg-green-100 text-green-700";
            if (isOverdue) badgeColor = "bg-red-100 text-red-700";

            return (
              <div key={inv.id} className="bg-white border border-gray-200 hover:border-[var(--ci-blue)] transition-colors rounded-xl p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[var(--ci-blue)]">{inv.belegnr}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${badgeColor}`}>
                      {inv.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Datum: {new Date(inv.datum).toLocaleDateString('de-DE')} 
                    {inv.faellig_am && ` • Fällig: ${new Date(inv.faellig_am).toLocaleDateString('de-DE')}`}
                  </p>
                </div>
                
                <div className="flex items-center gap-4 justify-between sm:justify-end">
                  <div className="text-right">
                    <p className="font-bold text-lg text-gray-900">{Number(inv.brutto).toFixed(2)} €</p>
                    <p className="text-[10px] uppercase font-bold text-gray-500">Brutto</p>
                  </div>
                  <button className="text-[var(--ci-blue)] hover:bg-blue-50 p-2 rounded transition-colors">
                    <ExternalLink className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
