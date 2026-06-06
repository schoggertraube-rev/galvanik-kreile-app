/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText, Camera, Fuel, TrendingUp, CreditCard,
  BarChart3, PieChart, Receipt, FileCheck,
  Download, AlertCircle, Settings, ChevronRight, CheckCircle2,
  Briefcase, CalendarClock, Sparkles, Banknote, Wallet,
  ArrowRight, Globe, Users, Landmark, Activity
} from "lucide-react";
import { getBuchhaltungProvider } from "@/lib/buchhaltung";
import type { UstvaWerte, Ersparnis, KategorieSumme } from "@/lib/buchhaltung/types";
import { pruefeFristen } from "@/lib/buchhaltung/regeln";
import { AnalysisOverlay } from "@/components/ui/AnalysisOverlay";
import { getAusgabenAnalysisAction, getUstvaAnalysisAction, getKraftstoffAnalysisAction, getOffenePostenAnalysisAction, getBwaAnalysisAction, getSparzaehlerAnalysisAction } from "@/app/buchhaltung/analysis.actions";
import Link from "next/link";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";

// ── Types ────────────────────────────────────────────────────────────────

type TileProps = {
  title: string;
  description: string;
  icon: React.ReactNode;
  iconColor: string;
  href?: string;
  kpi?: string;
  status?: { label: string; variant: "action" | "ready" | "prep" | "default" };
  footer?: string;
  analyseLink?: { label: string; href?: string; onClick?: () => void };
  onClick?: () => void;
};

// ── Tile Component ────────────────────────────────────────────────────────────

function Tile({ title, description, icon, iconColor, href, kpi, status, footer, analyseLink, onClick }: TileProps) {
  const router = useRouter();
  const statusColors = {
    action: "bg-red-50 text-red-600 border-red-100",
    ready: "bg-emerald-50 text-emerald-600 border-emerald-100",
    prep: "bg-amber-50 text-amber-600 border-amber-100",
    default: "bg-neutral-gray-100 text-text-muted border-neutral-gray-200",
  };

  const inner = (
    <>
      {/* Watermark */}
      <div className="absolute -right-2 -bottom-2 pointer-events-none opacity-[0.06] transform scale-[7] -rotate-12 origin-bottom-right">
        {icon}
      </div>

      <div className="relative z-10 flex items-start justify-end gap-3 min-h-[24px]">
        {kpi && (
          <span className="text-xl font-extrabold text-navy-900 tracking-tight">{kpi}</span>
        )}
        {status && (
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${statusColors[status.variant]}`}>
            {status.label}
          </span>
        )}
      </div>
      <h3 className="relative z-10 text-lg font-extrabold text-navy-900 leading-snug">{title}</h3>
      <p className="relative z-10 text-[13px] text-text-muted leading-relaxed">{description}</p>
      <div className="relative z-10 flex items-center justify-between mt-auto pt-1 gap-3">
        <span className="text-xs font-bold text-accent-orange flex items-center gap-1 group-hover:gap-2 transition-all">
          {footer ?? "Öffnen"} <ChevronRight className="w-3.5 h-3.5" />
        </span>
        {analyseLink && (
          analyseLink.onClick ? (
            <button
              onClick={(e) => { e.stopPropagation(); analyseLink.onClick!(); }}
              className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors border border-blue-100 shrink-0 z-10 relative"
            >
              <BarChart3 className="w-3 h-3" /> {analyseLink.label}
            </button>
          ) : (
            <Link
              href={analyseLink.href!}
              onClick={(e) => e.stopPropagation()}
              className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors border border-blue-100 shrink-0 z-10 relative"
            >
              <BarChart3 className="w-3 h-3" /> {analyseLink.label}
            </Link>
          )
        )}
      </div>
    </>
  );

  const cls = "group relative overflow-hidden bg-white border border-neutral-gray-100 rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 p-5 flex flex-col gap-3 min-h-[140px] cursor-pointer";

  // to avoid nested <a> tags (Link inside Link = hydration error)
  if (href && analyseLink) {
    return (
      <div className={cls} onClick={() => router.push(href)}>
        {/* Watermark */}
        <div className="absolute -right-2 -bottom-2 pointer-events-none opacity-[0.06] transform scale-[7] -rotate-12 origin-bottom-right">
          {icon}
        </div>

        <div className="relative z-10 flex items-start justify-end gap-3 min-h-[24px]">
          {kpi && (
            <span className="text-xl font-extrabold text-navy-900 tracking-tight">{kpi}</span>
          )}
          {status && (
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${statusColors[status.variant]}`}>
              {status.label}
            </span>
          )}
        </div>
        <h3 className="relative z-10 text-lg font-extrabold text-navy-900 leading-snug">{title}</h3>
        <p className="relative z-10 text-[13px] text-text-muted leading-relaxed">{description}</p>
        <div className="relative z-10 flex items-center justify-between mt-auto pt-1 gap-3">
          <span className="text-xs font-bold text-accent-orange flex items-center gap-1 group-hover:gap-2 transition-all">
            {footer ?? "Öffnen"} <ChevronRight className="w-3.5 h-3.5" />
          </span>
          {analyseLink && (
            <button
              onClick={(e) => { e.stopPropagation(); if (analyseLink.onClick) analyseLink.onClick(); else if (analyseLink.href) router.push(analyseLink.href); }}
              className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors border border-blue-100 shrink-0 z-10 relative"
            >
              <BarChart3 className="w-3 h-3" /> {analyseLink.label}
            </button>
          )}
        </div>
      </div>
    );
  }
  if (href) {
    return <Link href={href} className={cls}>{inner}</Link>;
  }
  return <div className={cls}>{inner}</div>;
}

// ── Section Header with Tile Icon ────────────────────────────────────────

function SectionHeader({ icon, iconBg, title, badge }: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  badge?: string;
}) {
  return (
    <div className="flex items-center gap-3 mt-10 mb-5 px-1">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <span className="text-base font-extrabold text-navy-900">{title}</span>
      {badge && (
        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-100">
          {badge}
        </span>
      )}
    </div>
  );
}

// ── Main Cockpit ─────────────────────────────────────────────────────────

export function BuchhaltungCockpitClient() {
  const [ustva, setUstva] = useState<UstvaWerte | null>(null);
  const [ersparnis, setErsparnis] = useState<Ersparnis | null>(null);
  const [kategorien, setKategorien] = useState<KategorieSumme[]>([]);
  const [loading, setLoading] = useState(true);
  const [analysisOpen, setAnalysisOpen] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("");
  const [analysisDataMap, setAnalysisDataMap] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!analysisOpen) return;
    const now = new Date();
    const von = `${now.getFullYear()}-01-01`;
    const bis = `${now.getFullYear()}-12-31`;
    if ((analysisOpen === "Ausgaben" || analysisOpen === "Fixkosten" || analysisOpen === "Variable Kosten") && !analysisDataMap["Ausgaben"]) {
      getAusgabenAnalysisAction("2026-06-01", "2026-06-30").then(res => setAnalysisDataMap(p => ({ ...p, Ausgaben: res, Fixkosten: res, "Variable Kosten": res })));
    } else if (analysisOpen === "UStVA" && !analysisDataMap["UStVA"]) {
      getUstvaAnalysisAction(von, bis).then(res => setAnalysisDataMap(p => ({ ...p, UStVA: res })));
    } else if (analysisOpen === "Kraftstoff" && !analysisDataMap["Kraftstoff"]) {
      getKraftstoffAnalysisAction(von, bis).then(res => setAnalysisDataMap(p => ({ ...p, Kraftstoff: res })));
    } else if (analysisOpen === "Offene Posten" && !analysisDataMap["Offene Posten"]) {
      getOffenePostenAnalysisAction(von, bis).then(res => setAnalysisDataMap(p => ({ ...p, "Offene Posten": res })));
    } else if (analysisOpen === "BWA" && !analysisDataMap["BWA"]) {
      getBwaAnalysisAction(von, bis).then(res => setAnalysisDataMap(p => ({ ...p, BWA: res })));
    } else if (analysisOpen === "Sparzähler" && !analysisDataMap["Sparzähler"]) {
      getSparzaehlerAnalysisAction(von, bis).then(res => setAnalysisDataMap(p => ({ ...p, "Sparzähler": res })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisOpen]);


  useEffect(() => {
    const load = async () => {
      const provider = getBuchhaltungProvider();
      const now = new Date();
      const monatsAnfang = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const monatsEnde = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;
      const zeitraum = { von: monatsAnfang, bis: monatsEnde };

      const [u, e, k] = await Promise.all([
        provider.berechneUstva(zeitraum),
        provider.getErsparnis(now.getFullYear()),
        provider.getAusgabenNachKategorie(zeitraum),
      ]);
      setUstva(u);
      setErsparnis(e);
      setKategorien(k);
      setLoading(false);
    };
    load();
  }, []);

  const fristen = pruefeFristen();
  const gesamtAusgaben = kategorien.reduce((sum, k) => sum + k.summe, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-3 border-accent-orange/20 border-t-accent-orange rounded-full animate-spin" />
      </div>
    );
  }


  const getAnalysisProps = (key: string | null): any => {
    if (!key) return null;
    switch (key) {
      case "Fixkosten":
      case "Variable Kosten":
      case "Ausgaben": {
        const aData = analysisDataMap["Ausgaben"];
        if (!aData) return { title: "Lade...", subtitle: "Daten werden live berechnet..." };
        return {
          icon: <Wallet className="w-6 h-6" />,
          title: "Ausgaben & Kostenstruktur",
          subtitle: "Laufende Kosten für den aktuellen Monat",
          accentBg: "linear-gradient(180deg, var(--posbg), transparent)",
          tabs: [
            { id: "gesamt", label: "Ausgaben Gesamt" },
            { id: "fix", label: "Fixkosten" },
            { id: "variabel", label: "Variable Kosten" }
          ],
          activeTab: activeTab || (key === "Fixkosten" ? "fix" : key === "Variable Kosten" ? "variabel" : "gesamt"),
          hero: {
            kicker: "GESAMTAUSGABEN (LFD. MONAT)",
            value: `${aData.gesamt.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`,
            changePill: { text: "Datenqualität: 95 %", variant: "teal" as const },
            meta: `Fixkosten: ${aData.fix.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € · Variable Kosten: ${aData.variabel.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`,
          },
          trend: {
            title: "Kostenentwicklung",
            chartType: "bar",
            chartData: aData.chartData
          },
          composition: {
            title: "Top 5 Ausgaben-Kategorien",
            rows: aData.topKategorien.map((k: any) => ({
              avatar: k.name.substring(0, 2).toUpperCase(),
              avatarColor: "#64748B",
              name: k.name,
              meta: "Summe aus Belegen & Verträgen",
              amount: `${k.amount.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`,
              href: `/buchhaltung/ausgaben?kategorie=${k.name}`
            })),
            footerLink: { label: "Zur Kosten-Übersicht", href: "/buchhaltung/kosten" }
          },
          crossKpi: [
            { label: "Anteil Fixkosten", value: aData.gesamt > 0 ? `${((aData.fix / aData.gesamt) * 100).toFixed(1)}%` : "0%", delta: "Ziel: < 40%", deltaColor: aData.gesamt > 0 && (aData.fix / aData.gesamt) < 0.4 ? "var(--green)" : "var(--text3)" },
            { label: "Größte variable Position", value: aData.topVariabel[0] ? `${Number(aData.topVariabel[0].netto).toLocaleString("de-DE")} €` : "0 €", delta: "Einzelbeleg", deltaColor: "var(--text3)" },
            { label: "Kostentreiber im Monat", value: aData.topKategorien[0]?.name || "-", delta: "Höchste Kategorie", deltaColor: "var(--amber, #D97706)" }
          ],
          insight: {
            body: aData.insightsGesamt.beobachtungen.map((b: string) => `<b>Beobachtung:</b> ${b}`).join('<br/>') + 
                  (aData.insightsGesamt.vermutungen.length > 0 ? '<br/><br/>' + aData.insightsGesamt.vermutungen.map((v: string) => `<b>Vermutung:</b> ${v}`).join('<br/>') : ''),
            actions: aData.insightsGesamt.vorschlaege.map((v: any) => ({ label: v.label, onClick: () => window.location.href = v.href }))
          },
          linkedAreas: [
            { label: "Ausgaben nach Kategorie analysieren", href: "/buchhaltung/ausgaben" },
            { label: "Wiederkehrende Kosten verwalten", href: "/buchhaltung/kosten" },
            { label: "BWA / Liquidität", href: "/buchhaltung/bwa" }
          ]
        };
      }
      
      case "UStVA": {
        const uData = analysisDataMap["UStVA"];
        if (!uData) return { title: "Lade...", subtitle: "Daten werden live berechnet..." };
        return {
          icon: <Landmark className="w-6 h-6" />,
          title: "UStVA Analyse",
          subtitle: "Umsatzsteuervoranmeldung",
          accentBg: "linear-gradient(180deg, var(--posbg), transparent)",
          tabs: [
            { id: "gesamt", label: "Zusammenfassung" },
            { id: "zahllast", label: "Zahllast" },
            { id: "vorsteuer", label: "Vorsteuer" }
          ],
          activeTab: activeTab || "gesamt",
          hero: {
            kicker: "VORAUSSICHTLICHE ZAHLLAST",
            value: `${uData.zahllast?.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0} €`,
            changePill: { text: "Pünktliche Meldung", variant: "teal" as const },
            meta: `Umsatzsteuer: ${uData.umsatzsteuer?.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0} € · Vorsteuer: ${uData.vorsteuer?.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0} €`,
          },
          trend: {
            title: "Zahllast Verlauf",
            chartType: "bar",
            chartData: uData.chartData || []
          },
          insight: {
            body: (uData.insights?.beobachtungen || []).map((b: string) => `<b>Beobachtung:</b> ${b}`).join('<br/>') + 
                  ((uData.insights?.vermutungen?.length || 0) > 0 ? '<br/><br/>' + uData.insights.vermutungen.map((v: string) => `<b>Vermutung:</b> ${v}`).join('<br/>') : ''),
            actions: (uData.insights?.vorschlaege || []).map((v: any) => ({ label: v.label, onClick: () => window.location.href = v.href }))
          },
          linkedAreas: [
            { label: "UStVA Meldungen", href: "/buchhaltung/export" }
          ]
        };
      }

      case "Kraftstoff": {
        const kData = analysisDataMap["Kraftstoff"];
        if (!kData) return { title: "Lade...", subtitle: "Daten werden live berechnet..." };
        return {
          icon: <Activity className="w-6 h-6" />,
          title: "Kraftstoff Analyse",
          subtitle: "Tankkosten und Ausreißer",
          accentBg: "linear-gradient(180deg, var(--posbg), transparent)",
          tabs: [
            { id: "gesamt", label: "Tankkosten Gesamt" }
          ],
          activeTab: "gesamt",
          hero: {
            kicker: "TANKKOSTEN DIESER MONAT",
            value: `${kData.gesamtKosten?.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0} €`,
            changePill: { text: `${kData.anzahlTankungen || 0} Tankungen`, variant: "teal" as const },
            meta: `Maximaler Tankwert: ${kData.maxKosten?.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0} €`,
          },
          trend: {
            title: "Tankkosten Verlauf",
            chartType: "bar",
            chartData: kData.chartData || []
          },
          insight: {
            body: (kData.insights?.beobachtungen || []).map((b: string) => `<b>Beobachtung:</b> ${b}`).join('<br/>') + 
                  ((kData.insights?.vermutungen?.length || 0) > 0 ? '<br/><br/>' + kData.insights.vermutungen.map((v: string) => `<b>Vermutung:</b> ${v}`).join('<br/>') : ''),
            actions: (kData.insights?.vorschlaege || []).map((v: any) => ({ label: v.label, onClick: () => window.location.href = v.href }))
          },
          linkedAreas: [
            { label: "Kraftstoff Detailansicht", href: "/buchhaltung/kraftstoff" }
          ]
        };
      }

      case "Offene Posten": {
        const oData = analysisDataMap["Offene Posten"];
        if (!oData) return { title: "Lade...", subtitle: "Daten werden live berechnet..." };
        return {
          icon: <AlertCircle className="w-6 h-6" />,
          title: "Offene Posten",
          subtitle: "Unbezahlte und überfällige Rechnungen",
          accentBg: "linear-gradient(180deg, var(--posbg), transparent)",
          tabs: [
            { id: "gesamt", label: "Gesamtrückstände" },
            { id: "ueberfaellig", label: "Überfällig" }
          ],
          activeTab: activeTab || "gesamt",
          hero: {
            kicker: "OFFENE SUMME GESAMT",
            value: `${oData.offeneSumme?.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0} €`,
            changePill: { text: `${oData.offeneCount || 0} Rechnungen`, variant: "teal" as const },
            meta: `Überfällig: ${oData.ueberfaelligSumme?.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0} € (${oData.ueberfaelligCount || 0} Stk)`,
          },
          trend: {
            title: "Rückstände Verlauf",
            chartType: "bar",
            chartData: oData.chartData || []
          },
          insight: {
            body: (oData.insights?.beobachtungen || []).map((b: string) => `<b>Beobachtung:</b> ${b}`).join('<br/>') + 
                  ((oData.insights?.vermutungen?.length || 0) > 0 ? '<br/><br/>' + oData.insights.vermutungen.map((v: string) => `<b>Vermutung:</b> ${v}`).join('<br/>') : ''),
            actions: (oData.insights?.vorschlaege || []).map((v: any) => ({ label: v.label, onClick: () => window.location.href = v.href }))
          },
          linkedAreas: [
            { label: "Rechnungen verwalten", href: "/buchhaltung/rechnungen" }
          ]
        };
      }

      case "BWA": {
        const bData = analysisDataMap["BWA"];
        if (!bData) return { title: "Lade...", subtitle: "Daten werden live berechnet..." };
        return {
          icon: <TrendingUp className="w-6 h-6" />,
          title: "BWA / Liquidität",
          subtitle: "Betriebswirtschaftliche Auswertung",
          accentBg: "linear-gradient(180deg, var(--posbg), transparent)",
          tabs: [
            { id: "gesamt", label: "Betriebsergebnis" }
          ],
          activeTab: "gesamt",
          hero: {
            kicker: "BETRIEBSERGEBNIS",
            value: `${bData.betriebsergebnis?.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0} €`,
            changePill: { text: `Einnahmen: ${bData.einnahmen?.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0} €`, variant: "teal" as const },
            meta: `Ausgaben: ${bData.ausgabenGesamt?.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0} €`,
          },
          trend: {
            title: "Ergebnis Verlauf",
            chartType: "bar",
            chartData: bData.chartData || []
          },
          insight: {
            body: (bData.insights?.beobachtungen || []).map((b: string) => `<b>Beobachtung:</b> ${b}`).join('<br/>') + 
                  ((bData.insights?.vermutungen?.length || 0) > 0 ? '<br/><br/>' + bData.insights.vermutungen.map((v: string) => `<b>Vermutung:</b> ${v}`).join('<br/>') : ''),
            actions: (bData.insights?.vorschlaege || []).map((v: any) => ({ label: v.label, onClick: () => window.location.href = v.href }))
          },
          linkedAreas: [
            { label: "Umsätze ansehen", href: "/performance/umsatz-marge" }
          ]
        };
      }

      case "Sparzähler": {
        const sData = analysisDataMap["Sparzähler"];
        if (!sData) return { title: "Lade...", subtitle: "Daten werden live berechnet..." };
        return {
          icon: <Activity className="w-6 h-6 text-accent-orange" />,
          title: "Sparzähler durch Automatisierung",
          subtitle: "Zeit & Kosten Ersparnis",
          accentBg: "linear-gradient(180deg, var(--posbg), transparent)",
          tabs: [
            { id: "gesamt", label: "Ersparnis" }
          ],
          activeTab: "gesamt",
          hero: {
            kicker: "KUMULIERTE ERSPARNIS",
            value: `${sData.ersparnisBetrag?.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0} €`,
            changePill: { text: `${sData.anzahlAutoBelege || 0} Autom. Belege`, variant: "teal" as const },
            meta: `${sData.prozentAutomatisch || 0}% Automatisierungsgrad`,
          },
          trend: {
            title: "Ersparnis Verlauf",
            chartType: "bar",
            chartData: sData.chartData?.map((d: any) => ({ name: d.name, ist: d.istKumuliert, vorjahr: d.vorjahr })) || []
          },
          insight: {
            body: (sData.insights?.beobachtungen || []).map((b: string) => `<b>Beobachtung:</b> ${b}`).join('<br/>') + 
                  ((sData.insights?.vermutungen?.length || 0) > 0 ? '<br/><br/>' + sData.insights.vermutungen.map((v: string) => `<b>Vermutung:</b> ${v}`).join('<br/>') : ''),
            actions: (sData.insights?.vorschlaege || []).map((v: any) => ({ label: v.label, onClick: () => window.location.href = v.href }))
          },
          linkedAreas: [
            { label: "Belege hochladen", href: "/buchhaltung/belege" }
          ]
        };
      }

      default:
        return { title: "Analyse", subtitle: "Keine Daten verfügbar" };
    }
  };

  return (
    <div className="w-full pb-24 px-4 sm:px-6 xl:px-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-semibold text-text-muted mt-4 mb-3">
        <Link href="/betrieb" className="hover:text-navy-900 transition-colors">Betrieb</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-navy-900">Buchhaltung & Finanzen</span>
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
            {ersparnis && <span>· {ersparnis.anzahlAutoBelege} Belege · {ersparnis.prozentAutomatisch} % automatisch</span>}
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

      {/* ── Hero-Band: UStVA + Sparzähler ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-4 mb-2">
        {/* UStVA Hero */}
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

        {/* Sparzähler */}
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

      {/* ── Abschnitt: Belege & Ausgaben ──────────────────────────────── */}
      <SectionHeader
        icon={<Receipt className="w-4.5 h-4.5 text-rose-500" strokeWidth={2} />}
        iconBg="bg-rose-50"
        title="Belege & Ausgaben"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Tile
          title="Belege erfassen & prüfen"
          description="Foto rein, Inhalt automatisch erkannt & kategorisiert. 3 von 142 unsicher."
          icon={<Receipt className="w-5 h-5 text-accent-orange" strokeWidth={1.8} />}
          iconColor="bg-accent-orange/10"
          href="/buchhaltung/belege"
          status={{ label: "3 prüfen", variant: "action" }}
        />
        <Tile
          title="Kraftstoff & Kfz"
          description="Diesel auf einen Blick: 18 Tankungen, Ø 1,71 €/l. Filterbar nach Ort & Zeit."
          icon={<Fuel className="w-5 h-5 text-blue-600" strokeWidth={1.8} />}
          iconColor="bg-blue-50"
          href="/buchhaltung/kraftstoff"
          kpi="1.240 €"
          footer="Auswertung"
        />
        <Tile
          title="Ausgaben & Kostenstruktur"
          description="Fix- und variable Kosten auf einen Blick. Filterbar nach Typ, Zeitraum und Kategorie."
          icon={<Wallet className="w-5 h-5 text-amber-600" strokeWidth={1.8} />}
          iconColor="bg-amber-50"
          href="/buchhaltung/kosten"
          kpi={`${gesamtAusgaben.toLocaleString("de-DE")} €`}
          footer="Kosten & Ausgaben"
        />
      </div>

      {/* ── Abschnitt: Einnahmen & Rechnungen ────────────────────────── */}
      <SectionHeader
        icon={<FileCheck className="w-4.5 h-4.5 text-emerald-600" strokeWidth={2} />}
        iconBg="bg-emerald-50"
        title="Einnahmen & Rechnungen"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Tile
          title="Offene Posten"
          description="3 Zahlungen überfällig. Mahnstufen & Zahlungserinnerung automatisch."
          icon={<AlertCircle className="w-5 h-5 text-red-500" strokeWidth={1.8} />}
          iconColor="bg-red-50"
          href="/buchhaltung/rechnungen?filter=offen"
          kpi="12.450 €"
          status={{ label: "3 überfällig", variant: "action" }}
          footer="Details"
        />
        <Tile
          title="Rechnungen & Statistik"
          description="Ausgangsrechnungen laufender Monat. Schreiben, E-Rechnung (ZUGFeRD/XRechnung)."
          icon={<FileCheck className="w-5 h-5 text-emerald-600" strokeWidth={1.8} />}
          iconColor="bg-emerald-50"
          href="/buchhaltung/rechnungen"
          kpi="42"
          footer="Details"
        />
        <Tile
          title="Zahlungsbereich"
          description="Dienstleister, Zahlungslinks, QR, Vor-Ort-Terminal. Zahlungsmoral & Zahlungsstatistik."
          icon={<CreditCard className="w-5 h-5 text-teal-600" strokeWidth={1.8} />}
          iconColor="bg-teal-50"
          href="/buchhaltung/zahlung"
          status={{ label: "In Vorbereitung", variant: "prep" }}
          footer="Optionen & Statistik"
          analyseLink={{ label: "Analyse", href: "/buchhaltung/zahlung?tab=statistik" }}
        />
      </div>

      {/* ── Abschnitt: Auswertung & Steuerprofil ─────────────────────── */}
      <SectionHeader
        icon={<TrendingUp className="w-4.5 h-4.5 text-teal-600" strokeWidth={2} />}
        iconBg="bg-teal-50"
        title="Auswertung & Steuerprofil"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Tile
          title="BWA / Monatsübersicht"
          description="Betriebswirtschaftliche Auswertung. Einnahmen, Ausgaben, Ergebnis."
          icon={<TrendingUp className="w-5 h-5 text-teal-600" strokeWidth={1.8} />}
          iconColor="bg-teal-50"
          href="/buchhaltung/bwa"
          kpi="+19.200 €"
          footer="Details"
        />
        <Tile
          title="Steuerprofil & UStVA"
          description="USt-Sätze, Voranmeldungs-Rhythmus, Berater-Nr. ELSTER-Einstellungen."
          icon={<Banknote className="w-5 h-5 text-purple-600" strokeWidth={1.8} />}
          iconColor="bg-purple-50"
          href="/buchhaltung/steuerprofil"
          kpi="DE"
          footer="Details"
        />
        <Tile
          title="Fixkosten"
          description="Laufende Fixkosten-Verträge, Abos, Miete (dieser Monat)."
          icon={<Wallet className="w-5 h-5 text-amber-600" strokeWidth={1.8} />}
          iconColor="bg-amber-50"
          href="/buchhaltung/kosten?kategorie=fix"
          kpi={`${(kategorien.find(k => k.kategorieId === "Fixkosten")?.summe || 0).toLocaleString("de-DE")} €`}
          footer="Auswertung"
          analyseLink={{ label: "Analyse", onClick: () => { setAnalysisOpen("Fixkosten"); setActiveTab("fix"); } }}
        />
        <Tile
          title="Variable Kosten"
          description="Laufende Ausgaben & Belege des Monats nach Kategorie."
          icon={<PieChart className="w-5 h-5 text-emerald-600" strokeWidth={1.8} />}
          iconColor="bg-emerald-50"
          href="/buchhaltung/ausgaben"
          kpi={`${(gesamtAusgaben - (kategorien.find(k => k.kategorieId === "Fixkosten")?.summe || 0)).toLocaleString("de-DE")} €`}
          footer="Auswertung"
          analyseLink={{ label: "Analyse", onClick: () => { setAnalysisOpen("Variable Kosten"); setActiveTab("variabel"); } }}
        />
      </div>

      {/* ── Abschnitt: Export & Steuerberater ─────────────────────────── */}
      <SectionHeader
        icon={<Download className="w-4.5 h-4.5 text-blue-600" strokeWidth={2} />}
        iconBg="bg-blue-50"
        title="Export & Steuerberater"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Tile
          title="DATEV-Export"
          description="Buchungsstapel (EXTF, SKR03) + Belegbilder. Vorschau & ein-Klick-Übergabe."
          icon={<Download className="w-5 h-5 text-emerald-600" strokeWidth={1.8} />}
          iconColor="bg-emerald-50"
          href="/buchhaltung/export?format=datev"
          status={{ label: "Bereit", variant: "ready" }}
          footer="Vorschau öffnen"
        />
        <Tile
          title="Lexware / Excel"
          description="Einfacher CSV-Export für Lexware oder Tabellenkalkulation."
          icon={<FileCheck className="w-5 h-5 text-emerald-600" strokeWidth={1.8} />}
          iconColor="bg-emerald-50"
          href="/buchhaltung/export?format=lexware"
          status={{ label: "Bereit", variant: "ready" }}
          footer="Vorschau öffnen"
        />
        <Tile
          title="Fristen & Pflichten"
          description="UStVA, GewSt, Rundfunkbeitrag. Rechtzeitige Erinnerung, nie verpassen."
          icon={<CalendarClock className="w-5 h-5 text-accent-orange" strokeWidth={1.8} />}
          iconColor="bg-accent-orange/10"
          href="/buchhaltung/fristen"
          status={{ label: "Überwacht", variant: "ready" }}
          footer="Kalender"
        />
      </div>

      {/* ── Abschnitt: Marketing & Umsatzwirkung ────────────────────────────── */}
      <SectionHeader
        icon={<Sparkles className="w-4.5 h-4.5 text-amber-600" strokeWidth={2} />}
        iconBg="bg-amber-50"
        title="Marketing & Umsatzwirkung"
        badge="Demo-Daten"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Tile
          title="Marketingkosten"
          description="Gesamtkosten für Kundenansprache, E-Mail-Kampagnen und Reaktivierungsmaßnahmen."
          icon={<Sparkles className="w-5 h-5 text-amber-600" strokeWidth={1.8} />}
          iconColor="bg-amber-50"
          kpi="– €"
          status={{ label: "Noch keine Daten", variant: "default" }}
          footer="Kosten erfassen"
        />
        <Tile
          title="Umsatz aus Reaktivierung"
          description="Umsatz, der durch Kundenreaktivierung generiert wurde. Verknüpfung mit Kampagnen erforderlich."
          icon={<TrendingUp className="w-5 h-5 text-emerald-600" strokeWidth={1.8} />}
          iconColor="bg-emerald-50"
          kpi="– €"
          status={{ label: "Nicht berechenbar", variant: "default" }}
          footer="Auswertung"
        />
        <Tile
          title="Marketing-Cockpit"
          description="Reaktivierungskandidaten, Segmente, Mailentwürfe und Kampagnenplanung."
          icon={<Users className="w-5 h-5 text-blue-600" strokeWidth={1.8} />}
          iconColor="bg-blue-50"
          href="/marketing"
          status={{ label: "Lokal vorbereitet", variant: "prep" }}
          footer="Zum Cockpit"
        />
      </div>

      {/* ── Premium: Steuerberater-Paket ──────────────────────────────── */}
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

      {/* ── Footer-Note ──────────────────────────────────────────────── */}
      <p className="text-xs text-text-muted text-center mt-8 leading-relaxed max-w-2xl mx-auto">
        <strong>Stufe 1 (Livegang):</strong> erfassen, kategorisieren, auswerten, exportieren — alles funktioniert.{" "}
        <strong>Stufe 2:</strong> ELSTER-Direktversand, Live-Bank & Lohn-Meldung docken an, sobald Zertifikat & Zugänge da sind.
        <br />
        Einmal Regeln einstellen — danach läuft die Buchhaltung im Hintergrund.
      </p>

      <AnalysisOverlay
        open={!!analysisOpen}
        onClose={() => setAnalysisOpen(null)}
        title={analysisOpen ? `Analyse: ${analysisOpen}` : ""}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        {...getAnalysisProps(analysisOpen)}
      />

      <FeedbackFooter pageTitle="Buchhaltung" route="/buchhaltung" variant="full" />
    </div>
  );
}
