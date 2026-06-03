"use client";

import { usePageView } from "@/hooks/usePageView";
import { useState, useEffect } from "react";
import Link from "next/link";
import { getBuchhaltungProvider } from "@/lib/buchhaltung";
import type { BelegDetail } from "@/lib/buchhaltung/types";
import { ChevronRight, FileText, CheckCircle2, XCircle, Edit3, ArrowLeft } from "lucide-react";

export function BelegDetailClient({ id }: { id: string }) {
  usePageView();
  const [beleg, setBeleg] = useState<BelegDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      const provider = getBuchhaltungProvider();
      const data = await provider.getBeleg(id);
      setBeleg(data);
      setLoading(false);
    };
    load();
  }, [id]);

  const handleFreigeben = async () => {
    if (!beleg) return;
    const provider = getBuchhaltungProvider();
    const updated = await provider.freigebenBeleg(beleg.id);
    setBeleg({ ...beleg, ...updated, positionen: beleg.positionen, kiHinweise: beleg.kiHinweise });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading || !beleg) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-3 border-accent-orange/20 border-t-accent-orange rounded-full animate-spin" />
      </div>
    );
  }

  const STATUS_COLORS: Record<string, string> = {
    pruefen: "bg-amber-50 text-amber-700 border-amber-200",
    erfasst: "bg-emerald-50 text-emerald-700 border-emerald-200",
    festgeschrieben: "bg-blue-50 text-blue-700 border-blue-200",
    storniert: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <div className="w-full pb-24 px-4 sm:px-6 xl:px-8">
      <div className="flex items-center gap-2 text-xs font-semibold text-text-muted mt-4 mb-3">
        <Link href="/" className="hover:text-navy-900 transition-colors">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/buchhaltung" className="hover:text-navy-900 transition-colors">Buchhaltung</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/buchhaltung/belege" className="hover:text-navy-900 transition-colors">Belege</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-navy-900">Detail</span>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <Link href="/buchhaltung/belege" className="flex items-center gap-2 text-sm font-bold text-text-muted hover:text-navy-900 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Zurück zu Belegen
        </Link>
      </div>

      {saved && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 text-sm font-bold text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Änderungen gespeichert
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6">
        {/* Vorschau */}
        <div className="bg-white border border-neutral-gray-100 rounded-2xl shadow-sm p-6">
          <h2 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-3">Originalbeleg</h2>
          <div className="aspect-[3/4] bg-neutral-gray-50 rounded-xl flex items-center justify-center border-2 border-dashed border-neutral-gray-200">
            <div className="text-center">
              <FileText className="w-12 h-12 text-neutral-gray-300 mx-auto mb-2" />
              <p className="text-xs text-text-muted">{beleg.originalDatei}</p>
              <p className="text-[10px] text-text-muted mt-1">Format: {beleg.originalFormat?.toUpperCase()}</p>
              <p className="text-[10px] text-accent-orange font-bold mt-2">Demo — kein echtes Bild hinterlegt</p>
            </div>
          </div>
        </div>

        {/* OCR-Felder */}
        <div className="bg-white border border-neutral-gray-100 rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-extrabold text-navy-900">Erkannte Daten</h2>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${STATUS_COLORS[beleg.status]}`}>
              {beleg.status}
            </span>
          </div>

          <div className="space-y-4">
            <Field label="Lieferant" value={beleg.lieferantText ?? "—"} />
            <Field label="Datum" value={beleg.belegdatum ? new Date(beleg.belegdatum).toLocaleDateString("de-DE") : "—"} />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Brutto" value={beleg.brutto ? `${beleg.brutto.toLocaleString("de-DE")} €` : "—"} />
              <Field label="Netto" value={beleg.netto ? `${beleg.netto.toLocaleString("de-DE")} €` : "—"} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="USt-Satz" value={beleg.ustSatz ? `${beleg.ustSatz} %` : "—"} />
              <Field label="USt-Betrag" value={beleg.ustBetrag ? `${beleg.ustBetrag.toLocaleString("de-DE")} €` : "—"} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Kategorie" value={beleg.kategorie?.name ?? beleg.kategorieId ?? "—"} />
              <Field label="SKR-Konto" value={beleg.skrKonto ?? "—"} />
            </div>
            <Field label="OCR Confidence" value={beleg.ocrConfidence ? `${beleg.ocrConfidence.toFixed(1)} %` : "—"} highlight={beleg.ocrConfidence !== undefined && beleg.ocrConfidence < 85} />
            <Field label="Absetzbar" value={`${beleg.absetzbarProzent} %`} sub={beleg.absetzbarGrund} />
          </div>

          {/* KI-Hinweise */}
          {beleg.kiHinweise.length > 0 && (
            <div className="mt-6 space-y-2">
              <h3 className="text-sm font-bold text-navy-900">KI-Hinweise</h3>
              {beleg.kiHinweise.map((h, i) => (
                <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs">
                  <span className="font-bold text-amber-800">{h.regel}</span>
                  {h.paragraf && <span className="text-amber-600 ml-2">({h.paragraf})</span>}
                  <p className="text-amber-700 mt-1">{h.text}</p>
                </div>
              ))}
            </div>
          )}

          {/* Kraftstoff-Detail */}
          {beleg.kraftstoffDetail && (
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h3 className="text-sm font-bold text-blue-800 mb-2">Tankbeleg-Details</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <span className="text-blue-600">Sorte: <strong>{beleg.kraftstoffDetail.sorte}</strong></span>
                <span className="text-blue-600">Liter: <strong>{beleg.kraftstoffDetail.liter}</strong></span>
                <span className="text-blue-600">€/l: <strong>{beleg.kraftstoffDetail.preisProLiter}</strong></span>
                <span className="text-blue-600">Tankstelle: <strong>{beleg.kraftstoffDetail.tankstelle}</strong></span>
                <span className="text-blue-600">Ort: <strong>{beleg.kraftstoffDetail.ort}</strong></span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-neutral-gray-100">
            <button onClick={handleFreigeben} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors active:scale-[0.98]">
              <CheckCircle2 className="w-4 h-4" /> Freigeben
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white text-navy-900 rounded-xl font-semibold text-sm border border-neutral-gray-200 hover:bg-neutral-gray-50 transition-colors active:scale-[0.98]">
              <Edit3 className="w-4 h-4" /> Korrektur speichern
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white text-red-600 rounded-xl font-semibold text-sm border border-red-200 hover:bg-red-50 transition-colors active:scale-[0.98]">
              <XCircle className="w-4 h-4" /> Storno vorbereiten
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-0.5">{label}</div>
      <div className={`text-sm font-semibold ${highlight ? "text-amber-600" : "text-navy-900"}`}>{value}</div>
      {sub && <div className="text-[10px] text-text-muted">{sub}</div>}
    </div>
  );
}
