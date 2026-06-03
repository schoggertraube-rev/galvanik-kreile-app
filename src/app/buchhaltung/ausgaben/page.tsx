"use client";
import { usePageView } from "@/hooks/usePageView";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronRight, TrendingDown, AlertCircle, CheckCircle2, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";

const CATEGORIES = [
  { id: "material", label: "Material & Chemie", color: "bg-rose-500", iconBg: "bg-rose-50", iconColor: "text-rose-500", sum: 18400, budget: 20000, trend: "+2.4%", count: 42 },
  { id: "energie", label: "Energie", color: "bg-teal-500", iconBg: "bg-teal-50", iconColor: "text-teal-500", sum: 9800, budget: 10000, trend: "-1.2%", count: 3 },
  { id: "kfz", label: "Kfz & Wartung", color: "bg-purple-500", iconBg: "bg-purple-50", iconColor: "text-purple-500", sum: 2100, budget: 1500, trend: "+12.5%", count: 8, warning: true },
  { id: "buero", label: "Büro & Software", color: "bg-emerald-500", iconBg: "bg-emerald-50", iconColor: "text-emerald-500", sum: 1480, budget: 1500, trend: "-0.5%", count: 24 },
  { id: "kraftstoff", label: "Kraftstoff", color: "bg-blue-500", iconBg: "bg-blue-50", iconColor: "text-blue-500", sum: 1240, budget: 1500, trend: "+5.0%", count: 18 },
  { id: "bewirtung", label: "Bewirtung", color: "bg-amber-500", iconBg: "bg-amber-50", iconColor: "text-amber-500", sum: 340, budget: 500, trend: "-10.0%", count: 4 },
  { id: "sonstiges", label: "Sonstiges", color: "bg-neutral-500", iconBg: "bg-neutral-100", iconColor: "text-neutral-500", sum: 15840, budget: 15000, trend: "+4.1%", count: 43 },
];

export default function AusgabenPage() {
  usePageView();

  const gesamt = CATEGORIES.reduce((s, k) => s + k.sum, 0);

  return (
    <div className="w-full pb-24 px-4 sm:px-6 xl:px-8 bg-[#fdfcf9] min-h-screen">
      
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-semibold text-text-muted mt-4 mb-3">
        <Link href="/" className="hover:text-navy-900 transition-colors">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/buchhaltung" className="hover:text-navy-900 transition-colors">Buchhaltung</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-navy-900">Ausgaben Details</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <Wallet className="w-7 h-7 text-rose-500" />
            <h1 className="text-3xl font-extrabold text-[#1e1b18] tracking-tight">Ausgaben nach Kategorien</h1>
          </div>
          <p className="text-xs font-semibold text-neutral-500 mt-2">
            2026 · Jan–Mai · Detailauswertung der operativen Kosten
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Gesamtausgaben</div>
          <div className="text-3xl font-extrabold text-rose-600">{gesamt.toLocaleString("de-DE")} €</div>
        </div>
      </div>

      {/* KI Ratgeber Section (Plausibilität) */}
      <h2 className="text-sm font-semibold text-neutral-600 mb-3">Plausibilitätsprüfung & Warnungen</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
        
        {/* Warning Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-neutral-100 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-full blur-3xl -mr-10 -mt-10 opacity-60" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              <h3 className="text-sm font-extrabold text-[#1e1b18]">Kfz-Kosten über Budget</h3>
            </div>
            <div className="flex items-center gap-1 mb-3">
              <span className="text-[10px] font-bold text-amber-600 tracking-wider bg-amber-50 px-2 py-0.5 rounded">WARNUNG</span>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Die Ausgaben für <strong className="text-[#1e1b18]">Kfz & Wartung (2.100 €)</strong> liegen diesen Monat <strong className="text-rose-600">+40 %</strong> über dem historischen Durchschnitt. Ursache ist primär die Rechnung von "Reifen Müller" über 420 €.
            </p>
          </div>
        </div>

        {/* Success Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-neutral-100 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl -mr-10 -mt-10 opacity-60" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-5 h-5 text-emerald-500" />
              <h3 className="text-sm font-extrabold text-[#1e1b18]">Energiekosten stabil</h3>
            </div>
            <div className="flex items-center gap-1 mb-3">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              <span className="text-[10px] font-bold text-emerald-600 tracking-wider">VERIFIZIERT</span>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Die Energiekosten (<strong className="text-[#1e1b18]">9.800 €</strong>) bewegen sich im budgetierten Rahmen und sind im Vergleich zum Vorjahreszeitraum um <strong className="text-emerald-600">1,2 % gesunken</strong>.
            </p>
          </div>
        </div>

      </div>

      {/* Kategorie-Karten */}
      <h2 className="text-sm font-semibold text-neutral-600 mb-3">Detail-Aufschlüsselung</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {CATEGORIES.map(k => {
          const anteil = ((k.sum / gesamt) * 100).toFixed(1);
          const isOverBudget = k.sum > k.budget;
          return (
            <Link
              key={k.id}
              href={`/buchhaltung/belege?kategorie=${k.id}`}
              className="group bg-white rounded-3xl border border-neutral-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 p-6 flex flex-col"
            >
              <div className="flex items-start justify-between mb-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${k.iconBg}`}>
                  <div className={`w-4 h-4 rounded-full ${k.color}`} />
                </div>
                <div className="text-right">
                  <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isOverBudget ? 'bg-amber-50 text-amber-600' : 'bg-neutral-50 text-neutral-500'}`}>
                    {k.trend}
                  </div>
                </div>
              </div>
              
              <h3 className="text-sm font-extrabold text-[#1e1b18] mb-1 group-hover:text-rose-600 transition-colors">{k.label}</h3>
              <p className="text-[10px] text-neutral-400 mb-4">{k.count} Belege erfasst</p>
              
              <div className="mt-auto">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-2xl font-extrabold text-[#1e1b18]">{k.sum.toLocaleString("de-DE")} €</span>
                </div>
                
                {/* Anteil-Bar */}
                <div className="flex items-center justify-between text-[10px] font-bold text-neutral-400 mb-1">
                  <span>{anteil} % vom Gesamt</span>
                  <span>Budget: {k.budget.toLocaleString("de-DE")}</span>
                </div>
                <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${isOverBudget ? 'bg-amber-500' : k.color}`} style={{ width: `${Math.min(100, (k.sum / k.budget) * 100)}%` }} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <FeedbackFooter pageTitle="Ausgaben" route="/buchhaltung/ausgaben" variant="full" />
    </div>
  );
}
