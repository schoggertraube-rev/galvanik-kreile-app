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

  useEffect(() => {
    instagramAdapter.isConnected().then(setIgConnected);
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
    const res = await instagramAdapter.publish(besteAktion);
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
      instagramAdapter.connect();
    }
  }, [igConnected]);

  const handleTabChange = useCallback((tab: TabName) => {
    setActiveTab(tab);
    if (tab === "Reichweite") setFunnelKey(k => k + 1);
  }, []);

  const handleEntryClick = useCallback((tab: "Reichweite" | "Kunden" | "Studio" | "Ideen" | "Kampagnen" | "Wirkung") => {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getAnalysisProps = (key: string | null): any => {
    if (!key) return {};
    if (key === "Kampagnen") {
      const active = kampagnen.filter((campaign) => campaign.status === 'aktiv').length;
      return {
        title: "Kampagnen-Performance",
        subtitle: "Gespeicherte Kampagnen mit ihrem belegten Fortschritt und attribuierten Ergebnis.",
        isEmpty: kampagnen.length === 0,
        emptyState: { title: "Noch keine Kampagnen", description: "Es sind keine Kampagnen gespeichert.", actionLabel: "Schließen", onAction: () => setAnalysisOpen(null) },
        hero: {
          kicker: "KAMPAGNENSTATUS",
          value: `${active} aktiv`,
          changePill: { text: `${kampagnen.length} gespeichert`, variant: "gray" as const },
          meta: "Fortschritt aus Zeitraum oder tatsächlich ausgeführten Aktionen; Ergebnis nur aus Attributionen.",
        },
        composition: {
          title: "Gespeicherte Kampagnen",
          rows: kampagnen.map((campaign) => ({
            avatar: campaign.titel.substring(0, 2).toUpperCase(),
            avatarColor: campaign.statusColor,
            name: campaign.titel,
            meta: `${campaign.statusLabel} · ${campaign.fortschritt} %`,
            amount: campaign.ergebnis,
          })),
        },
      };
    }
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
          changePill: { text: `${data.evidence.attributionRows} Attributionszeilen`, variant: "gray" as const },
          meta: "Gezählt werden ausschließlich eindeutige Lead-IDs mit expliziter Touchpoint-Zuordnung.",
        },
        trend: { title: "Anfragen im Zeitverlauf", chartType: "bar", chartData: data.chartData },
        composition: {
          title: "Top Marketing-Kanäle",
          rows: data.topKategorien.map((k: { name: string; amount: string | number }) => ({
            avatar: k.name.substring(0, 2).toUpperCase(), avatarColor: "#E1306C",
            name: k.name, meta: "Zugewiesene Anfragen", amount: `${k.amount}`
          })),
          footerLink: { label: "Zu allen Anfragen", href: "/kunden" }
        },
        crossKpi: [
          { label: "Touchpoints im Zeitraum", value: String(data.evidence.touchpoints), delta: "DB-Fakten", deltaColor: "var(--text3)" },
          { label: "Attributionszeilen", value: String(data.evidence.attributionRows), delta: data.evidence.source, deltaColor: "var(--text3)" },
          { label: "Stärkster belegter Kanal", value: data.topKategorien[0]?.name || "keiner", delta: "Keine Schätzung", deltaColor: "var(--text3)" }
        ],
        insight: {
          body: data.insights.beobachtungen.map((b: string) => `<b>Beobachtung:</b> ${b}`).join('<br/>') + 
                (data.insights.vermutungen.length > 0 ? '<br/><br/>' + data.insights.vermutungen.map((v: string) => `<b>Vermutung:</b> ${v}`).join('<br/>') : ''),
          actions: data.insights.vorschlaege.map((v: { label: string; href: string }) => ({ label: v.label, onClick: () => window.location.href = v.href }))
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
          changePill: { text: `${data.evidence.attributedOrders} zugeordnete Aufträge`, variant: "gray" as const },
          meta: "Summe ausschließlich aus gespeicherten marketing.attribution.umsatz-Werten.",
        },
        trend: { title: "Umsatz im Zeitverlauf", chartType: "bar", chartData: data.chartData },
        composition: {
          title: "Höchste umgesetzte Aufträge",
          rows: data.topAuftraege.map((order: { auftragId: string; umsatz: number; kanal: string }) => ({
            avatar: order.auftragId.substring(0, 2).toUpperCase(),
            avatarColor: "#1E3A8A",
            name: `Auftrag ${order.auftragId}`,
            meta: `Quelle: ${order.kanal}`,
            amount: `${order.umsatz.toLocaleString("de-DE")} €`,
          })),
          footerLink: { label: "Alle Marketing-Aufträge", href: "/auftraege" }
        },
        crossKpi: [
          { label: "Zugeordnete Aufträge", value: String(data.evidence.attributedOrders), delta: "eindeutige IDs", deltaColor: "var(--text3)" },
          { label: "Attributionszeilen", value: String(data.evidence.attributionRows), delta: data.evidence.source, deltaColor: "var(--text3)" }
        ],
        insight: {
          body: data.insights.beobachtungen.map((observation: string) => `<b>Beobachtung:</b> ${observation}`).join('<br/>'),
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
        title: "ROI-Datenlücke",
        subtitle: "Attribuierter Umsatz und Planbudget sind vorhanden; tatsächliche Ausgaben fehlen.",
        accentBg: "linear-gradient(180deg, var(--posbg), transparent)",
        tabs: [{ id: "gesamt", label: "Gesamt-ROI" }],
        activeTab: "gesamt",
        hero: {
          kicker: "MARKETING-ROI",
          value: data.gesamt === null ? "nicht berechenbar" : `${data.gesamt.toLocaleString("de-DE", { maximumFractionDigits: 2 })}×`,
          changePill: { text: `${data.plannedBudget.toLocaleString("de-DE")} € Planbudget`, variant: "amber" as const },
          meta: "Keine ROI-Berechnung, solange tatsächliche Marketingausgaben nicht gespeichert und zugeordnet sind.",
        },
        trend: { title: "ROI-Entwicklung", chartType: "line", chartData: data.chartData },
        composition: {
          title: "Berechnungsgrundlage",
          rows: [
            { avatar: "R", avatarColor: "#10B981", name: "Attribuierter Umsatz", meta: "marketing.attribution.umsatz", amount: `${data.revenue.toLocaleString("de-DE")} €` },
            { avatar: "P", avatarColor: "#F59E0B", name: "Planbudget", meta: "marketing.aktion.kosten_budget (Planwert)", amount: `${data.plannedBudget.toLocaleString("de-DE")} €` },
            { avatar: "K", avatarColor: "#94A3B8", name: "Tatsächliche Ausgaben", meta: "noch nicht mit Kostenledger verknüpft", amount: "nicht erfasst" },
            { avatar: "A", avatarColor: "#3B82F6", name: "Ausgeführte Aktionen", meta: "im gewählten Zeitraum", amount: `${data.actions} Stk.` }
          ],
          footerLink: { label: "Kosten in Buchhaltung ansehen", href: "/buchhaltung" }
        },
        crossKpi: [
          { label: "Aktionen mit Planbudget", value: String(data.evidence.budgetedActions), delta: "kosten_budget > 0 (Planwert)", deltaColor: "var(--text3)" },
          { label: "Attributionszeilen", value: String(data.evidence.attributionRows), delta: data.evidence.source, deltaColor: "var(--text3)" }
        ],
        insight: {
          body: data.insights.beobachtungen.map((observation: string) => `<b>Beobachtung:</b> ${observation}`).join('<br/>')
        },
        linkedAreas: [
          { label: "Buchhaltung (kosten_posten)", href: "/buchhaltung/kosten" },
          { label: "Performance Overview", href: "/performance" }
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
      <div className="mk-header">
        <div className="mk-title">
          <div className="mk-logo mk-animated">
            <svg viewBox="0 0 24 24"><path d="M3 11l18-8-8 18-2-7-8-3z" /></svg>
          </div>
          <div>
            <h1 className="font-serif">Marketing Studio</h1>
            <div className="mk-subtitle">
              Dein Betrieb, ins beste Licht gerückt — <b>geführt, in Minuten, ohne Vorkenntnisse.</b>
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
            Echte Datenbasis
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
        Jede Aktion kann <b>Aufwand und Kosten</b> tragen. Wirkung erscheint erst nach einem echten Touchpoint und einer expliziten Attribution.<br />
        Fehlende Verknüpfungen bleiben sichtbar und werden nicht durch Schätzwerte ersetzt.
      </div>

      <div className={`mk-toast ${showToast ? 'show' : ''}`}>
        <span className="mk-toast-check">
          <svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-11" /></svg>
        </span>
        <span>{toastMsg}</span>
      </div>

      <AnalysisOverlay
        isEmpty={false}
        emptyState={{ title: "Noch keine Daten", description: "Es wurden noch keine Daten für diesen Bereich erfasst.", actionLabel: "Jetzt Daten erfassen", actionHref: "/" }}
        open={!!analysisOpen}
        onClose={() => setAnalysisOpen(null)}
        title={analysisOpen ? `Analyse: ${analysisOpen}` : ""}
        {...getAnalysisProps(analysisOpen)}
      />
    </div>
  );
}
