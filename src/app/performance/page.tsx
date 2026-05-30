import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { getOrdersKPIs, getInquiriesFunnel, getUsageStats } from "@/app/actions/performance.actions";
import { EventsBarChart, ActivityLineChart, FunnelPieChart } from "./PerformanceCharts";
import { ArrowUpRight, ArrowDownRight, Clock, PackageCheck, AlertCircle, FileText } from "lucide-react";

export default async function PerformancePage() {
  const [ordersData, funnelData, usageData] = await Promise.all([
    getOrdersKPIs(),
    getInquiriesFunnel(),
    getUsageStats()
  ]);

  const isPositiveTrend = ordersData.completedThisWeek.percentChange >= 0;

  return (
    <div className="space-y-8 pb-12 font-sans antialiased text-navy-900 w-full">
      <PageHeader
        title="Werkstatt-Performance & Analyse"
        subtitle="Live-Metriken aus laufenden Aufträgen und Nutzeraktivitäten."
      />

      {/* BEREICH 1 — Auftrags-KPIs */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold font-serif text-navy-900 border-b border-neutral-gray-100 pb-2">1. Auftrags-KPIs</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-sm">
            <CardContent className="p-5 flex flex-col gap-2">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-xs font-bold uppercase tracking-wider">Offene Aufträge</span>
                <PackageCheck className="w-4 h-4" />
              </div>
              <div className="text-3xl font-black text-navy-900">{ordersData.openCount}</div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-5 flex flex-col gap-2">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-xs font-bold uppercase tracking-wider">Überfällig</span>
                <AlertCircle className="w-4 h-4 text-danger-red" />
              </div>
              <div className="text-3xl font-black text-danger-red">{ordersData.overdueCount}</div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-5 flex flex-col gap-2">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-xs font-bold uppercase tracking-wider">Ø Durchlaufzeit</span>
                <Clock className="w-4 h-4" />
              </div>
              <div className="text-3xl font-black text-navy-900">{ordersData.avgCycleTime} <span className="text-lg font-medium text-text-muted">Tage</span></div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-5 flex flex-col gap-2">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-xs font-bold uppercase tracking-wider">Diese Woche fertig</span>
                {isPositiveTrend ? <ArrowUpRight className="w-4 h-4 text-success-green" /> : <ArrowDownRight className="w-4 h-4 text-danger-red" />}
              </div>
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-black text-navy-900">{ordersData.completedThisWeek.count}</div>
                <div className={`text-xs font-bold ${isPositiveTrend ? "text-success-green" : "text-danger-red"}`}>
                  {isPositiveTrend ? "+" : ""}{ordersData.completedThisWeek.percentChange}%
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* BEREICH 2 — Anfragen-Funnel */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold font-serif text-navy-900 border-b border-neutral-gray-100 pb-2">2. Anfragen-Funnel</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          <Card className="shadow-sm lg:col-span-1">
            <CardContent className="p-5 flex flex-col justify-center h-full gap-4">
               <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1">Offene Anfragen</div>
                  <div className="text-3xl font-black text-navy-900">{funnelData.openCount}</div>
               </div>
               <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1">Conversion-Rate (90 Tage)</div>
                  <div className="text-3xl font-black text-success-green">{funnelData.conversionRate}%</div>
               </div>
               <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-text-muted mb-1">Ø Angebotswert</div>
                  <div className="text-3xl font-black text-navy-900">{funnelData.avgValue} €</div>
               </div>
            </CardContent>
          </Card>

          <div className="lg:col-span-2">
             <FunnelPieChart 
               open={funnelData.openCount} 
               accepted={Math.round((funnelData.conversionRate / 100) * (funnelData.openCount > 0 ? funnelData.openCount * 2 : 10))} 
             />
          </div>
        </div>
      </section>

      {/* BEREICH 3 — Nutzungsstatistik */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold font-serif text-navy-900 border-b border-neutral-gray-100 pb-2">3. App-Nutzung</h2>
        
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

    </div>
  );
}
