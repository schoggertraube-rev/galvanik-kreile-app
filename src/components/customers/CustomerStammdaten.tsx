import React from 'react';

export function CustomerStammdaten({ customerId }: { customerId: string }) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg text-[var(--ci-ink)]">Stammdaten</h3>
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-500 italic">Hier können künftig Stammdaten (Anschrift, Preferences) editiert werden.</p>
      </div>
    </div>
  );
}
