import { PageHeader } from "@/components/ui/PageHeader";
import { getRealAnalyticsStats } from "@/app/actions/tracking.actions";
import { EventsBarChart, ActivityLineChart } from "./AnalyticsCharts";
import { FileText, Clock, User, Shield, Target } from "lucide-react";

export default async function AnalyticsPage() {
  const usageData = await getRealAnalyticsStats();

  return (
    <div className="space-y-8 pb-12 font-sans antialiased text-navy-900 w-full">
      <PageHeader
        title="App-Nutzungsanalyse"
        subtitle="Entwickler- & Admin-Bereich: Auswertung der echten Nutzeraktivitäten im System."
      />

      <section className="space-y-4">
        <h2 className="text-xl font-bold font-serif text-navy-900 border-b border-neutral-gray-100 pb-2">Übersicht</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
           <EventsBarChart data={usageData.topEvents} />
           <ActivityLineChart data={usageData.activityData} />
        </div>

        <div className="flex items-center gap-2 text-sm text-text-muted bg-bg-app-soft p-3 rounded-xl border border-neutral-gray-100 w-fit">
           <FileText className="w-4 h-4" />
           <span className="font-semibold">Letzte Aktivität im System:</span>
           <span className="font-bold text-navy-900">{usageData.lastActive}</span>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold font-serif text-navy-900 border-b border-neutral-gray-100 pb-2">Letzte Ereignisse (Top 20)</h2>
        <div className="bg-white rounded-xl border border-neutral-gray-100 overflow-hidden shadow-sm">
          <table className="w-full text-sm text-left">
            <thead className="bg-bg-app-soft text-xs text-text-muted uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold"><div className="flex items-center gap-1"><Clock className="w-3 h-3"/> Zeit</div></th>
                <th className="px-4 py-3 font-semibold"><div className="flex items-center gap-1"><User className="w-3 h-3"/> Akteur</div></th>
                <th className="px-4 py-3 font-semibold"><div className="flex items-center gap-1"><Shield className="w-3 h-3"/> Rolle</div></th>
                <th className="px-4 py-3 font-semibold"><div className="flex items-center gap-1"><Target className="w-3 h-3"/> Event</div></th>
                <th className="px-4 py-3 font-semibold">Details / Route</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-gray-100">
              {usageData.recentEvents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-text-muted">Keine Events vorhanden.</td>
                </tr>
              )}
              {usageData.recentEvents.map((evt: any) => (
                <tr key={evt.id} className="hover:bg-bg-app-soft transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-text-muted font-mono">{evt.time}</td>
                  <td className="px-4 py-3 font-medium text-navy-900">{evt.user}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-gray-100 text-navy-900">
                      {evt.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                      {evt.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-muted truncate max-w-xs" title={evt.detail}>{evt.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
