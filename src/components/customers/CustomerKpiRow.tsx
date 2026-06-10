import React from 'react';
import { CustomerKpi } from './useCustomerKpi';

export function CustomerKpiRow({ data }: { data: CustomerKpi }) {
  return (
    <div className="flex gap-8 overflow-x-auto">
      <KpiItem label="Umsatz LTV" value={`${data.umsatz_ltv.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`} />
      <KpiItem label="Gewinn LTV" value={`${data.gewinn_ltv.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`} />
      <KpiItem label="Offene Posten" value={`${data.offene_posten.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`} />
      <KpiItem label="Pünktlichkeit" value={data.puenktlichkeit_pct !== null ? `${data.puenktlichkeit_pct}%` : 'N/A'} />
      <KpiItem label="Reklamationen" value={`${data.reklamationen}`} />
    </div>
  );
}

function KpiItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors">
      <span className="text-xs text-[var(--ci-ink-3)] uppercase tracking-wider">{label}</span>
      <span className="text-lg font-semibold text-[var(--ci-ink)]">{value}</span>
    </div>
  );
}
