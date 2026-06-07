"use client";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BackButton } from "@/components/ui/BackButton";

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
      <div className="mb-6">
        <Breadcrumb items={[{label:'Home',href:'/'}, {label:'Warendurchlauf',href:'/warendurchlauf'}]} />
        <BackButton label="Home" href="/" />
      </div>
      
      <SectionHeader 
        title="Warendurchlauf" 
        icon={<Box className="w-5 h-5 text-navy-900" />} 
        iconBg="bg-neutral-gray-200" 
      />


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
