"use client";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BackButton } from "@/components/ui/BackButton";

import { usePageView } from "@/hooks/usePageView";
import { useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Camera, Upload, CheckCircle2, Calendar as CalendarIcon, ReceiptText, WifiOff } from "lucide-react";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";
import { BelegUploadOverlay } from "@/components/buchhaltung/BelegUploadOverlay";
import type { OcrResult, Beleg } from "@/lib/buchhaltung/types";
import { createBelegAction, assignBelegeBatchAction } from "@/app/buchhaltung/actions";
import { useOfflineManager } from "../../../hooks/useOfflineManager";
import { MassenzuordnungModal } from "@/components/buchhaltung/MassenzuordnungModal";

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
const EMPTY_BELEGE: Beleg[] = [];

function slugify(name: string): string {
  return name.toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function formatStatus(status: string) {
  if (status === 'pruefen') return 'Prüfen';
  if (status === 'erfasst') return 'Erfasst';
  if (status === 'festgeschrieben') return 'Festgeschrieben';
  if (status === 'storniert') return 'Storniert';
  return status;
}

function getStatusColor(status: string) {
  if (status === 'pruefen') return 'bg-amber-50 text-amber-700';
  if (status === 'storniert') return 'bg-rose-50 text-rose-700';
  return 'bg-emerald-50 text-emerald-700';
}

function mapBelegToEntry(b: Beleg): BelegEntry {
  return {
    id: b.id,
    name: b.lieferantText || "Unbekannter Lieferant",
    date: b.belegdatum ? new Date(b.belegdatum).toLocaleDateString("de-DE") : new Date(b.erfasstAm).toLocaleDateString("de-DE"),
    info: b.belegart === 'tankbeleg' ? 'Tankbeleg' : b.belegart === 'bewirtung' ? 'Bewirtung' : 'Rechnung',
    categoryId: b.kategorieId || "buero",
    status: formatStatus(b.status),
    statusColor: getStatusColor(b.status),
    amount: b.brutto || 0,
    vst: b.ustBetrag || 0,
    icon: b.originalFormat?.includes('pdf') ? 'PDF' : 'FOTO',
    warning: b.status === 'pruefen'
  };
}

export function BelegeClient({ initialBelege = EMPTY_BELEGE }: { initialBelege?: Beleg[] }) {
  usePageView();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeFilter = searchParams.get("kategorie") || "alle";
  const viewFilter = searchParams.get("view") || "alle";

  const setActiveFilter = (catId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (catId === "alle") {
      params.delete("kategorie");
    } else {
      params.set("kategorie", catId);
    }
    router.push(`/buchhaltung/belege?${params.toString()}`);
  };

  const setViewFilter = (view: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (view === "alle") {
      params.delete("view");
    } else {
      params.set("view", view);
    }
    router.push(`/buchhaltung/belege?${params.toString()}`);
  };

  const [previousInitialBelege, setPreviousInitialBelege] = useState(initialBelege);
  const [belege, setBelege] = useState<Beleg[]>(initialBelege);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayMode, setOverlayMode] = useState<"foto" | "upload">("upload");
  const offlineManager = useOfflineManager();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [massenzuordnungOpen, setMassenzuordnungOpen] = useState(false);
  
  if (initialBelege !== previousInitialBelege) {
    setPreviousInitialBelege(initialBelege);
    setBelege(initialBelege);
  }
  
  const belegeEntries = useMemo(() => belege.map(mapBelegToEntry), [belege]);

  const openOverlay = useCallback((mode: "foto" | "upload") => {
    setOverlayMode(mode);
    setOverlayOpen(true);
  }, []);

  const handleUploadSubmit = useCallback(async (result: OcrResult, filename: string, mode: "erfasst" | "entwurf", rawFile?: File) => {
    const fallbackId = slugify(result.lieferant ?? "beleg") + "-" + Date.now();
    const tempBeleg: Beleg = {
      id: fallbackId,
      erfasstAm: new Date().toISOString(),
      lieferantText: result.lieferant,
      brutto: result.brutto || 0,
      netto: result.netto || 0,
      ustBetrag: result.ustBetrag || 0,
      kategorieId: result.belegart ? BELEGART_TO_CATEGORY[result.belegart] ?? "buero" : "buero",
      belegart: result.belegart,
      status: 'pruefen',
      originalDatei: filename,
      erstelltVon: 'local',
      vorsteuerAbzug: true,
      absetzbarProzent: 100
    };

    // Optimistic UI update
    setBelege(prev => [tempBeleg, ...prev]);
    
    if (rawFile) {
      const formData = new FormData();
      formData.append('file', rawFile);
      formData.append('filename', filename);
      formData.append('mimeType', rawFile.type || 'application/octet-stream');
      
      try {
        const createdBeleg = await createBelegAction(formData);
        setBelege(prev => prev.map(b => b.id === fallbackId ? createdBeleg : b));
      } catch (err) {
        console.warn("Upload failed, queueing offline outbox", err);
        offlineManager.enqueueAction({
          id: crypto.randomUUID(),
          type: "BUCHHALTUNG_BELEG_UPLOAD",
          payload: { filename, result },
          timestamp: new Date().toISOString(),
          status: "pending"
        });
      }
    }
  }, [offlineManager]);

  const filteredBelege = belegeEntries; // Data is already filtered by server

  const recentBelege = belegeEntries.slice(0, 3);

  const toggleSelection = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleMassenzuordnung = async (kontoId: string, kostenstelleId: string) => {
    await assignBelegeBatchAction(Array.from(selectedIds), { kontoId, kostenstelleId });
    // Optimistic uncheck
    setSelectedIds(new Set());
    // In a real app we'd refresh the data here.
  };

  return (
    <div className="w-full pb-24 px-4 sm:px-6 xl:px-8 min-h-screen">
      <div className="mb-6">
        <Breadcrumb items={[{label:'Home',href:'/'}, {label:'Buchhaltung',href:'/buchhaltung'}, {label:'Belege'}]} />
        <BackButton label="Buchhaltung" href="/buchhaltung" />
      </div>
      

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
          <p className="text-xs font-semibold text-neutral-500 mt-2 flex items-center gap-2">
            2026 · Jan–Mai · {belegeEntries.length} Belege erfasst
            {!navigator.onLine && (
              <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                <WifiOff className="w-3 h-3" /> Lokale Ansicht aktiv
              </span>
            )}
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

      {/* View Filter für Abschluss */}
      <div className="flex flex-wrap items-center gap-3 mb-6 bg-white border border-neutral-100 p-2 rounded-2xl shadow-sm">
        <span className="text-xs font-bold text-neutral-400 pl-2 uppercase tracking-wide">Prüfen:</span>
        <button
          onClick={() => setViewFilter("alle")}
          className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors ${
            viewFilter === "alle" ? "bg-neutral-100 text-[#1e1b18]" : "text-neutral-500 hover:text-[#1e1b18]"
          }`}
        >
          Alle
        </button>
        <button
          onClick={() => setViewFilter("missingKonto")}
          className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors flex items-center gap-1 ${
            viewFilter === "missingKonto" ? "bg-rose-100 text-rose-700" : "text-neutral-500 hover:text-rose-600"
          }`}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Konto fehlt
        </button>
        <button
          onClick={() => setViewFilter("missingKostenstelle")}
          className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors flex items-center gap-1 ${
            viewFilter === "missingKostenstelle" ? "bg-amber-100 text-amber-700" : "text-neutral-500 hover:text-amber-600"
          }`}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Kostenstelle fehlt
        </button>
        <button
          onClick={() => setViewFilter("nichtAufAuftrag")}
          className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors flex items-center gap-1 ${
            viewFilter === "nichtAufAuftrag" ? "bg-blue-100 text-blue-700" : "text-neutral-500 hover:text-blue-600"
          }`}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Kein Auftrag
        </button>
      </div>

      {/* List Container */}
      <div className="bg-white rounded-4xl border border-neutral-100 p-2 sm:p-5 shadow-sm">
        <div className="flex flex-col">
          {filteredBelege.map((beleg, idx) => {
            const cat = CATEGORIES.find(c => c.id === beleg.categoryId);
            const isSelected = selectedIds.has(beleg.id);
            return (
              <div key={beleg.id}>
                <div
                  className={`flex items-center gap-3 sm:gap-4 p-3 hover:bg-neutral-50 rounded-2xl transition-colors cursor-pointer group ${isSelected ? 'bg-blue-50/50' : ''}`}
                  onClick={(e) => {
                    // Navigation logic: only if not clicking the checkbox or its container
                    if ((e.target as HTMLElement).closest('.checkbox-container')) return;
                    router.push(`/buchhaltung/belege/${beleg.id}`);
                  }}
                >
                  <div className="checkbox-container p-2 -ml-2" onClick={(e) => toggleSelection(beleg.id, e)}>
                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-neutral-300'}`}>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                    </div>
                  </div>

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
                </div>
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

      {/* Sticky Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1e1b18] text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 z-40 animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="font-bold text-sm">
            {selectedIds.size} Belege ausgewählt
          </div>
          <div className="h-6 w-px bg-white/20" />
          <button
            onClick={() => setMassenzuordnungOpen(true)}
            className="text-sm font-bold bg-white text-[#1e1b18] px-4 py-2 rounded-xl hover:bg-neutral-100 transition-colors"
          >
            Massenzuordnung
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-sm font-bold text-neutral-400 hover:text-white transition-colors"
          >
            Abbrechen
          </button>
        </div>
      )}

      <MassenzuordnungModal
        isOpen={massenzuordnungOpen}
        onClose={() => setMassenzuordnungOpen(false)}
        onAssign={handleMassenzuordnung}
        count={selectedIds.size}
      />
    </div>
  );
}
