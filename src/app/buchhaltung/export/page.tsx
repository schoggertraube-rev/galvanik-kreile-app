"use client";
import { usePageView } from "@/hooks/usePageView";
import { useState } from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getBuchhaltungProvider } from "@/lib/buchhaltung";
import { ChevronRight, Download, FileText, Briefcase, CheckCircle2 } from "lucide-react";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";

function ExportContent() {
  usePageView();
  const searchParams = useSearchParams();
  const initialFormat = searchParams?.get("format") ?? "datev";
  const [activeFormat, setActiveFormat] = useState(initialFormat);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    const provider = getBuchhaltungProvider();
    const now = new Date();
    const zeitraum = {
      von: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
      bis: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`,
    };

    let result;
    if (activeFormat === "datev") result = await provider.exportDatev(zeitraum);
    else if (activeFormat === "lexware") result = await provider.exportLexware(zeitraum);
    else result = await provider.exportSteuerberaterPaket(zeitraum);

    setExported(`${result.dateiname} (${result.anzahlBuchungen} Buchungen)`);
    setExporting(false);
  };

  const FORMATS = [
    { id: "datev", label: "DATEV-EXTF", desc: "Buchungsstapel im EXTF-Format (SKR03) inkl. Belegbilder.", icon: Download },
    { id: "lexware", label: "Lexware / CSV", desc: "Standard-CSV für Lexware oder Excel-Tabellenkalkulation.", icon: FileText },
    { id: "steuerberater", label: "Steuerberater-ZIP", desc: "Komplettpaket: kontierte Buchungen, Belege, BWA — ein ZIP, ein Klick.", icon: Briefcase },
  ];

  return (
    <div className="w-full pb-24 px-4 sm:px-6 xl:px-8">
      <div className="flex items-center gap-2 text-xs font-semibold text-text-muted mt-4 mb-3">
        <Link href="/" className="hover:text-navy-900 transition-colors">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/buchhaltung" className="hover:text-navy-900 transition-colors">Buchhaltung</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-navy-900">Export</span>
      </div>

      <h1 className="text-2xl font-extrabold text-navy-900 mb-1">Export & Steuerberater</h1>
      <p className="text-sm text-text-muted mb-8">Daten exportieren für DATEV, Lexware oder als ZIP für den Steuerberater.</p>

      {exported && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <div>
            <p className="text-sm font-bold text-emerald-800">Export erfolgreich (Demo)</p>
            <p className="text-xs text-emerald-700">{exported}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {FORMATS.map(f => {
          const Icon = f.icon;
          return (
            <button
              key={f.id}
              onClick={() => { setActiveFormat(f.id); setExported(null); }}
              className={`text-left bg-white rounded-2xl border shadow-sm p-6 transition-all cursor-pointer ${
                activeFormat === f.id ? "border-navy-900 shadow-md ring-1 ring-navy-900" : "border-neutral-gray-100 hover:shadow-lg hover:-translate-y-0.5"
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-neutral-gray-50 flex items-center justify-center mb-3">
                <Icon className="w-5 h-5 text-navy-900" />
              </div>
              <h3 className="text-lg font-extrabold text-navy-900">{f.label}</h3>
              <p className="text-xs text-text-muted mt-1">{f.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Export-Aktion */}
      <div className="bg-white rounded-2xl border border-neutral-gray-100 shadow-sm p-6">
        <h2 className="text-base font-extrabold text-navy-900 mb-2">Export starten</h2>
        <p className="text-sm text-text-muted mb-4">
          Format: <strong>{FORMATS.find(f => f.id === activeFormat)?.label}</strong> · Zeitraum: laufender Monat
        </p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-6 py-3 bg-navy-900 text-white rounded-xl font-bold text-sm hover:bg-navy-800 transition-colors active:scale-[0.98] disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {exporting ? "Wird exportiert..." : "Jetzt exportieren (Demo)"}
        </button>
        <p className="text-[10px] text-text-muted mt-3">Demo-Modus: Erzeugt eine Mock-Datei. Echte DATEV-API und ZIP-Erstellung folgen mit dem Provider.</p>
      </div>

      <FeedbackFooter pageTitle="Export" route="/buchhaltung/export" variant="full" />
    </div>
  );
}

export default function ExportPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><div className="w-8 h-8 border-3 border-accent-orange/20 border-t-accent-orange rounded-full animate-spin" /></div>}>
      <ExportContent />
    </Suspense>
  );
}
