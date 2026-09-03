"use client";
import { usePageView } from "@/hooks/usePageView";
import Link from "next/link";
import { ChevronRight, CalendarClock, Globe } from "lucide-react";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";

export default function KalenderPage() {
  usePageView();

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
      <p className="text-sm text-text-muted mb-8">Lokaler Monatskalender. Operative Termine sind nicht angebunden.</p>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-6">
        {/* Mini-Kalender — rein lokal aus dem Gerätedatum abgeleitet */}
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
              return (
                <div
                  key={tag}
                  data-testid={istHeute ? "kalender-heute" : undefined}
                  className={`aspect-square rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${
                    istHeute ? "bg-navy-900 text-white" : "text-navy-900 hover:bg-neutral-gray-50"
                  }`}
                >
                  {tag}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          {/* Fail-closed: keine kanonische Terminquelle vorhanden */}
          <div
            role="status"
            data-testid="kalender-termine-unavailable"
            className="bg-white rounded-2xl border border-neutral-gray-100 shadow-sm p-5 flex items-start gap-4"
          >
            <div className="w-8 h-8 rounded-lg bg-neutral-gray-50 flex items-center justify-center shrink-0">
              <CalendarClock className="w-4 h-4 text-text-muted" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">NOT_AVAILABLE</p>
              <h3 className="text-sm font-extrabold text-navy-900 mt-1">Operative Termine sind nicht verfügbar</h3>
              <p className="text-xs text-text-muted mt-1">
                Operative Termine brauchen eine kanonische, tenantgebundene Kalender-Datenquelle. Solange diese fehlt,
                werden hier keine Fristen, Belege, Auftrags- oder Wiedervorlagetermine angezeigt.
              </p>
            </div>
          </div>

          {/* Google Calendar — nicht verbunden */}
          <div className="bg-neutral-gray-50 border border-neutral-gray-200 rounded-2xl p-5 flex items-start gap-4">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4 text-text-muted" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-navy-900">Google Kalender</h3>
              <p className="text-xs text-text-muted mt-1">Nicht verbunden. Es werden keine externen Termine gelesen oder geschrieben.</p>
            </div>
          </div>
        </div>
      </div>

      <FeedbackFooter pageTitle="Kalender" route="/kalender" variant="full" />
    </div>
  );
}
