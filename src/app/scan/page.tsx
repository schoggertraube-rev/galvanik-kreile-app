"use client";

import { usePageView } from "@/hooks/usePageView";
import { PageHeader } from "@/components/ui/PageHeader";
import { AlertTriangle } from "lucide-react";

export default function ScanPage() {
  usePageView();

  return (
    <div className="max-w-3xl mx-auto p-4">
      <PageHeader title="Scan & KI‑Erfassung" subtitle="Dokumente, Lieferscheine oder Bauteile – mit KI schnell erfassen" />
      
      <div className="mb-4 p-6 bg-[#FFF8E1] text-[#F57F17] rounded-3xl shadow-sm border border-[#FFECB3] flex flex-col items-center justify-center gap-4 text-center">
        <AlertTriangle className="w-12 h-12 shrink-0" />
        <h3 className="text-xl font-bold">Dieser alte Scanpfad wurde auf den gesicherten Erfassungsweg umgestellt.</h3>
        <p className="text-navy-900 font-medium">
          Bitte nutzen Sie den neuen, gesicherten Scan-Upload für alle Erfassungen.
        </p>
      </div>
    </div>
  );
}
