import React from 'react';
import { useOverlayStore } from '@/lib/overlayStore';

export function CustomerAuftraege({ customerId }: { customerId: string }) {
  const openOrder = useOverlayStore(state => state.openOrder);
  
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg text-[var(--ci-ink)]">Aktuelle Aufträge</h3>
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-500 italic">Liste der laufenden Aufträge für {customerId}.</p>
        <button className="mt-2 text-sm text-blue-600 hover:underline" onClick={() => openOrder('TEST-123')}>Test-Auftrag öffnen</button>
      </div>
    </div>
  );
}
