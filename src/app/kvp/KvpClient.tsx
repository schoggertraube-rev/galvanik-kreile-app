"use client";

import { useState } from "react";
import { Lightbulb, PlusCircle, Target, Activity, AlertOctagon, CheckCircle2, ListFilter, PlayCircle, BarChart3, Info, Lock } from "lucide-react";
import { usePageView } from "@/hooks/usePageView";
import { DetailOverlay } from "@/components/ui/DetailOverlay";
import Link from "next/link";
import { OfflineManager } from "@/lib/offline/OfflineManager";
import { OfflineSyncBadge } from "@/components/offline/OfflineSyncBadge";
import { usePermissions } from "@/lib/auth/PermissionsContext";

interface KvpItem {
  id: string;
  title: string;
  category: string;
  benefit: string;
  effort: "klein" | "mittel" | "groß";
  priority: "hoch" | "mittel" | "niedrig";
  status: "neu" | "prüfen" | "geplant" | "erledigt";
  problemDesc: string;
  observedSignal: string;
  expectedBenefit: string;
  affectedPage: string;
  nextAction: string;
  isDemo?: boolean;
}

const CATEGORIES = ["Bedienung", "Kommunikation", "Warendurchlauf", "Performance", "Kundenservice", "Bäder/Chemie", "Finanzen", "Sonstiges"];
const BENEFITS = ["Zeit sparen", "Fehler vermeiden", "Kunde zufriedener", "Kosten senken", "Übersicht verbessern"];

const DEMO_ITEMS: KvpItem[] = [
  {
    id: "demo-1", title: "Kommunikation stärker wie Messenger darstellen", category: "Kommunikation", benefit: "Übersicht verbessern", effort: "mittel", priority: "hoch", status: "erledigt",
    problemDesc: "Die Kommunikationsseite wirkt noch zu sehr wie eine Kachel-Ansicht, nicht wie ein Posteingang.",
    observedSignal: "Nutzer suchen lange nach der Antwort-Funktion.",
    expectedBenefit: "Schnelleres Bearbeiten von Kundenanfragen.",
    affectedPage: "/kommunikation", nextAction: "Messenger-Layout implementieren", isDemo: true
  },
  {
    id: "demo-2", title: "Doppelte Suche vermeiden", category: "Bedienung", benefit: "Übersicht verbessern", effort: "klein", priority: "mittel", status: "erledigt",
    problemDesc: "Auf der Performance-Seite gab es eine eigene Suche neben der globalen Suche.",
    observedSignal: "Verwirrung bei Such-Eingaben.",
    expectedBenefit: "Klarere UI-Muster.",
    affectedPage: "/performance", nextAction: "Lokale Suche entfernen", isDemo: true
  },
  {
    id: "demo-3", title: "Home-Checkliste automatisch erledigen", category: "Bedienung", benefit: "Zeit sparen", effort: "mittel", priority: "hoch", status: "prüfen",
    problemDesc: "Nutzer müssen Checklisten abhaken, obwohl die App den Status bereits kennt.",
    observedSignal: "Checklisten werden ignoriert.",
    expectedBenefit: "Weniger Klicks, mehr Vertrauen in System-Intelligenz.",
    affectedPage: "/", nextAction: "Logik für Auto-Completion schreiben", isDemo: true
  },
  {
    id: "demo-4", title: "Auftragskarten breiter und lesbarer machen", category: "Warendurchlauf", benefit: "Übersicht verbessern", effort: "klein", priority: "mittel", status: "erledigt",
    problemDesc: "Die Auftragskarten im Auftragsbuch sind zu schmal und verschwenden horizontalen Platz.",
    observedSignal: "Schwer lesbare Fristen.",
    expectedBenefit: "Bessere Lesbarkeit auf Desktop.",
    affectedPage: "/orders", nextAction: "OrderWideCard erstellen", isDemo: true
  },
  {
    id: "demo-5", title: "Performance-Kacheln mit Deep-Dive ausbauen", category: "Performance", benefit: "Übersicht verbessern", effort: "groß", priority: "hoch", status: "erledigt",
    problemDesc: "Performance-Kacheln zeigten nur Dummy-Text ohne echte Analyse-Tiefe.",
    observedSignal: "Klicks auf Kacheln führen ins Leere.",
    expectedBenefit: "Echtes Cockpit-Gefühl für Management.",
    affectedPage: "/performance", nextAction: "Detail-Overlays Level 2/3 implementieren", isDemo: true
  },
  {
    id: "demo-6", title: "Mobile Navigation vereinfachen", category: "Bedienung", benefit: "Übersicht verbessern", effort: "mittel", priority: "mittel", status: "geplant",
    problemDesc: "Das mobile Menü ist noch recht lang.",
    observedSignal: "Häufiges Scrollen auf kleinen Geräten.",
    expectedBenefit: "Schnellerer Zugriff auf Hauptfunktionen.",
    affectedPage: "Layout", nextAction: "Tabs oder kompakteres Grid prüfen", isDemo: true
  },
  {
    id: "demo-7", title: "Gerätefreigabe/Kopierschutz vorbereiten", category: "Sonstiges", benefit: "Fehler vermeiden", effort: "groß", priority: "niedrig", status: "prüfen",
    problemDesc: "App läuft überall ohne Einschränkung. Für Produktion wird Geräteschutz benötigt.",
    observedSignal: "Security-Review.",
    expectedBenefit: "Kein unbefugter Zugriff aus Fremdnetzen.",
    affectedPage: "/admin/devices", nextAction: "Device Guard Modul konzipieren", isDemo: true
  }
];

export function KvpClient() {
  usePageView();

  const { role } = usePermissions();
  const isAdminOrDev = role === "admin" || role === "developer";
  const [items, setItems] = useState<KvpItem[]>(() => {
    if (typeof window === "undefined") return DEMO_ITEMS;
    const saved = localStorage.getItem("kreile_kvp_items");
    if (!saved) return DEMO_ITEMS;
    try {
      const parsed = JSON.parse(saved);
      return [...parsed, ...DEMO_ITEMS];
    } catch {
      return DEMO_ITEMS;
    }
  });
  const [activeItem, setActiveItem] = useState<KvpItem | null>(null);

  // Form State
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState(CATEGORIES[0]);
  const [newBenefit, setNewBenefit] = useState(BENEFITS[0]);
  const [newProblem, setNewProblem] = useState("");

  const handleSave = () => {
    if (!newTitle.trim()) return;

    const newItem: KvpItem = {
      id: "local-" + Date.now(),
      title: newTitle,
      category: newCategory,
      benefit: newBenefit,
      effort: "mittel",
      priority: "mittel",
      status: "neu",
      problemDesc: newProblem,
      observedSignal: "Manuell gemeldet",
      expectedBenefit: newBenefit,
      affectedPage: "Allgemein",
      nextAction: "Muss noch analysiert werden",
      isDemo: false
    };

    const currentSaved = localStorage.getItem("kreile_kvp_items");
    let currentArr = [];
    if (currentSaved) {
      try { currentArr = JSON.parse(currentSaved); } catch(e) {}
    }
    currentArr.unshift(newItem);
    localStorage.setItem("kreile_kvp_items", JSON.stringify(currentArr));

    OfflineManager.enqueueAction("APP_KVP_CREATE", newItem).catch(console.error);

    setItems([newItem, ...items]);
    setNewTitle("");
    setNewProblem("");
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case "neu": return <span className="bg-blue-100 text-blue-700 text-[10px] font-black uppercase px-2 py-0.5 rounded">Neu</span>;
      case "prüfen": return <span className="bg-yellow-100 text-yellow-700 text-[10px] font-black uppercase px-2 py-0.5 rounded">Prüfen</span>;
      case "geplant": return <span className="bg-purple-100 text-purple-700 text-[10px] font-black uppercase px-2 py-0.5 rounded">Geplant</span>;
      case "erledigt": return <span className="bg-green-100 text-green-700 text-[10px] font-black uppercase px-2 py-0.5 rounded flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Erledigt</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 pb-8 font-sans antialiased text-navy-900 w-full max-w-7xl mx-auto animate-in fade-in duration-400">
      <OfflineSyncBadge />
      
      {/* HEADER */}
      <div className="mb-6 flex flex-col md:flex-row md:items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black font-serif tracking-tight text-navy-900 flex items-center gap-3">
            <Lightbulb className="w-8 h-8 text-accent-orange" />
            Developer-KVP / App-Verbesserung
          </h1>
          <p className="text-text-muted mt-2 font-medium">Technischer Verbesserungsprozess & Selbstanalyse der App.</p>
        </div>
        <div className="bg-bg-app-soft px-3 py-1.5 rounded-lg border border-neutral-gray-200 text-xs font-bold flex items-center gap-2 self-start">
          <Info className="w-4 h-4 text-accent-orange" />
          Speicherung erfolgt nur lokal (Demo)
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COL 1: NEUE VERBESSERUNG */}
        <div className="lg:col-span-1 space-y-6">
          <section className="bg-bg-app border border-neutral-gray-200 rounded-3xl p-6 shadow-sm">
            <h2 className="text-lg font-bold font-serif text-navy-900 flex items-center gap-2 mb-4">
              <PlusCircle className="w-5 h-5 text-accent-orange" />
              Neue Verbesserung
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">Was stört / was fehlt?</label>
                <input 
                  type="text" 
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Kurzer Titel..."
                  className="w-full rounded-xl border border-neutral-gray-300 px-3 py-2 text-sm focus:border-navy-900 focus:ring-1 focus:ring-navy-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">Details (Optional)</label>
                <textarea 
                  value={newProblem}
                  onChange={e => setNewProblem(e.target.value)}
                  placeholder="Beschreibe das Problem genauer..."
                  className="w-full rounded-xl border border-neutral-gray-300 px-3 py-2 text-sm h-20 resize-none focus:border-navy-900 focus:ring-1 focus:ring-navy-900 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase mb-1">Kategorie</label>
                  <select 
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    className="w-full rounded-lg border border-neutral-gray-300 px-2 py-1.5 text-xs focus:border-navy-900 outline-none bg-white"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase mb-1">Wirkung</label>
                  <select 
                    value={newBenefit}
                    onChange={e => setNewBenefit(e.target.value)}
                    className="w-full rounded-lg border border-neutral-gray-300 px-2 py-1.5 text-xs focus:border-navy-900 outline-none bg-white"
                  >
                    {BENEFITS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>

              <button 
                onClick={handleSave}
                disabled={!newTitle.trim()}
                className="w-full mt-2 bg-navy-900 text-white font-bold py-3 rounded-xl hover:bg-navy-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Lokal vormerken
              </button>
            </div>
          </section>

          {/* COL 1: SELBSTANALYSE */}
          <section className="bg-white border border-neutral-gray-200 rounded-3xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold font-serif text-navy-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-accent-orange" />
                Selbstanalyse
              </h2>
              <span className="bg-bg-app-soft text-text-muted text-[10px] px-2 py-1 rounded font-bold uppercase">Vorbereitet</span>
            </div>
            
            <p className="text-xs text-text-muted mb-4">
              Die App lernt mit. Zukünftig werden hier UX-Engpässe aus den Nutzungsdaten generiert.
            </p>

            <ul className="space-y-3 mb-6">
              <li className="flex justify-between items-center border-b border-neutral-gray-100 pb-2">
                <span className="text-sm font-medium text-navy-900">Häufigste Suche ohne Treffer</span>
                <span className="text-xs font-bold text-error-red">&quot;Urlaub&quot;</span>
              </li>
              <li className="flex justify-between items-center border-b border-neutral-gray-100 pb-2">
                <span className="text-sm font-medium text-navy-900">Rollenblockaden (Woche)</span>
                <span className="text-xs font-bold text-accent-orange">14x (Admin-Rechte)</span>
              </li>
              <li className="flex justify-between items-center">
                <span className="text-sm font-medium text-navy-900">Abbruchquote Auftragsformular</span>
                <span className="text-xs font-bold text-navy-900">22%</span>
              </li>
            </ul>

            {isAdminOrDev ? (
              <Link href="/admin/analytics" className="w-full flex items-center justify-center gap-2 bg-bg-app-soft text-navy-900 border border-neutral-gray-200 font-bold py-2 rounded-xl text-sm hover:bg-neutral-gray-200 transition">
                <BarChart3 className="w-4 h-4" /> Zu Developer Analytics
              </Link>
            ) : (
              <button disabled className="w-full flex items-center justify-center gap-2 bg-neutral-gray-100 text-neutral-gray-400 font-bold py-2 rounded-xl text-sm cursor-not-allowed">
                <Lock className="w-4 h-4" /> Analytics nur für Admins
              </button>
            )}
          </section>
        </div>

        {/* COL 2 & 3: VORSCHLÄGE LISTE */}
        <div className="lg:col-span-2 bg-white border border-neutral-gray-200 rounded-3xl p-6 shadow-sm flex flex-col h-full">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold font-serif text-navy-900 flex items-center gap-2">
              <ListFilter className="w-5 h-5 text-accent-orange" />
              Gesammelte Vorschläge
            </h2>
            <div className="text-xs font-bold bg-bg-app-soft text-navy-900 px-3 py-1.5 rounded-lg">
              {items.length} Einträge
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {items.map(item => (
              <div 
                key={item.id}
                onClick={() => setActiveItem(item)}
                className="group border border-neutral-gray-200 rounded-2xl p-4 hover:border-navy-900 hover:shadow-md transition-all cursor-pointer bg-white"
              >
                <div className="flex justify-between items-start gap-4 mb-2">
                  <h3 className="font-bold text-navy-900 text-sm group-hover:text-accent-orange transition-colors line-clamp-1">{item.title}</h3>
                  <div className="shrink-0 flex gap-2">
                    {!item.isDemo && <span className="bg-blue-50 text-blue-600 text-[10px] font-black uppercase px-2 py-0.5 rounded">Lokal</span>}
                    {getStatusBadge(item.status)}
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted mt-2">
                  <span className="font-bold bg-bg-app-soft px-2 py-0.5 rounded">{item.category}</span>
                  <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {item.benefit}</span>
                  <span className="flex items-center gap-1"><PlayCircle className="w-3 h-3" /> Aufwand: {item.effort}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* DETAIL OVERLAY */}
      <DetailOverlay open={!!activeItem} onClose={() => setActiveItem(null)} title="Vorschlag Details">
        {activeItem && (
          <div className="space-y-6 text-navy-900 pb-4">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold font-serif mb-2">{activeItem.title}</h2>
                <div className="flex gap-2">
                  {getStatusBadge(activeItem.status)}
                  <span className="bg-bg-app-soft text-navy-900 text-[10px] font-black uppercase px-2 py-0.5 rounded">{activeItem.category}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-bg-app-soft rounded-xl p-4 border border-neutral-gray-100">
                <p className="text-xs font-bold text-text-muted uppercase mb-1">Aufwand</p>
                <p className="font-bold capitalize">{activeItem.effort}</p>
              </div>
              <div className="bg-bg-app-soft rounded-xl p-4 border border-neutral-gray-100">
                <p className="text-xs font-bold text-text-muted uppercase mb-1">Wirkung</p>
                <p className="font-bold flex items-center gap-2"><Target className="w-4 h-4 text-accent-orange"/>{activeItem.benefit}</p>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-sm uppercase text-text-muted mb-2">Problembeschreibung</h3>
              <p className="text-sm bg-white border border-neutral-gray-200 rounded-xl p-4 leading-relaxed">
                {activeItem.problemDesc}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h3 className="font-bold text-sm uppercase text-text-muted mb-2 flex items-center gap-1"><AlertOctagon className="w-4 h-4" /> Signal</h3>
                <p className="text-sm bg-gray-50 border border-neutral-gray-200 rounded-xl p-3">
                  {activeItem.observedSignal}
                </p>
              </div>
              <div>
                <h3 className="font-bold text-sm uppercase text-text-muted mb-2 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Nutzen</h3>
                <p className="text-sm bg-gray-50 border border-neutral-gray-200 rounded-xl p-3">
                  {activeItem.expectedBenefit}
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-gray-200 flex justify-between items-center">
              <div className="text-xs">
                <span className="text-text-muted block mb-1">Betroffene Seite</span>
                <span className="font-bold font-mono bg-bg-app-soft px-2 py-1 rounded">{activeItem.affectedPage}</span>
              </div>
              <div className="text-right">
                <span className="text-text-muted block mb-1 text-xs">Nächste Aktion</span>
                <span className="font-bold text-sm text-accent-orange">{activeItem.nextAction}</span>
              </div>
            </div>
          </div>
        )}
      </DetailOverlay>

    </div>
  );
}
