"use client";

import { useState, useEffect } from "react";
import { Lightbulb, PlusCircle, CheckCircle2, ListFilter, PlayCircle, BarChart3, ThumbsUp, Wrench, MessageSquare, AlertTriangle, User, Smile } from "lucide-react";
import { usePageView } from "@/hooks/usePageView";
import { DetailOverlay } from "@/components/ui/DetailOverlay";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";
import { OfflineSyncBadge } from "@/components/offline/OfflineSyncBadge";
import { kvpRepository, KvpItem } from "@/lib/repositories/kvpRepository";
import { usePermissions } from "@/lib/auth/PermissionsContext";

const BENEFITS = ["Zeit sparen", "Fehler vermeiden", "Kunde zufriedener", "Kosten senken", "Arbeit erleichtern"];
const CATEGORIES = ["Sicherheit", "Qualität", "Ablauf", "Werkzeug/Maschine", "Kunde", "Kommunikation", "Ordnung/Sauberkeit", "Sonstiges"];

export function BetriebKvpClient() {
  usePageView();

  const [items, setItems] = useState<KvpItem[]>([]);
  const [activeItem, setActiveItem] = useState<KvpItem | null>(null);
  const { role } = usePermissions();
  const isChef = role === "admin" || role === "developer" || role === "meister";

  // Form State
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState(CATEGORIES[0]);
  const [newBenefit, setNewBenefit] = useState(BENEFITS[0]);
  const [newProblem, setNewProblem] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    kvpRepository.getAll()
      .then(data => {
        setItems(data);
        setLoadError(null);
      })
      .catch((error) => {
        console.error(error);
        setLoadError("KVP-Ideen konnten nicht geladen werden.");
      });
  }, []);

  const handleSave = async () => {
    if (!newTitle.trim()) return;

    try {
      const newItem = await kvpRepository.addItem({
        title: newTitle,
        category: newCategory,
        benefit: newBenefit,
        status: "neu",
        problemDesc: newProblem,
        hasPhoto: false,
      });

      setItems([newItem, ...items]);
      setNewTitle("");
      setNewProblem("");
    } catch (e) {
      console.error("Failed to add KVP item", e);
      alert("Fehler beim Speichern der Idee.");
    }
  };

  const handleUpdateStatus = async (status: KvpItem["status"]) => {
    if (!activeItem) return;
    try {
      const updated = await kvpRepository.updateItemStatus(activeItem.id, status);
      if (updated) {
        setItems(items.map(i => i.id === updated.id ? updated : i));
        setActiveItem(updated);
      }
    } catch (e) {
      console.error("Failed to update status", e);
      alert("Fehler beim Aktualisieren des Status.");
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case "neu": return <span className="bg-blue-100 text-blue-700 text-[10px] font-black uppercase px-2 py-0.5 rounded">Neu</span>;
      case "prüfen": return <span className="bg-yellow-100 text-yellow-700 text-[10px] font-black uppercase px-2 py-0.5 rounded">Wird geprüft</span>;
      case "angenommen": return <span className="bg-purple-100 text-purple-700 text-[10px] font-black uppercase px-2 py-0.5 rounded">Angenommen</span>;
      case "umgesetzt": return <span className="bg-green-100 text-green-700 text-[10px] font-black uppercase px-2 py-0.5 rounded flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Umgesetzt</span>;
      case "abgelehnt": return <span className="bg-gray-200 text-gray-700 text-[10px] font-black uppercase px-2 py-0.5 rounded">Abgelehnt</span>;
      default: return null;
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch(cat) {
      case "Sicherheit": return <AlertTriangle className="w-4 h-4 text-error-red" />;
      case "Qualität": return <CheckCircle2 className="w-4 h-4 text-blue-500" />;
      case "Ablauf": return <PlayCircle className="w-4 h-4 text-purple-500" />;
      case "Werkzeug/Maschine": return <Wrench className="w-4 h-4 text-neutral-gray-400" />;
      case "Kunde": return <User className="w-4 h-4 text-accent-orange" />;
      case "Kommunikation": return <MessageSquare className="w-4 h-4 text-teal-500" />;
      case "Ordnung/Sauberkeit": return <Smile className="w-4 h-4 text-green-500" />;
      default: return <Lightbulb className="w-4 h-4 text-navy-900" />;
    }
  };

  // Chef-Auswertung Stats
  const categoryCounts = items.reduce<Record<string, number>>((counts, item) => {
    counts[item.category] = (counts[item.category] || 0) + 1;
    return counts;
  }, {});
  const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Keine Daten";
  const stats = {
    total: items.length,
    new: items.filter(i => i.status === 'neu').length,
    implemented: items.filter(i => i.status === 'umgesetzt').length,
    topCategory,
  };

  return (
    <div className="space-y-6 pb-8 font-sans antialiased text-navy-900 w-full max-w-7xl mx-auto animate-in fade-in duration-400">
      <OfflineSyncBadge />
      
      {/* HEADER */}
      <div className="mb-6 flex flex-col md:flex-row md:items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black font-serif tracking-tight text-navy-900 flex items-center gap-3">
            <Wrench className="w-8 h-8 text-accent-orange" />
            Betriebs-KVP
          </h1>
          <p className="text-text-muted mt-2 font-medium">Betriebliche Verbesserungen, Mängel und Ideen aus der Werkstatt/Büro.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COL 1: NEUE IDEE / MANGEL */}
        <div className="lg:col-span-1 space-y-6">
          <section className="bg-bg-app border border-neutral-gray-200 rounded-3xl p-6 shadow-sm">
            <h2 className="text-lg font-bold font-serif text-navy-900 flex items-center gap-2 mb-4">
              <PlusCircle className="w-5 h-5 text-accent-orange" />
              Idee oder Mangel melden
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">Kurzer Titel</label>
                <input 
                  type="text" 
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Z.B. Besen kaputt..."
                  className="w-full rounded-xl border border-neutral-gray-300 px-3 py-2 text-sm focus:border-navy-900 focus:ring-1 focus:ring-navy-900 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">Kategorie</label>
                <select 
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  className="w-full rounded-lg border border-neutral-gray-300 px-2 py-1.5 text-sm focus:border-navy-900 outline-none bg-white"
                >
                  {CATEGORIES.map((c: string) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">Kurznotiz / Details</label>
                <textarea 
                  value={newProblem}
                  onChange={e => setNewProblem(e.target.value)}
                  placeholder="Was genau ist das Problem oder die Idee?"
                  className="w-full rounded-xl border border-neutral-gray-300 px-3 py-2 text-sm h-20 resize-none focus:border-navy-900 focus:ring-1 focus:ring-navy-900 outline-none"
                />
              </div>

              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-text-muted uppercase mb-1">Nutzen</label>
                  <select 
                    value={newBenefit}
                    onChange={e => setNewBenefit(e.target.value)}
                    className="w-full rounded-lg border border-neutral-gray-300 px-2 py-1.5 text-xs focus:border-navy-900 outline-none bg-white"
                  >
                    {BENEFITS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              </div>

              <p className="text-xs text-text-muted">Fotos sind hier noch nicht an den sicheren Uploadpfad angebunden.</p>

              <button 
                onClick={handleSave}
                disabled={!newTitle.trim()}
                className="w-full mt-2 bg-navy-900 text-white font-bold py-3 rounded-xl hover:bg-navy-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Einreichen
              </button>
            </div>
          </section>

          {/* COL 1: CHEF AUSWERTUNG */}
          <section className="bg-white border border-neutral-gray-200 rounded-3xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold font-serif text-navy-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-accent-orange" />
                Chef-Auswertung
              </h2>
            </div>
            
            <p className="text-xs text-text-muted mb-4">
              Zusammenfassung für Geschäftsführung zur schnellen Entscheidung.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-bg-app-soft rounded-xl p-3 border border-neutral-gray-100">
                <div className="text-2xl font-black text-navy-900">{stats.new}</div>
                <div className="text-xs font-bold text-text-muted uppercase mt-1">Neu zu prüfen</div>
              </div>
              <div className="bg-bg-app-soft rounded-xl p-3 border border-neutral-gray-100">
                <div className="text-2xl font-black text-success-green">{stats.implemented}</div>
                <div className="text-xs font-bold text-text-muted uppercase mt-1">Umgesetzt</div>
              </div>
            </div>

            <ul className="space-y-3 mb-4 border-t border-neutral-gray-100 pt-4">
              <li className="flex justify-between items-center text-sm">
                <span className="font-medium text-navy-900">Häufigste Kategorie:</span>
                <span className="font-bold text-accent-orange">{stats.topCategory}</span>
              </li>
              <li className="flex justify-between items-center text-sm">
                <span className="font-medium text-navy-900">Detailauswertung:</span>
                <span className="font-bold text-text-muted">Noch nicht instrumentiert</span>
              </li>
            </ul>
          </section>
        </div>

        {/* COL 2 & 3: LISTE */}
        <div className="lg:col-span-2 bg-white border border-neutral-gray-200 rounded-3xl p-6 shadow-sm flex flex-col h-full">
          {loadError && <p className="mb-4 rounded-xl border border-danger-red bg-accent-orange-soft p-3 text-sm font-bold text-danger-red">{loadError}</p>}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold font-serif text-navy-900 flex items-center gap-2">
              <ListFilter className="w-5 h-5 text-accent-orange" />
              Eingereichte Ideen & Mängel
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
                  <h3 className="font-bold text-navy-900 text-base group-hover:text-accent-orange transition-colors flex items-center gap-2">
                    {getCategoryIcon(item.category)}
                    {item.title}
                  </h3>
                  <div className="shrink-0 flex items-center gap-2">
                    {getStatusBadge(item.status)}
                  </div>
                </div>
                
                <div className="flex justify-between items-end mt-3">
                  <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
                    <span className="font-bold bg-bg-app-soft px-2 py-0.5 rounded">{item.category}</span>
                    <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> Nutzen: {item.benefit}</span>
                  </div>
                  <span className="text-xs font-bold text-neutral-gray-400">{new Date(item.date).toLocaleString("de-DE")}</span>
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
            <div className="flex justify-between items-start border-b border-neutral-gray-100 pb-4">
              <div>
                <h2 className="text-xl font-bold font-serif mb-2">{activeItem.title}</h2>
                <div className="flex gap-2 items-center">
                  {getStatusBadge(activeItem.status)}
                  <span className="text-xs text-text-muted font-bold ml-2">Eingereicht: {activeItem.date}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-bg-app-soft rounded-xl p-4 border border-neutral-gray-100 flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-neutral-gray-200">
                  {getCategoryIcon(activeItem.category)}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-text-muted uppercase">Kategorie</p>
                  <p className="font-bold text-sm">{activeItem.category}</p>
                </div>
              </div>
              <div className="bg-bg-app-soft rounded-xl p-4 border border-neutral-gray-100 flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-neutral-gray-200">
                  <ThumbsUp className="w-4 h-4 text-accent-orange" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-text-muted uppercase">Nutzen</p>
                  <p className="font-bold text-sm">{activeItem.benefit}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-sm uppercase text-text-muted mb-2">Kurznotiz</h3>
              <p className="text-sm bg-white border border-neutral-gray-200 rounded-xl p-4 leading-relaxed">
                {activeItem.problemDesc}
              </p>
            </div>

            {isChef && (
              <div className="pt-4 border-t border-neutral-gray-200">
                <h3 className="font-bold text-sm uppercase text-text-muted mb-2">Aktion (Chef / Meister)</h3>
                <div className="flex gap-2">
                  <button onClick={() => handleUpdateStatus("umgesetzt")} className="flex-1 bg-success-green/10 text-success-green font-bold py-2 rounded-lg text-sm border border-success-green/20 hover:bg-success-green/20 transition">Umgesetzt</button>
                  <button onClick={() => handleUpdateStatus("prüfen")} className="flex-1 bg-warning-yellow/10 text-warning-yellow font-bold py-2 rounded-lg text-sm border border-warning-yellow/20 hover:bg-warning-yellow/20 transition">Prüfen</button>
                  <button onClick={() => handleUpdateStatus("abgelehnt")} className="flex-1 bg-neutral-gray-100 text-text-muted font-bold py-2 rounded-lg text-sm border border-neutral-gray-200 hover:bg-neutral-gray-200 transition">Ablehnen</button>
                </div>
              </div>
            )}
          </div>
        )}
      </DetailOverlay>
      
      <FeedbackFooter pageTitle="Betriebs-KVP" route="/betrieb-kvp" />
    </div>
  );
}
