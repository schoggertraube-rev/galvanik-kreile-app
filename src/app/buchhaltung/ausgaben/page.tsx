"use client";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BackButton } from "@/components/ui/BackButton";
import { usePageView } from "@/hooks/usePageView";
import { useState, useEffect } from "react";
import Link from "next/link";
import { BarChart3, ChevronRight, Database, Wallet } from "lucide-react";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";
import { getAusgabenKategorien } from '@/app/buchhaltung/analysis.actions';

export default function AusgabenPage() {
  usePageView();

  const [categories, setCategories] = useState<Awaited<ReturnType<typeof getAusgabenKategorien>>>([]);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    getAusgabenKategorien().then(setCategories).catch(() => setLoadError(true));
  }, []);

  const gesamt = categories.reduce((s, k) => s + k.sum, 0);
  const receiptCount = categories.reduce((sum, entry) => sum + entry.count, 0);
  const largest = categories[0];

  return (
    <div className="w-full pb-24 px-4 sm:px-6 xl:px-8 min-h-screen">
      <div className="mb-6">
        <Breadcrumb items={[{label:'Home',href:'/'}, {label:'Buchhaltung',href:'/buchhaltung'}, {label:'Ausgaben'}]} />
        <BackButton label="Buchhaltung" href="/buchhaltung" />
      </div>
      
      
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-semibold text-text-muted mt-4 mb-3">
        <Link href="/betrieb" className="hover:text-navy-900 transition-colors">Betrieb</Link>
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
            Gesamter erfasster Datenbestand · ohne simulierte Budget- oder Vorjahreswerte
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Gesamtausgaben</div>
          <div className="text-3xl font-extrabold text-rose-600">{gesamt.toLocaleString("de-DE")} €</div>
        </div>
      </div>

      <h2 className="text-sm font-semibold text-neutral-600 mb-3">Datenbasis</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-neutral-100 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-full blur-3xl -mr-10 -mt-10 opacity-60" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-5 h-5 text-rose-500" />
              <h3 className="text-sm font-extrabold text-[#1e1b18]">Größte erfasste Kategorie</h3>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed">
              {largest
                ? <><strong className="text-[#1e1b18]">{largest.label}</strong> enthält {largest.count} Belege mit zusammen <strong className="text-rose-600">{largest.sum.toLocaleString("de-DE")} €</strong>.</>
                : 'Noch keine nicht stornierten Belege erfasst.'}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-neutral-100 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -mr-10 -mt-10 opacity-60" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <Database className="w-5 h-5 text-blue-500" />
              <h3 className="text-sm font-extrabold text-[#1e1b18]">Belastbare Grundlage</h3>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed">
              {receiptCount} Belege in {categories.length} Kategorien. Budget- und Trendwarnungen erscheinen erst, wenn dafür echte Sollwerte und Vergleichsperioden gespeichert sind.
            </p>
          </div>
        </div>
      </div>

      {loadError && <p className="mb-6 text-sm font-semibold text-rose-600">Ausgabendaten konnten nicht geladen werden.</p>}

      {/* Kategorie-Karten */}
      <h2 className="text-sm font-semibold text-neutral-600 mb-3">Detail-Aufschlüsselung</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {categories.map(k => {
          const anteilValue = gesamt > 0 ? (k.sum / gesamt) * 100 : 0;
          const anteil = anteilValue.toFixed(1);
          return (
            <Link
              key={k.id}
              href={k.id === 'unassigned' ? '/buchhaltung/belege' : `/buchhaltung/belege?kategorie=${encodeURIComponent(k.id)}`}
              className="group bg-white rounded-3xl border border-neutral-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 p-6 flex flex-col"
            >
              <div className="flex items-start justify-between mb-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${k.iconBg}`}>
                  <div className={`w-4 h-4 rounded-full ${k.color}`} />
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-50 text-neutral-500">
                    Ist-Daten
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
                  <span>{k.count} Belege</span>
                </div>
                <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${k.color}`} style={{ width: `${Math.min(100, anteilValue)}%` }} />
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
