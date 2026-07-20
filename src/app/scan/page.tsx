"use client";

import { ScanUpload } from "@/components/erfassung/ScanFlow/ScanUpload";
import { PageHeader } from "@/components/ui/PageHeader";
import { usePageView } from "@/hooks/usePageView";

/**
 * Legacy route kept as a stable entry point. It deliberately delegates to the
 * canonical capture flow: the original is stored and identified before OCR is
 * attempted, so every derived order can retain a durable sourceRef.
 */
export default function ScanPage() {
  usePageView();

  return (
    <div className="mx-auto max-w-3xl p-4">
      <PageHeader
        title="Scan & KI-Erfassung"
        subtitle="Original sichern, anschließend auswerten und fachlich bestätigen"
      />
      <ScanUpload />
    </div>
  );
}
