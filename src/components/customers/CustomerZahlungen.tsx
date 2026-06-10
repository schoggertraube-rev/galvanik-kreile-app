import React from 'react';

export function CustomerZahlungen({ customerId }: { customerId: string }) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg text-[var(--ci-ink)]">Letzte Zahlungen</h3>
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-500 italic">Zahlungshistorie für {customerId}.</p>
      </div>
    </div>
  );
}
