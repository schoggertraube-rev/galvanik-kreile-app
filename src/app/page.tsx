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
} from "lucide-react";
import Link from "next/link";

// ────────────────────────────────────────────────
// KPI CARD — exakt nach Referenzbild 2
// Großes rundes Icon + Titel + Zahl + Subtext + Progress
// ────────────────────────────────────────────────
type KpiStatus = "neutral" | "warning" | "danger" | "success" | "info";

function KpiCard({
  title,
  value,
  subtitle,
  status,
  progress,
  icon,
  emoji,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  status: KpiStatus;
  progress?: number;
  icon?: React.ReactNode;
  emoji?: string;
}) {
  const circleBg: Record<KpiStatus, string> = {
    neutral: "bg-kreile-sand/55",
    warning: "bg-[#FFF1DE]",
    danger: "bg-[#FFE3E1]",
    success: "bg-[#EDF6E7]",
    info: "bg-[#E8F0FE]",
  };
  const progressColor: Record<KpiStatus, string> = {
    neutral: "bg-kreile-muted",
    warning: "bg-[#F28A0C]",
    danger: "bg-[#E20B0B]",
    success: "bg-[#4F8A2D]",
    info: "bg-[#001B38]",
  };

  return (
    <div className="bg-white rounded-3xl border border-kreile-border p-5 flex flex-col justify-between min-h-[115px] shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden group">
      {/* Horizontaler Inhalt: Icon links, Texte rechts */}
      <div className="flex items-center gap-4">
        {/* Icon / Emoji Kreis */}
        <div className={`w-14 h-14 rounded-full ${circleBg[status]} flex items-center justify-center shrink-0`}>
          {emoji ? (
            <span className="text-3xl leading-none">{emoji}</span>
          ) : (
            <div className="text-kreile-navy">
              {icon}
            </div>
          )}
        </div>

        {/* Text-Stapel */}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black text-kreile-muted uppercase tracking-widest leading-none mb-1.5">{title}</p>
          <p className="text-2xl md:text-3xl font-black text-kreile-navy leading-none tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-[11px] text-kreile-muted font-bold mt-1 tracking-wide">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Progress Bar am unteren Kartenrand horizontal (wie in Bild 2) */}
      {progress !== undefined && (
        <div className="absolute bottom-0 left-0 right-0 h-1 w-full bg-kreile-bg overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${progressColor[status]}`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────
// TIMELINE ITEM — wie in Bild 2
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
      <span className="w-7 h-7 rounded-full bg-status-green flex items-center justify-center shrink-0">
        <Check className="w-4 h-4 text-white" strokeWidth={3} />
      </span>
    ),
    current: (
      <span className="w-7 h-7 rounded-full border-2 border-kreile-accent bg-white flex items-center justify-center shrink-0">
        <Clock className="w-3.5 h-3.5 text-kreile-accent" />
      </span>
    ),
    pause: (
      <span className="w-7 h-7 rounded-full bg-kreile-sand flex items-center justify-center shrink-0">
        {/* Besteck-Emoji */}
        <span className="text-sm">🍽</span>
      </span>
    ),
    upcoming: (
      <span className="w-7 h-7 rounded-full border-2 border-kreile-border bg-white flex items-center justify-center shrink-0" />
    ),
  };

  const titleClass = status === "current" ? "text-kreile-accent font-bold" : "text-kreile-navy font-bold";

  return (
    <div className={`flex items-start gap-4 transition-opacity ${status === "upcoming" ? "opacity-50" : ""}`}>
      {/* Zeit */}
      <span className="w-10 text-right text-[13px] font-mono text-kreile-muted shrink-0 pt-1.5">{time}</span>

      {/* Dot */}
      {dot[status]}

      {/* Inhalt */}
      <div className="flex-1 min-w-0 pt-0.5">
        <p className={`text-sm leading-snug ${titleClass}`}>{title}</p>
        <p className="text-xs text-kreile-muted mt-0.5 leading-relaxed">{description}</p>
      </div>

      {/* Action Button */}
      {actionLabel && (
        actionHref ? (
          <Link
            href={actionHref}
            className="shrink-0 px-3 py-1.5 rounded-lg border border-kreile-border-strong text-xs font-semibold text-kreile-navy hover:bg-kreile-bg transition-colors"
          >
            {actionLabel}
          </Link>
        ) : (
          <button className="shrink-0 px-3 py-1.5 rounded-lg border border-kreile-border-strong text-xs font-semibold text-kreile-navy hover:bg-kreile-bg transition-colors">
            {actionLabel}
          </button>
        )
      )}
    </div>
  );
}

// ────────────────────────────────────────────────
// IMPORTANT ITEM — „Heute wichtig" Listenzeile
// ────────────────────────────────────────────────
function ImportantItem({
  icon,
  iconBg,
  title,
  subtitle,
  href,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  href?: string;
}) {
  const inner = (
    <div className="flex items-center gap-3 py-3 border-b border-kreile-border last:border-b-0 hover:bg-kreile-bg -mx-2 px-2 rounded-xl transition-colors cursor-pointer group">
      <div className={`w-9 h-9 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-kreile-navy leading-tight">{title}</p>
        <p className="text-xs text-kreile-muted truncate">{subtitle}</p>
      </div>
      <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 text-kreile-muted group-hover:text-kreile-navy shrink-0 transition-colors">
        <polyline points="6 12 10 8 6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}

// ────────────────────────────────────────────────
// MAIN HOME COMPONENT
// ────────────────────────────────────────────────
export default function HomeDashboard() {
  const [orders, setOrders] = useState<MockOrder[]>([]);
  const [openQuotes, setOpenQuotes] = useState(0);

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

  const countCritical = orders.filter(o => o.risk === "red").length;
  const countGalvanik = orders.filter(o => o.station === "beschichtung").length;
  const countGalvanikCrit = orders.filter(o => o.station === "beschichtung" && o.risk === "red").length;
  const countAusgang = orders.filter(o => o.station === "warenausgang").length;
  const countDue = orders.filter(o => o.dueValue?.toLowerCase().includes("heute")).length;
  const countDone = orders.filter(o => o.risk === "green").length;

  const dayStatus = countCritical > 3
    ? { emoji: "😰", title: "Schwieriger Tag", subtitle: "Eingreifen nötig", status: "danger" as KpiStatus }
    : countCritical > 0
    ? { emoji: "🧐", title: "Aufpassen", subtitle: "Offene Punkte", status: "warning" as KpiStatus }
    : { emoji: "😊", title: "Gut auf Kurs", subtitle: "Weiter so! 💪", status: "neutral" as KpiStatus };

  return (
    <div className="space-y-6 pb-8 animate-in fade-in duration-400">

      {/* ── KPI REIHE ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
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
          progress={openQuotes > 0 ? 40 : 0}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="w-6 h-6 text-kreile-gold-muted">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              <circle cx="12" cy="14" r="2"/><line x1="12" y1="11" x2="12" y2="11.01"/>
            </svg>
          }
        />
        <KpiCard
          title="In Galvanik"
          value={countGalvanik}
          subtitle={`${countGalvanikCrit} kritisch`}
          status={countGalvanikCrit > 0 ? "warning" : "info"}
          progress={countGalvanik > 0 ? 75 : 0}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="w-6 h-6 text-kreile-navy">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
          }
        />
        <KpiCard
          title="Warenausgang"
          value={countAusgang}
          subtitle={`${countDue} heute fällig`}
          status="success"
          progress={90}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="w-6 h-6 text-status-green">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
          }
        />
        <KpiCard
          title="Fertig heute"
          value={countDone}
          subtitle="Super!"
          status="neutral"
          emoji="🎉"
        />
      </div>

      {/* ── HAUPT GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

        {/* LINKE SPALTE: Tagesablauf */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-kreile-border shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-kreile-border">
            <h2 className="text-[17px] font-black text-kreile-navy">Tagesablauf auf einen Blick</h2>
            <button className="flex items-center gap-1.5 text-sm font-semibold text-kreile-navy bg-kreile-bg border border-kreile-border rounded-xl px-3 py-1.5 hover:bg-kreile-sand transition-colors">
              Kommende Arbeiten <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Vertikale Linie */}
          <div className="px-6 py-5 relative">
            {/* Connector Line */}
            <div className="absolute left-[72px] top-8 bottom-8 w-px bg-kreile-border" />

            <div className="space-y-5">
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

        {/* RECHTE SPALTE */}
        <div className="space-y-4">

          {/* HEUTE WICHTIG */}
          <div className="bg-white rounded-2xl border border-kreile-border shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">⭐</span>
              <h2 className="text-[15px] font-black text-kreile-navy">Heute wichtig</h2>
            </div>
            <div className="space-y-0">
              <ImportantItem
                icon={<AlertTriangle className="w-4 h-4 text-status-orange" />}
                iconBg="bg-[#FFF1DE]"
                title="Salzsäure fast leer"
                subtitle="Bestellung heute nicht vergessen."
                href="/items"
              />
              <ImportantItem
                icon={<Info className="w-4 h-4 text-kreile-navy" />}
                iconBg="bg-[#E8F0FE]"
                title="2 Freigaben fehlen"
                subtitle="Kunden warten auf Rückmeldung."
                href="/customers"
              />
              <ImportantItem
                icon={<CheckCircle className="w-4 h-4 text-status-green" />}
                iconBg="bg-[#EDF6E7]"
                title="Warenausgang im Plan"
                subtitle={`Heute ${countDue} Abholungen geplant.`}
                href="/orders"
              />
            </div>
          </div>

          {/* KLEINER HINWEIS ZUM TAG */}
          <div className="bg-white rounded-2xl border border-kreile-border shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">😊</span>
                <h3 className="text-[14px] font-bold text-kreile-navy">Kleiner Hinweis zum Tag</h3>
              </div>
              <Heart className="w-4 h-4 text-kreile-muted" />
            </div>
            <p className="text-sm font-bold text-kreile-navy">Gleich feierabend! 🎊</p>
            <p className="text-xs text-kreile-muted mt-1 leading-relaxed">
              Salzsäure bestellen nicht vergessen und dann: wohlverdient Feierabend.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
