import { Suspense } from "react";
import ArchivePage from "@/app/archive/page";
import PerformancePage from "@/app/performance/page";
import { KontrolleTabsClient } from "./KontrolleTabsClient";

interface KontrollePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function KontrolleTabsPage({ searchParams }: KontrollePageProps) {
  const params = await searchParams;
  const activeTab = typeof params.tab === "string" ? params.tab : "kontrolle";

  return (
    <Suspense fallback={<div className="p-12 text-center text-text-muted">Lade...</div>}>
      <KontrolleTabsClient 
        activeTab={activeTab}
        archiveTab={<ArchivePage />}
        performanceTab={<PerformancePage />}
      />
    </Suspense>
  );
}
