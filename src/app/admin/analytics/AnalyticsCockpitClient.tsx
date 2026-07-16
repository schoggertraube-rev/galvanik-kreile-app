"use client";

import { useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Lightbulb,
  MonitorSmartphone,
  MousePointer2,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  Users,
} from "lucide-react";
import type {
  AnalyticsSuggestion,
  DeveloperCockpitData,
  DeviceUsage,
  FrictionSignal,
} from "@/app/actions/developerAnalytics.actions";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";
import { DetailOverlay } from "@/components/ui/DetailOverlay";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActivityLineChart, EventsBarChart } from "./AnalyticsCharts";

function formatLastActive(value: string | null): string {
  if (!value) return "Keine Daten";
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function AvailabilityNotice({ children }: { children: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">
      {children}
    </div>
  );
}

export function AnalyticsCockpitClient({ data }: { data: DeveloperCockpitData }) {
  const [activeSuggestion, setActiveSuggestion] = useState<AnalyticsSuggestion | null>(null);
  const [activeFriction, setActiveFriction] = useState<FrictionSignal | null>(null);
  const { operatorControl, overview, frictionAnalysis, suggestions, devices } = data;
  const eventCount = overview.activityData.reduce((total, day) => total + day.events, 0);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 pb-12 font-sans text-navy-900 antialiased">
      <PageHeader
        title="Developer Analytics"
        subtitle="Datensparsame, persistierte Nutzungsereignisse der letzten sieben Tage. Nicht instrumentierte Auswertungen werden ausdrücklich gekennzeichnet."
      />

      <section className="rounded-2xl border border-neutral-gray-200 bg-white p-5 shadow-sm" aria-labelledby="operator-control-status">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              <h2 id="operator-control-status" className="font-serif text-lg font-bold">Betreiberkanal</h2>
            </div>
            <p className="mt-2 text-sm text-text-muted">
              {operatorControl.availability === "available"
                ? "Signatur und Wirksamkeitsfenster sind verifiziert."
                : "Kein wirksamer verifizierter Betreiberstatus; eine Sperre wird nicht angewendet."}
            </p>
            {operatorControl.notice ? <p className="mt-2 text-sm font-medium">{operatorControl.notice}</p> : null}
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <div><dt className="text-text-muted">Verfügbarkeit</dt><dd className="font-bold">{operatorControl.availability}</dd></div>
            <div><dt className="text-text-muted">Plan</dt><dd className="font-bold">{operatorControl.plan}</dd></div>
            <div><dt className="text-text-muted">Modus</dt><dd className="font-bold">{operatorControl.mode}</dd></div>
            <div><dt className="text-text-muted">Version</dt><dd className="font-bold">{operatorControl.policyVersion ?? "—"}</dd></div>
          </dl>
        </div>
      </section>

      {overview.availability === "unavailable" && (
        <AvailabilityNotice>Nutzungsdaten konnten nicht geladen werden. Es werden keine Ersatz- oder Demodaten angezeigt.</AvailabilityNotice>
      )}
      {overview.availability === "empty" && (
        <AvailabilityNotice>Für diesen Mandanten liegen in den letzten sieben Tagen noch keine gespeicherten Nutzungsereignisse vor.</AvailabilityNotice>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-neutral-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-start justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-muted">Ereignisse (7 Tage)</h3>
            <Activity className="h-5 w-5" />
          </div>
          <span className="text-3xl font-black">{eventCount}</span>
          <p className="mt-1 text-xs font-medium text-text-muted">dauerhaft bestätigt</p>
        </div>

        <div className="rounded-2xl border border-neutral-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-start justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-muted">Aktive Pseudonyme</h3>
            <Users className="h-5 w-5" />
          </div>
          <span className="text-3xl font-black">{overview.activeUsers}</span>
          <p className="mt-1 text-xs font-medium text-text-muted">
            Rollen: {overview.activeRoles.length > 0 ? overview.activeRoles.join(", ") : "keine"}
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-start justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-muted">Meistgenutzt</h3>
            <TrendingUp className="h-5 w-5" />
          </div>
          <span className="block truncate text-xl font-bold">{overview.topEvents[0]?.name || "Keine Daten"}</span>
          <p className="mt-1 text-xs font-medium text-text-muted">Route oder Aktion</p>
        </div>

        <div className="rounded-2xl border border-neutral-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-start justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-muted">Letztes Ereignis</h3>
            <MousePointer2 className="h-5 w-5" />
          </div>
          <span className="text-base font-bold">{formatLastActive(overview.lastActive)}</span>
          <p className="mt-1 text-xs font-medium text-text-muted">Serverbestätigte Zeit</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="flex flex-col overflow-hidden rounded-2xl border border-neutral-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 bg-navy-900 p-4 text-white">
            <Lightbulb className="h-5 w-5 text-kreile-yellow" />
            <h2 className="font-serif text-lg font-bold">Verbesserungsvorschläge</h2>
          </div>
          <div className="flex-1 bg-bg-app-soft">
            {suggestions.length === 0 ? (
              <p className="p-5 text-sm text-text-muted">
                Automatische Empfehlungen sind noch nicht instrumentiert. Aus Nutzungszahlen werden keine unbelegten Vorschläge erzeugt.
              </p>
            ) : (
              <ul className="divide-y divide-neutral-gray-200">
                {suggestions.map((suggestion) => (
                  <li key={suggestion.id}>
                    <button
                      type="button"
                      onClick={() => setActiveSuggestion(suggestion)}
                      className="group flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-white"
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold">{suggestion.recommendation}</h4>
                        <p className="mt-1 truncate text-xs text-text-muted">Beobachtung: {suggestion.signal}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-neutral-gray-400" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="flex flex-col overflow-hidden rounded-2xl border border-neutral-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-error-red/20 bg-error-red/10 p-4 text-error-red">
            <AlertCircle className="h-5 w-5" />
            <h2 className="font-serif text-lg font-bold">Friktionsanalyse</h2>
          </div>
          <div className="flex-1 p-4">
            {frictionAnalysis.length === 0 ? (
              <p className="text-sm text-text-muted">
                Abbruchgründe und Sequenzen sind noch nicht instrumentiert. Ein fehlendes Signal wird nicht als reibungsloser Ablauf ausgegeben.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {frictionAnalysis.map((signal) => (
                  <button
                    key={signal.id}
                    type="button"
                    onClick={() => setActiveFriction(signal)}
                    className="rounded-xl border border-neutral-gray-200 bg-bg-app-soft p-4 text-left transition hover:border-error-red/30"
                  >
                    <h4 className="mb-2 text-sm font-bold">{signal.title}</h4>
                    <p className="text-xs text-text-muted">{signal.detail}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <EventsBarChart data={overview.topEvents} />
            <ActivityLineChart data={overview.activityData} />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-neutral-gray-200 bg-white shadow-sm lg:col-span-1">
          <div className="flex items-center gap-2 border-b border-neutral-gray-100 p-4">
            <Smartphone className="h-5 w-5" />
            <h3 className="font-serif text-lg font-bold">Geräteklassen</h3>
          </div>
          <div className="p-6 text-center">
            <div className="mb-4 flex justify-center">
              <MonitorSmartphone className="h-16 w-16 text-neutral-gray-300" />
            </div>
            <p className="mb-4 text-xs text-text-muted">{devices.message}</p>
            <ul className="space-y-3">
              {devices.stats.map((device: DeviceUsage) => (
                <li key={device.name} className="flex items-center justify-between">
                  <span className="text-sm font-bold">{device.name}</span>
                  <span className="rounded-md bg-bg-app-soft px-2 py-1 text-sm text-text-muted">{device.value}% der Events</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <DetailOverlay
        open={Boolean(activeSuggestion)}
        onClose={() => setActiveSuggestion(null)}
        title="Verbesserungsvorschlag"
        subtitle={activeSuggestion?.page}
      >
        {activeSuggestion && (
          <div className="space-y-4 text-sm">
            <h4 className="font-bold">{activeSuggestion.recommendation}</h4>
            <p className="text-text-muted">Beobachtetes Signal: {activeSuggestion.signal}</p>
            <p className="text-text-muted">{activeSuggestion.reason}</p>
          </div>
        )}
      </DetailOverlay>

      <DetailOverlay
        open={Boolean(activeFriction)}
        onClose={() => setActiveFriction(null)}
        title="Friktionssignal"
        subtitle={activeFriction?.page}
      >
        {activeFriction && (
          <div className="space-y-3 text-sm">
            <h4 className="font-bold text-error-red">{activeFriction.title}</h4>
            <p className="text-text-muted">{activeFriction.detail}</p>
            <p className="text-xs text-text-muted">Es werden ausschließlich gespeicherte, strukturierte Messwerte angezeigt.</p>
          </div>
        )}
      </DetailOverlay>

      <FeedbackFooter pageTitle="Analytics" route="/admin/analytics" variant="full" />
    </div>
  );
}
