"use client";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BackButton } from "@/components/ui/BackButton";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText, Camera, Settings, ChevronRight,
  Receipt, FileCheck, Download, TrendingUp, Sparkles, Users, Briefcase
} from "lucide-react";
import { getBuchhaltungProvider } from "@/lib/buchhaltung";
import type { KategorieSumme } from "@/lib/buchhaltung/types";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";

import { HeroBand } from "./components/HeroBand";
import { SectionHeader } from "./components/SectionHeader";
import { Tile } from "./components/Tile";

import { BelegeKachel } from "./components/BelegeKachel";
import { KraftstoffKachel } from "./components/KraftstoffKachel";
import { AusgabenKachel } from "./components/AusgabenKachel";
import { OffenePostenKachel } from "./components/OffenePostenKachel";
import { RechnungenKachel } from "./components/RechnungenKachel";
import { ZahlungKachel } from "./components/ZahlungKachel";
import { BwaKachel } from "./components/BwaKachel";
import { SteuerprofilKachel } from "./components/SteuerprofilKachel";
import { FixkostenKachel } from "./components/FixkostenKachel";
import { VariableKostenKachel } from "./components/VariableKostenKachel";
import { ExportKachel } from "./components/ExportKachel";
import { FristenKachel } from "./components/FristenKachel";
import { RoiKachel } from "./components/RoiKachel";

export function BuchhaltungCockpitClient() {
  const [kategorien, setKategorien] = useState<KategorieSumme[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const provider = getBuchhaltungProvider();
      const now = new Date();
      const monatsAnfang = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const monatsEnde = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;
      
      const k = await provider.getAusgabenNachKategorie({ von: monatsAnfang, bis: monatsEnde });
      setKategorien(k);
      setLoading(false);
    };
    load();
  }, []);

  const gesamtAusgaben = kategorien.reduce((sum, k) => sum + k.summe, 0);
  const fixkostenSumme = kategorien.find(k => k.kategorieId === "Fixkosten")?.summe || 0;
  const variableKostenSumme = gesamtAusgaben - fixkostenSumme;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-3 border-accent-orange/20 border-t-accent-orange rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full pb-24 px-4 sm:px-6 xl:px-8">
      {/* Breadcrumb & BackButton */}
      <div className="mb-4">
        <Breadcrumb items={[{label:'Home',href:'/'}, {label:'Betrieb',href:'/betrieb'}, {label:'Buchhaltung & Finanzen'}]} />
        <BackButton label="Betrieb" href="/betrieb" />
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-accent-orange/10 flex items-center justify-center">
              <FileText className="w-6 h-6 text-accent-orange" strokeWidth={1.8} />
            </div>
            <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">Buchhaltung & Finanzen</h1>
          </div>
          <p className="text-sm text-text-muted mt-2 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Automatik aktiv
            </span>
            <span>· {new Date().toLocaleDateString("de-DE", { month: "long", year: "numeric" })}</span>
            <span>· SKR03</span>
            <span>· revisionssicher (GoBD)</span>
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/buchhaltung/belege" className="flex items-center gap-2 px-4 py-3 bg-navy-900 text-white rounded-xl font-bold text-sm hover:bg-navy-800 transition-colors shadow-sm active:scale-[0.98] min-h-[44px]">
            <Camera className="w-4.5 h-4.5" strokeWidth={2} />
            Beleg fotografieren
          </Link>
          <Link href="/buchhaltung/einstellungen" className="flex items-center gap-2 px-4 py-3 bg-white text-text-muted rounded-xl font-semibold text-sm border border-neutral-gray-200 hover:text-navy-900 transition-colors shadow-sm active:scale-[0.98] min-h-[44px]">
            <Settings className="w-4.5 h-4.5" strokeWidth={1.8} />
            Voreinstellungen
          </Link>
        </div>
      </div>

      <HeroBand />

      <SectionHeader icon={<Receipt className="w-4.5 h-4.5 text-rose-500" strokeWidth={2} />} iconBg="bg-rose-50" title="Belege & Ausgaben" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <BelegeKachel />
        <KraftstoffKachel />
        <AusgabenKachel gesamtAusgaben={gesamtAusgaben} />
      </div>

      <SectionHeader icon={<FileCheck className="w-4.5 h-4.5 text-emerald-600" strokeWidth={2} />} iconBg="bg-emerald-50" title="Einnahmen & Rechnungen" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <OffenePostenKachel />
        <RechnungenKachel />
        <ZahlungKachel />
      </div>

      <SectionHeader icon={<TrendingUp className="w-4.5 h-4.5 text-teal-600" strokeWidth={2} />} iconBg="bg-teal-50" title="Auswertung & Steuerprofil" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <RoiKachel />
        <BwaKachel />
        <SteuerprofilKachel />
        <FixkostenKachel summe={fixkostenSumme} />
        <VariableKostenKachel summe={variableKostenSumme} />
      </div>

      <SectionHeader icon={<Download className="w-4.5 h-4.5 text-blue-600" strokeWidth={2} />} iconBg="bg-blue-50" title="Export & Steuerberater" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <ExportKachel />
        <FristenKachel />
      </div>

      <SectionHeader icon={<Sparkles className="w-4.5 h-4.5 text-amber-600" strokeWidth={2} />} iconBg="bg-amber-50" title="Marketing & Umsatzwirkung" badge="Demo-Daten" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Tile title="Marketingkosten" description="Gesamtkosten für Kundenansprache, E-Mail-Kampagnen und Reaktivierungsmaßnahmen." icon={<Sparkles className="w-5 h-5 text-amber-600" strokeWidth={1.8} />} iconColor="bg-amber-50" kpi="– €" status={{ label: "Noch keine Daten", variant: "default" }} footer="Kosten erfassen" />
        <Tile title="Umsatz aus Reaktivierung" description="Umsatz, der durch Kundenreaktivierung generiert wurde. Verknüpfung mit Kampagnen erforderlich." icon={<TrendingUp className="w-5 h-5 text-emerald-600" strokeWidth={1.8} />} iconColor="bg-emerald-50" kpi="– €" status={{ label: "Nicht berechenbar", variant: "default" }} footer="Auswertung" />
        <Tile title="Marketing-Cockpit" description="Reaktivierungskandidaten, Segmente, Mailentwürfe und Kampagnenplanung." icon={<Users className="w-5 h-5 text-blue-600" strokeWidth={1.8} />} iconColor="bg-blue-50" href="/marketing" status={{ label: "Lokal vorbereitet", variant: "prep" }} footer="Zum Cockpit" />
      </div>

      <div className="bg-white border border-neutral-gray-100 rounded-2xl shadow-sm p-5 flex flex-col sm:flex-row items-center gap-5 mt-8">
        <div className="w-12 h-12 rounded-xl bg-accent-orange/10 flex items-center justify-center shrink-0">
          <Briefcase className="w-6 h-6 text-accent-orange" strokeWidth={1.7} />
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h3 className="text-base font-bold text-navy-900 mb-1">Steuerberater-Paket</h3>
          <p className="text-xs text-text-muted">Digitaler Aktenordner für die Monatsübergabe: kontierte Buchungen, Belege, Auswertungen — ein ZIP, ein Klick.</p>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-accent-orange">Premium-Modul</span>
        <Link href="/buchhaltung/export?format=steuerberater" className="text-xs font-bold text-accent-orange flex items-center gap-1 whitespace-nowrap hover:gap-2 transition-all">
          Paket-Inhalte prüfen <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <p className="text-xs text-text-muted text-center mt-8 leading-relaxed max-w-2xl mx-auto">
        <strong>Stufe 1 (Livegang):</strong> erfassen, kategorisieren, auswerten, exportieren — alles funktioniert.{" "}
        <strong>Stufe 2:</strong> ELSTER-Direktversand, Live-Bank & Lohn-Meldung docken an, sobald Zertifikat & Zugänge da sind.
        <br />
        Einmal Regeln einstellen — danach läuft die Buchhaltung im Hintergrund.
      </p>

      <FeedbackFooter pageTitle="Buchhaltung" route="/buchhaltung" variant="full" />
    </div>
  );
}
