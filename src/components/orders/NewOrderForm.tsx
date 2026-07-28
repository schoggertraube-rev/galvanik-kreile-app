"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NewOrderFormProps {
  onClose: () => void;
  customerId: string;
  customerName: string;
  ocrData?: Record<string, string>;
  previewUrl?: string;
  onSuccess?: () => void;
}

/** No scan/browser upload is converted into a product order without a receipt. */
export function NewOrderForm({ onClose }: NewOrderFormProps) {
  return (
    <section className="mx-auto max-w-md rounded-2xl border border-amber-500/30 bg-amber-50 p-6 text-center text-amber-950">
      <AlertTriangle className="mx-auto h-8 w-8" />
      <h2 className="mt-3 text-lg font-bold">Auftragserfassung ist noch nicht freigegeben</h2>
      <p className="mt-2 text-sm">Die frühere Form konnte Browserdateien und OCR-Vorschläge als gespeicherten Auftrag ausgeben. Ohne Upload-, Kunden- und Receipt-Vertrag wird nichts angelegt.</p>
      <Button className="mt-5" variant="outline" onClick={onClose}>Schließen</Button>
    </section>
  );
}
