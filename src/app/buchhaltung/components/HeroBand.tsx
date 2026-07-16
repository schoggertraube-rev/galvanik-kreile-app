"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Sparkles } from "lucide-react";
import { getBuchhaltungProvider } from "@/lib/buchhaltung";
import type { UstvaWerte, Ersparnis } from "@/lib/buchhaltung/types";

export function HeroBand() {
  const [ustva, setUstva] = useState<UstvaWerte | null>(null);
  const [ersparnis, setErsparnis] = useState<Ersparnis | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const provider = getBuchhaltungProvider();
      const now = new Date();
      const monatsAnfang = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const monatsEnde = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;
      const zeitraum = { von: monatsAnfang, bis: monatsEnde };

      try {
        const [u, e] = await Promise.all([
          provider.berechneUstva(zeitraum),
          provider.getErsparnis(now.getFullYear()),
        ]);
        setUstva(u);
        setErsparnis(e);
        setLoadError(null);
      } catch (error) {
        console.error("Accounting hero unavailable", error);
        setUstva(null);
        setErsparnis(null);
        setLoadError("Buchhaltungs-Arbeitswerte konnten nicht bestätigt geladen werden.");
      }
    };
    load();
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-4 mb-2">
      <div className="relative bg-white border border-neutral-gray-100 rounded-2xl shadow-sm p-6 overflow-hidden">
        <div className="absolute -right-12 -top-12 w-56 h-56 rounded-full bg-linear-to-br from-emerald-50 to-transparent pointer-events-none" />
        
        <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-wider mb-3">
          <span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
            <AlertTriangle className="w-2.5 h-2.5 text-white" strokeWidth={3} />
          </span>
          Rechnerischer Arbeitsstand · nicht freigegeben
        </div>
        
        <h2 className="text-lg font-extrabold text-navy-900 mb-1 relative z-10">
          UStVA-Arbeitsstand · {new Date().toLocaleDateString("de-DE", { month: "long", year: "numeric" })}
        </h2>
        <p className="text-sm text-text-muted mb-5">Aus bestätigten Buchungsdaten berechnet; keine steuerliche Prüfung, Freigabe oder ELSTER-Übermittlung.</p>

        {loadError && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{loadError}</p>}
        
        <div className="flex flex-wrap gap-7 mb-5 relative z-10">
          <div>
            <div className="text-2xl font-extrabold text-navy-900 tracking-tight">
              {ustva ? ustva.zahllast.toLocaleString("de-DE") : "—"} <span className="text-base">€</span>
            </div>
            <div className="text-xs text-text-muted mt-1">Rechnerische Zahllast im Arbeitsstand</div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-navy-900 tracking-tight">
              {ersparnis?.anzahlAutoBelege ?? "—"}
            </div>
            <div className="text-xs text-text-muted mt-1">Belege über konfigurierter OCR-Schwelle · Quote {ersparnis ? `${ersparnis.prozentAutomatisch} %` : "—"}</div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-amber-600 tracking-tight">
              —
            </div>
            <div className="text-xs text-text-muted mt-1">Steuerfrist nicht aus bestätigter Quelle angebunden</div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-3 relative z-10">
          <Link href="/buchhaltung/steuerprofil?tab=ustva" className="flex items-center gap-2 px-4 py-2.5 bg-navy-900 text-white rounded-xl font-bold text-sm hover:bg-navy-800 transition-colors active:scale-[0.98] min-h-[44px]">
            <Sparkles className="w-4 h-4" /> Arbeitsstand prüfen
          </Link>
          <Link href="/buchhaltung/export?format=steuerberater" className="px-4 py-2.5 bg-white text-text-muted rounded-xl font-semibold text-sm border border-neutral-gray-200 hover:text-navy-900 transition-colors active:scale-[0.98] min-h-[44px]">
            Export ohne Belegdateien
          </Link>
        </div>
        
        <p className="text-xs text-text-muted mt-4 relative z-10">
          Diese Ansicht besitzt keinen ELSTER-Sende-, Steuerberater-Freigabe- oder Fristenbeleg. Der Export enthält laut Manifest keine Belegdateien.
        </p>
      </div>

      <div className="bg-linear-to-br from-emerald-500 to-emerald-700 text-white rounded-2xl p-6 flex flex-col justify-center relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 w-40 h-40 rounded-full bg-white/8 pointer-events-none" />
        <div className="text-xs font-bold uppercase tracking-widest opacity-85 mb-2">Modellierter Zeitwert {new Date().getFullYear()}</div>
        <div className="text-4xl font-extrabold tracking-tight">
          {ersparnis ? ersparnis.betrag.toLocaleString("de-DE") : "—"} <span className="text-lg">€</span>
        </div>
        <p className="text-sm opacity-90 mt-3 leading-relaxed relative z-10">
          Annahme aus Konfiguration: {ersparnis ? <><strong>{ersparnis.anzahlAutoBelege} Belege</strong> × <strong>{ersparnis.minutenProBeleg} Minuten</strong> × <strong>{ersparnis.beraterStundensatz.toLocaleString("de-DE")} €/h</strong></> : "nicht verfügbar"}. Kein Nachweis tatsächlich eingesparter Kosten.
        </p>
      </div>
    </div>
  );
}
