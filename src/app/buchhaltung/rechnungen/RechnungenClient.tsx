"use client";
import { usePageView } from "@/hooks/usePageView";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Filter, AlertTriangle, CheckCircle2, FileText, Download } from "lucide-react";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";
import { Ausgangsrechnung } from "@/lib/buchhaltung/types";

export function RechnungenClient({ initialRechnungen, offeneSumme, ueberfaelligSumme }: { initialRechnungen: Ausgangsrechnung[], offeneSumme: number, ueberfaelligSumme: number, initialFilter: any }) {
  usePageView();
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = searchParams?.get("status") || "alle";

  const setFilter = (newStatus: string) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (newStatus === "alle") {
      params.delete("status");
    } else {
      params.set("status", newStatus);
    }
    router.push("?" + params.toString());
  };

  const mapStatusToColor = (s: string) => {
    if (s === "offen") return "bg-blue-50 text-blue-600";
    if (s === "teilbezahlt") return "bg-blue-50 text-blue-600";
    if (s === "ueberfaellig" || s === "Überfällig") return "bg-amber-50 text-amber-600";
    if (s === "gemahnt" || s === "mahnung") return "bg-rose-50 text-rose-600";
    if (s === "bezahlt") return "bg-emerald-50 text-emerald-600";
    return "bg-neutral-100 text-neutral-600";
  };

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
            <FileText className="w-7 h-7 text-navy-900" />
            <h1 className="text-3xl font-extrabold text-[#1e1b18] tracking-tight">Ausgangsrechnungen</h1>
          </div>
          <p className="text-xs font-semibold text-neutral-500 mt-2">
            Alle Rechnungen, Offene Posten und Mahnungen
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link 
            href="/buchhaltung/rechnungen/neu"
            className="flex items-center gap-2 px-5 py-2.5 bg-navy-900 text-white rounded-full text-sm font-bold hover:bg-navy-800 transition-colors active:scale-95"
          >
            Neue Rechnung
          </Link>
        </div>
      </div>

      {/* Top Dashboards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
        
        {/* Card 1 */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-neutral-100 flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -mr-10 -mt-10 opacity-60" />
          <div className="relative">
            <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Offene Forderungen</div>
            <div className="text-3xl font-extrabold text-[#1e1b18] mb-2">{offeneSumme.toLocaleString("de-DE", {minimumFractionDigits: 2})} €</div>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-neutral-400" />
              <span className="text-[11px] font-semibold text-neutral-500">Noch nicht fällig / im Zeitplan</span>
            </div>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-neutral-100 flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-full blur-3xl -mr-10 -mt-10 opacity-60" />
          <div className="relative">
            <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Überfällig & Mahnungen</div>
            <div className="text-3xl font-extrabold text-[#1e1b18] mb-2">{ueberfaelligSumme.toLocaleString("de-DE", {minimumFractionDigits: 2})} €</div>
            <div className="flex items-center gap-1">
              <AlertTriangle className={`w-3 h-3 ${ueberfaelligSumme > 0 ? "text-amber-500" : "text-neutral-400"}`} />
              <span className={`text-[11px] font-semibold ${ueberfaelligSumme > 0 ? "text-amber-600" : "text-neutral-500"}`}>Sofortiger Handlungsbedarf</span>
            </div>
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
            { id: "ueberfaellig", label: "Überfällig", color: "bg-amber-500" },
            { id: "bezahlt", label: "Bezahlt", color: "bg-emerald-500" },
            { id: "storniert", label: "Storniert", color: "bg-neutral-500" },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors ${
                statusFilter === f.id ? "bg-navy-900 text-white" :
                "bg-white border border-transparent text-neutral-500 hover:text-[#1e1b18] hover:border-neutral-200"
              }`}
            >
              {f.id !== "alle" && <div className={`w-1.5 h-1.5 rounded-full ${f.color}`} />}
              {f.label}
            </button>
          ))}
        </div>
        <button className="flex items-center gap-2 text-[11px] font-bold text-neutral-500 hover:text-[#1e1b18] px-3 py-1.5 rounded-full hover:bg-white transition-colors border border-transparent hover:border-neutral-200">
          <Filter className="w-3.5 h-3.5" />
          Mehr Filter
        </button>
      </div>

      {/* List Container */}
      <div className="bg-white rounded-4xl border border-neutral-100 p-2 sm:p-5 shadow-sm">
        <div className="flex flex-col">
          {initialRechnungen.map((t, idx) => {
            const isWarning = ["ueberfaellig", "gemahnt", "Überfällig", "mahnung"].includes(t.status) || (new Date(t.faelligAm || "") < new Date() && ["offen", "teilbezahlt"].includes(t.status));
            
            return (
              <div key={t.id}>
                <Link href={`/buchhaltung/rechnungen/${t.id}`} className="flex items-center gap-4 p-3 hover:bg-neutral-50 rounded-2xl transition-colors group">
                  
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 border border-neutral-100 ${isWarning ? 'bg-amber-50' : 'bg-neutral-50'}`}>
                    <FileText className={`w-4 h-4 ${isWarning ? 'text-amber-500' : 'text-neutral-400'}`} />
                  </div>
                  
                  {/* Name & Date */}
                  <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center">
                    <div className="w-full md:w-[40%] min-w-[200px] pr-4 mb-2 md:mb-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-[#1e1b18] truncate">{t.kundeName || "Kunde " + t.kundeId}</span>
                        {isWarning && <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />}
                      </div>
                      <div className="text-[11px] font-semibold text-neutral-500 mt-0.5 flex items-center gap-1.5 truncate">
                        <span className="text-neutral-400">{t.nummer}</span>
                        <span className="w-1 h-1 rounded-full bg-neutral-300" />
                        <span>Datum: {new Date(t.datum).toLocaleDateString("de-DE")}</span>
                      </div>
                    </div>
                    
                    {/* Status Pill */}
                    <div className="w-full md:flex-1 px-0 md:px-4 flex justify-start md:justify-center items-center">
                      <span className={`px-2.5 py-1 rounded text-[10px] font-extrabold tracking-wide uppercase ${mapStatusToColor(t.status)}`}>
                        {t.status}
                      </span>
                    </div>
                    
                    {/* Fällig */}
                    <div className="hidden lg:flex w-[120px] justify-center items-center">
                      <span className={`text-[11px] font-bold ${isWarning ? 'text-amber-600' : 'text-neutral-400'}`}>
                        Fällig: {t.faelligAm ? new Date(t.faelligAm).toLocaleDateString("de-DE") : "-"}
                      </span>
                    </div>
                  </div>

                  {/* Amount & Arrow */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <div className="text-base font-extrabold text-[#1e1b18]">{(Number(t.brutto) || 0).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-navy-900 transition-colors" />
                  </div>

                </Link>
                {idx < initialRechnungen.length - 1 && <div className="w-full h-px bg-neutral-100 my-1 ml-14" />}
              </div>
            );
          })}
          
          {initialRechnungen.length === 0 && (
            <div className="text-center py-12 text-neutral-400 text-sm font-semibold">Keine Rechnungen für diesen Filter gefunden.</div>
          )}
        </div>
      </div>

      <FeedbackFooter pageTitle="Rechnungen" route="/buchhaltung/rechnungen" variant="full" />
    </div>
  );
}
