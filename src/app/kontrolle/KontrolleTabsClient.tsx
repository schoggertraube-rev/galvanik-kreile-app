"use client";

import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFeatureFlag } from "@/lib/license/useFeatureFlag";
import { LockedCard } from "@/components/license/LockedCard";
import { ReactNode } from "react";

interface KontrolleTabsClientProps {
  activeTab: string;
  archiveTab: ReactNode;
  performanceTab: ReactNode;
}

export function KontrolleTabsClient({ activeTab, archiveTab, performanceTab }: KontrolleTabsClientProps) {
  const router = useRouter();
  
  // FeatureFlag liefert { available, lockReason, demoValue, role }
  const performanceFeature = useFeatureFlag("performance_score");
  
  // Nur Inhaber sehen die echten Metriken. Ansonsten wird es gesperrt.
  const isPerformanceAllowed = performanceFeature.available && performanceFeature.role === "inhaber";

  const handleTabChange = (val: string) => {
    // Wenn es nicht allowed ist, verhindern wir nicht zwingend den Wechsel, 
    // sondern zeigen den "Nicht verfügbar" Screen im Tab an.
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
            className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-navy-900"
          >
            <div className="flex items-center gap-2">
              Performance
              {!isPerformanceAllowed && (
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
            {archiveTab}
          </div>
        </TabsContent>
        
        <TabsContent value="performance" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
          <div className="border border-neutral-gray-100 rounded-xl bg-white p-2">
             {isPerformanceAllowed ? (
               performanceTab
             ) : (
               <LockedCard featureKey="performance_score" title="Performance Dashboard">
                 <div className="p-8 text-center text-text-muted">
                   <p>Dieses Feature ist nur für Inhaber verfügbar oder in Ihrer aktuellen Lizenz nicht enthalten.</p>
                 </div>
               </LockedCard>
             )}
          </div>
        </TabsContent>
        
        <TabsContent value="archiv" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
          <div className="border border-neutral-gray-100 rounded-xl bg-white p-2">
            {archiveTab}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
