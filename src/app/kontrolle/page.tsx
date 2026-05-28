"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFeatureFlag } from "@/lib/license/useFeatureFlag";
import ArchivePage from "@/app/archive/page";
import PerformancePage from "@/app/performance/page";
import { Suspense } from "react";

function KontrolleTabsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get("tab") || "kontrolle";

  const performanceFeature = useFeatureFlag("performance_score");

  const handleTabChange = (val: string) => {
    // If the performance feature is disabled, prevent switching to it
    if (val === "performance" && !performanceFeature.available) {
      return;
    }
    router.replace(`/kontrolle?tab=${val}`);
  };

  return (
    <div className="space-y-6 pb-12 font-sans antialiased text-navy-900 max-w-6xl mx-auto pt-6">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6 bg-bg-app-soft p-1">
          <TabsTrigger 
            value="kontrolle" 
            className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-navy-900"
          >
            Kontrolle
          </TabsTrigger>
          <TabsTrigger 
            value="performance"
            disabled={!performanceFeature.available}
            className={`data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-navy-900 ${
              !performanceFeature.available ? "opacity-40 grayscale cursor-not-allowed" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              Performance
              {!performanceFeature.available && (
                <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-neutral-gray-300" />
              )}
            </div>
          </TabsTrigger>
          <TabsTrigger 
            value="archiv"
            className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-navy-900"
          >
            Archiv
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="kontrolle" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
          <div className="border border-neutral-gray-100 rounded-xl bg-white p-2">
            <ArchivePage />
          </div>
        </TabsContent>
        
        <TabsContent value="performance" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
          <div className="border border-neutral-gray-100 rounded-xl bg-white p-2">
             {performanceFeature.available ? (
               <PerformancePage />
             ) : (
               <div className="p-12 text-center text-text-muted">
                 Performance ist in dieser Lizenz nicht verfügbar.
               </div>
             )}
          </div>
        </TabsContent>
        
        <TabsContent value="archiv" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
          <div className="border border-neutral-gray-100 rounded-xl bg-white p-2">
            <ArchivePage />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function KontrolleTabsPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-text-muted">Lade...</div>}>
      <KontrolleTabsContent />
    </Suspense>
  );
}
