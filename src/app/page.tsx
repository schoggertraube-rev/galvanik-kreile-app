"use client";

import { usePageView } from "@/hooks/usePageView";
import { useState, useEffect, useRef } from "react";
import { getOrdersDb } from "@/app/actions/orders.actions";
import { inquiriesRepository } from "@/lib/repositories/inquiriesRepository"; // Will keep this if no actions exist
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Order = any;
import { DetailOverlay } from "@/components/ui/DetailOverlay";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOrderModal } from "@/components/orders/OrderModalProvider";
import { useErfassung } from "@/components/erfassung/ErfassungProvider";
import {
  UserPlus, FilePlus, Camera, AlertTriangle,
  CheckCircle, Activity, Info, Phone, RefreshCw, Sparkles, BarChart3
} from "lucide-react";
import { useAppShortcut, ShortcutType } from "@/components/ui/AppShortcutContext";
import { useSync } from "@/lib/offline/SyncContext";
import { usePermissions } from "@/lib/auth/PermissionsContext";

/* ── Home-specific CSS variables ──────────────────────────── */
const homeStyles = `
  @keyframes hm-floatIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes crit-pulse {
    0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); }
    50% { transform: scale(1.05); box-shadow: 0 0 0 6px rgba(220, 38, 38, 0); }
  }
  .crit-pulse-active {
    animation: crit-pulse 2s ease-in-out 3;
  }
  @media (prefers-reduced-motion: reduce) { .hm-animate { animation: none !important; transition: none !important; } }
`;

// Task model definition
interface ChecklistTask {
  id: number;
  title: string;
  reason: string;
  area: string;
  urgency: string;
  action: string;
  targetHref?: string;
  completionType: "live" | "demo" | "auto";
  completionHint?: string;
  source: "live" | "demo" | "fallback";
  done: boolean;
}

// Counter hook for animated numbers
function useAnimatedCount(target: number, running: boolean) {
  const [val, setVal] = useState(0);
  const frameRef = useRef<number>(0);
  useEffect(() => {
    if (!running) return;
    let cur = 0;
    const inc = target / 30;
    const tick = () => {
      cur += inc;
      if (cur >= target) { setVal(target); return; }
      setVal(Math.round(cur));
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, running]);
  return val;
}

const IconComponents: Record<string, React.ComponentType<{ className?: string }>> = {
  phone: Phone, userplus: UserPlus, fileplus: FilePlus, camera: Camera, alert: AlertTriangle, sparkles: Sparkles,
};

export default function HomeDashboard() {
  usePageView();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [openQuotes, setOpenQuotes] = useState(0);
  const [mounted, setMounted] = useState(false);
  
  // Drilldown Overlay State
  const [activeOverlay, setActiveOverlay] = useState<{title: string, desc: string, targetLink?: string} | null>(null);
  const [showCriticalOrders, setShowCriticalOrders] = useState(false);
  
  // Unified App Shortcuts
  const { openShortcut } = useAppShortcut();
  const { openOrder } = useOrderModal();
  const { openErfassung } = useErfassung();

  const { isOnline, outboxItems, syncNow } = useSync();

  // Todo List State (Enriched Task Model)
  const [todos, setTodos] = useState<ChecklistTask[]>([]);

  const [feedback, setFeedback] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    const load = async () => {
      
      const dbOrdersRes = await getOrdersDb();
      const dbOrders = dbOrdersRes.ok ? dbOrdersRes.data : [];
      
      const newTodos: ChecklistTask[] = [];
      const kritisch = dbOrders.filter(o => o.risk === 'red' || o.risk === 'orange');
      if (kritisch.length > 0) {
         newTodos.push({
            id: 1, title: `Kritische Aufträge prüfen (${kritisch.length})`, reason: "Aufträge mit hohem Risiko entdeckt",
            area: "Warendurchlauf", urgency: "Hoch", action: "Aufträge ansehen", targetHref: "/kontrolle",
            completionType: "live", source: "live", done: false
         });
      }
      const auslieferungen = dbOrders.filter(o => o.station === 'warenausgang');
      if (auslieferungen.length > 0) {
         newTodos.push({
            id: 2, title: `Auslieferungen klären (${auslieferungen.length})`, reason: "Aufträge sind im Warenausgang",
            area: "Warenausgang", urgency: "Normal", action: "Versand prüfen", targetHref: "/warendurchlauf/warenausgang",
            completionType: "live", source: "live", done: false
         });
      }
      
      setTodos(newTodos);

      if (dbOrders) setOrders(dbOrders as unknown as Order[]);
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

  // Auto-completion logic
  useEffect(() => {
    const timer = setTimeout(() => {
      setTodos(prev =>
        prev.map(t => {
          if (t.done) return t;
          if (t.completionType === "auto") return { ...t, done: true, completionHint: "Auto-erledigt" };
          
          // ID 1: Kritische Aufträge
          if (t.id === 1 && orders.length > 0 && orders.filter(o => o.risk === 'red' || o.risk === 'orange').length === 0) {
            return { ...t, done: true, completionHint: "Keine kritischen Aufträge mehr" };
          }
          // ID 2: Auslieferungen
          if (t.id === 2 && orders.length > 0 && orders.filter(o => o.station === 'warenausgang').length === 0) {
            return { ...t, done: true, completionHint: "Alle Auslieferungen erledigt" };
          }
          // ID 3: Offene Anfragen
          if (t.id === 3 && openQuotes === 0) {
            return { ...t, done: true, completionHint: "Keine offenen Anfragen" };
          }
          
          return t;
        })
      );
    }, 0);
    return () => clearTimeout(timer);
  }, [orders, openQuotes]);

  const toggleTodo = (id: number) => {
    setTodos(prev =>
      prev.map(t => (t.id === id && t.source === "demo" ? { ...t, done: !t.done } : t))
    );
  };

  const handleTaskClick = (task: ChecklistTask) => {
    if (task.targetHref) {
      router.push(task.targetHref);
    } else {
      setActiveOverlay({
        title: task.title,
        desc: task.completionHint || "Weitere Informationen fehlen. Bitte prüfen Sie die jeweiligen Bereiche.",
        targetLink: task.targetHref,
      });
    }
  };

  const focusMessage = (() => {
    if (orders.filter(o => o.risk === "red").length > 0) return "Kritische Aufträge zuerst entschärfen";
    if (openQuotes > 0) return "Kundenrückfragen bündeln";
    return "Warendurchlauf kurz prüfen und Engpässe vermeiden";
  })();

  const handleFeedback = () => {
    if (!feedback.trim()) return;
    setFeedbackSent(true);
    setFeedback("");
    setTimeout(() => setFeedbackSent(false), 3000);
  };

  const activeTodos = todos.filter(t => !t.done);
  const doneTodos = todos.filter(t => t.done);

  // Animated counts
  const totalCount = useAnimatedCount(orders.length, mounted);
  const critCount = useAnimatedCount(orders.filter(o => o.risk === 'red').length, mounted);

  // Get day info
  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Guten Morgen' : now.getHours() < 17 ? 'Guten Tag' : 'Guten Abend';

  const handleQuickClick = (card: Record<string, unknown>) => {
    if (card.id === 'kritisch') {
      setShowCriticalOrders(true);
      return;
    }
    if (card.id === 'auftrag') {
      openErfassung({ mode: 'order', source: 'manual' });
      return;
    }
    if (card.id === 'kunde') {
      openErfassung({ mode: 'customer', intent: 'create_customer', source: 'manual' });
      return;
    }
    if (card.shortcut) {
      openShortcut(card.shortcut as ShortcutType);
    } else if (card.href) {
      router.push(card.href as string);
    }
  };

  const { name } = usePermissions();

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: homeStyles }} />
      <div className="pb-12 w-full">

        {/* ── GREETING ─────────────────────────────────── */}
        <div
          className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4"
          style={{ animation: 'hm-floatIn .5s ease both' }}
        >
          <h1 className="font-serif text-[31px] font-bold tracking-tight">
            {greeting}, {name || 'Nutzer'}.{' '}
            <span className="font-sans text-[15px] font-medium text-text-muted tracking-normal block md:inline mt-1 md:mt-0">
              Dein Tag im Überblick — Gehirn aus, Checkliste an.
            </span>
          </h1>
          
          <Link 
            href="/cockpit"
            className="flex items-center gap-2 text-sm font-bold text-navy-700 bg-white hover:bg-navy-50 px-4 py-2.5 rounded-xl transition-colors border border-neutral-gray-200 shadow-sm shrink-0"
          >
            <BarChart3 className="w-4 h-4 text-accent-orange" /> Cockpit öffnen
          </Link>
        </div>

        {/* ── OUTBOX WARNING ──────────────────────────── */}
        {outboxItems.length > 0 && (
          <div
            className="bg-gold-50 border-2 border-gold-400 p-4 md:p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm mb-4"
            style={{ animation: 'hm-floatIn .5s ease both' }}
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-gold-200 rounded-full shrink-0">
                <RefreshCw className={`w-6 h-6 text-gold-800 ${isOnline ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <h3 className="font-bold text-navy-900 text-lg">Ausstehende Synchronisation</h3>
                <p className="text-sm font-medium text-navy-800">
                  Es {outboxItems.length === 1 ? "befindet sich 1 Änderung" : `befinden sich ${outboxItems.length} Änderungen`} lokal auf diesem Gerät.
                </p>
              </div>
            </div>
            <button
              onClick={() => syncNow()}
              disabled={!isOnline}
              className="w-full md:w-auto px-6 py-3 bg-navy-900 hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl whitespace-nowrap transition-colors"
            >
              {isOnline ? "Jetzt synchronisieren" : "Warte auf Internet..."}
            </button>
          </div>
        )}

        {/* ── SCHNELLSTART ────────────────────────────── */}
        <div
          className="mb-6"
          style={{ animation: 'hm-floatIn .5s ease .06s both' }}
        >
          <h2 className="text-[11px] font-extrabold text-text-muted uppercase tracking-widest mb-3">Schnellstart</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            
            {(() => {
              const kritisch = orders.filter(o => o.risk === 'red' || o.risk === 'orange').length;
              const QUICK_CARDS = [
                { id: 'telefon', label: 'Telefonnotiz', sub: 'schnell festhalten', grad: 'linear-gradient(135deg,#0E8C8C,#13B0A6)', shadow: 'rgba(14,140,140,.35)', icon: 'phone', href: '/telefonnotiz?source=home', shortcut: undefined as string | undefined },
                { id: 'kunde', label: 'Neuer Kunde', sub: 'in 30 Sekunden', grad: 'linear-gradient(135deg,#2E9E6B,#46C285)', shadow: 'rgba(46,158,107,.35)', icon: 'userplus', href: undefined as string | undefined, shortcut: 'new_customer' },
                { id: 'auftrag', label: 'Neuer Auftrag', sub: 'Teil annehmen', grad: 'linear-gradient(135deg,#3A6EA5,#4F8BC9)', shadow: 'rgba(58,110,165,.35)', icon: 'fileplus', href: undefined as string | undefined, shortcut: 'new_order' },
                { id: 'kritisch', label: 'Kritische Aufträge', sub: kritisch > 0 ? `${kritisch} brauchen dich` : 'Alles im Lot', grad: 'linear-gradient(135deg,#D8453C,#EE6A5A)', shadow: 'rgba(216,69,60,.35)', icon: 'alert', href: undefined as string | undefined, badge: kritisch > 0 ? kritisch.toString() : undefined },
                { id: 'marketing', label: 'Marketing', sub: 'Keine Aktion', grad: 'linear-gradient(115deg,#7A3FB0,#C2185B 55%,#F2643C)', shadow: 'rgba(194,24,91,.4)', icon: 'sparkles', href: '/marketing', badge: undefined },
              ];
              return QUICK_CARDS;
            })().map(card => {

              const Icon = IconComponents[card.icon];
              return (
                <button
                  key={card.id}
                  onClick={() => handleQuickClick(card)}
                  className="relative overflow-hidden bg-white border border-neutral-gray-200 rounded-2xl p-5 flex flex-col items-center text-center cursor-pointer group"
                  style={{
                    boxShadow: '0 1px 2px rgba(40,33,22,.04), 0 8px 24px rgba(40,33,22,.06)',
                    transition: 'transform .2s, box-shadow .2s',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-5px)';
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 8px rgba(40,33,22,.08), 0 22px 50px rgba(40,33,22,.15)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.transform = '';
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 2px rgba(40,33,22,.04), 0 8px 24px rgba(40,33,22,.06)';
                  }}
                >
                  {/* Gradient border on hover (pseudo-element via inline) */}
                  <span
                    className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 pointer-events-none"
                    style={{
                      padding: '1.5px',
                      background: card.grad,
                      WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
                      WebkitMaskComposite: 'xor',
                      maskComposite: 'exclude',
                      transition: 'opacity .25s',
                    }}
                  />
                  {/* Badge */}
                  {card.badge && (
                    <span
                      className="absolute top-2.5 right-2.5 text-white text-[9px] font-extrabold rounded-full px-2 py-0.5"
                      style={{ background: card.grad }}
                    >
                      {card.badge}
                    </span>
                  )}
                  {/* Icon Tile */}
                  <div
                    className="w-[50px] h-[50px] rounded-[15px] flex items-center justify-center mb-3 group-hover:scale-110 group-hover:rotate-[-4deg] hm-animate"
                    style={{
                      background: card.grad,
                      backgroundSize: '180% 180%',
                      boxShadow: `0 6px 16px ${card.shadow}`,
                      transition: 'transform .25s',
                    }}
                  >
                    <Icon className="w-[25px] h-[25px] text-white" />
                  </div>
                  <span className="text-[13.5px] font-bold">{card.label}</span>
                  <span className="text-[11px] text-text-muted mt-0.5">{card.sub}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── MAIN LAYOUT: Checklist + Sidebar ────────── */}
        <div
          className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-[18px]"
          style={{ animation: 'hm-floatIn .5s ease .12s both' }}
        >
          {/* ── CHECKLISTE ─────────────────────────────── */}
          <section
            className="bg-white border border-neutral-gray-200 rounded-[22px] p-5 md:p-6"
            style={{ boxShadow: '0 1px 2px rgba(40,33,22,.04), 0 8px 24px rgba(40,33,22,.06)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-[19px] font-bold">Deine Checkliste für heute</h2>
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted bg-bg-app-soft px-2.5 py-1 rounded-full">Demo-Auswertung</span>
            </div>

            {/* Hebel-Hinweis */}
            <div
              className="flex items-center gap-3 rounded-2xl p-3 mb-4 border"
              style={{
                background: 'linear-gradient(120deg, var(--accent-orange-soft, #FBF1DC), var(--surface-card, #fff))',
                borderColor: 'var(--neutral-gray-100)',
              }}
            >
              <Activity className="w-[18px] h-[18px] text-accent-orange shrink-0" />
              <div className="text-[13px]">
                <b>Heute wichtigster Hebel:</b>{' '}
                <span className="text-accent-orange font-bold">{focusMessage}</span>
              </div>
            </div>

            {/* Tasks */}
            <div className="space-y-0">
              {activeTodos.length === 0 && doneTodos.length === 0 ? (
                <div className="p-12 text-center text-text-muted space-y-2">
                  <p className="font-bold text-navy-900">Noch keine Aufträge erfasst</p>
                </div>
              ) : (
                [...activeTodos, ...doneTodos].map(todo => (
                  <div
                    key={todo.id}
                    onClick={() => handleTaskClick(todo)}
                    className={`flex items-start gap-3 py-3.5 cursor-pointer border-b last:border-b-0 ${
                      todo.done ? 'opacity-60' : ''
                    }`}
                    style={{ borderColor: 'var(--neutral-gray-100)' }}
                  >
                    <button
                      className="mt-0.5 shrink-0 cursor-pointer"
                      onClick={e => { e.stopPropagation(); toggleTodo(todo.id); }}
                    >
                      {todo.done ? (
                        <div className="w-5 h-5 rounded-full bg-success-green flex items-center justify-center">
                          <svg viewBox="0 0 24 24" className="w-3 h-3"><path d="M5 12l5 5 9-11" stroke="#fff" strokeWidth="3" fill="none" /></svg>
                        </div>
                      ) : (
                        <div
                          className="w-5 h-5 rounded-full border-2 hover:border-success-green transition-colors"
                          style={{ borderColor: 'var(--neutral-gray-300)' }}
                        />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className={`text-[14.5px] font-bold ${todo.done ? 'line-through text-text-muted' : ''}`}>{todo.title}</h3>
                        <div className="flex gap-2 shrink-0">
                          {!todo.done && todo.urgency === "Hoch" && (
                            <span className="text-[9.5px] font-extrabold tracking-wider text-error-red uppercase">HOCH</span>
                          )}
                          <span
                            className="text-[9px] font-bold uppercase tracking-wider text-white px-2 py-0.5 rounded-full"
                            style={{ background: todo.source === 'live' ? 'var(--navy-900)' : 'var(--accent-orange)' }}
                          >
                            {todo.source === 'live' ? 'LIVE' : 'DEMO'}
                          </span>
                        </div>
                      </div>
                      <p className="text-[12px] text-text-muted mt-0.5">{todo.reason}</p>
                      {!todo.done && (
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <span className="text-[11px] font-bold bg-bg-app-soft px-2 py-0.5 rounded-md">{todo.area}</span>
                          <span className="text-[11.5px] text-accent-orange font-bold flex items-center gap-1">
                            <Activity className="w-3 h-3" /> Nächste Aktion: {todo.action}
                          </span>
                          <button
                            className="text-[12px] font-bold text-brand ml-auto hover:underline"
                            onClick={e => { e.stopPropagation(); handleTaskClick(todo); }}
                            style={{ color: 'var(--brand, #C2185B)' }}
                          >
                            Öffnen
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* ── SIDEBAR ────────────────────────────────── */}
          <aside className="space-y-[18px]">

            {/* Im Umlauf */}
            <div
              className="bg-white border border-neutral-gray-200 rounded-[22px] p-5"
              style={{ boxShadow: '0 1px 2px rgba(40,33,22,.04), 0 8px 24px rgba(40,33,22,.06)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-serif text-[17px] font-bold">Im Umlauf</h3>
                <span className="text-[9.5px] font-bold uppercase tracking-wider text-text-muted bg-bg-app-soft px-2 py-1 rounded-full">Live &amp; Demo</span>
              </div>
              <div className="flex justify-between items-end mb-3">
                <div>
                  <div className="text-[10.5px] text-text-muted font-semibold uppercase tracking-wider">Gesamt</div>
                  <div className="font-serif text-4xl font-bold leading-none">{totalCount}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10.5px] text-error-red font-semibold uppercase tracking-wider">Kritisch</div>
                  <div className="font-serif text-xl font-bold text-error-red leading-none">{critCount}</div>
                </div>
              </div>
              <div className="space-y-1.5 border-t pt-2" style={{ borderColor: 'var(--neutral-gray-100)' }}>
                <div className="flex justify-between text-[13px]">
                  <span className="text-text-muted">In Galvanik</span>
                  <b>{orders.filter(o => o.station === 'beschichtung').length}</b>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-text-muted">Warenausgang</span>
                  <b>{orders.filter(o => o.station === 'warenausgang').length}</b>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-text-muted">Warten auf Freigabe</span>
                  <b>{orders.filter(o => o.risk === 'blocked').length}</b>
                </div>
              </div>
              <div className="mt-3">
                <div className="text-[9.5px] text-text-muted font-bold uppercase tracking-wider mb-1.5">Volumen-Trend</div>
                <div className="h-[9px] w-full rounded-md bg-bg-app-soft overflow-hidden flex">
                  <div className="h-full" style={{ width: '62%', background: 'var(--navy-900)' }} />
                  <div className="h-full" style={{ width: '24%', background: 'var(--accent-orange)' }} />
                  <div className="h-full" style={{ width: '14%', background: 'var(--neutral-gray-300)' }} />
                </div>
              </div>
            </div>

          </aside>
        </div>

        {/* ── FEEDBACK SECTION ────────────────────────── */}
        <section
          className="bg-bg-app-soft border border-neutral-gray-200 rounded-[22px] p-6 text-center max-w-2xl mx-auto mt-8"
          style={{ animation: 'hm-floatIn .5s ease .18s both' }}
        >
          <h3 className="text-lg font-bold font-serif mb-2">Was fehlt auf dieser Seite?</h3>
          <p className="text-xs text-text-muted mb-4">Feedback-Speicherung wird später angebunden (Demo-Modus).</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="Z.B. Ich brauche einen Knopf für..."
              className="flex-1 rounded-xl border border-neutral-gray-300 px-4 py-3 text-sm focus:outline-none focus:border-navy-900 focus:ring-1 focus:ring-navy-900"
              onKeyDown={e => e.key === 'Enter' && handleFeedback()}
            />
            <button
              onClick={handleFeedback}
              className="bg-navy-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-navy-800 transition-colors shrink-0 cursor-pointer"
            >
              {feedbackSent ? "Gemerkt!" : "Merken"}
            </button>
          </div>
          <div className="mt-4 pt-4 border-t border-neutral-gray-200 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/kvp" className="text-sm font-bold text-text-muted hover:text-navy-900 hover:underline">App verbessern (Developer KVP)</Link>
            <span className="hidden sm:inline text-neutral-gray-300">•</span>
            <Link href="/betrieb-kvp" className="text-sm font-bold text-accent-orange hover:underline">Zum Betriebs-KVP (Werkstatt/Büro)</Link>
          </div>
        </section>

        {/* ── OVERLAY ─────────────────────────────────── */}
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

        {/* ── CRITICAL ORDERS MODAL ───────────────────── */}
        <DetailOverlay open={showCriticalOrders} onClose={() => setShowCriticalOrders(false)} title="Kritische Aufträge">
          <div className="space-y-4 text-navy-900 max-h-[60vh] overflow-y-auto pr-2">
            {orders.filter(o => o.risk === 'red' || o.risk === 'orange' || o.risk === 'yellow').length === 0 ? (
              <div className="p-4 rounded-xl border bg-success-green-soft border-success-green flex gap-3 text-success-green">
                <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold">Alles im Lot</h4>
                  <p className="text-sm mt-1">Es gibt aktuell keine kritischen Aufträge im System.</p>
                </div>
              </div>
            ) : (
              orders.filter(o => o.risk === 'red' || o.risk === 'orange' || o.risk === 'yellow').map(o => (
                <div key={o.id} className={`p-4 rounded-xl border flex items-start gap-4 transition-all hover:bg-neutral-gray-50 ${o.risk === 'red' ? 'bg-red-50/50 border-red-200 crit-pulse-active' : 'bg-gold-50/50 border-gold-200'}`}>
                  <div className={`p-2 rounded-lg shrink-0 mt-1 ${o.risk === 'red' ? 'bg-red-100 text-red-600' : 'bg-gold-200 text-gold-700'}`}>
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <button onClick={() => { openOrder(o.id); setShowCriticalOrders(false); }} className="font-bold text-navy-900 text-base hover:underline text-left">
                        {(o as Record<string, unknown>).title || o.task || "Unbekannter Auftrag"}
                      </button>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${o.risk === 'red' ? 'bg-red-100 text-red-700' : 'bg-gold-200 text-gold-800'}`}>
                        {o.risk === 'red' ? 'Kritisch' : 'Warnung'}
                      </span>
                    </div>
                    <p className="text-sm text-navy-700 mt-1">{o.customerName || "Kreile System"}</p>
                    <div className="text-xs text-text-muted mt-2 flex items-center gap-2">
                      <span className="bg-white border px-2 py-0.5 rounded-md shadow-xs">{o.station}</span>
                      <span>•</span>
                      <span>{o.task}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DetailOverlay>
      </div>
    </>
  );
}

