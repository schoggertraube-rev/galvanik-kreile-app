"use client";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BackButton } from "@/components/ui/BackButton";

import React, { useState, useEffect, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { Settings } from "lucide-react";
import { AnalysisOverlay } from "@/components/ui/AnalysisOverlay";
import "./marketing.css";

import { SubNav, TabName } from "./components/SubNav";
import { StudioView } from "./components/StudioView";
import { IdeenView } from "./components/IdeenView";
import { KampagnenView } from "./components/KampagnenView";
import { ReichweiteView } from "./components/ReichweiteView";
import { KundenView } from "./components/KundenView";
import { WirkungView } from "./components/WirkungView";

import { listVorschlaegeAction } from "@/app/marketing/marketing.actions";
import { instagramAdapter } from "@/lib/marketing/adapters/InstagramAdapter";

import type {
  AktionVorschlag, Kampagne, FunnelDaten,
  Segment, LernInsight, WirkungMini, StoryIdee, SortMode
} from "@/lib/marketing/marketingTypes";

export default function MarketingStudioClient({
  initialBesteAktion,
  initialVorschlaege,
  initialKampagnen,
  initialFunnel,
  initialSegmente,
  initialInsights,
  initialWirkungMini,
  initialStoryIdeen
}: {
  initialBesteAktion: AktionVorschlag | null;
  initialVorschlaege: AktionVorschlag[];
  initialKampagnen: Kampagne[];
  initialFunnel: FunnelDaten | null;
  initialSegmente: Segment[];
  initialInsights: LernInsight[];
  initialWirkungMini: WirkungMini[];
  initialStoryIdeen: StoryIdee[];
}) {
  const [activeTab, setActiveTab] = useState<TabName>("Studio");
  const [besteAktion, setBesteAktion] = useState<AktionVorschlag | null>(initialBesteAktion);
  const [vorschlaege, setVorschlaege] = useState<AktionVorschlag[]>(initialVorschlaege);
  const [kampagnen] = useState<Kampagne[]>(initialKampagnen);
  const [funnel] = useState<FunnelDaten | null>(initialFunnel);
  const [segmente] = useState<Segment[]>(initialSegmente);
  const [insights] = useState<LernInsight[]>(initialInsights);
  const [wirkungMini] = useState<WirkungMini[]>(initialWirkungMini);
  const [storyIdeen] = useState<StoryIdee[]>(initialStoryIdeen);

  const [varianteIdx, setVarianteIdx] = useState(0);
  const [activeSort, setActiveSort] = useState<SortMode>("output");
  const [toastMsg, setToastMsg] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [funnelKey, setFunnelKey] = useState(0);
  const [analysisOpen, setAnalysisOpen] = useState<string | null>(null);
  const [analysisDataMap, setAnalysisDataMap] = useState<Record<string, any>>({});
  const [igConnected, setIgConnected] = useState(false);

  useEffect(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().substring(0, 10);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().substring(0, 10);
    
    if (analysisOpen === "Anfragen aus Marketing" && !analysisDataMap["Anfragen aus Marketing"]) {
      import("@/app/marketing/analysis.actions").then(m => {
        m.getMarketingAnfragenAnalysisAction(firstDay, lastDay).then(res => {
          setAnalysisDataMap(p => ({ ...p, "Anfragen aus Marketing": res }));
        });
      });
    }

    if (analysisOpen === "Umsatz daraus" && !analysisDataMap["Umsatz daraus"]) {
      import("@/app/marketing/analysis.actions").then(m => {
        m.getMarketingUmsatzAnalysisAction(firstDay, lastDay).then(res => {
          setAnalysisDataMap(p => ({ ...p, "Umsatz daraus": res }));
        });
      });
    }

    if (analysisOpen === "Return on Invest" && !analysisDataMap["Return on Invest"]) {
      import("@/app/marketing/analysis.actions").then(m => {
        m.getMarketingRoiAnalysisAction(firstDay, lastDay).then(res => {
          setAnalysisDataMap(p => ({ ...p, "Return on Invest": res }));
        });
      });
    }
  }, [analysisOpen]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const token = params.get('access_token');
      if (token) {
        localStorage.setItem('ig_access_token', token);
        setIgConnected(true);
      }
      window.history.replaceState(null, '', window.location.pathname);
    } else {
      instagramAdapter.isConnected().then(setIgConnected);
    }
  }, []);

  const handleSort = useCallback(async (sort: SortMode) => {
    setActiveSort(sort);
    const vs = await listVorschlaegeAction(sort);
    setVorschlaege(vs);
  }, []);

  const handleStoryClick = useCallback((story: StoryIdee) => {
    if (story.isAdd || !besteAktion) return;
    setBesteAktion(prev => prev ? {
      ...prev,
      titel: story.titel + ' posten',
      caption: story.caption,
      hashtags: story.hashtags,
    } : prev);
    setActiveTab("Studio");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [besteAktion]);

  const handlePost = useCallback(async () => {
    if (!besteAktion) return;
    const res = await instagramAdapter.publish(besteAktion as any);
    setToastMsg(res.message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 5000);
  }, [besteAktion]);

  const handleInstagramConnect = useCallback(() => {
    if (igConnected) {
      setToastMsg("Instagram ist bereits verbunden.");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } else {
      instagramAdapter.connect(window.location.origin + '/marketing');
    }
  }, [igConnected]);

  const handleTabChange = useCallback((tab: TabName) => {
    setActiveTab(tab);
    if (tab === "Reichweite") setFunnelKey(k => k + 1);
  }, []);

  const handleEntryClick = useCallback((tab: any) => {
    handleTabChange(tab);
  }, [handleTabChange]);

  const nextVar = useCallback(() => {
    if (!besteAktion) return;
    const next = (varianteIdx + 1) % besteAktion.varianten.length;
    setVarianteIdx(next);
    const v = besteAktion.varianten[next];
    setBesteAktion(prev => prev ? { ...prev, titel: v.titel, caption: v.caption, hashtags: v.hashtags } : prev);
  }, [besteAktion, varianteIdx]);

  const prevVar = useCallback(() => {
    if (!besteAktion) return;
    const prev = (varianteIdx - 1 + besteAktion.varianten.length) % besteAktion.varianten.length;
    setVarianteIdx(prev);
    const v = besteAktion.varianten[prev];
    setBesteAktion(p => p ? { ...p, titel: v.titel, caption: v.caption, hashtags: v.hashtags } : p);
  }, [besteAktion, varianteIdx]);

  const getAnalysisProps = (key: string | null): any => {
    // Keep it minimal for now, logic preserved from original
    if (!key) return {};
    const data = analysisDataMap[key];
    if (!data) return { title: "Lade...", subtitle: "Daten werden live berechnet..." };

    if (key === "Anfragen aus Marketing") {
      return {
        icon: <svg viewBox="0 0 24 24" width={24} height={24} stroke="currentColor" strokeWidth={2} fill="none"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>,
        title: "Anfragen aus Marketing",
        subtitle: "Messung aller Leads, die nachweislich über Marketingkanäle kamen.",
        accentBg: "linear-gradient(180deg, var(--posbg), transparent)",
        tabs: [{ id: "gesamt", label: "Alle Anfragen" }],
        activeTab: "gesamt",
        hero: {
          kicker: "ANFRAGEN (LFD. MONAT)",
          value: `${data.gesamt} Leads`,
          changePill: { text: "Datenqualität: 95 % (Sehr hoch)", variant: "teal" as const },
          meta: "Definition: Eingehende Anfragen via Telefonnotiz, Web-Formular oder Instagram-DM, bei denen der Marketing-Touchpoint erfasst wurde.",
        },
        trend: { title: "Anfragen im Zeitverlauf", chartType: "bar", chartData: data.chartData },
        composition: {
          title: "Top Marketing-Kanäle",
          rows: data.topKategorien.map((k: any) => ({
            avatar: k.name.substring(0, 2).toUpperCase(), avatarColor: "#E1306C",
            name: k.name, meta: "Zugewiesene Anfragen", amount: `${k.amount}`
          })),
          footerLink: { label: "Zu allen Anfragen", href: "/kunden" }
        },
        crossKpi: [
          { label: "Qualifizierungsrate", value: "66%", delta: "Ziel: > 50%", deltaColor: "var(--green)" },
          { label: "Höchster Kanal", value: data.topKategorien[0]?.name || "-", delta: "Diesen Monat", deltaColor: "var(--text3)" },
          { label: "Ø Anfragen pro Tag", value: (data.gesamt / 30).toFixed(1), delta: "Normal", deltaColor: "var(--text3)" }
        ],
        insight: {
          body: data.insights.beobachtungen.map((b: string) => `<b>Beobachtung:</b> ${b}`).join('<br/>') + 
                (data.insights.vermutungen.length > 0 ? '<br/><br/>' + data.insights.vermutungen.map((v: string) => `<b>Vermutung:</b> ${v}`).join('<br/>') : ''),
          actions: data.insights.vorschlaege.map((v: any) => ({ label: v.label, onClick: () => window.location.href = v.href }))
        },
        linkedAreas: [
          { label: "Telefonnotiz & CRM", href: "/kunden" },
          { label: "Performance Marketing Touchpoints", href: "/performance" }
        ]
      };
    }

    if (key === "Umsatz daraus") {
      return {
        icon: <svg viewBox="0 0 24 24" width={24} height={24} stroke="currentColor" strokeWidth={2} fill="none"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
        title: "Umsatz aus Marketing",
        subtitle: "Umsatz aus Aufträgen, deren Ursprungsanfrage dem Marketing zugeordnet ist.",
        accentBg: "linear-gradient(180deg, var(--posbg), transparent)",
        tabs: [{ id: "gesamt", label: "Marketing-Umsatz" }],
        activeTab: "gesamt",
        hero: {
          kicker: "UMSATZ (LFD. MONAT)",
          value: `${data.gesamt.toLocaleString("de-DE")} €`,
          changePill: { text: "Datenqualität: 100 % (Exakt)", variant: "teal" as const },
          meta: "Definition: Netto-Auftragswert von abgerechneten oder bestätigten Aufträgen, die mit einer Marketing-Anfrage verknüpft sind.",
        },
        trend: { title: "Umsatz im Zeitverlauf", chartType: "bar", chartData: data.chartData },
        composition: {
          title: "Höchste umgesetzte Aufträge",
          rows: [
            { avatar: "A1", avatarColor: "#1E3A8A", name: "Auftrag ORD-2026-89", meta: "Quelle: Google Suche", amount: "1.200 €" },
            { avatar: "A2", avatarColor: "#1E3A8A", name: "Auftrag ORD-2026-92", meta: "Quelle: Instagram", amount: "850 €" }
          ],
          footerLink: { label: "Alle Marketing-Aufträge", href: "/auftraege" }
        },
        crossKpi: [
          { label: "Conversion-Rate (Anfrage -> Auftrag)", value: "66%", delta: "Sehr gut", deltaColor: "var(--green)" },
          { label: "Ø Ticketgröße", value: "1.450 €", delta: "Branchen-Ø: 1.200 €", deltaColor: "var(--green)" }
        ],
        insight: {
          body: "<b>Beobachtung:</b> Die Zuordnung funktioniert perfekt (100%). Die Conversion-Rate von Anfrage zu Auftrag liegt bei 66%.",
          actions: [{ label: "Zu den Aufträgen", onClick: () => window.location.href = "/auftraege" }]
        },
        linkedAreas: [
          { label: "Rechnungen & Buchhaltung", href: "/buchhaltung" }
        ]
      };
    }

    if (key === "Return on Invest") {
      return {
        icon: <svg viewBox="0 0 24 24" width={24} height={24} stroke="currentColor" strokeWidth={2} fill="none"><path d="M23 6l-9.5 9.5-5-5L1 18"/></svg>,
        title: "Return on Invest & Lead-Kosten",
        subtitle: "Wie viel Umsatz jeder investierte Marketing-Euro zurückbringt.",
        accentBg: "linear-gradient(180deg, var(--posbg), transparent)",
        tabs: [{ id: "gesamt", label: "Gesamt-ROI" }],
        activeTab: "gesamt",
        hero: {
          kicker: "MARKETING-ROI",
          value: `${data.gesamt} € / Post`,
          changePill: { text: "Datenqualität: 85 % (Geschätzt)", variant: "amber" as const },
          meta: "Definition: (Marketing-Umsatz minus Marketing-Kosten) geteilt durch Anzahl der Aktionen/Posts.",
        },
        trend: { title: "ROI-Entwicklung", chartType: "line", chartData: data.chartData },
        composition: {
          title: "Berechnungsgrundlage",
          rows: [
            { avatar: "R", avatarColor: "#10B981", name: "Umsatz (Positiv)", meta: "Aus konvertierten Aufträgen", amount: "18.400 €" },
            { avatar: "K", avatarColor: "#EF4444", name: "Kosten (Negativ)", meta: "Instagram Ads + Agentur (kosten_posten DB)", amount: "-1.600 €" },
            { avatar: "P", avatarColor: "#3B82F6", name: "Anzahl Posts (Teiler)", meta: "marketing_touchpoints DB", amount: "40 Stk." }
          ],
          footerLink: { label: "Kosten in Buchhaltung ansehen", href: "/buchhaltung" }
        },
        crossKpi: [
          { label: "Invest pro Monat", value: "1.600 €", delta: "Plan: 2.000 €", deltaColor: "var(--text3)" },
          { label: "CAC (Customer Acq. Cost)", value: "57 €", delta: "Ziel: < 100 €", deltaColor: "var(--green)" }
        ],
        insight: {
          body: "<b>Beobachtung:</b> Die Kosten für Arbeitszeit der Mitarbeiter bei der Content-Erstellung fehlen noch (Datenqualität 85%).",
          actions: [{ label: "Zeiterfassung verknüpfen", onClick: () => alert("Verknüpfung öffnen") }]
        },
        linkedAreas: [
          { label: "Buchhaltung (kosten_posten)", href: "/buchhaltung/kosten" },
          { label: "Performance Overview", href: "/performance" }
        ]
      };
    }

    if (key === "Kampagnen") {
      return {
        icon: <svg viewBox="0 0 24 24" width={24} height={24} stroke="currentColor" strokeWidth={2} fill="none"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
        title: "Kampagnen-Performance",
        subtitle: "Detailanalyse der laufenden und geplanten Kampagnen.",
        accentBg: "linear-gradient(180deg, var(--posbg), transparent)",
        tabs: [{ id: "gesamt", label: "Aktive Kampagnen" }],
        activeTab: "gesamt",
        hero: {
          kicker: "KAMPAGNEN STATUS",
          value: "2 Aktiv",
          changePill: { text: "Guter Verlauf", variant: "teal" as const },
          meta: "Messung der Interaktionen und Conversion-Rate aller gebündelten Aktionen.",
        },
        composition: {
          title: "Performance nach Kampagne",
          rows: [
            { avatar: "M", avatarColor: "bg-navy-900", name: "Messe-Nachfass", amount: "+14 Leads", href: "/marketing/kampagne/1" },
            { avatar: "O", avatarColor: "bg-posbg", name: "Oberflächen-Push", amount: "+8 Leads", href: "/marketing/kampagne/2" }
          ]
        },
        insight: { body: "Messe-Nachfass konvertiert aktuell 15% besser als erwartet. Budget-Erhöhung empfohlen." },
        linkedAreas: [
          { label: "Kunden & CRM", href: "/customers" },
          { label: "Umsatz-Performance", href: "/performance" }
        ]
      };
    }

    return {};
  };

  // Remove early return
  // if (!besteAktion) return null;

  return (
    <div className="pb-12 w-full">
      <div className="mb-6">
        <Breadcrumb items={[{label:'Home',href:'/'}, {label:'Marketing',href:'/marketing'}]} />
        <BackButton label="Home" href="/" />
      </div>
      
      <div className="mk-crumb">
        Home
        <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg>
        Marketing
      </div>

      <div className="mk-header">
        <div className="mk-title">
          <div className="mk-logo mk-animated">
            <svg viewBox="0 0 24 24"><path d="M3 11l18-8-8 18-2-7-8-3z" /></svg>
          </div>
          <div>
            <h1 className="font-serif">Marketing Studio</h1>
            <div className="mk-subtitle">
              Dein Betrieb, ins beste Licht gerückt â€” <b>geführt, in Minuten, ohne Vorkenntnisse.</b>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleInstagramConnect}
            className="flex items-center gap-2 text-[12px] font-bold bg-bg-app-soft text-navy-900 px-3 py-1.5 rounded-full hover:bg-neutral-gray-200 transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            {igConnected ? "Instagram verbunden" : "Instagram verknüpfen"}
          </button>
          <div className="mk-live-pill">
            <span className="dot" />
            System lernt mit
          </div>
        </div>
      </div>

      <SubNav activeTab={activeTab} onTabChange={handleTabChange} />

      <AnimatePresence mode="wait">
        {activeTab === "Studio" && besteAktion && (
          <StudioView
            aktion={besteAktion}
            varianteIdx={varianteIdx}
            onNextVar={nextVar}
            onPrevVar={prevVar}
            onPost={handlePost}
            storyIdeen={storyIdeen}
            wirkungMini={wirkungMini}
            onStoryClick={handleStoryClick}
            onEntryClick={handleEntryClick}
            isVisible={true}
          />
        )}
        {activeTab === "Studio" && !besteAktion && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-neutral-gray-200 rounded-full flex items-center justify-center mb-4">
              <svg viewBox="0 0 24 24" width={32} height={32} stroke="currentColor" strokeWidth={1.5} fill="none" className="text-text-muted">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <h2 className="text-xl font-serif mb-2">Keine neuen Aktionen</h2>
            <p className="text-text-muted max-w-md">
              Aktuell gibt es keine neuen Marketing-Vorschläge. Schauen Sie später wieder vorbei oder erstellen Sie eigene Ideen.
            </p>
          </div>
        )}
        {activeTab === "Ideen" && (
          <IdeenView vorschlaege={vorschlaege} activeSort={activeSort} onSort={handleSort} />
        )}
        {activeTab === "Kampagnen" && (
          <KampagnenView kampagnen={kampagnen} onOpenAnalysis={setAnalysisOpen} />
        )}
        {activeTab === "Reichweite" && (
          <ReichweiteView funnel={funnel} funnelKey={funnelKey} />
        )}
        {activeTab === "Kunden" && (
          <KundenView segmente={segmente} />
        )}
        {activeTab === "Wirkung" && (
          <WirkungView insights={insights} />
        )}
      </AnimatePresence>

      <div className="mk-footnote">
        Jede Aktion trägt <b>Aufwand, Kosten und erwarteten Umsatz</b> â€” das Studio lernt aus jedem Post, was bei dir wirkt.<br />
        Kosten fließen automatisch in die Buchhaltung, Umsatz in Performance. Komplett per Feature-Toggle abschaltbar.
      </div>

      <div className={`mk-toast ${showToast ? 'show' : ''}`}>
        <span className="mk-toast-check">
          <svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-11" /></svg>
        </span>
        <span>{toastMsg}</span>
      </div>

      <AnalysisOverlay
        open={!!analysisOpen}
        onClose={() => setAnalysisOpen(null)}
        title={analysisOpen ? `Analyse: ${analysisOpen}` : ""}
        {...getAnalysisProps(analysisOpen)}
      />
    </div>
  );
}
