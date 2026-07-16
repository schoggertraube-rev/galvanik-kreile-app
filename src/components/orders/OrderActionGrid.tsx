"use client";

import { useRef, useState } from "react";
import { Camera, Phone, Printer, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { StationStatusButton } from "./StationStatusButton";
import { transitionOrderProcess } from "@/app/actions/orders.actions";

export function OrderActionGrid({ 
  orderId,
  customerId,
  currentStationId,
  currentStatus,
  customerPhone,
  onCompleteStation, 
  onPrint 
}: { 
  orderId: string;
  customerId?: string;
  currentStationId: string;
  currentStatus: string;
  customerPhone?: string;
  onCompleteStation?: () => void;
  onPrint?: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const cancelRequestId = useRef<string | null>(null);

  const confirmCancellation = async () => {
    if (isSubmitting) return;
    if (confirm('Möchten Sie wirklich die Aktion "Auftrag stornieren" ausführen?')) {
      setIsSubmitting(true);
      setActionError(null);
      try {
        cancelRequestId.current ||= crypto.randomUUID();
        const result = await transitionOrderProcess({
          orderId,
          action: "cancel",
          expectedStation: currentStationId,
          clientRequestId: cancelRequestId.current,
        });
        if (!result.ok) throw new Error(result.message);
        cancelRequestId.current = null;
        if (typeof window !== "undefined") window.dispatchEvent(new Event("storage"));
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Auftrag konnte nicht storniert werden.");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const openCompletion = () => {
    if (isSubmitting || !onCompleteStation) return;
    onCompleteStation();
  };

  /*
    Nacharbeit bleibt sichtbar, aber bewusst nicht mutierend: Ohne Zielstation,
    Grund und Versionsbezug wäre ein Event allein eine fachliche Scheinwirkung.
  */
 
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-extrabold text-navy-500 uppercase tracking-widest pl-1">Schnellaktionen</h3>
      {actionError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{actionError}</div>}
      <div className="grid grid-cols-2 gap-4">
        
        <StationStatusButton 
          orderId={orderId} 
          customerId={customerId} 
          currentStationId={currentStationId} 
          currentStatus={currentStatus} 
          onCompleteStation={onCompleteStation} 
        />
        <Button onClick={onPrint} variant="outline" className="h-24 flex flex-col gap-2 rounded-2xl border-2 border-neutral-gray-100 text-navy-900 hover:bg-bg-app-soft active:scale-95 transition-all">
          <Printer className="w-6 h-6 text-navy-700" />
          <span className="font-bold">Etikett drucken</span>
        </Button>
        
        <Button disabled title="Fotoaufnahme benötigt ein ausgewähltes Auftragsteil" variant="outline" className="h-24 flex flex-col gap-2 rounded-2xl border-2 border-neutral-gray-100 text-text-muted">
          <Camera className="w-6 h-6 text-accent-orange" />
          <span className="font-bold">Teil für Foto wählen</span>
        </Button>
      </div>
      
      {/* Secondary Actions Row */}
      <div className="flex gap-4">
        {customerPhone ? (
          <a href={`tel:${customerPhone}`} className="flex-1 block">
            <Button variant="outline" className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-neutral-gray-100 text-navy-900 hover:bg-bg-app-soft font-bold h-12 active:scale-95 transition-all">
              <Phone className="w-4 h-4 text-green-600" />
              <span>Kunde anrufen</span>
            </Button>
          </a>
        ) : (
          <Button disabled title="Keine Telefonnummer hinterlegt" variant="outline" className="flex-1 flex items-center justify-center gap-2 rounded-2xl border-2 border-neutral-gray-100 text-text-muted font-bold h-12">
            <Phone className="w-4 h-4" />
            <span>Kunde anrufen</span>
          </Button>
        )}
        
        <DropdownMenu>
          <DropdownMenuTrigger className="flex-1 text-navy-500 hover:bg-neutral-gray-100 hover:text-navy-900 font-bold h-12 rounded-lg flex items-center justify-center border border-transparent transition-colors outline-none cursor-pointer">
            <MoreHorizontal className="w-5 h-5 mr-2" /> Weitere
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled title="Benötigt Zielstation, Grund und Versionsbezug" className="font-bold text-text-muted">
              Nacharbeit starten · noch nicht sicher angebunden
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!onCompleteStation || isSubmitting} onClick={openCompletion} className="cursor-pointer font-bold text-navy-700">
              Prozessschritt abschließen
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={isSubmitting} onClick={() => void confirmCancellation()} className="cursor-pointer font-bold text-danger-red">
              Auftrag stornieren
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

      </div>
    </div>
  );
}
