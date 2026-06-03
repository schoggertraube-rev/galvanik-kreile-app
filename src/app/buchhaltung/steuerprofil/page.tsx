"use client";
import { usePageView } from "@/hooks/usePageView";
import { useState, useEffect } from "react";
import Link from "next/link";
import { getBuchhaltungProvider } from "@/lib/buchhaltung";
import type { Steuerprofil, UstvaWerte } from "@/lib/buchhaltung/types";
import { ChevronRight, Banknote, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";

export default function SteuerprofilPage() {
  usePageView();
  const [profil, setProfil] = useState<Steuerprofil | null>(null);
  const [ustva, setUstva] = useState<UstvaWerte | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const provider = getBuchhaltungProvider();
      const now = new Date();
      const [p, u] = await Promise.all([
        provider.getSteuerprofil(),
        provider.berechneUstva({
          von: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
          bis: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`,
        }),
      ]);
      setProfil(p);
      setUstva(u);
      setLoading(false);
    };
    load();
  }, []);

  if (loading || !profil || !ustva) {
    return <div className="flex items-center justify-center min-h-[50vh]"><div className="w-8 h-8 border-3 border-accent-orange/20 border-t-accent-orange rounded-full animate-spin" /></div>;
  }

  return (
    <div className="w-full pb-24 px-4 sm:px-6 xl:px-8">
      <div className="flex items-center gap-2 text-xs font-semibold text-text-muted mt-4 mb-3">
        <Link href="/" className="hover:text-navy-900 transition-colors">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/buchhaltung" className="hover:text-navy-900 transition-colors">Buchhaltung</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-navy-900">Steuerprofil</span>
      </div>

      <h1 className="text-2xl font-extrabold text-navy-900 mb-1">Steuerprofil & UStVA</h1>
      <p className="text-sm text-text-muted mb-8">{profil.bezeichnung} · {profil.sachkontenrahmen}</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profil */}
        <div className="bg-white rounded-2xl border border-neutral-gray-100 shadow-sm p-6">
          <h2 className="text-base font-extrabold text-navy-900 mb-4">USt-Profil</h2>
          <div className="space-y-3">
            <Row label="Regelsatz" value={`${profil.standardUstSatz} %`} />
            <Row label="Ermäßigt" value={`${profil.reduziertUstSatz} %`} />
            <Row label="Kleinunternehmer" value={profil.kleinunternehmer ? "Ja (§ 19 UStG)" : "Nein"} />
            <Row label="Voranmeldung" value={profil.voranmeldungRhythmus === "monatlich" ? "Monatlich" : "Vierteljährlich"} />
            <Row label="Kontenrahmen" value={profil.sachkontenrahmen} />
            <Row label="Berater-Nr." value={profil.beraterNr ?? "—"} />
            <Row label="Mandanten-Nr." value={profil.mandantenNr ?? "—"} />
          </div>
        </div>

        {/* UStVA */}
        <div className="bg-white rounded-2xl border border-neutral-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-extrabold text-navy-900">UStVA — {new Date(ustva.zeitraumVon).toLocaleDateString("de-DE", { month: "long", year: "numeric" })}</h2>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
              ustva.status === "freigegeben" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
            }`}>{ustva.status}</span>
          </div>
          <div className="space-y-3">
            <Row label="Umsatz 19 %" value={`${ustva.umsatz19.toLocaleString("de-DE")} €`} sub={`USt: ${ustva.ust19.toLocaleString("de-DE")} €`} />
            <Row label="Umsatz 7 %" value={`${ustva.umsatz7.toLocaleString("de-DE")} €`} sub={`USt: ${ustva.ust7.toLocaleString("de-DE")} €`} />
            <Row label="Steuerfreie Umsätze" value={`${ustva.umsatz0.toLocaleString("de-DE")} €`} />
            <Row label="Vorsteuer" value={`${ustva.vorsteuer.toLocaleString("de-DE")} €`} />
            <div className="pt-3 border-t-2 border-navy-900">
              <Row label="Zahllast" value={`${ustva.zahllast.toLocaleString("de-DE")} €`} bold />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <Link href="/buchhaltung/export?format=datev" className="flex items-center gap-2 px-4 py-2.5 bg-navy-900 text-white rounded-xl font-bold text-sm hover:bg-navy-800 transition-colors active:scale-[0.98]">
              <CheckCircle2 className="w-4 h-4" /> UStVA prüfen
            </Link>
            <Link href="/buchhaltung/export?format=steuerberater" className="flex items-center gap-2 px-4 py-2.5 bg-white text-navy-900 rounded-xl font-semibold text-sm border border-neutral-gray-200 hover:bg-neutral-gray-50 transition-colors active:scale-[0.98]">
              An Steuerberater <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* ELSTER Stufe 2 */}
        <div className="lg:col-span-2 bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-amber-800">ELSTER-Direktversand — Stufe 2</h3>
            <p className="text-sm text-amber-700 mt-1">Der ELSTER-Direktversand wird aktiviert, sobald dein Organisationszertifikat hinterlegt ist. Bis dahin: Export für manuellen ELSTER-Upload.</p>
            <Link href="/buchhaltung/einstellungen" className="text-xs font-bold text-amber-800 underline mt-2 inline-block">Zertifikat in Einstellungen hinterlegen →</Link>
          </div>
        </div>
      </div>

      <FeedbackFooter pageTitle="Steuerprofil" route="/buchhaltung/steuerprofil" variant="full" />
    </div>
  );
}

function Row({ label, value, sub, bold }: { label: string; value: string; sub?: string; bold?: boolean }) {
  return (
    <div className="flex items-start justify-between">
      <span className="text-sm text-text-muted">{label}</span>
      <div className="text-right">
        <span className={`text-sm ${bold ? "font-extrabold text-navy-900 text-base" : "font-semibold text-navy-900"}`}>{value}</span>
        {sub && <div className="text-[10px] text-text-muted">{sub}</div>}
      </div>
    </div>
  );
}
