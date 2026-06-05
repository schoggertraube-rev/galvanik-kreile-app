"use client";

import { usePageView } from "@/hooks/usePageView";
import { useState } from "react";
import Link from "next/link";
import { AppBackButton } from "@/components/ui/AppBackButton";
import {
  Sparkles, Users, Mail, Calendar, TrendingUp, AlertTriangle, X,
  Clock, Eye, EyeOff, BarChart2, Send, ChevronRight
} from "lucide-react";
import { INITIAL_CUSTOMERS, INITIAL_ORDERS } from "@/lib/mockData";
import { ReactivationGeneratorOverlay } from "@/components/kommunikation/ReactivationGeneratorOverlay";

/* ═══════════════════════════════════════════════════════════════
   DEMO DATA — Reaktivierungskandidaten (regelbasiert aus Mockdaten)
   ═══════════════════════════════════════════════════════════════ */
function buildCandidates() {
  const now = new Date();
  return INITIAL_CUSTOMERS.slice(0, 8).map((c) => {
    const custOrders = INITIAL_ORDERS.filter(o => o.customerId === c.id);
    const lastOrder = custOrders.sort((a, b) =>
      new Date(b.intakeDate || "2025-01-01").getTime() - new Date(a.intakeDate || "2025-01-01").getTime()
    )[0];
    const monthsAgo = lastOrder ? Math.floor((now.getTime() - new Date(lastOrder.intakeDate || "2025-01-01").getTime()) / (1000 * 60 * 60 * 24 * 30)) : 99;
    return {
      id: c.id,
      name: c.name,
      city: c.city || "–",
      lastOrderTitle: lastOrder?.task || "Unbekannt",
      lastOrderDate: monthsAgo < 99 ? `vor ${monthsAgo} Monaten` : "Unbekannt",
      monthsAgo,
      segment: detectSegment(lastOrder?.task || ""),
      potential: monthsAgo > 12 ? "Hoch" : monthsAgo > 6 ? "Mittel" : "Niedrig",
      excluded: false,
      excludeReason: null as string | null,
    };
  }).filter(c => c.monthsAgo >= 6).sort((a, b) => b.monthsAgo - a.monthsAgo);
}

function detectSegment(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("chrom") || t.includes("stoß") || t.includes("motor") || t.includes("felg")) return "Oldtimer / Fahrzeuge";
  if (t.includes("schmuck") || t.includes("ring")) return "Schmuck";
  if (t.includes("besteck") || t.includes("silber")) return "Besteck / Silber";
  if (t.includes("kirch") || t.includes("leuchter") || t.includes("kronleuchter")) return "Kirchen / Institutionen";
  if (t.includes("museum") || t.includes("restaur") || t.includes("uhr")) return "Museen / Restaurierung";
  return "Allgemein";
}

const SEGMENTS = [
  { name: "Oldtimer / Fahrzeuge", icon: "🚗", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { name: "Schmuck", icon: "💎", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { name: "Besteck / Silber", icon: "🍴", color: "bg-gray-100 text-gray-800 border-gray-200" },
  { name: "Kirchen / Institutionen", icon: "⛪", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { name: "Museen / Restaurierung", icon: "🏛️", color: "bg-teal-100 text-teal-800 border-teal-200" },
  { name: "Geschäftskunden", icon: "🏢", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  { name: "Privatkunden", icon: "👤", color: "bg-rose-100 text-rose-800 border-rose-200" },
];

export default function MarketingPage() {
  usePageView();
  const [candidates] = useState(buildCandidates);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [reactivationTarget, setReactivationTarget] = useState<{ name: string; lastOrderTitle: string; lastOrderDate: string } | null>(null);

  const visibleCandidates = candidates.filter(c => !hidden.has(c.id));
  const segmentCounts = SEGMENTS.map(s => ({
    ...s,
    count: candidates.filter(c => c.segment === s.name).length,
  }));

  return (
    <div className="space-y-8 pb-16 font-sans antialiased text-navy-900 w-full max-w-7xl mx-auto animate-in fade-in duration-400">
      <div className="mb-2">
        <AppBackButton fallbackHref="/" label="Zurück zum Dashboard" />
      </div>

      <div className="flex flex-col md:flex-row md:items-baseline gap-2">
        <h1 className="text-2xl md:text-3xl font-black font-serif tracking-tight text-navy-900 flex items-center gap-3">
          <Sparkles className="text-gold-700" /> Marketing & Kundenreaktivierung
        </h1>
      </div>

      {/* STATUS BANNER */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl text-sm text-blue-800 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" />
        <div>
          <strong>Datenstatus:</strong> Alle Daten basieren aktuell auf Demo-/Bestandsdaten. Echte Kampagnen und E-Mail-Versand sind noch nicht angebunden.
          Statuslabels kennzeichnen den Reifegrad jeder Funktion.
        </div>
      </div>

      {/* ──── SECTION 1: ÜBERSICHT ──── */}
      <section>
        <h2 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-4">Übersicht</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Umsatzchancen" value={visibleCandidates.length} badge="Demo" badgeColor="bg-gold-100 text-gold-800" />
          <StatCard label="Prüfbereite Entwürfe" value={0} badge="Lokal vorbereitet" badgeColor="bg-blue-100 text-blue-700" />
          <StatCard label="Folgepotenzial" value={candidates.filter(c => c.potential === "Hoch").length} badge="Demo" badgeColor="bg-gold-100 text-gold-800" />
          <StatCard label="Ausgeschlossen" value={hidden.size} badge="Opt-out / Manuell" badgeColor="bg-gray-100 text-gray-600" />
        </div>
      </section>

      {/* ──── SECTION 2: REAKTIVIERUNGSKANDIDATEN ──── */}
      <section>
        <h2 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-4">Reaktivierungskandidaten</h2>
        {visibleCandidates.length === 0 ? (
          <p className="text-text-muted italic p-8 text-center border-2 border-dashed rounded-2xl">Alle Kandidaten wurden ausgeblendet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {visibleCandidates.map(c => (
              <div key={c.id} className="bg-white border-2 border-neutral-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative group">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-navy-900">{c.name}</h3>
                    <p className="text-xs text-text-muted">{c.city}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.potential === "Hoch" ? "bg-success-green/20 text-success-green" : c.potential === "Mittel" ? "bg-gold-100 text-gold-800" : "bg-gray-100 text-gray-500"}`}>
                    {c.potential}
                  </span>
                </div>
                <div className="space-y-1 text-sm mb-4">
                  <div className="flex justify-between"><span className="text-text-muted">Letzter Auftrag:</span><span className="font-bold text-navy-900 text-right max-w-[60%] truncate">{c.lastOrderTitle}</span></div>
                  <div className="flex justify-between"><span className="text-text-muted">Letzter Kontakt:</span><span className="font-bold">{c.lastOrderDate}</span></div>
                  <div className="flex justify-between"><span className="text-text-muted">Segment:</span><span className="font-bold">{c.segment}</span></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setReactivationTarget({ name: c.name, lastOrderTitle: c.lastOrderTitle, lastOrderDate: c.lastOrderDate })} className="flex-1 py-2 bg-navy-900 hover:bg-navy-800 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1">
                    <Mail size={14} /> Mail vorschlagen
                  </button>
                  <button onClick={() => setHidden(prev => new Set(prev).add(c.id))} className="px-3 py-2 bg-neutral-gray-100 hover:bg-neutral-gray-200 text-text-muted text-xs font-bold rounded-xl transition-colors" title="Ausblenden">
                    <EyeOff size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ──── SECTION 3: SEGMENTE ──── */}
      <section>
        <h2 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-4">Kundensegmente</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {segmentCounts.map(s => (
            <div key={s.name} className={`border-2 rounded-2xl p-4 flex items-center gap-3 ${s.color}`}>
              <span className="text-2xl">{s.icon}</span>
              <div>
                <div className="font-bold text-sm">{s.name}</div>
                <div className="text-xs font-bold">{s.count} Kandidaten</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ──── SECTION 4: MAILENTWÜRFE ──── */}
      <section>
        <h2 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-4">Mailentwürfe</h2>
        <div className="bg-white border-2 border-neutral-gray-200 rounded-2xl p-6 text-center space-y-3">
          <Mail className="w-10 h-10 mx-auto text-text-muted opacity-30" />
          <p className="text-text-muted font-bold">Noch keine Entwürfe erstellt</p>
          <p className="text-sm text-text-muted max-w-md mx-auto">
            Wähle oben einen Reaktivierungskandidaten aus und klicke „Mail vorschlagen", um einen personalisierten Entwurf zu erstellen.
          </p>
          <span className="inline-block text-[10px] font-bold bg-blue-100 text-blue-700 px-3 py-1 rounded-full">Lokal vorbereitet — kein echter Versand</span>
        </div>
      </section>

      {/* ──── SECTION 5: TIMING ──── */}
      <section>
        <h2 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-4">Versandplanung</h2>
        <div className="bg-white border-2 border-neutral-gray-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Calendar className="text-success-green" size={24} />
            <div>
              <h3 className="font-bold text-navy-900">Empfohlene Versandfenster</h3>
              <p className="text-sm text-text-muted">Dienstag – Donnerstag, 09:00 – 11:00 Uhr (B2B optimal)</p>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {["Mo", "Di", "Mi", "Do", "Fr"].map((d, i) => (
              <div key={d} className={`text-center p-3 rounded-xl border-2 ${i >= 1 && i <= 3 ? "bg-success-green/10 border-success-green/30 text-success-green font-bold" : "bg-gray-50 border-gray-200 text-text-muted"}`}>
                <div className="text-xs font-bold">{d}</div>
                <div className="text-lg font-black">{i >= 1 && i <= 3 ? "✓" : "–"}</div>
              </div>
            ))}
          </div>
          <span className="inline-block text-[10px] font-bold bg-gold-100 text-gold-800 px-3 py-1 rounded-full">Planung vorbereitet — echter Scheduler nicht angebunden</span>
        </div>
      </section>

      {/* ──── SECTION 6: WIRKUNG / ROI ──── */}
      <section>
        <h2 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-4">Wirkung & ROI</h2>
        <div className="bg-white border-2 border-neutral-gray-200 rounded-2xl p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-100">
              <span className="text-[10px] text-text-muted font-bold uppercase">Conversion</span>
              <span className="block text-2xl font-black text-navy-900">– %</span>
              <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Noch nicht berechenbar</span>
            </div>
            <div className="bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-100">
              <span className="text-[10px] text-text-muted font-bold uppercase">Umsatz aus Reaktivierung</span>
              <span className="block text-2xl font-black text-navy-900">– €</span>
              <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Keine Kampagnendaten</span>
            </div>
            <div className="bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-100">
              <span className="text-[10px] text-text-muted font-bold uppercase">ROI</span>
              <span className="block text-2xl font-black text-navy-900">– %</span>
              <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Kosten/Umsatz nicht verknüpft</span>
            </div>
          </div>
          <p className="text-xs text-text-muted">Echte Kampagnenwirkung kann erst berechnet werden, wenn E-Mail-Versand und Auftragsverknüpfung angebunden sind.</p>
        </div>
      </section>

      {/* Reactivation overlay */}
      {reactivationTarget && (
        <ReactivationGeneratorOverlay
          customer={{ name: reactivationTarget.name }}
          lastOrderTitle={reactivationTarget.lastOrderTitle}
          lastOrderDate={reactivationTarget.lastOrderDate}
          onClose={() => setReactivationTarget(null)}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, badge, badgeColor }: { label: string; value: number; badge: string; badgeColor: string }) {
  return (
    <div className="bg-white border-2 border-neutral-gray-200 rounded-2xl p-4 shadow-sm">
      <span className="text-[10px] text-text-muted font-bold uppercase block mb-1">{label}</span>
      <span className="text-3xl font-black text-navy-900 block">{value}</span>
      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-2 ${badgeColor}`}>{badge}</span>
    </div>
  );
}
