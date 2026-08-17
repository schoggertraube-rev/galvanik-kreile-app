"use client";

import { usePageView } from "@/hooks/usePageView";
import { CameraCapture } from "@/components/intake/CameraCapture";
import { PageHeader } from "@/components/ui/PageHeader";

export default function ScanPage() {
  usePageView();

  return (
    <div className="max-w-3xl mx-auto p-4">
      <PageHeader title="Scan & KI‑Erfassung" subtitle="Dokumente, Lieferscheine oder Bauteile – mit KI schnell erfassen" />
      <p className="my-4 rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">NOT_AVAILABLE: Auftragserstellung benötigt den W3-Command-Vertrag.</p>
      <CameraCapture onScanComplete={() => {}} />
    </div>
  );
}
