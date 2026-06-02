"use client";

import { usePageView } from "@/hooks/usePageView";
import { useState, useEffect } from "react";
import { ordersRepository } from "@/lib/repositories/ordersRepository";
import { inquiriesRepository } from "@/lib/repositories/inquiriesRepository";
import { MockOrder } from "@/lib/mockData";
import { DetailOverlay } from "@/components/ui/DetailOverlay";
import Link from "next/link";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";
import {
  UserPlus, FilePlus, Camera, AlertTriangle, HeadphonesIcon, Settings,
  CheckCircle, Circle, Clock, AlertOctagon, Send, Activity, Info
} from "lucide-react";

export default function HomeDashboard() {
  usePageView();
  const [orders, setOrders] = useState<MockOrder[]>([]);
  const [openQuotes, setOpenQuotes] = useState(0);
  
  // Drilldown Overlay State
  const [activeOverlay, setActiveOverlay] = useState<{title: string, desc: string, targetLink?: string} | null>(null);

  // Todo List State (Local only)
  const [todos, setTodos] = useState([
    { id: 1, title: "Überfällige Auslieferungen klären", reason: "3 Aufträge sind seit gestern fertig aber nicht abgeholt", area: "Warenausgang", urgency: "Hoch", action: "Kunde anrufen", done: false },
    { id: 2, title: "Salzsäure nachbestellen", reason: "Bestand unter 20%", area: "Chemie / Lager", urgency: "Hoch", action: "Lieferant kontaktieren", done: false },
    { id: 3, title: "Kundenfreigabe Maier GmbH", reason: "Wartet seit 2 Tagen auf Preisbestätigung", area: "Büro", urgency: "Mittel", action: "Nachfassen", done: false },
    { id: 4, title: "Material fehlt für Auftrag #8102", reason: "Rohteile nicht auffindbar", area: "Wareneingang", urgency: "Mittel", action: "Palette suchen", done: false },
    { id: 5, title: "QS: Teile nacharbeiten", reason: "2 Trommeln Nickel fehlerhaft", area: "Galvanik", urgency: "Mittel", action: "Entlacken starten", done: false },
    { id: 6, title: "Versand vorbereiten", reason: "14 Pakete müssen heute raus", area: "Warenausgang", urgency: "Normal", action: "Lieferscheine drucken", done: false },
    { id: 7, title: "Offene Anfragen sichten", reason: "5 neue E-Mails im Postfach", area: "Büro", urgency: "Normal", action: "Angebote schreiben", done: false },
    { id: 8, title: "Bad-Protokolle eintragen", reason: "Routineprüfung fällig", area: "Labor", urgency: "Normal", action: "Messen", done: false },
    { id: 9, title: "Leergut sortieren", reason: "Kisten stapeln sich", area: "Hof", urgency: "Niedrig", action: "Aufräumen", done: false },
    { id: 10, title: "Tagesrundgang Warendurchlauf", reason: "Einmal prüfen, ob alle Stationen sauber weiterlaufen", area: "Warendurchlauf", urgency: "Normal", action: "Stationen prüfen", done: false }
  ]);

  useEffect(() => {
    const load = async () => {
      const dbOrders = await ordersRepository.getAll();
      if (dbOrders) setOrders(dbOrders as unknown as MockOrder[]);
      const qCount = await inquiriesRepository.getOpenCount();
      setOpenQuotes(qCount);
    };
    load();
    const onUpdate = () => load();
    window.addEventListener("kreile-orders-updated", onUpdate);
    window.addEventListener("kreile-inquiries-updated", onUpdate);
    return () => {
      window.removeEventListener("kreile-orders-updated", onUpdate);
      window.removeEventListener("kreile-inquiries-updated", onUpdate);
    };
  }, []);

  const toggleTodo = (id: number) => {
    setTodos(todos.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const activeTodos = todos.filter(t => !t.done);
  const doneTodos = todos.filter(t => t.done);

  return (
    <div className="space-y-8 pb-12 font-sans antialiased text-navy-900 w-full max-w-7xl mx-auto animate-in fade-in duration-400">
      
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-black font-serif tracking-tight text-navy-900">Guten Morgen!</h1>
        <p className="text-text-muted mt-1 font-medium">Dein Tag im Überblick. Gehirn aus, Checkliste an.</p>
      </div>

      {/* 1. USP-SCHNELLSTART-KACHELN */}
      <section>
        <h2 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-4">Schnellstart</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <button 
            onClick={() => setActiveOverlay({title: "Neuer Kunde", desc: "Schneller Kundenstart wird angebunden. Bis dahin Kundendaten über Kundenbereich prüfen oder ergänzen.", targetLink: "/customers"})}
            className="bg-white border border-neutral-gray-200 rounded-2xl p-4 flex flex-col items-center justify-center text-center hover:border-navy-900 hover:shadow-md transition-all active:scale-95 group cursor-pointer"
          >
            <div className="w-12 h-12 bg-bg-app-soft rounded-full flex items-center justify-center mb-3 group-hover:bg-navy-900 transition-colors">
              <UserPlus className="w-6 h-6 text-navy-900 group-hover:text-white transition-colors" />
            </div>
            <span className="font-bold text-sm text-navy-900">Neuer Kunde</span>
          </button>

          <button 
            onClick={() => setActiveOverlay({title: "Neuer Auftrag", desc: "Auftragserfassung wird im Warendurchlauf angebunden. Bis dahin über Warendurchlauf oder Auftragsliste prüfen.", targetLink: "/warendurchlauf"})}
            className="bg-white border border-neutral-gray-200 rounded-2xl p-4 flex flex-col items-center justify-center text-center hover:border-navy-900 hover:shadow-md transition-all active:scale-95 group cursor-pointer"
          >
            <div className="w-12 h-12 bg-bg-app-soft rounded-full flex items-center justify-center mb-3 group-hover:bg-navy-900 transition-colors">
              <FilePlus className="w-6 h-6 text-navy-900 group-hover:text-white transition-colors" />
            </div>
            <span className="font-bold text-sm text-navy-900">Neuer Auftrag</span>
          </button>

          <Link href="/scan" className="bg-white border border-neutral-gray-200 rounded-2xl p-4 flex flex-col items-center justify-center text-center hover:border-navy-900 hover:shadow-md transition-all active:scale-95 group cursor-pointer">
            <div className="w-12 h-12 bg-bg-app-soft rounded-full flex items-center justify-center mb-3 group-hover:bg-navy-900 transition-colors">
              <Camera className="w-6 h-6 text-navy-900 group-hover:text-white transition-colors" />
            </div>
            <span className="font-bold text-sm text-navy-900">Foto / Scan</span>
          </Link>

          <Link href="/kontrolle" className="bg-white border border-error-red/30 rounded-2xl p-4 flex flex-col items-center justify-center text-center hover:border-error-red hover:shadow-md transition-all active:scale-95 group relative overflow-hidden cursor-pointer">
            <div className="absolute top-0 left-0 w-full h-1 bg-error-red" />
            <div className="w-12 h-12 bg-error-red/10 rounded-full flex items-center justify-center mb-3 group-hover:bg-error-red transition-colors">
              <AlertTriangle className="w-6 h-6 text-error-red group-hover:text-white transition-colors" />
            </div>
            <span className="font-bold text-sm text-error-red">Kritische Aufträge</span>
          </Link>

          <Link href="/kundenservice" className="bg-white border border-neutral-gray-200 rounded-2xl p-4 flex flex-col items-center justify-center text-center hover:border-accent-orange hover:shadow-md transition-all active:scale-95 group relative cursor-pointer">
             <div className="absolute top-2 right-2 w-3 h-3 bg-accent-orange rounded-full animate-pulse" />
            <div className="w-12 h-12 bg-bg-app-soft rounded-full flex items-center justify-center mb-3 group-hover:bg-accent-orange transition-colors">
              <HeadphonesIcon className="w-6 h-6 text-navy-900 group-hover:text-white transition-colors" />
            </div>
            <span className="font-bold text-sm text-navy-900">Kundenservice</span>
          </Link>

          <Link href="/warendurchlauf" className="bg-white border border-neutral-gray-200 rounded-2xl p-4 flex flex-col items-center justify-center text-center hover:border-navy-900 hover:shadow-md transition-all active:scale-95 group cursor-pointer">
            <div className="w-12 h-12 bg-bg-app-soft rounded-full flex items-center justify-center mb-3 group-hover:bg-navy-900 transition-colors">
              <Settings className="w-6 h-6 text-navy-900 group-hover:text-white transition-colors" />
            </div>
            <span className="font-bold text-sm text-navy-900">Warendurchlauf</span>
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 2. HEUTE ZUERST - TAGES CHECKLISTE */}
        <section className="lg:col-span-2">
          <div className="bg-white border border-neutral-gray-200 rounded-3xl p-6 shadow-sm h-full flex flex-col">
             <div className="flex justify-between items-center mb-6 bg-gray-200 p-2 rounded">
                <h2 className="text-xl font-bold font-serif text-navy-900">Deine Checkliste für Heute</h2>
                <span className="bg-bg-app-soft text-text-muted text-xs px-2 py-1 rounded font-bold uppercase tracking-wider">Demo-Auswertung</span>
             </div>
             
             <div className="flex-1 overflow-hidden flex flex-col gap-3">
               {[...activeTodos, ...doneTodos].map(todo => (
                 <div 
                   key={todo.id} 
                   onClick={() => toggleTodo(todo.id)}
                   className={`flex items-start gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${todo.done ? 'bg-bg-app-soft border-neutral-gray-100 opacity-60' : 'bg-white border-neutral-gray-200 hover:border-navy-900 hover:shadow-sm'}`}
                 >
                   <button className="mt-1 shrink-0 cursor-pointer">
                     {todo.done ? (
                       <CheckCircle className="w-6 h-6 text-success-green" />
                     ) : (
                       <Circle className="w-6 h-6 text-neutral-gray-300" />
                     )}
                   </button>
                   <div className="flex-1 min-w-0">
                     <div className="flex justify-between items-start gap-2">
                       <h3 className={`font-bold ${todo.done ? 'text-text-muted line-through' : 'text-navy-900'}`}>{todo.title}</h3>
                       {!todo.done && todo.urgency === "Hoch" && (
                         <span className="shrink-0 bg-error-red/10 text-error-red text-[10px] font-black uppercase px-2 py-0.5 rounded">Hoch</span>
                       )}
                     </div>
                     <p className={`text-xs mt-1 ${todo.done ? 'text-text-muted/60' : 'text-text-muted'}`}>{todo.reason}</p>
                     
                     {!todo.done && (
                       <div className="flex items-center gap-4 mt-3">
                         <span className="text-xs font-bold text-navy-900 bg-bg-app-soft px-2 py-1 rounded-md">{todo.area}</span>
                         <span className="text-xs font-medium text-accent-orange flex items-center gap-1">
                           <Activity className="w-3 h-3" /> Nächste Aktion: {todo.action}
                         </span>
                       </div>
                     )}
                   </div>
                 </div>
               ))}
             </div>
          </div>
        </section>

        {/* RECHTE SPALTE - PANELS */}
        <div className="space-y-6">
          
          {/* 4. AUFTRÄGE IM UMLAUF */}
          <section className="bg-white border border-neutral-gray-200 rounded-3xl p-6 shadow-sm">
             <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold font-serif text-navy-900">Im Umlauf</h2>
                <span className="bg-bg-app-soft text-text-muted text-xs px-2 py-1 rounded font-bold">Live & Demo</span>
             </div>
             
             <div className="space-y-4">
                <div className="flex justify-between items-end border-b border-neutral-gray-100 pb-3">
                  <div>
                    <p className="text-xs text-text-muted font-bold uppercase tracking-wider mb-1">Gesamt</p>
                    <span className="text-3xl font-black text-navy-900">{orders.length > 0 ? orders.length : 84}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-error-red font-bold uppercase tracking-wider mb-1">Kritisch</p>
                    <span className="text-xl font-bold text-error-red">{orders.filter(o => o.risk === 'red').length || 3}</span>
                  </div>
                </div>
                
                <div className="space-y-2 pt-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">In Galvanik</span>
                    <span className="font-bold text-navy-900">{orders.filter(o => o.station === 'beschichtung').length || 22}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Warenausgang</span>
                    <span className="font-bold text-navy-900">{orders.filter(o => o.station === 'warenausgang').length || 14}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-text-muted">Warten auf Freigabe</span>
                    <span className="font-bold text-navy-900">5</span>
                  </div>
                </div>

                {/* Demo Chart Bar */}
                <div className="pt-2">
                  <p className="text-[10px] text-text-muted font-bold uppercase mb-1">Volumen-Trend (Demo)</p>
                  <div className="h-2 w-full bg-bg-app-soft rounded-full overflow-hidden flex">
                    <div className="h-full bg-navy-900 w-[60%]" />
                    <div className="h-full bg-accent-orange w-[25%]" />
                    <div className="h-full bg-error-red w-[15%]" />
                  </div>
                </div>
             </div>
          </section>

          {/* 5. STRESSPHASEN-VORSCHAU */}
          <section className="bg-white border border-neutral-gray-200 rounded-3xl p-6 shadow-sm">
             <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold font-serif text-navy-900">Stressphasen</h2>
                <span className="bg-bg-app-soft text-text-muted text-xs px-2 py-1 rounded font-bold">Demo</span>
             </div>
             <p className="text-xs text-text-muted mb-4">Wann häufen sich heute typischerweise Ereignisse? (Wird später aus Historiendaten abgeleitet).</p>
             
             <ul className="space-y-3">
               <li className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                   <Clock className="w-4 h-4 text-text-muted" />
                   <span className="text-sm font-bold text-navy-900">08:00 - 10:00</span>
                 </div>
                 <span className="text-xs bg-accent-orange/10 text-accent-orange px-2 py-1 rounded font-bold">Hoher Auftragseingang</span>
               </li>
               <li className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                   <Clock className="w-4 h-4 text-text-muted" />
                   <span className="text-sm font-bold text-navy-900">14:00 - 16:00</span>
                 </div>
                 <span className="text-xs bg-error-red/10 text-error-red px-2 py-1 rounded font-bold">Versand / Abholungen</span>
               </li>
             </ul>
          </section>

          {/* 6. KUNDENSERVICE-HINWEIS */}
          <Link href="/kundenservice" className="bg-white border border-accent-orange/30 rounded-3xl p-6 shadow-sm block hover:border-accent-orange transition-colors group cursor-pointer">
             <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2 text-accent-orange">
                  <AlertOctagon className="w-5 h-5" />
                  <h2 className="text-lg font-bold font-serif">Kundenservice</h2>
                </div>
             </div>
             <div className="space-y-2">
               <p className="text-sm font-bold text-navy-900">1 Reklamationsverdacht</p>
               <p className="text-sm text-text-muted">3 offene Rückfragen von Kunden.</p>
               <p className="text-xs text-accent-orange font-bold mt-2 flex items-center gap-1 group-hover:underline">
                 Bereich öffnen <Send className="w-3 h-3" />
               </p>
             </div>
          </Link>

        </div>
      </div>

      {/* 7. FEEDBACKFELD */}
      <FeedbackFooter pageTitle="Home" route="/" variant="full" />

      {/* OVERLAY FOR NOT IMPLEMENTED FEATURES */}
      <DetailOverlay open={!!activeOverlay} onClose={() => setActiveOverlay(null)} title={activeOverlay?.title || ""}>
        <div className="space-y-6 text-navy-900">
          <div className="p-4 rounded-xl border bg-bg-app-soft border-neutral-gray-200 flex gap-3">
            <Info className="w-5 h-5 shrink-0 mt-0.5 text-navy-900" />
            <div>
              <h4 className="font-bold">Noch nicht angebunden</h4>
              <p className="text-sm mt-1 text-text-muted">{activeOverlay?.desc}</p>
            </div>
          </div>
          
          <div className="pt-4 border-t border-neutral-gray-200 flex justify-end">
             {activeOverlay?.targetLink && (
               <Link href={activeOverlay.targetLink} onClick={() => setActiveOverlay(null)} className="bg-navy-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-navy-800 transition-colors">
                 Zum Bereich wechseln
               </Link>
             )}
          </div>
        </div>
      </DetailOverlay>

    </div>
  );
}
