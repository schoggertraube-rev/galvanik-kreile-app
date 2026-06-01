import { PageHeader } from "@/components/ui/PageHeader";
import { getUsageStats } from "@/app/actions/performance.actions";
import { EventsBarChart, ActivityLineChart } from "./AnalyticsCharts";
import { FileText } from "lucide-react";

export default async function AnalyticsPage() {
  const usageData = await getUsageStats();

  return (
    <div className="space-y-8 pb-12 font-sans antialiased text-navy-900 w-full">
      <PageHeader
        title="App-Nutzungsanalyse"
        subtitle="Entwickler- & Admin-Bereich: Auswertung der Nutzeraktivitäten im System."
      />

      <section className="space-y-4">
        <h2 className="text-xl font-bold font-serif text-navy-900 border-b border-neutral-gray-100 pb-2">App-Nutzung</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
           <EventsBarChart data={usageData.topEvents} />
           <ActivityLineChart data={usageData.activityData} />
        </div>

        <div className="flex items-center gap-2 text-sm text-text-muted bg-bg-app-soft p-3 rounded-xl border border-neutral-gray-100 w-fit">
           <FileText className="w-4 h-4" />
           <span className="font-semibold">Letzte Aktivit&auml;t im System:</span>
           <span className="font-bold text-navy-900">{usageData.lastActive}</span>
        </div>
      </section>
    </div>
  );
}
