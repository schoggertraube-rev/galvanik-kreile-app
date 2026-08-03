import React from 'react';

export function CustomerKommHistorie({ customerId }: { customerId: string }) {
  void customerId;
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg text-[var(--ci-ink)]">Kommunikation</h3>
      <div className="space-y-4">
        {/* Placeholder for timeline items */}
        <div className="flex gap-3 relative pl-4 border-l-2 border-gray-200">
          <div className="absolute w-3 h-3 bg-blue-500 rounded-full -left-[7px] top-1"></div>
          <div>
            <p className="text-xs text-gray-500">Gestern, 14:30</p>
            <p className="text-sm font-medium">E-Mail: Angebot verschickt</p>
          </div>
        </div>
        <div className="flex gap-3 relative pl-4 border-l-2 border-gray-200">
          <div className="absolute w-3 h-3 bg-gray-300 rounded-full -left-[7px] top-1"></div>
          <div>
            <p className="text-xs text-gray-500">12.05.2026</p>
            <p className="text-sm font-medium">Telefonat bzgl. Reklamation</p>
          </div>
        </div>
      </div>
    </div>
  );
}
