"use client";

import { usePageView } from "@/hooks/usePageView";
import { useState, useMemo } from "react";
import Link from "next/link";
import { getBuchhaltungProvider } from "@/lib/buchhaltung";
import { useEffect } from "react";
import type { Beleg } from "@/lib/buchhaltung/types";
import { pruefeBelegHinweise } from "@/lib/buchhaltung/regeln";
import { ChevronRight, Receipt, Upload, Camera, Filter, Search } from "lucide-react";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";

const KATEGORIE_CHIPS = [
  { id: "alle", label: "Alle" },
  { id: "kat-kraftstoff", label: "Kraftstoff" },
  { id: "kat-material", label: "Material & Chemie" },
  { id: "kat-bewirtung", label: "Bewirtung" },
  { id: "kat-versicherung", label: "Versicherungen" },
  { id: "kat-miete", label: "Miete" },
  { id: "kat-sonstiges", label: "Sonstiges" },
];

const STATUS_COLORS: Record<string, string> = {
  pruefen: "bg-amber-50 text-amber-700 border-amber-200",
  erfasst: "bg-emerald-50 text-emerald-700 border-emerald-200",
  festgeschrieben: "bg-blue-50 text-blue-700 border-blue-200",
  storniert: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_LABELS: Record<string, string> = {
  pruefen: "Prüfen",
  erfasst: "Erfasst",
  festgeschrieben: "Festgeschrieben",
  storniert: "Storniert",
};

export function BelegeClient() {
  usePageView();
  const [belege, setBelege] = useState<Beleg[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeKategorie, setActiveKategorie] = useState("alle");
  const [suchbegriff, setSuchbegriff] = useState("");
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    const load = async () => {
      const provider = getBuchhaltungProvider();
      const data = await provider.listBelege();
      setBelege(data);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    let result = [...belege];
    if (activeKategorie !== "alle") {
      result = result.filter(b => b.kategorieId === activeKategorie);
    }
    if (suchbegriff) {
      const q = suchbegriff.toLowerCase();
      result = result.filter(b => b.lieferantText?.toLowerCase().includes(q) || b.skrKonto?.includes(q));
    }
    return result;
  }, [belege, activeKategorie, suchbegriff]);

  const gesamtBrutto = belege.reduce((s, b) => s + (b.brutto ?? 0), 0);
  const gesamtNetto = belege.reduce((s, b) => s + (b.netto ?? 0), 0);
  const unsicherCount = belege.filter(b => b.status === "pruefen").length;

  const handleMockUpload = async () => {
    const provider = getBuchhaltungProvider();
    const newBeleg = await provider.createBelegFromUpload({
      data: "", filename: "foto-upload.jpg", mimeType: "image/jpeg",
    });
    setBelege(prev => [newBeleg, ...prev]);
    setShowUpload(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-3 border-accent-orange/20 border-t-accent-orange rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full pb-24 px-4 sm:px-6 xl:px-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-semibold text-text-muted mt-4 mb-3">
        <Link href="/" className="hover:text-navy-900 transition-colors">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/buchhaltung" className="hover:text-navy-900 transition-colors">Buchhaltung</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-navy-900">Belege & Ausgaben</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">Belege & Ausgaben</h1>
          <p className="text-sm text-text-muted mt-1">
            {belege.length} Belege · {unsicherCount > 0 && <span className="text-amber-600 font-bold">{unsicherCount} prüfen</span>}
            {unsicherCount > 0 && " · "}
            Summe: {gesamtBrutto.toLocaleString("de-DE")} € brutto · {gesamtNetto.toLocaleString("de-DE")} € netto
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowUpload(true)} className="flex items-center gap-2 px-4 py-3 bg-navy-900 text-white rounded-xl font-bold text-sm hover:bg-navy-800 transition-colors shadow-sm active:scale-[0.98]">
            <Camera className="w-4 h-4" /> Beleg fotografieren
          </button>
          <button onClick={handleMockUpload} className="flex items-center gap-2 px-4 py-3 bg-white text-text-muted rounded-xl font-semibold text-sm border border-neutral-gray-200 hover:text-navy-900 transition-colors shadow-sm active:scale-[0.98]">
            <Upload className="w-4 h-4" /> Hochladen
          </button>
        </div>
      </div>

      {/* KI-Hinweise */}
      {unsicherCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <Receipt className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-800">{unsicherCount} Belege brauchen deinen Blick</p>
            <p className="text-xs text-amber-700 mt-1">Die OCR-Erkennung ist bei diesen Belegen unsicher. Bitte prüfe die Daten manuell.</p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2 bg-white border border-neutral-gray-100 rounded-xl px-3 py-2 shadow-sm flex-1 max-w-sm">
          <Search className="w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Lieferant, Beleg, Konto..."
            value={suchbegriff}
            onChange={(e) => setSuchbegriff(e.target.value)}
            className="text-sm bg-transparent outline-none flex-1 text-navy-900 placeholder:text-text-muted"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {KATEGORIE_CHIPS.map(chip => (
            <button
              key={chip.id}
              onClick={() => setActiveKategorie(chip.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                activeKategorie === chip.id
                  ? "bg-navy-900 text-white"
                  : "bg-white border border-neutral-gray-200 text-text-muted hover:text-navy-900"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Belegliste */}
      <div className="space-y-3">
        {filtered.map(beleg => {
          const hinweise = pruefeBelegHinweise(beleg);
          return (
            <Link
              key={beleg.id}
              href={`/buchhaltung/belege/${beleg.id}`}
              className="group bg-white rounded-2xl border border-neutral-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 p-5 flex items-center gap-5 cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-neutral-gray-50 flex items-center justify-center shrink-0">
                <Receipt className="w-5 h-5 text-text-muted" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-navy-900 truncate">{beleg.lieferantText ?? "Unbekannt"}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_COLORS[beleg.status]}`}>
                    {STATUS_LABELS[beleg.status]}
                  </span>
                </div>
                <p className="text-xs text-text-muted mt-0.5">
                  {beleg.belegdatum ? new Date(beleg.belegdatum).toLocaleDateString("de-DE") : "—"} · {beleg.belegart ?? "—"} · {beleg.skrKonto ?? "—"}
                  {beleg.ocrConfidence !== undefined && ` · ${beleg.ocrConfidence.toFixed(0)} % Confidence`}
                </p>
                {hinweise.length > 0 && (
                  <p className="text-[11px] text-amber-600 font-semibold mt-1">{hinweise[0].text}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="text-lg font-extrabold text-navy-900">{beleg.brutto?.toLocaleString("de-DE")} €</div>
                <div className="text-xs text-text-muted">{beleg.netto?.toLocaleString("de-DE")} € netto</div>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-gray-300 group-hover:text-accent-orange transition-colors shrink-0" />
            </Link>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-text-muted text-sm">Keine Belege gefunden.</div>
        )}
      </div>

      {/* Upload Overlay */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-elevated border border-neutral-gray-100 w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-extrabold text-navy-900 mb-4">Beleg fotografieren / hochladen</h3>
            <p className="text-sm text-text-muted mb-6">Wähle ein Foto oder PDF aus. Die KI erkennt Lieferant, Betrag, Datum und Kategorie automatisch.</p>
            <div className="flex gap-3">
              <button onClick={handleMockUpload} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-navy-900 text-white rounded-xl font-bold text-sm hover:bg-navy-800 transition-colors">
                <Camera className="w-4 h-4" /> Demo: Beleg simulieren
              </button>
              <button onClick={() => setShowUpload(false)} className="px-4 py-3 bg-neutral-gray-100 text-navy-900 rounded-xl font-semibold text-sm hover:bg-neutral-gray-200 transition-colors">
                Abbrechen
              </button>
            </div>
            <p className="text-[10px] text-text-muted mt-4 text-center">Demo-Modus: Beleg wird mit Beispieldaten erzeugt.</p>
          </div>
        </div>
      )}

      <FeedbackFooter pageTitle="Belege" route="/buchhaltung/belege" variant="full" />
    </div>
  );
}
