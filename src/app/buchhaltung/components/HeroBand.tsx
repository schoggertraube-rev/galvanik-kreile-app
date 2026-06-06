"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Sparkles } from "lucide-react";
import { getBuchhaltungProvider } from "@/lib/buchhaltung";
import type { UstvaWerte, Ersparnis } from "@/lib/buchhaltung/types";
import { pruefeFristen } from "@/lib/buchhaltung/regeln";

export function HeroBand() {
  const [ustva, setUstva] = useState<UstvaWerte | null>(null);
  const [ersparnis, setErsparnis] = useState<Ersparnis | null>(null);

  useEffect(() => {
    const load = async () => {
      const provider = getBuchhaltungProvider();
      const now = new Date();
      const monatsAnfang = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const monatsEnde = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;
      const zeitraum = { von: monatsAnfang, bis: monatsEnde };

      const [u, e] = await Promise.all([
        provider.berechneUstva(zeitraum),
        provider.getErsparnis(now.getFullYear()),
      ]);
      setUstva(u);
      setErsparnis(e);
    };
    load();
  }, []);

  const fristen = pruefeFristen();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-4 mb-2">
      <div className="relative bg-white border border-neutral-gray-100 rounded-2xl shadow-sm p-6 overflow-hidden">
        <div className="absolute -right-12 -top-12 w-56 h-56 rounded-full bg-linear-to-br from-emerald-50 to-transparent pointer-events-none" />
        
        <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold uppercase tracking-wider mb-3">
          <span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
            <CheckCircle2 className="w-2.5 h-2.5 text-white" strokeWidth={3} />
          </span>
          Fertig vorbereitet & geprüft
        </div>
        
        <h2 className="text-lg font-extrabold text-navy-900 mb-1 relative z-10">
          Umsatzsteuer-Voranmeldung · {new Date().toLocaleDateString("de-DE", { month: "long", year: "numeric" })}
        </h2>
        <p className="text-sm text-text-muted mb-5">KI-kontiert · Werte berechnet · bereit zur Freigabe</p>
        
        <div className="flex flex-wrap gap-7 mb-5 relative z-10">
          <div>
            <div className="text-2xl font-extrabold text-navy-900 tracking-tight">
              {ustva ? ustva.zahllast.toLocaleString("de-DE") : "—"} <span className="text-base">€</span>
            </div>
            <div className="text-xs text-text-muted mt-1">Zahllast ans Finanzamt</div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-navy-900 tracking-tight">
              {ersparnis?.anzahlAutoBelege ?? "—"}
            </div>
            <div className="text-xs text-text-muted mt-1">Belege · {ersparnis?.prozentAutomatisch ?? 0} % automatisch</div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-amber-600 tracking-tight">
              {fristen.length > 0 ? "10. " + new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toLocaleDateString("de-DE", { month: "long" }) : "—"}
            </div>
            <div className="text-xs text-text-muted mt-1">Frist · in {Math.max(0, 10 - new Date().getDate())} Tagen</div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-3 relative z-10">
          <Link href="/buchhaltung/steuerprofil?tab=ustva" className="flex items-center gap-2 px-4 py-2.5 bg-navy-900 text-white rounded-xl font-bold text-sm hover:bg-navy-800 transition-colors active:scale-[0.98] min-h-[44px]">
            <Sparkles className="w-4 h-4" /> Prüfen & freigeben
          </Link>
          <Link href="/buchhaltung/export?format=steuerberater" className="px-4 py-2.5 bg-white text-text-muted rounded-xl font-semibold text-sm border border-neutral-gray-200 hover:text-navy-900 transition-colors active:scale-[0.98] min-h-[44px]">
            An Steuerberater
          </Link>
        </div>
        
        <p className="text-xs text-text-muted mt-4 relative z-10">
          3 Belege brauchen noch deinen Blick. ELSTER-Direktversand wird scharfgeschaltet, sobald dein Zertifikat hinterlegt ist — bis dahin: Export für den ELSTER-Upload.
        </p>
      </div>

      <div className="bg-linear-to-br from-emerald-500 to-emerald-700 text-white rounded-2xl p-6 flex flex-col justify-center relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 w-40 h-40 rounded-full bg-white/8 pointer-events-none" />
        <div className="text-xs font-bold uppercase tracking-widest opacity-85 mb-2">Gespart {new Date().getFullYear()}</div>
        <div className="text-4xl font-extrabold tracking-tight">
          {ersparnis ? ersparnis.betrag.toLocaleString("de-DE") : "—"} <span className="text-lg">€</span>
        </div>
        <p className="text-sm opacity-90 mt-3 leading-relaxed relative z-10">
          weil <strong>{ersparnis?.prozentAutomatisch ?? 0} %</strong> automatisch vorbereitet wird und dein Steuerberater nur noch <strong>freigibt</strong> statt zu sortieren.
        </p>
      </div>
    </div>
  );
}
