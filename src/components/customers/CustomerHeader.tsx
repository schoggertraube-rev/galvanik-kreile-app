import React from 'react';
import { CustomerKpi } from './useCustomerKpi';

export function CustomerHeader({ data }: { data: CustomerKpi }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold text-[var(--ci-ink)]">{data.kunde}</h2>
        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
          Klasse {data.classification}
        </span>
      </div>
      <p className="text-[var(--ci-ink-3)] text-sm">
        Kunde seit {new Date(data.kunde_seit).toLocaleDateString('de-DE')}
      </p>
    </div>
  );
}
