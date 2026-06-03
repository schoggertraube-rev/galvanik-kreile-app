"use client";
import { usePageView } from "@/hooks/usePageView";
import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Filter, AlertTriangle, CheckCircle2, FileText, Download } from "lucide-react";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";

const INVOICE_DATA = [
  { id: "RE-26-1042", name: "AutoTech GmbH", date: "02.06.2026", due: "16.06.2026", status: "offen", statusColor: "bg-blue-50 text-blue-600", amount: 4850.00, warning: false },
  { id: "RE-26-1041", name: "Metallbau Schmidt", date: "28.05.2026", due: "11.06.2026", status: "offen", statusColor: "bg-blue-50 text-blue-600", amount: 1240.50, warning: false },
  { id: "RE-26-1038", name: "Zweirad Zentrale", date: "15.05.2026", due: "29.05.2026", status: "überfällig", statusColor: "bg-amber-50 text-amber-600", amount: 3100.00, warning: true },
  { id: "RE-26-1035", name: "Industrieanlagen Müller", date: "02.05.2026", due: "16.05.2026", status: "mahnung", statusColor: "bg-rose-50 text-rose-600", amount: 8900.00, warning: true },
  { id: "RE-26-1030", name: "AutoTech GmbH", date: "20.04.2026", due: "04.05.2026", status: "bezahlt", statusColor: "bg-emerald-50 text-emerald-600", amount: 5200.00, warning: false },
  { id: "RE-26-1028", name: "Classic Cars Restauration", date: "15.04.2026", due: "29.04.2026", status: "bezahlt", statusColor: "bg-emerald-50 text-emerald-600", amount: 950.00, warning: false },
];

export default function RechnungenPage() {
  usePageView();
  const [filter, setFilter] = useState("alle");

  const filtered = filter === "alle" 
    ? INVOICE_DATA 
    : INVOICE_DATA.filter(i => filter === "offen" ? ["offen", "überfällig", "mahnung"].includes(i.status) : i.status === filter);

  const offeneSumme = INVOICE_DATA.filter(i => ["offen", "überfällig", "mahnung"].includes(i.status)).reduce((s, i) => s + i.amount, 0);
  const ueberfaelligSumme = INVOICE_DATA.filter(i => ["überfällig", "mahnung"].includes(i.status)).reduce((s, i) => s + i.amount, 0);

  return (
    <div className="w-full pb-24 px-4 sm:px-6 xl:px-8 min-h-screen">
      
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-semibold text-text-muted mt-4 mb-3">
        <Link href="/betrieb" className="hover:text-navy-900 transition-colors">Betrieb</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/buchhaltung" className="hover:text-navy-900 transition-colors">Buchhaltung</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-navy-900">Rechnungen</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <FileText className="w-7 h-7 text-blue-500" />
            <h1 className="text-3xl font-extrabold text-[#1e1b18] tracking-tight">Rechnungen & OPOS</h1>
          </div>
          <p className="text-xs font-semibold text-neutral-500 mt-2">
            Verwaltung der Ausgangsrechnungen und offener Forderungen
          </p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-5 py-2.5 bg-white text-[#1e1b18] rounded-xl font-bold text-sm border border-neutral-200 hover:bg-neutral-50 transition-colors shadow-sm">
            <Download className="w-4 h-4" /> OPOS-Liste exportieren
          </button>
        </div>
      </div>

      {/* Top Dashboards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
        
        {/* KPI Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-neutral-100 flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -mr-10 -mt-10 opacity-60" />
          <div className="relative flex justify-between items-end">
            <div>
              <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Offene Forderungen (Gesamt)</div>
              <div className="text-3xl font-extrabold text-[#1e1b18]">{offeneSumme.toLocaleString("de-DE", {minimumFractionDigits: 2})} €</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold text-rose-500 uppercase tracking-wider mb-1">Davon überfällig</div>
              <div className="text-xl font-extrabold text-rose-600">{ueberfaelligSumme.toLocaleString("de-DE", {minimumFractionDigits: 2})} €</div>
            </div>
          </div>
        </div>

        {/* Action Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-neutral-100 flex items-center gap-5">
           <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
             <AlertTriangle className="w-6 h-6 text-rose-500" />
           </div>
           <div>
             <h3 className="text-sm font-extrabold text-[#1e1b18] mb-1">2 Rechnungen erfordern Aktion</h3>
             <p className="text-xs text-neutral-500 leading-relaxed">
               Zweirad Zentrale und Industrieanlagen Müller sind in Verzug. Ein Mahnlauf (Stufe 2) oder direkter Zahlungslink wird empfohlen.
             </p>
           </div>
        </div>

      </div>

      {/* Filter Bar */}
      <h2 className="text-sm font-semibold text-neutral-600 mb-3">Rechnungsliste</h2>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: "alle", label: "Alle Rechnungen", color: "bg-black" },
            { id: "offen", label: "Offene Posten", color: "bg-blue-500" },
            { id: "bezahlt", label: "Bezahlt", color: "bg-emerald-500" },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors ${
                filter === f.id && f.id === "alle" ? "bg-[#1e1b18] text-white" :
                filter === f.id ? "bg-white border border-neutral-200 text-[#1e1b18] shadow-sm" :
                "bg-white border border-transparent text-neutral-500 hover:text-[#1e1b18] hover:border-neutral-200"
              }`}
            >
              {f.id !== "alle" && <div className={`w-1.5 h-1.5 rounded-full ${f.color}`} />}
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List Container */}
      <div className="bg-white rounded-[2rem] border border-neutral-100 p-2 sm:p-5 shadow-sm">
        <div className="flex flex-col">
          {filtered.map((inv, idx) => {
            return (
              <div key={inv.id}>
                <div className="flex items-center gap-4 p-3 hover:bg-neutral-50 rounded-2xl transition-colors cursor-pointer group">
                  
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 border border-neutral-100 bg-neutral-50`}>
                    <FileText className={`w-4 h-4 text-neutral-500`} />
                  </div>
                  
                  {/* Name & ID */}
                  <div className="flex-1 min-w-0 flex items-center">
                    <div className="w-[35%] min-w-[200px] pr-4">
                      <div className="text-sm font-extrabold text-[#1e1b18] truncate">{inv.name}</div>
                      <div className="text-[11px] font-semibold text-neutral-500 mt-0.5 truncate">{inv.id} · {inv.date}</div>
                    </div>
                    
                    {/* Status Pill */}
                    <div className="w-[20%] min-w-[120px] px-4 hidden md:flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded text-[10px] font-extrabold tracking-wide uppercase ${inv.statusColor} ${inv.warning ? 'animate-pulse' : ''}`}>
                        {inv.status}
                      </span>
                    </div>

                    {/* Due Date */}
                    <div className="flex-1 px-4 flex justify-end md:justify-center text-[11px] text-neutral-500 font-medium">
                      fällig: {inv.due}
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="text-right shrink-0 min-w-[100px]">
                    <div className="text-base font-extrabold text-[#1e1b18]">{inv.amount.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</div>
                  </div>

                </div>
                {idx < filtered.length - 1 && <div className="w-full h-px bg-neutral-100 my-1 ml-14" />}
              </div>
            );
          })}
          
          {filtered.length === 0 && (
            <div className="text-center py-12 text-neutral-400 text-sm">Keine Rechnungen für diesen Filter gefunden.</div>
          )}
        </div>
      </div>

      <FeedbackFooter pageTitle="Rechnungen" route="/buchhaltung/rechnungen" variant="full" />
    </div>
  );
}
