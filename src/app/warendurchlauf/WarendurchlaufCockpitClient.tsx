"use client";

import { usePageView } from "@/hooks/usePageView";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";

import { TermintreueKachel } from "./components/TermintreueKachel";
import { DurchlaufzeitKachel } from "./components/DurchlaufzeitKachel";
import { EngpassKachel } from "./components/EngpassKachel";
import { OffeneAuftraegeKachel } from "./components/OffeneAuftraegeKachel";

export function WarendurchlaufCockpitClient({ data }: { data: any }) {
  usePageView();

  return (
    <div className="w-full pb-24 px-4 sm:px-6 xl:px-8 font-sans">
      <div className="flex items-center gap-3 mt-10 mb-5 px-1">
        <span className="text-base font-extrabold text-navy-900">Warendurchlauf</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 auto-rows-min mb-12">
        <TermintreueKachel data={data} />
        <DurchlaufzeitKachel data={data} />
        <EngpassKachel data={data} />
        <OffeneAuftraegeKachel data={data} />
      </div>

      <FeedbackFooter pageTitle="Warendurchlauf Cockpit" route="/warendurchlauf" variant="full" />
    </div>
  );
}
