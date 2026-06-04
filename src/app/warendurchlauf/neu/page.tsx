"use client";

import { Suspense } from "react";
import { WarendurchlaufIntakeWizard } from "@/components/warendurchlauf/WarendurchlaufIntakeWizard";

export default function NeuerWarendurchlaufPage() {
  return (
    <Suspense fallback={<div>Lade...</div>}>
      <WarendurchlaufIntakeWizard />
    </Suspense>
  );
}
