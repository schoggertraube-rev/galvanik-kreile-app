"use client";
import { usePageView } from "@/hooks/usePageView";
import { FoundationUnavailable } from "@/components/foundation/FoundationUnavailable";
import Link from "next/link";
import { pruefeFristen } from "@/lib/buchhaltung/regeln";
import { ChevronRight, CalendarClock, Truck, Phone, Users, Globe, ReceiptText } from "lucide-react";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";

const TERMIN_QUELLEN = [
  {
    quelle: "Zuletzt gebuchte Belege",
    icon: ReceiptText,
    color: "text-rose-500",
    bg: "bg-rose-50",
    status: "aktiv",
    termine: [
      { titel: "Shell - Frankfurt-Ost (78,40 €)", datum: "Heute", wichtig: false, link: "/buchhaltung/belege/shell-frankfurt-ost" },
      { titel: "Gasthaus Adler (64,00 €)", datum: "Gestern", wichtig: false, link: "/buchhaltung/belege/gasthaus-adler" },
      { titel: "Riedel Chemie GmbH (1.190,00 €)", datum: "30.05.2026", wichtig: false, link: "/buchhaltung/belege/riedel-chemie" },
    ],
  },
  {
    quelle: "Buchhaltung / Fristen",
    icon: CalendarClock,
    color: "text-accent-orange",
    bg: "bg-accent-orange/10",
    status: "aktiv",
    termine: [
      { titel: "UStVA-Frist", datum: "10. des Folgemonats", wichtig: true },
      { titel: "Gewerbesteuer-Vorauszahlung", datum: "15.02 / 15.05 / 15.08 / 15.11", wichtig: false },
      { titel: "Rundfunkbeitrag", datum: "Quartalsmitte", wichtig: false },
    ],
  },
  {
    quelle: "Warendurchlauf / Termine",
    icon: Truck,
    color: "text-blue-500",
    bg: "bg-blue-50",
    status: "vorbereitet",
    termine: [
      { titel: "Abholtermin Müller GmbH", datum: "Mo 09.06.2026", wichtig: true },
      { titel: "Versand AutoTech", datum: "Mi 11.06.2026", wichtig: false },
    ],
  },
  {
    quelle: "Telefonnotizen / Wiedervorlage",
    icon: Phone,
    color: "text-emerald-500",
    bg: "bg-emerald-50",
    status: "vorbereitet",
    termine: [
      { titel: "Rückruf: Hr. Weber (Reklamation)", datum: "Di 10.06.2026", wichtig: true },
    ],
  },
  {
    quelle: "Kunden & Aufträge",
    icon: Users,
    color: "text-purple-500",
    bg: "bg-purple-50",
    status: "vorbereitet",
    termine: [
      { titel: "Lieferfrist Auftrag #2026-087", datum: "Fr 13.06.2026", wichtig: false },
    ],
  },
];

export default function KalenderPage() {
  return <FoundationUnavailable title="Kalenderdaten nicht freigegeben" reason="Die frühere Kalenderansicht bestand aus festen Terminen und Beträgen. Bis eine belegte Fristen- und Kalenderquelle angebunden ist, wird kein Terminstatus behauptet." returnHref="/" returnLabel="Zur Startseite" />;
}

function KalenderLegacyPage() {
  usePageView();
  const fristenHinweise = pruefeFristen();

  const heute = new Date();
  const monatsTage = new Date(heute.getFullYear(), heute.getMonth() + 1, 0).getDate();
  const ersterTag = new Date(heute.getFullYear(), heute.getMonth(), 1).getDay(); // 0=So
  const versatz = ersterTag === 0 ? 6 : ersterTag - 1; // Mo=0

  return (
    <div className="w-full pb-24 px-4 sm:px-6 xl:px-8">
      <div className="flex items-center gap-2 text-xs font-semibold text-text-muted mt-4 mb-3">
        <Link href="/" className="hover:text-navy-900 transition-colors">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-navy-900">Kalender</span>
      </div>

      <h1 className="text-2xl font-extrabold text-navy-900 mb-1">Kalender-Hub</h1>
      <p className="text-sm text-text-muted mb-8">Zentrale Terminübersicht — Buchhaltung, Warendurchlauf, Wiedervorlagen, Kunden.</p>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-6">
        {/* Mini-Kalender */}
        <div className="bg-white rounded-2xl border border-neutral-gray-100 shadow-sm p-6">
          <h2 className="text-base font-extrabold text-navy-900 mb-4">
            {heute.toLocaleDateString("de-DE", { month: "long", year: "numeric" })}
          </h2>
          <div className="grid grid-cols-7 text-center text-[10px] font-bold text-text-muted mb-2">
            {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(d => <span key={d}>{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: versatz }).map((_, i) => <span key={`e-${i}`} />)}
            {Array.from({ length: monatsTage }).map((_, i) => {
              const tag = i + 1;
              const istHeute = tag === heute.getDate();
              const istFrist = tag === 10; // UStVA
              return (
                <div
                  key={tag}
                  className={`aspect-square rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${
                    istHeute ? "bg-navy-900 text-white" : istFrist ? "bg-amber-100 text-amber-700" : "text-navy-900 hover:bg-neutral-gray-50"
                  }`}
                >
                  {tag}
                </div>
              );
            })}
          </div>
        </div>

        {/* Terminquellen */}
        <div className="space-y-4">
          {/* Aktuelle Warnungen */}
          {fristenHinweise.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-amber-800 mb-2">Aktuell anstehend</h3>
              {fristenHinweise.map((h, i) => (
                <p key={i} className="text-xs text-amber-700 mt-1">• {h.text}</p>
              ))}
            </div>
          )}

          {TERMIN_QUELLEN.map((q, i) => {
            const Icon = q.icon;
            return (
              <div key={i} className="bg-white rounded-2xl border border-neutral-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${q.bg}`}>
                    <Icon className={`w-4 h-4 ${q.color}`} />
                  </div>
                  <h3 className="text-sm font-extrabold text-navy-900">{q.quelle}</h3>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    q.status === "aktiv" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-neutral-gray-50 text-text-muted border-neutral-gray-200"
                  }`}>{q.status}</span>
                </div>
                <div className="space-y-1.5">
                  {q.termine.map((t, j) => {
                    const inner = (
                      <>
                        <span className={`${t.wichtig ? "font-bold text-navy-900" : "text-text-muted"} ${"link" in t ? "hover:text-navy-900 transition-colors" : ""}`}>
                          {t.wichtig && "⚡ "}{t.titel}
                        </span>
                        <span className="text-text-muted font-semibold">{t.datum}</span>
                      </>
                    );
                    return "link" in t && (t as { link?: string }).link ? (
                      <Link key={j} href={(t as { link: string }).link} className="flex items-center justify-between text-xs hover:bg-neutral-50 rounded-lg px-1 -mx-1 py-0.5 transition-colors">
                        {inner}
                      </Link>
                    ) : (
                      <div key={j} className="flex items-center justify-between text-xs">
                        {inner}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Google Calendar Stufe 2 */}
          <div className="bg-neutral-gray-50 border border-neutral-gray-200 rounded-2xl p-5 flex items-start gap-4">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4 text-text-muted" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-navy-900">Google Kalender</h3>
              <p className="text-xs text-text-muted mt-1">Vorbereitet, noch nicht verbunden. Die Anbindung erfolgt in Stufe 2 über die Google Calendar API.</p>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mt-2 inline-block">Stufe 2</span>
            </div>
          </div>
        </div>
      </div>

      <FeedbackFooter pageTitle="Kalender" route="/kalender" variant="full" />
    </div>
  );
}
void KalenderLegacyPage;
