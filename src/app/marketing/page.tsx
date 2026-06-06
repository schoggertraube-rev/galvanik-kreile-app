"use client";

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   Marketing Studio â€” Main Page
   Spec: 20 (Hauptspec), 26 (UI), 27 (Build)
   Reference: kreile_marketing_studio.html
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

import { usePageView } from "@/hooks/usePageView";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Settings } from "lucide-react";
import Link from "next/link";
import { AnalysisOverlay } from "@/components/ui/AnalysisOverlay";
import "./marketing.css";

import { marketingMockProvider } from "@/lib/marketing/marketingMockProvider";
import type {
  AktionVorschlag, Kampagne, FunnelDaten,
  Segment, LernInsight, WirkungMini, StoryIdee, SortMode
} from "@/lib/marketing/marketingTypes";
import { instagramAdapter } from "@/lib/marketing/adapters/InstagramAdapter";

// â”€â”€ Sub-View Names â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const TAB_NAMES = ["Studio", "Ideen", "Kampagnen", "Reichweite", "Kunden", "Wirkung"] as const;
type TabName = (typeof TAB_NAMES)[number];

// â”€â”€ Framer Motion Variants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const floatIn = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.05, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] }
  }),
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } }
};

// â”€â”€ Counter Hook â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function useCounter(target: number, divisor = 1, running = true) {
  const [val, setVal] = useState(0);
  const frameRef = useRef<number>(0);
  useEffect(() => {
    if (!running) { setTimeout(() => setVal(0), 0); return; }
    let cur = 0;
    const steps = 40;
    const inc = target / steps;
    const tick = () => {
      cur += inc;
      if (cur >= target) { cur = target; setVal(cur); return; }
      setVal(cur);
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, running]);
  const formatted = divisor > 1
    ? (val / divisor).toFixed(1).replace('.', ',')
    : Math.round(val).toLocaleString('de-DE');
  return formatted;
}

// â”€â”€ Counter Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function AnimatedCounter({ wert, suffix, divisor, running }: WirkungMini & { running: boolean }) {
  const formatted = useCounter(wert, divisor, running);
  return <>{formatted}{suffix}</>;
}

export default function MarketingPage(): React.ReactElement | null {
  usePageView();

  // â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [activeTab, setActiveTab] = useState<TabName>("Studio");
  const [besteAktion, setBesteAktion] = useState<AktionVorschlag | null>(null);
  const [vorschlaege, setVorschlaege] = useState<AktionVorschlag[]>([]);
  const [kampagnen, setKampagnen] = useState<Kampagne[]>([]);
  const [funnel, setFunnel] = useState<FunnelDaten | null>(null);
  const [segmente, setSegmente] = useState<Segment[]>([]);
  const [insights, setInsights] = useState<LernInsight[]>([]);
  const [wirkungMini, setWirkungMini] = useState<WirkungMini[]>([]);
  const [storyIdeen, setStoryIdeen] = useState<StoryIdee[]>([]);
  const [varianteIdx, setVarianteIdx] = useState(0);
  const [activeSort, setActiveSort] = useState<SortMode>("output");
  const [toastMsg, setToastMsg] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [funnelKey, setFunnelKey] = useState(0);
  const [analysisOpen, setAnalysisOpen] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisOpen]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getAnalysisProps = (key: string | null): any => {
    switch (key) {
      case "Anfragen aus Marketing":
        const aData = analysisDataMap["Anfragen aus Marketing"];
        if (!aData) return { title: "Lade...", subtitle: "Daten werden live berechnet..." };

        return {
          icon: <svg viewBox="0 0 24 24" width={24} height={24} stroke="currentColor" strokeWidth={2} fill="none"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>,
          title: "Anfragen aus Marketing",
          subtitle: "Messung aller Leads, die nachweislich Ã¼ber MarketingkanÃ¤le kamen.",
          accentBg: "linear-gradient(180deg, var(--posbg), transparent)",
          
          tabs: [{ id: "gesamt", label: "Alle Anfragen" }],
          activeTab: "gesamt",

          hero: {
            kicker: "ANFRAGEN (LFD. MONAT)",
            value: `${aData.gesamt} Leads`,
            changePill: { text: "DatenqualitÃ¤t: 95 % (Sehr hoch)", variant: "teal" as const },
            meta: "Definition: Eingehende Anfragen via Telefonnotiz, Web-Formular oder Instagram-DM, bei denen der Marketing-Touchpoint erfasst wurde.",
          },

          trend: {
            title: "Anfragen im Zeitverlauf",
            chartType: "bar",
            chartData: aData.chartData
          },

          composition: {
            title: "Top Marketing-KanÃ¤le",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            rows: aData.topKategorien.map((k: any) => ({
              avatar: k.name.substring(0, 2).toUpperCase(), avatarColor: "#E1306C",
              name: k.name,
              meta: "Zugewiesene Anfragen",
              amount: `${k.amount}`
            })),
            footerLink: { label: "Zu allen Anfragen", href: "/kunden" }
          },

          crossKpi: [
            { label: "Qualifizierungsrate", value: "66%", delta: "Ziel: > 50%", deltaColor: "var(--green)" },
            { label: "HÃ¶chster Kanal", value: aData.topKategorien[0]?.name || "-", delta: "Diesen Monat", deltaColor: "var(--text3)" },
            { label: "Ã˜ Anfragen pro Tag", value: (aData.gesamt / 30).toFixed(1), delta: "Normal", deltaColor: "var(--text3)" }
          ],

          insight: {
            body: aData.insights.beobachtungen.map((b: string) => `<b>Beobachtung:</b> ${b}`).join('<br/>') + 
                  (aData.insights.vermutungen.length > 0 ? '<br/><br/>' + aData.insights.vermutungen.map((v: string) => `<b>Vermutung:</b> ${v}`).join('<br/>') : ''),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            actions: aData.insights.vorschlaege.map((v: any) => ({ label: v.label, onClick: () => window.location.href = v.href }))
          },

          linkedAreas: [
            { label: "Telefonnotiz & CRM", href: "/kunden" },
            { label: "Performance Marketing Touchpoints", href: "/performance" }
          ]
        };

      case "Umsatz daraus":
        const uData = analysisDataMap["Umsatz daraus"];
        if (!uData) return { title: "Lade...", subtitle: "Daten werden live berechnet..." };

        return {
          icon: <svg viewBox="0 0 24 24" width={24} height={24} stroke="currentColor" strokeWidth={2} fill="none"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
          title: "Umsatz aus Marketing",
          subtitle: "Umsatz aus AuftrÃ¤gen, deren Ursprungsanfrage dem Marketing zugeordnet ist.",
          accentBg: "linear-gradient(180deg, var(--posbg), transparent)",
          
          tabs: [{ id: "gesamt", label: "Marketing-Umsatz" }],
          activeTab: "gesamt",

          hero: {
            kicker: "UMSATZ (LFD. MONAT)",
            value: `${uData.gesamt.toLocaleString("de-DE")} â‚¬`,
            changePill: { text: "DatenqualitÃ¤t: 100 % (Exakt)", variant: "teal" as const },
            meta: "Definition: Netto-Auftragswert von abgerechneten oder bestÃ¤tigten AuftrÃ¤gen, die mit einer Marketing-Anfrage verknÃ¼pft sind.",
          },

          trend: {
            title: "Umsatz im Zeitverlauf",
            chartType: "bar",
            chartData: uData.chartData
          },

          composition: {
            title: "HÃ¶chste umgesetzte AuftrÃ¤ge",
            rows: [
              { avatar: "A1", avatarColor: "#1E3A8A", name: "Auftrag ORD-2026-89", meta: "Quelle: Google Suche", amount: "1.200 â‚¬" },
              { avatar: "A2", avatarColor: "#1E3A8A", name: "Auftrag ORD-2026-92", meta: "Quelle: Instagram", amount: "850 â‚¬" }
            ],
            footerLink: { label: "Alle Marketing-AuftrÃ¤ge", href: "/auftraege" }
          },

          crossKpi: [
            { label: "Conversion-Rate (Anfrage -> Auftrag)", value: "66%", delta: "Sehr gut", deltaColor: "var(--green)" },
            { label: "Ã˜ TicketgrÃ¶ÃŸe", value: "1.450 â‚¬", delta: "Branchen-Ã˜: 1.200 â‚¬", deltaColor: "var(--green)" }
          ],

          insight: {
            body: "<b>Beobachtung:</b> Die Zuordnung funktioniert perfekt (100%). Die Conversion-Rate von Anfrage zu Auftrag liegt bei 66%.",
            actions: [{ label: "Zu den AuftrÃ¤gen", onClick: () => window.location.href = "/auftraege" }]
          },

          linkedAreas: [
            { label: "Rechnungen & Buchhaltung", href: "/buchhaltung" }
          ]
        };

      case "Return on Invest":
        const rData = analysisDataMap["Return on Invest"];
        if (!rData) return { title: "Lade...", subtitle: "Daten werden live berechnet..." };

        return {
          icon: <svg viewBox="0 0 24 24" width={24} height={24} stroke="currentColor" strokeWidth={2} fill="none"><path d="M23 6l-9.5 9.5-5-5L1 18"/></svg>,
          title: "Return on Investment (ROI)",
          subtitle: "Wie viel Umsatz jeder investierte Marketing-Euro zurÃ¼ckbringt.",
          accentBg: "linear-gradient(180deg, var(--posbg), transparent)",
          
          tabs: [{ id: "gesamt", label: "Gesamt-ROI" }],
          activeTab: "gesamt",

          hero: {
            kicker: "MARKETING-ROI",
            value: `${rData.gesamt} â‚¬ / Post`,
            changePill: { text: "DatenqualitÃ¤t: 85 % (GeschÃ¤tzt)", variant: "amber" as const },
            meta: "Definition: (Marketing-Umsatz minus Marketing-Kosten) geteilt durch Anzahl der Aktionen/Posts.",
          },

          trend: {
            title: "ROI-Entwicklung",
            chartType: "line",
            chartData: rData.chartData
          },

          composition: {
            title: "Berechnungsgrundlage",
            rows: [
              { avatar: "R", avatarColor: "#10B981", name: "Umsatz (Positiv)", meta: "Aus konvertierten AuftrÃ¤gen", amount: "18.400 â‚¬" },
              { avatar: "K", avatarColor: "#EF4444", name: "Kosten (Negativ)", meta: "Instagram Ads + Agentur (kosten_posten DB)", amount: "-1.600 â‚¬" },
              { avatar: "P", avatarColor: "#3B82F6", name: "Anzahl Posts (Teiler)", meta: "marketing_touchpoints DB", amount: "40 Stk." }
            ],
            footerLink: { label: "Kosten in Buchhaltung ansehen", href: "/buchhaltung" }
          },

          crossKpi: [
            { label: "Invest pro Monat", value: "1.600 â‚¬", delta: "Plan: 2.000 â‚¬", deltaColor: "var(--text3)" },
            { label: "CAC (Customer Acq. Cost)", value: "57 â‚¬", delta: "Ziel: < 100 â‚¬", deltaColor: "var(--green)" }
          ],

          insight: {
            body: "<b>Beobachtung:</b> Die Kosten fÃ¼r Arbeitszeit der Mitarbeiter bei der Content-Erstellung fehlen noch (DatenqualitÃ¤t 85%).",
            actions: [{ label: "Zeiterfassung verknÃ¼pfen", onClick: () => alert("VerknÃ¼pfung Ã¶ffnen") }]
          },

          linkedAreas: [
            { label: "Buchhaltung (kosten_posten)", href: "/buchhaltung/kosten" },
            { label: "Performance Overview", href: "/performance" }
          ]
        };

      default:
        return {
          insight: { body: "Dieser Bereich wird im nÃ¤chsten Schritt mit detaillierten Metriken und Herleitungen zur Berechnung gefÃ¼llt." }
        };
    }
  };

  // â”€â”€ Load Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const load = async () => {
      const [ba, vs, kp, fn, sg, li, wm, si] = await Promise.all([
        marketingMockProvider.getBesteAktion(),
        marketingMockProvider.listVorschlaege(),
        marketingMockProvider.getKampagnen(),
        marketingMockProvider.getFunnel(),
        marketingMockProvider.getSegmente(),
        marketingMockProvider.getLernInsights(),
        marketingMockProvider.getWirkungMini(),
        marketingMockProvider.getStoryIdeen(),
      ]);
      setBesteAktion(ba);
      setVorschlaege(vs);
      setKampagnen(kp);
      setFunnel(fn);
      setSegmente(sg);
      setInsights(li);
      setWirkungMini(wm);
      setStoryIdeen(si);

      // Instagram Status
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
    };
    load();
  }, []);

  // â”€â”€ Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleSort = useCallback(async (sort: SortMode) => {
    setActiveSort(sort);
    const vs = await marketingMockProvider.listVorschlaege(sort);
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  const handleEntryClick = useCallback((tab: TabName) => {
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

  if (!besteAktion) return null;

  return (
    <>
    <div className="pb-12 w-full">
      {/* Breadcrumb */}
      <div className="mk-crumb">
        Home
        <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg>
        Marketing
      </div>

      {/* Header */}
      <div className="mk-header">
        <div className="mk-title">
          <div className="mk-logo mk-animated">
            <svg viewBox="0 0 24 24"><path d="M3 11l18-8-8 18-2-7-8-3z" /></svg>
          </div>
          <div>
            <h1 className="font-serif">Marketing Studio</h1>
            <div className="mk-subtitle">
              Dein Betrieb, ins beste Licht gerÃ¼ckt â€” <b>gefÃ¼hrt, in Minuten, ohne Vorkenntnisse.</b>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleInstagramConnect}
            className="flex items-center gap-2 text-[12px] font-bold bg-bg-app-soft text-navy-900 px-3 py-1.5 rounded-full hover:bg-neutral-gray-200 transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            {igConnected ? "Instagram verbunden" : "Instagram verknÃ¼pfen"}
          </button>
          <div className="mk-live-pill">
            <span className="dot" />
            System lernt mit
          </div>
        </div>
      </div>


      <SubNav activeTab={activeTab} onTabChange={handleTabChange} />

      {/* View Content */}
      <AnimatePresence mode="wait">
        {activeTab === "Studio" && (
          <motion.div key="studio" initial="hidden" animate="visible" exit="exit">
            {/* Composer Hero */}
            <ComposerHero
              aktion={besteAktion}
              varianteIdx={varianteIdx}
              onNextVar={nextVar}
              onPrevVar={prevVar}
              onPost={handlePost}
            />

            {/* 3 Schritte */}
            <motion.div custom={1} variants={floatIn} className="mk-steps">
              <div className="mk-step">
                <div className="mk-step-num">1</div>
                <div className="mk-step-text"><b>Foto wÃ¤hlen</b>aus deinen AuftrÃ¤gen</div>
              </div>
              <div className="mk-step-arrow"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></div>
              <div className="mk-step">
                <div className="mk-step-num">2</div>
                <div className="mk-step-text"><b>Text kommt automatisch</b>Bildunterschrift &amp; Hashtags</div>
              </div>
              <div className="mk-step-arrow"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></div>
              <div className="mk-step">
                <div className="mk-step-num">3</div>
                <div className="mk-step-text"><b>Ein Tipp â€” fertig</b>Rest macht das Studio</div>
              </div>
            </motion.div>

            {/* Story Ideen */}
            <motion.div custom={2} variants={floatIn}>
              <div className="mk-sec-label">Ideen fÃ¼r heute â€” antippen &amp; Ã¼bernehmen</div>
              <div className="mk-stories">
                {storyIdeen.map(story => (
                  <StoryRing key={story.id} story={story} onClick={() => handleStoryClick(story)} />
                ))}
              </div>
            </motion.div>

            {/* Wirkung Mini */}
            <motion.div custom={3} variants={floatIn}>
              <div className="mk-sec-label">Was es bringt â€” diesen Monat</div>
              <div className="mk-impact">
                {wirkungMini.map(w => (
                  <div key={w.label} className="mk-imp cursor-pointer hover:shadow-md transition-shadow" onClick={() => setAnalysisOpen(w.label)}>
                    <div className="mk-imp-label">{w.label}</div>
                    <div className="mk-imp-value">
                      <AnimatedCounter {...w} running={activeTab === "Studio"} />
                    </div>
                    <div className="mk-spark">
                      {w.sparkValues.map((v, i) => (
                        <span key={i} style={{ height: `${v}%` }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Entry Tiles */}
            <motion.div custom={4} variants={floatIn}>
              <div className="mk-sec-label">Tiefer einsteigen &amp; VerknÃ¼pfungen</div>
              <div className="mk-entries">
                <div className="mk-entry" onClick={() => handleEntryClick("Ideen")}>
                  <div className="mk-entry-icon">
                    <svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.8.8 1 1.3 1 2.5h6c0-1.2.2-1.7 1-2.5A6 6 0 0012 3z" /></svg>
                  </div>
                  <div><h3>Ideenpool</h3><p>Alle VorschlÃ¤ge, sortierbar</p></div>
                </div>
                <div className="mk-entry" onClick={() => handleEntryClick("Reichweite")}>
                  <div className="mk-entry-icon">
                    <svg viewBox="0 0 24 24"><path d="M3 3v18h18M7 14l3-3 3 2 5-6" /></svg>
                  </div>
                  <div><h3>Reichweite</h3><p>Post â†’ Anfrage â†’ Umsatz</p></div>
                </div>
                <div className="mk-entry" onClick={() => handleEntryClick("Kunden")}>
                  <div className="mk-entry-icon">
                    <svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /></svg>
                  </div>
                  <div><h3>Kunden</h3><p>Segmente &amp; Reaktivierung</p></div>
                </div>
                <Link href="/buchhaltung" className="mk-entry">
                  <div className="mk-entry-icon" style={{ background: "var(--bg-app-soft)", color: "var(--text-muted)" }}>
                    <svg viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                  </div>
                  <div><h3>Buchhaltung</h3><p>Marketingkosten &amp; ROI</p></div>
                </Link>
                <Link href="/kommunikation" className="mk-entry">
                  <div className="mk-entry-icon" style={{ background: "var(--bg-app-soft)", color: "var(--text-muted)" }}>
                    <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                  </div>
                  <div><h3>Kommunikation</h3><p>Kundenanfragen bearbeiten</p></div>
                </Link>
                <Link href="/performance" className="mk-entry">
                  <div className="mk-entry-icon" style={{ background: "var(--bg-app-soft)", color: "var(--text-muted)" }}>
                    <svg viewBox="0 0 24 24"><path d="M2 20h20M5 17l5-5 4 4 7-7" /></svg>
                  </div>
                  <div><h3>Performance</h3><p>Umfassende Analyse</p></div>
                </Link>
                <div className="mk-entry" onClick={() => handleEntryClick("Kunden")}>
                  <div className="mk-entry-icon">
                    <svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /></svg>
                  </div>
                  <div><h3>Kunden wecken</h3><p>Stammkunden reaktivieren</p></div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {activeTab === "Ideen" && (
          <motion.div key="ideen" initial="hidden" animate="visible" exit="exit">
            <motion.div custom={0} variants={floatIn}>
              <div className="mk-filterchips">
                {([["output", "Meister Output"], ["einfach", "Am einfachsten"], ["relevanz", "Relevanz"], ["kanal", "Nach Kanal"]] as [SortMode, string][]).map(([key, label]) => (
                  <span key={key} className={`mk-fchip ${activeSort === key ? 'active' : ''}`} onClick={() => handleSort(key)}>{label}</span>
                ))}
              </div>
            </motion.div>
            <motion.div custom={1} variants={floatIn} className="mk-ideas">
              {vorschlaege.map(v => (
                <IdeenCard key={v.id} vorschlag={v} />
              ))}
            </motion.div>
          </motion.div>
        )}

        {activeTab === "Kampagnen" && (
          <motion.div key="kampagnen" initial="hidden" animate="visible" exit="exit">
            <motion.div custom={0} variants={floatIn} className="mk-panel">
              <h3 className="font-serif">Laufende &amp; geplante Kampagnen</h3>
              <div className="pdesc">Mehrere Aktionen mit einem Ziel gebÃ¼ndelt â€” das Studio verteilt sie auf die besten Zeitfenster.</div>
              {kampagnen.map(k => (
                <div key={k.id} className="mk-camp">
                  <span className="mk-camp-dot" style={{ background: k.statusColor }} />
                  <div className="mk-camp-content">
                    <h4>{k.titel}</h4>
                    <div className="ct">{k.kanal}</div>
                  </div>
                  <div className="mk-camp-bar"><span style={{ width: `${k.fortschritt}%` }} /></div>
                  <span className="mk-camp-result">{k.ergebnis}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>
        )}

        {activeTab === "Reichweite" && funnel && (
          <motion.div key="reichweite" initial="hidden" animate="visible" exit="exit">
            <motion.div custom={0} variants={floatIn} className="mk-panel">
              <h3 className="font-serif">Was dein Marketing wirklich bringt</h3>
              <div className="pdesc">End-to-End verfolgt: vom Post bis zum bezahlten Auftrag â€” {new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}.</div>
              <div className="mk-fbars">
                {funnel.stufen.map((s, i) => (
                  <div key={i} className="mk-fbar">
                    <span className="mk-fbar-label">{s.label}</span>
                    <div className="mk-fbar-track">
                      <motion.div
                        className="mk-fbar-fill"
                        key={`${funnelKey}-${i}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${s.breite}%` }}
                        transition={{ duration: 1, delay: i * 0.1, ease: [0.4, 0, 0.2, 1] }}
                      >
                        {s.wert.toLocaleString('de-DE')}
                      </motion.div>
                    </div>
                    <span className="mk-fbar-val">{s.wert.toLocaleString('de-DE')}</span>
                  </div>
                ))}
              </div>
              <div className="mk-roi-big mk-animated">
                <div>
                  <div className="mk-roi-label">Umsatz aus Marketing</div>
                  <div className="mk-roi-value">{funnel.umsatz.toLocaleString('de-DE')} â‚¬</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mk-roi-label">ROI</div>
                  <div className="mk-roi-value">{funnel.roi.toFixed(1).replace('.', ',')}Ã—</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {activeTab === "Kunden" && (
          <motion.div key="kunden" initial="hidden" animate="visible" exit="exit">
            <motion.div custom={0} variants={floatIn} className="mk-panel">
              <h3 className="font-serif">Kunden wecken</h3>
              <div className="pdesc">Segmente aus deiner Kartei â€” das Studio schlÃ¤gt vor, wen du wann ansprichst.</div>
              <div className="mk-segs">
                {segmente.map(s => (
                  <div key={s.id} className="mk-seg">
                    <div className="mk-seg-ring">
                      <div className="mk-seg-inner">{s.emoji}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="mk-seg-name">{s.name}</div>
                      <div className="mk-seg-desc">{s.kundenAnzahl} Kunden</div>
                    </div>
                    <span className="mk-seg-badge">{s.weckbar} weckbar</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}

        {activeTab === "Wirkung" && (
          <motion.div key="wirkung" initial="hidden" animate="visible" exit="exit">
            <div className="mk-learns">
              {insights.map((insight, i) => (
                <motion.div key={insight.id} custom={i} variants={floatIn} className="mk-lcard">
                  <span className="mk-lcard-badge">âœ¦ Gelernt</span>
                  <h4>{insight.titel}</h4>
                <p dangerouslySetInnerHTML={{ __html: insight.text }} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Helper function for Overlays */}


      {/* Footer */}
      <div className="mk-footnote">
        Jede Aktion trÃ¤gt <b>Aufwand, Kosten und erwarteten Umsatz</b> â€” das Studio lernt aus jedem Post, was bei dir wirkt.<br />
        Kosten flieÃŸen automatisch in die Buchhaltung, Umsatz in Performance. Komplett per Feature-Toggle abschaltbar.
      </div>

      {/* Toast */}
      <div className={`mk-toast ${showToast ? 'show' : ''}`}>
        <span className="mk-toast-check">
          <svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-11" /></svg>
        </span>
        <span>{toastMsg}</span>
      </div>

      {/* Analysis Overlay */}
      <AnalysisOverlay
        open={!!analysisOpen}
        onClose={() => setAnalysisOpen(null)}
        title={analysisOpen ? `Analyse: ${analysisOpen}` : ""}
        {...getAnalysisProps(analysisOpen)}
      />
    </div>
    </>
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   SUB-COMPONENTS
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

// â”€â”€ SubNav with animated glider â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SubNav({ activeTab, onTabChange }: { activeTab: TabName; onTabChange: (t: TabName) => void }): React.ReactElement {
  return (
    <div className="mk-subnav">
      {TAB_NAMES.map(name => (
        <button
          key={name}
          className={activeTab === name ? 'active' : ''}
          onClick={() => onTabChange(name)}
          style={{ position: 'relative' }}
        >
          {activeTab === name && (
            <motion.span
              layoutId="mk-glider"
              className="mk-glider"
              style={{ position: 'absolute', inset: 0, borderRadius: 999 }}
              transition={{ type: "spring", stiffness: 400, damping: 35 }}
            />
          )}
          <span style={{ position: 'relative', zIndex: 1 }}>{name}</span>
        </button>
      ))}
    </div>
  );
}

// â”€â”€ Composer Hero â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ComposerHero({
  aktion, varianteIdx, onNextVar, onPrevVar, onPost
}: {
  aktion: AktionVorschlag;
  varianteIdx: number;
  onNextVar: () => void;
  onPrevVar: () => void;
  onPost: () => void;
}) {
  return (
    <motion.div custom={0} variants={floatIn} className="mk-composer">
      {/* Left: Post Preview */}
      <div className="mk-preview">
        <div className="mk-pv-top">
          <div className="mk-pv-ring mk-animated">
            <div className="mk-pv-ring-inner">K</div>
          </div>
          <div className="mk-pv-name">
            galvanik_kreile
            <small>Frankfurt Â· jetzt</small>
          </div>
        </div>
        <div className="mk-pv-img">
          <div className="mk-pv-half before">
            <div className="mk-pv-icon">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M8 12h8" /></svg>
            </div>
            <span className="mk-pv-label">Vorher</span>
          </div>
          <div className="mk-pv-half after mk-animated">
            <div className="mk-pv-icon">
              <svg viewBox="0 0 24 24"><path d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1L12 16.6 5.7 21l2.3-7.1-6-4.5h7.6z" /></svg>
            </div>
            <span className="mk-pv-label">Nachher</span>
            <div className="mk-pv-shine mk-animated" />
          </div>
        </div>
        <div className="mk-pv-caption">
          <div className="mk-pv-acts">
            <svg className="heart" viewBox="0 0 24 24" style={{ fill: '#F2643C', stroke: '#F2643C' }}>
              <path d="M12 21s-7-4.4-9.5-8.5C.9 9.7 2.3 6 5.5 6 7.5 6 9 7.2 12 10c3-2.8 4.5-4 6.5-4 3.2 0 4.6 3.7 3 6.5C19 16.6 12 21 12 21z" />
            </svg>
            <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
            <svg viewBox="0 0 24 24"><path d="M4 12v8h16v-8M16 6l-4-4-4 4M12 2v14" /></svg>
          </div>
          <div className="mk-pv-txt">
            <b>galvanik_kreile</b> {aktion.caption}
          </div>
          <div className="mk-pv-tags">{aktion.hashtags}</div>
        </div>
      </div>

      {/* Right: Controls */}
      <div className="mk-ctrl">
        <span className="mk-badge mk-animated">âœ¦ Gelernt Â· beste Aktion heute</span>
        <h2 className="font-serif">{aktion.titel}</h2>
        <div className="why">{aktion.begruendung}</div>
        <div className="mk-meta">
          <span className="mk-mtag out">{aktion.erwarteterOutput}</span>
          <span className="mk-mtag eff">{aktion.aufwand}</span>
          <span className="mk-mtag cost">{aktion.kosten}</span>
        </div>
        <div className="mk-actions">
          <button className="mk-nav-var" onClick={onPrevVar}>
            <svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <motion.button
            className="mk-cta mk-animated"
            whileTap={{ scale: 0.96 }}
            onClick={onPost}
          >
            <Send size={18} />
            Jetzt posten
          </motion.button>
          <button className="mk-nav-var" onClick={onNextVar}>
            <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </div>
        <div className="mk-var-dots">
          {aktion.varianten.map((_, i) => (
            <span key={i} className={i === varianteIdx ? 'active' : ''} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// â”€â”€ Story Ring â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function StoryRing({ story, onClick }: { story: StoryIdee; onClick: () => void }) {
  // Map icon names to inline SVGs
  const iconMap: Record<string, React.ReactNode> = {
    Building2: <svg viewBox="0 0 24 24"><path d="M3 22h18M5 22V8l7-5 7 5v14M9 22v-6h6v6" /></svg>,
    Star: <svg viewBox="0 0 24 24"><path d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1L12 16.6 5.7 21l2.3-7.1-6-4.5h7.6z" /></svg>,
    Landmark: <svg viewBox="0 0 24 24"><path d="M3 21h18M5 21V8l7-4 7 4v13M9 12h.01M15 12h.01M9 16h.01M15 16h.01" /></svg>,
    Lightbulb: <svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.8.8 1 1.3 1 2.5h6c0-1.2.2-1.7 1-2.5A6 6 0 0012 3z" /></svg>,
    Plus: <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>,
  };

  return (
    <motion.div
      className={`mk-story ${story.isAdd ? 'add' : ''}`}
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <div className={`mk-story-ring ${story.isAdd ? '' : 'mk-animated'}`}>
        <div className="mk-story-inner">
          {iconMap[story.icon] || iconMap.Star}
        </div>
      </div>
      <span className="mk-story-label">{story.label}</span>
    </motion.div>
  );
}

// â”€â”€ Ideen Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function IdeenCard({ vorschlag }: { vorschlag: AktionVorschlag }) {
  const kanalClass = vorschlag.kanal === 'instagram' ? 'ig' : vorschlag.kanal === 'email' ? 'mail' : 'google';
  const kanalIcon = vorschlag.kanal === 'instagram'
    ? <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" /></svg>
    : vorschlag.kanal === 'email'
    ? <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
    : <svg viewBox="0 0 24 24"><circle cx="12" cy="10" r="3" /><path d="M12 2a8 8 0 00-8 8c0 5 8 12 8 12s8-7 8-12a8 8 0 00-8-8z" /></svg>;

  return (
    <motion.div className="mk-idea" whileHover={{ y: -3 }}>
      <div className="mk-idea-head">
        <div className={`mk-idea-chan ${kanalClass}`}>{kanalIcon}</div>
        <h4>{vorschlag.titel}</h4>
      </div>
      <p>{vorschlag.quelle || vorschlag.begruendung}</p>
      <div className="mk-idea-foot">
        <span className="mk-idea-score">Wirkung <b>{vorschlag.score}</b></span>
        <button className="mk-idea-btn">
          {vorschlag.kanal === 'email' ? 'Mails prÃ¼fen' : vorschlag.kanal === 'google' ? 'Anfragen' : 'Ãœbernehmen'}
        </button>
      </div>
    </motion.div>
  );
}
