"use client";

import { AlertTriangle } from "lucide-react";
import { ResponsiveDetailDrawer } from "@/components/ui/ResponsiveDetailDrawer";
import { Button } from "@/components/ui/button";

interface NewCustomerFormProps {
  onClose: () => void;
  customerId?: string | null;
  previewUrl?: string;
  onSave?: (customerId: string) => void;
  inline?: boolean;
}

/**
 * Capture used to combine browser-side uploads and an incompatible customer
 * payload. Keep every caller fail-closed until its single server-side receipt
 * contract exists; no form state or local file selection is retained here.
 */
export function NewCustomerForm({ onClose, inline = false }: NewCustomerFormProps) {
  const content = (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-amber-500/30 bg-amber-50 p-8 text-center text-amber-950">
      <AlertTriangle className="h-8 w-8" />
      <h2 className="text-lg font-bold">Kundenanlage ist noch nicht freigegeben</h2>
      <p className="text-sm">Die frühere Erfassung verband Browser-Uploads, falsche Validierung und Datenbankmeldung ohne gemeinsamen Receipt-Vertrag. Es wird daher nichts lokal oder remote als gespeichert behauptet.</p>
      <Button onClick={onClose} variant="outline">Schließen</Button>
    </div>
  );

  if (inline) return content;
  return <ResponsiveDetailDrawer isOpen onClose={onClose} title="Kundenanlage">{content}</ResponsiveDetailDrawer>;
}
