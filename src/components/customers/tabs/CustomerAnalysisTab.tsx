import React from 'react';
import { TrendingUp, Award, Clock, DollarSign, Tag } from 'lucide-react';

function metric(value: unknown, suffix: string): string {
  if (value === null || value === undefined || value === "") return "Nicht verfügbar";
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(0)} ${suffix}`.trim() : "Ungültiger Messwert";
}

type CustomerAnalysisData = {
  kpi?: {
    umsatz_ltv?: unknown;
    gewinn_ltv?: unknown;
    puenktlichkeit_pct?: unknown;
  } | null;
  tags?: unknown;
  classification?: unknown;
};

export function CustomerAnalysisTab({ customerData }: { customerId: string, customerData: CustomerAnalysisData | null }) {
  if (!customerData) return <div className="p-4 text-gray-500">Lade Analyse...</div>;

  const kpi = customerData.kpi;
  const tags = Array.isArray(customerData.tags)
    ? customerData.tags.filter((tag): tag is string => typeof tag === "string")
    : [];
  const classification = typeof customerData.classification === "string" && customerData.classification
    ? customerData.classification
    : "Nicht hinterlegt";

  if (!kpi) {
    return <div role="status" className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-600">Kundenanalyse ist noch nicht belastbar verbunden. Es werden keine Nullwerte abgeleitet.</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h3 className="text-lg font-bold font-serif text-navy-900">Analyse & Marketing</h3>
      
      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <DollarSign className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Umsatz LTV</span>
          </div>
          <span className="text-xl font-bold text-gray-900">{metric(kpi.umsatz_ltv, "€")}</span>
        </div>
        
        <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Gewinn LTV</span>
          </div>
          <span className="text-xl font-bold text-green-600">{metric(kpi.gewinn_ltv, "€")}</span>
        </div>
        
        <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Pünktlichkeit</span>
          </div>
          <span className="text-xl font-bold text-gray-900">{metric(kpi.puenktlichkeit_pct, "%")}</span>
        </div>
        
        <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <Award className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Klasse</span>
          </div>
          <span className="text-xl font-bold text-[var(--ci-blue)]">{classification}</span>
        </div>
      </div>

      {/* Marketing Tags */}
      <div className="bg-white border border-gray-200 p-6 rounded-xl space-y-4">
        <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <Tag className="w-4 h-4 text-[var(--ci-orange)]" /> Marketing-Tags
        </h4>
        {tags.length === 0 ? (
          <p className="text-sm text-gray-500">Keine Tags zugewiesen.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag: string, idx: number) => (
              <span key={idx} className="bg-orange-50 text-[var(--ci-orange)] border border-orange-200 px-3 py-1 rounded-full text-xs font-bold">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
