"use client";

import { usePageView } from "@/hooks/usePageView";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";
import { SectionHeader } from "@/app/buchhaltung/components/SectionHeader";
import { TermintreueKachel } from "./components/TermintreueKachel";
import { DurchlaufzeitKachel } from "./components/DurchlaufzeitKachel";
import { EngpassKachel } from "./components/EngpassKachel";
import { OffeneAuftraegeKachel } from "./components/OffeneAuftraegeKachel";
import Link from "next/link";
import { ArrowRight, Box, Settings } from "lucide-react";

export function WarendurchlaufCockpitClient({ data }: { data: any }) {
  usePageView();

  return (
    <div className="w-full pb-24 px-4 sm:px-6 xl:px-8 font-sans">
      <SectionHeader 
        title="Warendurchlauf" 
        icon={<Box className="w-5 h-5 text-navy-900" />} 
        iconBg="bg-neutral-gray-200" 
      />
      {/* Hero Links to Stations */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <Link href="/warendurchlauf/wareneingang" className="bg-navy-900 text-white rounded-3xl p-6 flex items-center justify-between group hover:bg-navy-800 transition-colors shadow-md">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
              <Box className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="block font-bold text-lg">Wareneingang</span>
              <span className="text-xs text-white/70">Erfassung & Anlage</span>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-white/50 group-hover:text-white transition-colors" />
        </Link>

        <Link href="/warendurchlauf/galvanik" className="bg-navy-900 text-white rounded-3xl p-6 flex items-center justify-between group hover:bg-navy-800 transition-colors shadow-md">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="block font-bold text-lg">Galvanik</span>
              <span className="text-xs text-white/70">Gestell & Trommel</span>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-white/50 group-hover:text-white transition-colors" />
        </Link>

        <Link href="/warendurchlauf/warenausgang" className="bg-navy-900 text-white rounded-3xl p-6 flex items-center justify-between group hover:bg-navy-800 transition-colors shadow-md">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
              <Box className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="block font-bold text-lg">Warenausgang</span>
              <span className="text-xs text-white/70">Versand & Abschluss</span>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-white/50 group-hover:text-white transition-colors" />
        </Link>
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
