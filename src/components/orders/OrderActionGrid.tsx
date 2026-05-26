import { useRef } from "react";
import { Camera, Phone, Printer, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { eventsRepository } from "@/lib/repositories/eventsRepository";
import { ordersRepository } from "@/lib/repositories/ordersRepository";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { createStatusEvent } from "@/app/actions/status-events.actions";
import { StationStatusButton } from "./StationStatusButton";

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
  const fileInputRef = useRef<HTMLInputElement>(null);
 
  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
 
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 800;
        let w = img.width;
        let h = img.height;
        if (w > h && w > maxDim) {
          h = Math.round((maxDim / w) * h);
          w = maxDim;
        } else if (h > maxDim) {
          w = Math.round((maxDim / h) * w);
          h = maxDim;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(async (blob) => {
            if (blob) {
              const base64 = await new Promise<string>((resolve) => {
                const r = new FileReader();
                r.onloadend = () => resolve(r.result as string);
                r.readAsDataURL(blob);
              });
              
              localStorage.setItem(`kreile_photo_${orderId}_${Date.now()}`, base64);
              
              await eventsRepository.addEvent({
                orderId, customerId,
                eventType: "PHOTO_CAPTURED",
                metadata: { timestamp: new Date().toISOString() }
              });
 
              if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("storage"));
              }
              alert("Foto erfolgreich gespeichert!");
            }
          }, "image/jpeg", 0.6);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };
 
    const confirmAction = async (action: string, status: "completed" | "cancelled" | "rework") => {
    if (confirm(`Möchten Sie wirklich die Aktion "${action}" ausführen?`)) {
      if (status === "rework") {
        await eventsRepository.addEvent({ orderId, customerId, eventType: "REWORK_STARTED" });
        createStatusEvent({ orderId, eventType: "REWORK_STARTED" }).catch(e => console.warn(e));
      } else if (status === "cancelled") {
        await ordersRepository.updateOrder(orderId, { status: "cancelled" });
        await eventsRepository.addEvent({ orderId, customerId, eventType: "QUALITY_CHECK_FAILED" });
        createStatusEvent({ orderId, eventType: "QUALITY_CHECK_FAILED" }).catch(e => console.warn(e));
      } else {
        await ordersRepository.updateOrder(orderId, { status: "completed" });
        await eventsRepository.addEvent({ orderId, customerId, eventType: "STATION_COMPLETED" });
        createStatusEvent({ orderId, eventType: "STATION_COMPLETED" }).catch(e => console.warn(e));
      }
      if (typeof window !== "undefined") window.dispatchEvent(new Event("storage"));
    }
  };
 
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-extrabold text-slate-500 uppercase tracking-widest pl-1">Schnellaktionen</h3>
      <div className="grid grid-cols-2 gap-4">
        
        <StationStatusButton 
          orderId={orderId} 
          customerId={customerId} 
          currentStationId={currentStationId} 
          currentStatus={currentStatus} 
          onCompleteStation={onCompleteStation} 
        />
        <Button onClick={onPrint} variant="outline" className="h-24 flex flex-col gap-2 rounded-2xl border-2 border-slate-200 text-kreile-navy hover:bg-slate-50 active:scale-95 transition-all">
          <Printer className="w-6 h-6 text-blue-600" />
          <span className="font-bold">Etikett drucken</span>
        </Button>
        
        <input 
          type="file" 
          accept="image/*" 
          capture="environment" 
          className="hidden" 
          ref={fileInputRef} 
          onChange={handlePhotoCapture} 
        />
        <Button title="Foto aufnehmen" onClick={() => fileInputRef.current?.click()} variant="outline" className="h-24 flex flex-col gap-2 rounded-2xl border-2 border-slate-200 text-kreile-navy hover:bg-slate-50 active:scale-95 transition-all">
          <Camera className="w-6 h-6 text-orange-500" />
          <span className="font-bold">Foto aufnehmen</span>
        </Button>
      </div>
      
      {/* Secondary Actions Row */}
      <div className="flex gap-4">
        {customerPhone ? (
          <a href={`tel:${customerPhone}`} className="flex-1 block">
            <Button variant="outline" className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 text-kreile-navy hover:bg-slate-50 font-bold h-12 active:scale-95 transition-all">
              <Phone className="w-4 h-4 text-green-600" />
              <span>Kunde anrufen</span>
            </Button>
          </a>
        ) : (
          <Button disabled title="Keine Telefonnummer hinterlegt" variant="outline" className="flex-1 flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 text-kreile-muted font-bold h-12">
            <Phone className="w-4 h-4" />
            <span>Kunde anrufen</span>
          </Button>
        )}
        
        <DropdownMenu>
          <DropdownMenuTrigger className="flex-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 font-bold h-12 rounded-lg flex items-center justify-center border border-transparent transition-colors outline-none cursor-pointer">
            <MoreHorizontal className="w-5 h-5 mr-2" /> Weitere
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => confirmAction("Nacharbeit starten", "rework")} className="cursor-pointer font-bold">
              Nacharbeit starten
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => confirmAction("Auftrag schließen", "completed")} className="cursor-pointer font-bold text-blue-600">
              Auftrag schließen
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => confirmAction("Auftrag stornieren", "cancelled")} className="cursor-pointer font-bold text-red-600">
              Auftrag stornieren
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

      </div>
    </div>
  );
}
