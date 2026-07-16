import React, { useEffect, useState } from 'react';
import { getCustomerPrices } from '@/features/customers/customer-card/customerCard.actions';
import { Loader2, Euro, PlusCircle } from 'lucide-react';

type CustomerPrice = Extract<
  Awaited<ReturnType<typeof getCustomerPrices>>,
  { ok: true }
>["data"][number];

export function CustomerPricesTab({ customerId }: { customerId: string }) {
  const [prices, setPrices] = useState<CustomerPrice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    getCustomerPrices(customerId).then(res => {
      if (isMounted) {
        if (res.ok) setPrices(res.data || []);
        else {
          setPrices([]);
          setError("Preisvereinbarungen konnten nicht bestätigt werden.");
        }
        setIsLoading(false);
      }
    }).catch(() => {
      if (isMounted) {
        setPrices([]);
        setError("Preisvereinbarungen konnten nicht bestätigt werden.");
        setIsLoading(false);
      }
    });
    return () => { isMounted = false; };
  }, [customerId]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold font-serif text-navy-900">Preise & Angebote</h3>
        <button disabled title="Preisvereinbarungen sind hier read-only" className="bg-white border border-gray-200 text-gray-500 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 opacity-60">
          <PlusCircle className="w-4 h-4 text-green-600" /> Preisvereinbarung
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-800">{error}</div>
      ) : prices.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center text-gray-500 flex flex-col items-center">
          <Euro className="w-12 h-12 mb-4 opacity-50" />
          <p className="font-semibold">Keine bestätigten Preisvereinbarungen vorhanden.</p>
          <p className="text-sm mt-1">Daraus wird kein Standardpreis abgeleitet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {prices.map((price) => (
            <div key={price.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:border-[var(--ci-blue)] transition-colors">
              <div className="flex justify-between items-start mb-3">
                <h4 className="font-bold text-gray-900 text-sm">Preisvereinbarung</h4>
                <span className="text-xs bg-green-50 text-green-700 font-bold px-2 py-0.5 rounded border border-green-200">Aktiv</span>
              </div>
              <div className="flex justify-between items-end border-t border-gray-100 pt-3">
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">{price.scope || 'Allgemein'}</p>
                  <p className="text-[10px] text-gray-400">Seit: {new Date(price.date).toLocaleDateString('de-DE')}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg text-gray-900">{price.rate !== null && price.rate !== undefined && Number.isFinite(Number(price.rate)) ? `${Number(price.rate).toFixed(2)} €` : 'Nicht verfügbar'}</p>
                  <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Netto</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
