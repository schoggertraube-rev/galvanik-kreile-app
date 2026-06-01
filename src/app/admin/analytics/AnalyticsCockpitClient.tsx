"use client";

import React, { useState } from 'react';
import { PageHeader } from "@/components/ui/PageHeader";
import { DetailOverlay } from "@/components/ui/DetailOverlay";
import { EventsBarChart, ActivityLineChart } from "./AnalyticsCharts";
import { 
  BarChart2, AlertCircle, Lightbulb, Smartphone, 
  MousePointerClick, UserX, SearchX, Activity, ArrowRight,
  TrendingUp, Users, MonitorSmartphone, MousePointer2
} from "lucide-react";

import type { DeveloperCockpitData, AnalyticsSuggestion, FrictionSignal, DeviceUsage } from "@/app/actions/developerAnalytics.actions";

export function AnalyticsCockpitClient({ data }: { data: DeveloperCockpitData }) {
  const [activeSuggestion, setActiveSuggestion] = useState<AnalyticsSuggestion | null>(null);
  const [activeFriction, setActiveFriction] = useState<FrictionSignal | null>(null);

  const { overview, frictionAnalysis, suggestions, devices } = data;

  return (
    <div className="space-y-8 pb-12 font-sans antialiased text-navy-900 w-full max-w-7xl mx-auto">
      <PageHeader
        title="Developer Analytics 2.0"
        subtitle="Entwickler-Cockpit: UI-Verbesserungen abgeleitet aus echter App-Nutzung."
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-neutral-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider">Aktivität (7 Tage)</h3>
            <Activity className="w-5 h-5 text-navy-900" />
          </div>
          <span className="text-3xl font-black text-navy-900">
            {overview.activityData.reduce((acc: number, val: {events: number}) => acc + val.events, 0)}
          </span>
          <p className="text-xs text-text-muted mt-1 font-medium">Events aufgezeichnet</p>
        </div>
        
        <div className="bg-white border border-neutral-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider">Aktive Nutzer</h3>
            <Users className="w-5 h-5 text-navy-900" />
          </div>
          <span className="text-3xl font-black text-navy-900">{overview.activeUsers}</span>
          <p className="text-xs text-text-muted mt-1 font-medium">Rollen: {overview.activeRoles.join(", ")}</p>
        </div>

        <div className="bg-white border border-neutral-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider">Meistgenutzt</h3>
            <TrendingUp className="w-5 h-5 text-navy-900" />
          </div>
          <span className="text-xl font-bold text-navy-900 truncate block">
            {overview.topEvents[0]?.name?.split(":")[1]?.trim() || "N/A"}
          </span>
          <p className="text-xs text-text-muted mt-1 font-medium">Top Route / Aktion</p>
        </div>

        <div className="bg-white border border-neutral-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider">Letztes Event</h3>
            <MousePointer2 className="w-5 h-5 text-navy-900" />
          </div>
          <span className="text-lg font-bold text-navy-900">{overview.lastActive}</span>
          <p className="text-xs text-text-muted mt-1 font-medium">Uhrzeit</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* A) Automatische Verbesserungsvorschläge */}
        <section className="bg-white border border-neutral-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="bg-navy-900 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <Lightbulb className="w-5 h-5 text-kreile-yellow" />
              <h2 className="font-bold font-serif text-lg">UI-Verbesserungsvorschläge</h2>
            </div>
            <span className="bg-white/20 text-white text-xs px-2 py-1 rounded font-bold">Aus Daten abgeleitet</span>
          </div>
          <div className="p-0 flex-1 bg-bg-app-soft">
            <ul className="divide-y divide-neutral-gray-200">
              {suggestions.map((sugg: AnalyticsSuggestion) => (
                <li key={sugg.id}>
                  <button 
                    onClick={() => setActiveSuggestion(sugg)}
                    className="w-full text-left p-4 hover:bg-white transition-colors flex items-start gap-3 group"
                  >
                    <div className={`mt-1 shrink-0 w-3 h-3 rounded-full ${sugg.priority === 'hoch' ? 'bg-error-red' : sugg.priority === 'mittel' ? 'bg-accent-orange' : 'bg-neutral-gray-400'}`} />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-navy-900 text-sm group-hover:text-kreile-yellow transition-colors">{sugg.recommendation}</h4>
                      <p className="text-xs text-text-muted mt-1 truncate">Beobachtung: {sugg.signal}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-neutral-gray-400 group-hover:text-navy-900 shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* B) Friktionsanalyse */}
        <section className="bg-white border border-neutral-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="bg-error-red/10 p-4 flex items-center justify-between border-b border-error-red/20">
            <div className="flex items-center gap-2 text-error-red">
              <AlertCircle className="w-5 h-5" />
              <h2 className="font-bold font-serif text-lg">Friktionsanalyse</h2>
            </div>
            <span className="bg-error-red text-white text-xs px-2 py-1 rounded font-bold">Demo-Auswertung</span>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
            {frictionAnalysis.map((f: FrictionSignal) => (
              <div key={f.id} onClick={() => setActiveFriction(f)} className="bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-200 hover:border-error-red/30 hover:shadow-sm transition-all cursor-pointer">
                <div className="flex items-center gap-2 mb-2">
                  {f.title.includes("Abbrüche") ? <UserX className="w-4 h-4 text-error-red" /> : 
                   f.title.includes("Suchen") ? <SearchX className="w-4 h-4 text-accent-orange" /> : 
                   <MousePointerClick className="w-4 h-4 text-text-muted" />}
                  <h4 className="font-bold text-sm text-navy-900">{f.title}</h4>
                </div>
                <p className="text-xs text-text-muted">{f.detail}</p>
              </div>
            ))}
          </div>
        </section>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* C) Vorhandene Charts (Übersicht) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
             <EventsBarChart data={overview.topEvents} />
             <ActivityLineChart data={overview.activityData} />
          </div>
        </div>

        {/* D) Geräte/Sessions */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-neutral-gray-200 rounded-2xl shadow-sm overflow-hidden h-full">
             <div className="p-4 border-b border-neutral-gray-100 flex items-center gap-2">
               <Smartphone className="w-5 h-5 text-navy-900" />
               <h3 className="font-bold font-serif text-lg text-navy-900">Geräte & Viewports</h3>
             </div>
             <div className="p-6 text-center">
               {!devices.connected && (
                 <div className="bg-warning-yellow/10 text-warning-yellow-dark text-sm p-4 rounded-xl border border-warning-yellow/30 mb-6 font-medium">
                   {devices.message}
                 </div>
               )}
               <div className="flex justify-center mb-4">
                 <MonitorSmartphone className="w-16 h-16 text-neutral-gray-300" />
               </div>
               <ul className="space-y-3">
                 {devices.stats.map((d: DeviceUsage) => (
                   <li key={d.name} className="flex items-center justify-between">
                     <span className="text-sm font-bold text-navy-900">{d.name}</span>
                     <span className="text-sm bg-bg-app-soft px-2 py-1 rounded-md text-text-muted">{d.value}%</span>
                   </li>
                 ))}
               </ul>
             </div>
          </div>
        </div>

      </div>

      {/* Drilldown: Suggestion DetailOverlay */}
      <DetailOverlay open={!!activeSuggestion} onClose={() => setActiveSuggestion(null)} title="Verbesserungsvorschlag" subtitle={activeSuggestion?.page}>
        {activeSuggestion && (
          <div className="space-y-6 text-navy-900">
            <div className={`p-4 rounded-xl border flex gap-3 ${activeSuggestion.priority === 'hoch' ? 'bg-error-red/10 border-error-red/20' : activeSuggestion.priority === 'mittel' ? 'bg-accent-orange/10 border-accent-orange/20' : 'bg-neutral-gray-100 border-neutral-gray-200'}`}>
              <Lightbulb className={`w-5 h-5 shrink-0 mt-0.5 ${activeSuggestion.priority === 'hoch' ? 'text-error-red' : activeSuggestion.priority === 'mittel' ? 'text-accent-orange' : 'text-text-muted'}`} />
              <div>
                <h4 className="font-bold">Maßnahme: {activeSuggestion.recommendation}</h4>
                <p className="text-sm mt-1 opacity-80 font-medium">Priorität: {activeSuggestion.priority.toUpperCase()} | Status: {activeSuggestion.status.toUpperCase()}</p>
              </div>
            </div>
            
            <div>
              <h4 className="font-bold mb-2 border-b border-neutral-gray-200 pb-2">Datengrundlage (Beobachtetes Signal)</h4>
              <p className="text-sm text-text-muted bg-bg-app-soft p-3 rounded-lg border border-neutral-gray-100 font-mono">
                {activeSuggestion.signal}
              </p>
            </div>
            
            <div>
              <h4 className="font-bold mb-2">Begründung für Änderung</h4>
              <p className="text-sm text-text-muted">{activeSuggestion.reason}</p>
            </div>
            
            <div className="pt-4 border-t border-neutral-gray-200 flex justify-end">
               <button onClick={() => setActiveSuggestion(null)} className="bg-navy-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-navy-800 transition-colors">
                 Verstanden
               </button>
            </div>
          </div>
        )}
      </DetailOverlay>

      {/* Drilldown: Friction DetailOverlay */}
      <DetailOverlay open={!!activeFriction} onClose={() => setActiveFriction(null)} title="Friktions-Ereignis" subtitle={activeFriction?.page}>
        {activeFriction && (
          <div className="space-y-6 text-navy-900">
            <div className="p-4 rounded-xl border bg-error-red/10 border-error-red/20 flex gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-error-red" />
              <div>
                <h4 className="font-bold text-error-red">{activeFriction.title}</h4>
                <p className="text-sm text-error-red/80 mt-1">{activeFriction.detail}</p>
              </div>
            </div>
            
            <div>
              <h4 className="font-bold mb-2 border-b border-neutral-gray-200 pb-2">Rohdaten / Sequenz (Demo)</h4>
              <div className="text-xs text-text-muted font-mono bg-bg-app-soft p-3 rounded-lg border border-neutral-gray-100 space-y-2">
                <div>[10:45:01] page_view: {activeFriction.page}</div>
                <div>[10:45:15] click: input_field</div>
                <div>[10:45:40] abort_action: cancel_button_clicked</div>
              </div>
            </div>
            
            <div className="pt-4 border-t border-neutral-gray-200 flex justify-end">
               <button onClick={() => setActiveFriction(null)} className="bg-navy-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-navy-800 transition-colors">
                 Zurück zur Übersicht
               </button>
            </div>
          </div>
        )}
      </DetailOverlay>

    </div>
  );
}
