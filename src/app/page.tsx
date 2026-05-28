"use client";

import { useState, useEffect } from "react";
import { ordersRepository } from "@/lib/repositories/ordersRepository";
import { inquiriesRepository } from "@/lib/repositories/inquiriesRepository";
import { MockOrder } from "@/lib/mockData";
import {
  AlertTriangle,
  CheckCircle,
  Truck,
  Info,
  Heart,
  ChevronDown,
  Check,
  Clock,
  HelpCircle,
  Activity,
  PartyPopper,
  Flame,
  Wrench,
} from "lucide-react";
import Link from "next/link";

// ────────────────────────────────────────────────
// KPI CARD — Premium style as in specification
// ────────────────────────────────────────────────
type KpiStatus = "neutral" | "warning" | "danger" | "success" | "info";

function KpiCard({
  title,
  value,
  subtitle,
  status,
  icon: Icon,
  emoji,
  href,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  status: KpiStatus;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  emoji?: string;
  href?: string;
}) {
  const circleBg: Record<KpiStatus, string> = {
    neutral: "bg-gold-100",
    warning: "bg-accent-orange-soft",
    danger: "bg-accent-orange-soft",
    success: "bg-success-green-soft",
    info: "bg-bg-app-soft",
  };
  
  const iconColor: Record<KpiStatus, string> = {
    neutral: "text-gold-600",
    warning: "text-accent-orange",
    danger: "text-danger-red",
    success: "text-success-green",
    info: "text-navy-700",
  };

  const Content = (
    <>
      {/* Icon / Emoji Circle */}
      <div className={`w-14 h-14 rounded-full ${circleBg[status]} flex items-center justify-center shrink-0`}>
        {emoji ? (
          <span className="text-3xl leading-none">{emoji}</span>
        ) : Icon ? (
          <Icon className={`w-7 h-7 ${iconColor[status]}`} strokeWidth={1.5} />
        ) : null}
      </div>

      {/* Text block */}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black text-text-muted uppercase tracking-widest leading-none mb-2">{title}</p>
        <p className="text-2xl font-black text-navy-900 leading-none tracking-tight">{value}</p>
        {subtitle && (
          <p className="text-[11px] text-text-muted font-bold mt-1.5 tracking-wide">{subtitle}</p>
        )}
      </div>
    </>
  );

  const containerClasses = "bg-white rounded-2xl p-5 flex items-center gap-4 h-[132px] shadow-card hover:shadow-md transition-all duration-200 overflow-hidden relative group";

  if (href) {
    return (
      <Link href={href} className={`${containerClasses} block cursor-pointer active:scale-95`}>
        {Content}
      </Link>
    );
  }

  return (
    <div className={containerClasses}>
      {Content}
    </div>
  );
}

// ────────────────────────────────────────────────
// TIMELINE ITEM — Chronological past/present/future
// ────────────────────────────────────────────────
type TLStatus = "done" | "current" | "pause" | "upcoming";

function TimelineItem({
  time,
  title,
  description,
  status,
  actionLabel,
  actionHref,
}: {
  time: string;
  title: string;
  description: string;
  status: TLStatus;
  actionLabel?: string;
  actionHref?: string;
}) {
  const dot: Record<TLStatus, React.ReactNode> = {
    done: (
      <span className="w-7 h-7 rounded-full bg-success-green flex items-center justify-center shrink-0 shadow-sm">
        <Check className="w-4 h-4 text-white" strokeWidth={2.5} />
      </span>
    ),
    current: (
      <span className="w-7 h-7 rounded-full border-2 border-accent-orange bg-white flex items-center justify-center shrink-0 animate-pulse">
        <Clock className="w-4 h-4 text-accent-orange" strokeWidth={1.5} />
      </span>
    ),
    pause: (
      <span className="w-7 h-7 rounded-full bg-gold-100 flex items-center justify-center shrink-0">
        <span className="text-sm">🍽</span>
      </span>
    ),
    upcoming: (
      <span className="w-7 h-7 rounded-full border-2 border-neutral-gray-300 bg-white flex items-center justify-center shrink-0" />
    ),
  };

  const titleClass = status === "current" ? "text-accent-orange font-bold" : "text-navy-900 font-bold";

  return (
    <div className={`flex items-start gap-4 transition-all duration-300 ${status === "upcoming" ? "opacity-60" : ""}`}>
      {/* Time */}
      <span className="w-12 text-right text-[13px] font-mono text-text-muted shrink-0 pt-1.5">{time}</span>

      {/* Circle Icon */}
      {dot[status]}

      {/* Content */}
      <div className="flex-1 min-w-0 pt-0.5">
        <p className={`text-sm leading-snug ${titleClass}`}>{title}</p>
        <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{description}</p>
      </div>

      {/* Action Button */}
      {actionLabel && (
        actionHref ? (
          <Link
            href={actionHref}
            className="shrink-0 px-3.5 py-1.5 rounded-lg border border-neutral-gray-300 text-xs font-bold text-navy-700 hover:bg-bg-app-soft transition-colors"
          >
            {actionLabel}
          </Link>
        ) : (
          <button className="shrink-0 px-3.5 py-1.5 rounded-lg border border-neutral-gray-300 text-xs font-bold text-navy-700 hover:bg-bg-app-soft transition-colors cursor-pointer">
            {actionLabel}
          </button>
        )
      )}
    </div>
  );
}

// ────────────────────────────────────────────────
// MAIN DASHBOARD
// ────────────────────────────────────────────────
export default function HomeDashboard() {
  const [orders, setOrders] = useState<MockOrder[]>([]);
  const [openQuotes, setOpenQuotes] = useState(0);
  const [morningMessage, setMorningMessage] = useState("Gleich feierabend! 🍺 Salzsäure bestellen nicht vergessen.");

  useEffect(() => {
    const load = async () => {
      const dbOrders = await ordersRepository.getAll();
      if (dbOrders) setOrders(dbOrders as unknown as MockOrder[]);
      const qCount = await inquiriesRepository.getOpenCount();
      setOpenQuotes(qCount);
      
      try {
        const msgRes = await fetch("/api/morning-message?context=end-of-day");
        const msgData = await msgRes.json();
        if (msgData?.message) setMorningMessage(msgData.message);
      } catch (err) {
        console.warn("Morning message API not reachable during load:", err);
      }
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

  const countCritical = orders.filter(o => o.risk === "red").length;
  const countGalvanik = orders.filter(o => o.station === "beschichtung").length;
  const countGalvanikCrit = orders.filter(o => o.station === "beschichtung" && o.risk === "red").length;
  const countAusgang = orders.filter(o => o.station === "warenausgang").length;
  const countDue = orders.filter(o => o.dueValue?.toLowerCase().includes("heute")).length;
  const countDone = orders.filter(o => o.risk === "green").length;

  const dayStatus = countCritical > 3
    ? { title: "Kritisch", subtitle: "Eingreifen nötig 🧐", status: "danger" as KpiStatus, emoji: "🧐" }
    : countCritical > 0
    ? { title: "Aufpassen", subtitle: "Offene Punkte 🧐", status: "warning" as KpiStatus, emoji: "🧐" }
    : { title: "Gut auf Kurs", subtitle: "Weiter so! 💪", status: "neutral" as KpiStatus, emoji: "😊" };

  return (
    <div className="space-y-6 pb-8 animate-in fade-in duration-400">

      {/* ── ROW 1: 5 KPI CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          title="So läuft's heute"
          value={dayStatus.title}
          subtitle={dayStatus.subtitle}
          status={dayStatus.status}
          emoji={dayStatus.emoji}
        />
        <KpiCard
          title="Offene Anfragen"
          value={openQuotes}
          subtitle={`davon ${Math.min(2, openQuotes)} neu`}
          status={openQuotes > 0 ? "warning" : "neutral"}
          icon={HelpCircle}
          href="/quotes"
        />
        <KpiCard
          title="In Galvanik"
          value={countGalvanik}
          subtitle={`${countGalvanikCrit} kritisch`}
          status={countGalvanikCrit > 0 ? "danger" : "neutral"}
          icon={Activity}
          href="/station/beschichtung"
        />
        <KpiCard
          title="Warenausgang"
          value={countAusgang}
          subtitle={`${countDue} heute fällig`}
          status="success"
          icon={Truck}
          href="/station/warenausgang"
        />
        <KpiCard
          title="Fertig heute"
          value={countDone}
          subtitle={countDone > 0 ? "Super!" : "Heute noch nichts."}
          status="neutral"
          icon={PartyPopper}
        />
      </div>

      {/* ── ROW 2: TIMELINE + SIDEBARS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* LEFT COLUMN: Timeline Card */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-neutral-gray-100 shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-neutral-gray-100">
            <h2 className="text-[17px] font-black text-navy-900">Tagesablauf auf einen Blick</h2>
            <button className="flex items-center gap-1.5 text-xs font-bold text-navy-700 bg-bg-app-soft border border-neutral-gray-100 rounded-xl px-3 py-1.5 hover:bg-neutral-gray-300 transition-colors cursor-pointer">
              Kommende Arbeiten <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          <div className="px-6 py-6 relative">
            {/* Connector Line */}
            <div className="absolute left-[78px] top-9 bottom-9 w-[1.5px] bg-neutral-gray-300" />

            <div className="space-y-6">
              <TimelineItem time="08:00" title="Wareneingang geprüft" description="Alle Eingänge von gestern Abend erfasst." status="done" />
              <TimelineItem time="09:15" title="3 Teile in Galvanik gestartet" description="Sie laufen planmäßig." status="done" />
              <TimelineItem
                time="11:30"
                title="Anfragen sortieren"
                description={`${openQuotes} Anfragen warten auf Rückmeldung.`}
                status="current"
                actionLabel="Ansehen"
                actionHref="/quotes"
              />
              <TimelineItem
                time="12:30"
                title="Mittagspause"
                description="Gönn dir was!"
                status="pause"
                actionLabel="In 2 Std."
              />
              <TimelineItem
                time="14:30"
                title="Versand vorbereiten"
                description={`${countAusgang} Aufträge bereitstellen.`}
                status="upcoming"
                actionLabel="Ansehen"
                actionHref="/orders"
              />
              <TimelineItem
                time="16:30"
                title="Tagesabschluss"
                description="Offene Punkte prüfen & abschließen."
                status="upcoming"
                actionLabel="Checkliste"
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Stacked Panels */}
        <div className="space-y-5">

          {/* TODAY IMPORTANT PANEL */}
          <div className="bg-white rounded-2xl border border-neutral-gray-100 shadow-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">⭐</span>
              <h2 className="text-[15px] font-black text-navy-900">Heute wichtig</h2>
            </div>
            
            <div className="space-y-0.5">
              {/* Alert 1 */}
              <Link href="/items" className="flex items-center gap-3.5 py-3 border-b border-neutral-gray-100 hover:bg-bg-app-soft -mx-2 px-2 rounded-xl transition-colors group">
                <div className="w-9 h-9 rounded-full bg-accent-orange-soft flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-accent-orange" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-navy-900 leading-tight">Salzsäure fast leer</p>
                  <p className="text-xs text-text-muted truncate">Bestellung heute nicht vergessen.</p>
                </div>
                <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-text-muted group-hover:text-navy-900 shrink-0 transition-colors">
                  <polyline points="6 12 10 8 6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>

              {/* Alert 2 */}
              <Link href="/customers" className="flex items-center gap-3.5 py-3 border-b border-neutral-gray-100 hover:bg-bg-app-soft -mx-2 px-2 rounded-xl transition-colors group">
                <div className="w-9 h-9 rounded-full bg-bg-app-soft flex items-center justify-center shrink-0">
                  <Info className="w-5 h-5 text-navy-700" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-navy-900 leading-tight">2 Freigaben fehlen</p>
                  <p className="text-xs text-text-muted truncate">Kunden warten auf Rückmeldung.</p>
                </div>
                <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-text-muted group-hover:text-navy-900 shrink-0 transition-colors">
                  <polyline points="6 12 10 8 6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>

              {/* Alert 3 */}
              <Link href="/orders" className="flex items-center gap-3.5 py-3 hover:bg-bg-app-soft -mx-2 px-2 rounded-xl transition-colors group">
                <div className="w-9 h-9 rounded-full bg-success-green-soft flex items-center justify-center shrink-0">
                  <CheckCircle className="w-5 h-5 text-success-green" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-navy-900 leading-tight">Warenausgang im Plan</p>
                  <p className="text-xs text-text-muted truncate">Heute {countDue} Abholungen geplant.</p>
                </div>
                <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-text-muted group-hover:text-navy-900 shrink-0 transition-colors">
                  <polyline points="6 12 10 8 6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
            </div>
          </div>

          {/* KLEINER HINWEIS ZUM TAG */}
          <div className="bg-white rounded-2xl border border-neutral-gray-100 shadow-card p-5">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <span className="text-xl">😊</span>
                <h3 className="text-sm font-black text-navy-900">Kleiner Hinweis zum Tag</h3>
              </div>
              <Heart className="w-4 h-4 text-gold-600 fill-gold-600" />
            </div>
            <p className="text-sm font-bold text-navy-900 leading-relaxed">
              {morningMessage}
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
