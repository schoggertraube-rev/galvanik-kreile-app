"use client";

import { usePageView } from "@/hooks/usePageView";
import { useState, useCallback } from "react";
import Link from "next/link";
import { ChevronRight, Camera, Upload, CheckCircle2, Calendar as CalendarIcon, ReceiptText } from "lucide-react";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";
import { BelegUploadOverlay } from "@/components/buchhaltung/BelegUploadOverlay";
import type { OcrResult } from "@/lib/buchhaltung/types";

const CATEGORIES = [
  { id: "alle", label: "Alle", color: "bg-black" },
  { id: "kraftstoff", label: "Kraftstoff", color: "bg-blue-500", iconBg: "bg-blue-50", iconColor: "text-blue-500" },
  { id: "material", label: "Material & Chemie", color: "bg-rose-500", iconBg: "bg-rose-50", iconColor: "text-rose-500" },
  { id: "bewirtung", label: "Bewirtung", color: "bg-amber-500", iconBg: "bg-amber-50", iconColor: "text-amber-600" },
  { id: "buero", label: "Büro", color: "bg-emerald-500", iconBg: "bg-emerald-50", iconColor: "text-emerald-500" },
  { id: "kfz", label: "Kfz", color: "bg-purple-500", iconBg: "bg-purple-50", iconColor: "text-purple-500" },
  { id: "energie", label: "Energie", color: "bg-teal-500", iconBg: "bg-teal-50", iconColor: "text-teal-500" },
];

export interface BelegEntry {
  id: string;
  name: string;
  date: string;
  info: string;
  categoryId: string;
  status: string;
  statusColor: string;
  amount: number;
  vst: number;
  icon: string;
  warning?: boolean;
}

const BELEGART_TO_CATEGORY: Record<string, string> = {
  tankbeleg: "kraftstoff",
  bewirtung: "bewirtung",
  rechnung: "material",
  abo: "buero",
  kassenbon: "buero",
};

function slugify(name: string): string {
  return name.toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const INITIAL_BELEGE: BelegEntry[] = [
  { id: "shell-frankfurt-ost", name: "Shell - Frankfurt-Ost", date: "02.06.2026", info: "Diesel 45,8 l", categoryId: "kraftstoff", status: "100 % absetzbar", statusColor: "bg-emerald-50 text-emerald-700", amount: 78.40, vst: 12.52, icon: "FOTO" },
  { id: "gasthaus-adler", name: "Gasthaus Adler", date: "31.05.2026", info: "Anlass fehlt", categoryId: "bewirtung", status: "70 % - prüfen", statusColor: "bg-amber-50 text-amber-700", amount: 64.00, vst: 10.22, icon: "FOTO", warning: true },
  { id: "riedel-chemie", name: "Riedel Chemie GmbH", date: "30.05.2026", info: "E-Rechnung (ZUGFeRD)", categoryId: "material", status: "100 % absetzbar", statusColor: "bg-emerald-50 text-emerald-700", amount: 1190.00, vst: 190.00, icon: "PDF" },
  { id: "microsoft-365", name: "Microsoft 365", date: "28.05.2026", info: "Abo - monatlich", categoryId: "buero", status: "100 % absetzbar", statusColor: "bg-emerald-50 text-emerald-700", amount: 12.60, vst: 2.01, icon: "PDF" },
  { id: "aral-hanau", name: "Aral - Hanau", date: "24.05.2026", info: "Diesel 41,2 l", categoryId: "kraftstoff", status: "100 % absetzbar", statusColor: "bg-emerald-50 text-emerald-700", amount: 70.90, vst: 11.32, icon: "FOTO" },
  { id: "reifen-mueller", name: "Reifen Müller", date: "19.05.2026", info: "Werkstattrechnung", categoryId: "kfz", status: "100 % absetzbar", statusColor: "bg-emerald-50 text-emerald-700", amount: 420.00, vst: 67.06, icon: "FOTO" },
  { id: "mainova-ag", name: "Mainova AG", date: "15.05.2026", info: "Stromabschlag", categoryId: "energie", status: "100 % absetzbar", statusColor: "bg-emerald-50 text-emerald-700", amount: 1960.00, vst: 312.94, icon: "PDF" },
];

export function BelegeClient() {
  usePageView();
  const [activeFilter, setActiveFilter] = useState("alle");
  const [belege, setBelege] = useState<BelegEntry[]>(INITIAL_BELEGE);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayMode, setOverlayMode] = useState<"foto" | "upload">("upload");

  const openOverlay = useCallback((mode: "foto" | "upload") => {
    setOverlayMode(mode);
    setOverlayOpen(true);
  }, []);

  const handleUploadSubmit = useCallback((result: OcrResult, filename: string, mode: "erfasst" | "entwurf") => {
    const catId = result.belegart ? BELEGART_TO_CATEGORY[result.belegart] ?? "buero" : "buero";
    const isLow = result.confidence < 85;
    const today = new Date();
    const dateStr = `${String(today.getDate()).padStart(2, "0")}.${String(today.getMonth() + 1).padStart(2, "0")}.${today.getFullYear()}`;

    const newBeleg: BelegEntry = {
      id: slugify(result.lieferant ?? "beleg") + "-" + Date.now(),
      name: result.lieferant ?? "Unbekannt",
      date: dateStr,
      info: result.belegart === "tankbeleg" && result.kraftstoff
        ? `${result.kraftstoff.sorte === "diesel" ? "Diesel" : "Super"} ${result.kraftstoff.liter} l`
        : result.belegart === "bewirtung" ? "Bewirtung"
        : result.belegart === "abo" ? "Abo"
        : filename.endsWith(".pdf") ? "E-Rechnung" : "Beleg",
      categoryId: catId,
      status: isLow || mode === "entwurf" ? (result.belegart === "bewirtung" ? "70 % - prüfen" : "prüfen") : "100 % absetzbar",
      statusColor: isLow || mode === "entwurf" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700",
      amount: result.brutto ?? 0,
      vst: result.ustBetrag ?? 0,
      icon: filename.endsWith(".pdf") ? "PDF" : "FOTO",
      warning: isLow,
    };

    setBelege(prev => [newBeleg, ...prev]);
  }, []);

  const filteredBelege = activeFilter === "alle"
    ? belege
    : belege.filter(b => b.categoryId === activeFilter);

  const recentBelege = belege.slice(0, 3);

  return (
    <div className="w-full pb-24 px-4 sm:px-6 xl:px-8 min-h-screen">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-semibold text-text-muted mt-4 mb-3">
        <Link href="/betrieb" className="hover:text-navy-900 transition-colors">Betrieb</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/buchhaltung" className="hover:text-navy-900 transition-colors">Buchhaltung</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-navy-900">Belege & Ausgaben</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <ReceiptText className="w-7 h-7 text-rose-500" />
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#2a2420] tracking-tight">Belege & Ausgaben</h1>
          </div>
          <p className="text-xs font-semibold text-neutral-500 mt-2">
            2026 · Jan–Mai · {belege.length} Belege erfasst · 94 % automatisch zugeordnet
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => openOverlay("foto")}
            className="flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-[#1e1b18] text-white rounded-xl font-bold text-sm hover:bg-black transition-colors shadow-sm min-h-[44px]"
          >
            <Camera className="w-4 h-4" /> <span className="hidden sm:inline">Beleg</span> fotografieren
          </button>
          <button
            onClick={() => openOverlay("upload")}
            className="flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-white text-[#1e1b18] rounded-xl font-bold text-sm border border-neutral-200 hover:bg-neutral-50 transition-colors shadow-sm min-h-[44px]"
          >
            <Upload className="w-4 h-4" /> Hochladen
          </button>
        </div>
      </div>

      {/* Top Dashboards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">

        {/* KPI Bar Chart Card */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-neutral-100">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-6 gap-4">
            <div className="flex gap-6 sm:gap-8">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[10px] sm:text-xs font-bold text-neutral-500 uppercase tracking-wide">Einnahmen</span>
                </div>
                <div className="text-xl sm:text-2xl font-extrabold text-[#1e1b18]">68.400 €</div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="text-[10px] sm:text-xs font-bold text-neutral-500 uppercase tracking-wide">Ausgaben</span>
                </div>
                <div className="text-xl sm:text-2xl font-extrabold text-[#1e1b18]">49.200 €</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold text-neutral-400 mb-1">Saldo - vorläufig</div>
              <div className="text-xl sm:text-2xl font-extrabold text-emerald-600">+19.200 €</div>
              <div className="flex items-center justify-end gap-1 text-[10px] font-bold text-emerald-600 mt-0.5">
                <CheckCircle2 className="w-3 h-3" /> im Griff
              </div>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="h-4 w-full flex rounded-full overflow-hidden mb-4">
            <div className="h-full bg-rose-500" style={{ width: "37%" }} />
            <div className="h-full bg-teal-500" style={{ width: "20%" }} />
            <div className="h-full bg-purple-500" style={{ width: "4%" }} />
            <div className="h-full bg-blue-500" style={{ width: "3%" }} />
            <div className="h-full bg-emerald-500" style={{ width: "3%" }} />
            <div className="h-full bg-amber-500" style={{ width: "1%" }} />
            <div className="h-full bg-neutral-400" style={{ width: "32%" }} />
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-4 sm:gap-x-5 gap-y-2 text-[10px] sm:text-[11px]">
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500" /><span className="text-neutral-500">Material</span><span className="font-bold text-[#1e1b18]">18.400 €</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-teal-500" /><span className="text-neutral-500">Energie</span><span className="font-bold text-[#1e1b18]">9.800 €</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-purple-500" /><span className="text-neutral-500">Kfz</span><span className="font-bold text-[#1e1b18]">2.100 €</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /><span className="text-neutral-500">Kraftstoff</span><span className="font-bold text-[#1e1b18]">1.240 €</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-neutral-500">Büro</span><span className="font-bold text-[#1e1b18]">1.480 €</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500" /><span className="text-neutral-500">Bewirtung</span><span className="font-bold text-[#1e1b18]">340 €</span></div>
          </div>
        </div>

        {/* Zuletzt automatisch erfasst */}
        <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-neutral-100 flex flex-col">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <h2 className="text-xs font-bold text-[#1e1b18]">Zuletzt automatisch erfasst</h2>
          </div>

          <div className="space-y-4 flex-1">
            {recentBelege.map((b, idx) => (
              <div key={b.id}>
                <Link href={`/buchhaltung/belege/${b.id}`} className="flex items-start justify-between hover:bg-neutral-50 rounded-xl p-1 -m-1 transition-colors">
                  <div className="flex gap-3">
                    <div className="px-2 py-1 bg-neutral-100 text-neutral-400 text-[9px] font-extrabold rounded shrink-0">{b.icon}</div>
                    <div>
                      <div className="text-xs font-extrabold text-[#1e1b18]">{b.name}</div>
                      <div className="text-[10px] text-neutral-400 mt-0.5">{b.date} · <span className="text-emerald-600 font-medium">{b.info}</span></div>
                    </div>
                  </div>
                  <div className="text-xs font-extrabold text-[#1e1b18] shrink-0 ml-2">{b.amount.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</div>
                </Link>
                {idx < recentBelege.length - 1 && <div className="w-full h-px bg-neutral-100 mt-4" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KI Ratgeber Section */}
      <h2 className="text-sm font-semibold text-neutral-600 mb-3">Was die KI dir rät — geprüft an den Steuerregeln</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-emerald-600 font-bold">$</span>
            <h3 className="text-sm font-extrabold text-[#1e1b18]">Bewirtung optimal nutzen</h3>
          </div>
          <div className="flex items-center gap-1 mb-3">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span className="text-[10px] font-bold text-emerald-600 tracking-wider">VERIFIZIERT</span>
          </div>
          <p className="text-xs text-neutral-600 leading-relaxed flex-1">
            Geschäftsessen sind zu <strong className="text-[#1e1b18]">70 % absetzbar</strong>. Von deinen 340 € wirken <strong className="text-[#1e1b18]">238 €</strong> steuermindernd. Bei <strong className="text-[#1e1b18]">2 Belegen</strong> fehlt noch Anlass & Teilnehmer.
          </p>
          <div className="text-[10px] text-neutral-400 mt-4 font-medium">§ 4 Abs. 5 Nr. 2 EStG</div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-blue-500 font-bold">⛽</span>
            <h3 className="text-sm font-extrabold text-[#1e1b18]">Kraftstoff — plausibel</h3>
          </div>
          <div className="flex items-center gap-1 mb-3">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span className="text-[10px] font-bold text-emerald-600 tracking-wider">VERIFIZIERT</span>
          </div>
          <p className="text-xs text-neutral-600 leading-relaxed flex-1">
            Diesel <strong className="text-[#1e1b18]">1.240 € = 1,8 % vom Umsatz</strong>. Für deinen Fuhrpark im normalen Rahmen. Zwischen <strong className="text-[#1e1b18]">12.-19. Mai</strong> fehlt eine Tankung.
          </p>
          <div className="text-[10px] text-neutral-400 mt-4 font-medium">Vollständigkeit prüfen</div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-amber-500 font-bold">🎁</span>
            <h3 className="text-sm font-extrabold text-[#1e1b18]">Geschenk-Grenze</h3>
          </div>
          <div className="flex items-center gap-1 mb-3">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span className="text-[10px] font-bold text-emerald-600 tracking-wider">VERIFIZIERT</span>
          </div>
          <p className="text-xs text-neutral-600 leading-relaxed flex-1">
            <strong className="text-[#1e1b18]">2 Geschenke</strong> an Kunden über <strong className="text-[#1e1b18]">50 € pro Person/Jahr</strong> — nicht anerkannt. Differenz: <strong className="text-[#1e1b18]">- 90 €</strong>.
          </p>
          <div className="text-[10px] text-neutral-400 mt-4 font-medium">§ 4 Abs. 5 Nr. 1 EStG - Grenze 50 €</div>
        </div>
      </div>

      {/* List Section Header */}
      <h2 className="text-sm font-semibold text-neutral-600 mb-3">Alle Belege</h2>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveFilter(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors min-h-[36px] ${
                activeFilter === cat.id && cat.id === "alle" ? "bg-[#1e1b18] text-white" :
                activeFilter === cat.id ? "bg-white border border-neutral-200 text-[#1e1b18] shadow-sm" :
                "bg-white border border-transparent text-neutral-500 hover:text-[#1e1b18] hover:border-neutral-200"
              }`}
            >
              {cat.id !== "alle" && <div className={`w-1.5 h-1.5 rounded-full ${cat.color}`} />}
              {cat.label}
            </button>
          ))}
        </div>
        <button className="flex items-center gap-2 bg-white border border-neutral-200 rounded-full px-4 py-2 text-[11px] font-bold text-neutral-500 hover:text-[#1e1b18] shadow-sm whitespace-nowrap min-h-[36px]">
          <CalendarIcon className="w-3.5 h-3.5" /> 2026 · Jan–Mai
        </button>
      </div>

      {/* List Container */}
      <div className="bg-white rounded-[2rem] border border-neutral-100 p-2 sm:p-5 shadow-sm">
        <div className="flex flex-col">
          {filteredBelege.map((beleg, idx) => {
            const cat = CATEGORIES.find(c => c.id === beleg.categoryId);
            return (
              <div key={beleg.id}>
                <Link
                  href={`/buchhaltung/belege/${beleg.id}`}
                  className="flex items-center gap-3 sm:gap-4 p-3 hover:bg-neutral-50 rounded-2xl transition-colors cursor-pointer group"
                >
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 border border-neutral-100 ${cat?.iconBg ?? "bg-neutral-50"}`}>
                    <ReceiptText className={`w-4 h-4 ${cat?.iconColor ?? "text-neutral-400"}`} />
                  </div>

                  {/* Name & Date - stacked on mobile */}
                  <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center">
                    <div className="sm:w-[35%] sm:min-w-[180px] sm:pr-4">
                      <div className="text-sm font-extrabold text-[#1e1b18] truncate">{beleg.name}</div>
                      <div className="text-[11px] text-neutral-500 mt-0.5 truncate">{beleg.date} · {beleg.info}</div>
                    </div>

                    {/* Category */}
                    <div className="hidden md:flex sm:w-[20%] sm:min-w-[120px] sm:px-4 items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${cat?.color ?? "bg-neutral-400"}`} />
                      <span className="text-xs font-bold text-[#1e1b18]">{cat?.label}</span>
                    </div>

                    {/* Status */}
                    <div className="flex sm:flex-1 sm:px-4 sm:justify-center mt-1 sm:mt-0">
                      <span className={`px-2.5 py-1 rounded text-[10px] font-extrabold tracking-wide ${beleg.statusColor} ${beleg.warning ? "animate-pulse" : ""}`}>
                        {beleg.status}
                      </span>
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="text-right shrink-0">
                    <div className="text-sm sm:text-base font-extrabold text-[#1e1b18]">{beleg.amount.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</div>
                    <div className="text-[10px] font-medium text-neutral-400">{beleg.vst.toLocaleString("de-DE", { minimumFractionDigits: 2 })} € VSt</div>
                  </div>
                </Link>
                {idx < filteredBelege.length - 1 && <div className="w-full h-px bg-neutral-100 my-1 ml-14" />}
              </div>
            );
          })}

          {filteredBelege.length === 0 && (
            <div className="text-center py-12 text-neutral-400 text-sm">Keine Belege für diesen Filter gefunden.</div>
          )}
        </div>
      </div>

      {/* Upload Overlay */}
      <BelegUploadOverlay
        open={overlayOpen}
        onClose={() => setOverlayOpen(false)}
        onSubmit={handleUploadSubmit}
        mode={overlayMode}
      />

      <FeedbackFooter pageTitle="Belege" route="/buchhaltung/belege" variant="full" />
    </div>
  );
}
