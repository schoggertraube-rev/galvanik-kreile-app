"use client";
import { usePageView } from "@/hooks/usePageView";
import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Fuel, AlertTriangle, CheckCircle2, Navigation, TrendingUp } from "lucide-react";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";

const TANKUNGEN = [
  { id: 1, kfz: "F-GK 101 (Sprinter)", date: "02.06.2026", liter: 45.8, amount: 78.40, sorte: "Diesel", ort: "Shell - Frankfurt-Ost", absetzbar: true },
  { id: 2, kfz: "F-GK 102 (Caddy)", date: "24.05.2026", liter: 41.2, amount: 70.90, sorte: "Diesel", ort: "Aral - Hanau", absetzbar: true },
  { id: 3, kfz: "F-GK 101 (Sprinter)", date: "11.05.2026", liter: 62.0, amount: 105.40, sorte: "Diesel", ort: "Esso - Offenbach", absetzbar: true },
  { id: 4, kfz: "Privat-PKW Chef", date: "08.05.2026", liter: 35.0, amount: 65.50, sorte: "Super 95", ort: "Jet - Frankfurt", absetzbar: false },
];

export default function KraftstoffPage() {
  usePageView();
  const [filter, setFilter] = useState("alle");

  const filtered = filter === "alle" 
    ? TANKUNGEN 
    : TANKUNGEN.filter(t => t.kfz.includes(filter));

  const gesamtLiter = TANKUNGEN.filter(t => t.absetzbar).reduce((s, t) => s + t.liter, 0);
  const gesamtKosten = TANKUNGEN.filter(t => t.absetzbar).reduce((s, t) => s + t.amount, 0);

  return (
    <div className="w-full pb-24 px-4 sm:px-6 xl:px-8 bg-[#fdfcf9] min-h-screen">
      
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-semibold text-text-muted mt-4 mb-3">
        <Link href="/" className="hover:text-navy-900 transition-colors">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/buchhaltung" className="hover:text-navy-900 transition-colors">Buchhaltung</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-navy-900">Kraftstoff & Kfz</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <Fuel className="w-7 h-7 text-blue-500" />
            <h1 className="text-3xl font-extrabold text-[#1e1b18] tracking-tight">Kraftstoff & Fuhrpark</h1>
          </div>
          <p className="text-xs font-semibold text-neutral-500 mt-2">
            Verbrauchsauswertung, Plausibilität und Fahrtenbuch-Checks
          </p>
        </div>
      </div>

      {/* Top Dashboards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-10">
        
        {/* KPI Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-neutral-100 flex flex-col justify-center relative overflow-hidden lg:col-span-1">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -mr-10 -mt-10 opacity-60" />
          <div className="relative">
            <div className="flex justify-between items-end mb-4">
              <div>
                <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Kraftstoffkosten (Betrieblich)</div>
                <div className="text-3xl font-extrabold text-[#1e1b18]">{gesamtKosten.toLocaleString("de-DE", {minimumFractionDigits: 2})} €</div>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold">
              <div className="text-blue-600">{gesamtLiter.toFixed(1)} Liter gesamt</div>
              <div className="text-neutral-400">ø 1,71 €/L</div>
            </div>
          </div>
        </div>

        {/* KI Advice Cards */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5">
           {/* Card 1 */}
           <div className="bg-white rounded-3xl p-6 shadow-sm border border-neutral-100 flex flex-col">
             <div className="flex items-center gap-2 mb-2">
               <span className="text-blue-500 font-bold">⛽</span>
               <h3 className="text-sm font-extrabold text-[#1e1b18]">Verbrauch — plausibel</h3>
             </div>
             <div className="flex items-center gap-1 mb-3">
               <CheckCircle2 className="w-3 h-3 text-emerald-500" />
               <span className="text-[10px] font-bold text-emerald-600 tracking-wider">VERIFIZIERT</span>
             </div>
             <p className="text-xs text-neutral-600 leading-relaxed flex-1">
               Dieselkosten liegen bei <strong className="text-[#1e1b18]">1,8 % vom Umsatz</strong>. Für deinen Fuhrpark (2 Transporter) absolut im Rahmen.
             </p>
           </div>
           
           {/* Card 2 */}
           <div className="bg-white rounded-3xl p-6 shadow-sm border border-neutral-100 flex flex-col">
             <div className="flex items-center gap-2 mb-2">
               <AlertTriangle className="w-4 h-4 text-amber-500" />
               <h3 className="text-sm font-extrabold text-[#1e1b18]">Tanklücke erkannt</h3>
             </div>
             <div className="flex items-center gap-1 mb-3">
               <span className="text-[10px] font-bold text-amber-600 tracking-wider bg-amber-50 px-2 py-0.5 rounded">HINWEIS</span>
             </div>
             <p className="text-xs text-neutral-600 leading-relaxed flex-1">
               Zwischen <strong className="text-[#1e1b18]">12.-19. Mai</strong> fehlt eine Tankung beim F-GK 101. Die Fahrleistung laut GPS-Daten erfordert hier eigentlich Kraftstoff.
             </p>
           </div>
        </div>

      </div>

      {/* Filter Bar */}
      <h2 className="text-sm font-semibold text-neutral-600 mb-3">Tankungen</h2>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: "alle", label: "Alle Fahrzeuge", color: "bg-black" },
            { id: "101", label: "F-GK 101", color: "bg-blue-500" },
            { id: "102", label: "F-GK 102", color: "bg-teal-500" },
            { id: "Privat", label: "Privat-PKW", color: "bg-neutral-400" },
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
          {filtered.map((t, idx) => {
            return (
              <div key={t.id}>
                <div className="flex items-center gap-4 p-3 hover:bg-neutral-50 rounded-2xl transition-colors cursor-pointer group">
                  
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 border border-neutral-100 ${t.absetzbar ? 'bg-blue-50' : 'bg-neutral-50'}`}>
                    <Navigation className={`w-4 h-4 ${t.absetzbar ? 'text-blue-500' : 'text-neutral-400'}`} />
                  </div>
                  
                  {/* Name & Date */}
                  <div className="flex-1 min-w-0 flex items-center">
                    <div className="w-[35%] min-w-[200px] pr-4">
                      <div className="text-sm font-extrabold text-[#1e1b18] truncate">{t.kfz}</div>
                      <div className="text-[11px] font-semibold text-neutral-500 mt-0.5 truncate">{t.date} · {t.ort}</div>
                    </div>
                    
                    {/* Liter / Sorte */}
                    <div className="w-[20%] min-w-[120px] px-4 hidden md:flex flex-col">
                      <span className={`text-xs font-bold text-[#1e1b18]`}>{t.sorte}</span>
                      <span className="text-[10px] text-neutral-400">{t.liter} Liter</span>
                    </div>

                    {/* Status Pill */}
                    <div className="flex-1 px-4 flex justify-end md:justify-center">
                      <span className={`px-2.5 py-1 rounded text-[10px] font-extrabold tracking-wide uppercase ${t.absetzbar ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
                        {t.absetzbar ? 'Betrieblich' : 'Privat / Nicht absetzbar'}
                      </span>
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="text-right shrink-0 min-w-[100px]">
                    <div className="text-base font-extrabold text-[#1e1b18]">{t.amount.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</div>
                  </div>

                </div>
                {idx < filtered.length - 1 && <div className="w-full h-px bg-neutral-100 my-1 ml-14" />}
              </div>
            );
          })}
          
          {filtered.length === 0 && (
            <div className="text-center py-12 text-neutral-400 text-sm">Keine Tankungen für diesen Filter gefunden.</div>
          )}
        </div>
      </div>

      <FeedbackFooter pageTitle="Kraftstoff" route="/buchhaltung/kraftstoff" variant="full" />
    </div>
  );
}
