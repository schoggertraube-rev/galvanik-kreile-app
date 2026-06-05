"use client";

import React from "react";
import { DollarSign, TrendingUp, TrendingDown, Clock, Factory } from "lucide-react";
import type { Order } from "@/lib/repositories/ordersRepository";

export function OrderProfitabilityCard({ order }: { order: Order }) {
  // Simulate profitability data
  const revenue = 780;
  const laborCost = 140; // 3.5 hrs * 40
  const materialCost = 85;
  const bathCost = 120;
  const overhead = 165; // Fixed overhead per order

  const totalCost = laborCost + materialCost + bathCost + overhead;
  const profit = revenue - totalCost;
  const margin = Math.round((profit / revenue) * 100);

  const isProfitable = profit > 0;

  return (
    <div className="bg-white border-2 border-neutral-gray-300 rounded-3xl p-6 md:p-8 shadow-sm">
      <div className="flex justify-between items-center mb-6 border-b border-neutral-gray-100 pb-4">
        <h3 className="text-sm font-extrabold text-navy-500 uppercase tracking-widest pl-1">Wirtschaftlichkeit</h3>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${isProfitable ? "bg-success-green/20 text-success-green" : "bg-danger-red/20 text-danger-red"}`}>
          {isProfitable ? "Profitabel" : "Kritisch"}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-bg-app-soft p-4 rounded-2xl border border-neutral-gray-100 flex flex-col justify-center">
          <span className="text-[10px] text-text-muted font-bold uppercase">Auftragswert</span>
          <span className="text-xl font-black text-navy-900">{revenue} €</span>
        </div>
        <div className="bg-bg-app-soft p-4 rounded-2xl border border-neutral-gray-100 flex flex-col justify-center">
          <span className="text-[10px] text-text-muted font-bold uppercase">Gesamtkosten</span>
          <span className="text-xl font-black text-danger-red">{totalCost} €</span>
        </div>
        <div className={`p-4 rounded-2xl border flex flex-col justify-center ${isProfitable ? 'bg-success-green/5 border-success-green/20' : 'bg-danger-red/5 border-danger-red/20'}`}>
          <span className="text-[10px] text-text-muted font-bold uppercase">Ergebnis</span>
          <span className={`text-xl font-black ${isProfitable ? 'text-success-green' : 'text-danger-red'} flex items-center gap-1`}>
            {profit} € {isProfitable ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          </span>
        </div>
        <div className="bg-bg-app-soft p-4 rounded-2xl border border-neutral-gray-100 flex flex-col justify-center">
          <span className="text-[10px] text-text-muted font-bold uppercase">Marge</span>
          <span className="text-xl font-black text-navy-900">{margin} %</span>
        </div>
      </div>

      <div className="space-y-3 mt-4 pt-4 border-t border-neutral-gray-100">
        <h4 className="text-xs font-bold text-navy-700 uppercase mb-2">Kostenaufschlüsselung</h4>
        <div className="flex justify-between text-sm">
          <div className="flex items-center gap-2 text-text-muted"><Clock size={14} /> Arbeitszeit (3,5h)</div>
          <div className="font-bold text-navy-900">{laborCost} €</div>
        </div>
        <div className="flex justify-between text-sm">
          <div className="flex items-center gap-2 text-text-muted"><Factory size={14} /> Maschinennutzung / Bad</div>
          <div className="font-bold text-navy-900">{bathCost} €</div>
        </div>
        <div className="flex justify-between text-sm">
          <div className="flex items-center gap-2 text-text-muted">Material / Chemie</div>
          <div className="font-bold text-navy-900">{materialCost} €</div>
        </div>
        <div className="flex justify-between text-sm">
          <div className="flex items-center gap-2 text-text-muted">Gemeinkostenanteil</div>
          <div className="font-bold text-navy-900">{overhead} €</div>
        </div>
      </div>

      <div className="mt-6 p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-xl flex items-start gap-2">
        <DollarSign className="w-4 h-4 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="block mb-1">Hinweis zur Kalkulation:</strong>
          Die hier gezeigten Werte basieren aktuell auf Schätzungen (Demo-Modus).
          Mit der baldigen Integration echter Kostenpunkte pro Station (Zeit, Chemie, Energie) wird dies vollautomatisch je Auftrag errechnet.
        </p>
      </div>
    </div>
  );
}
