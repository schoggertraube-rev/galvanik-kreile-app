import { useRef } from "react";
import { Camera, Phone, Printer, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { eventsRepository } from "@/lib/repositories/eventsRepository";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
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
 
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-extrabold text-navy-500 uppercase tracking-widest pl-1">Schnellaktionen</h3>
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
        
        <input 
          type="file" 
          accept="image/*" 
          capture="environment" 
          className="hidden" 
          ref={fileInputRef} 
          onChange={handlePhotoCapture} 
        />
        <Button title="Foto aufnehmen" onClick={() => fileInputRef.current?.click()} variant="outline" className="h-24 flex flex-col gap-2 rounded-2xl border-2 border-neutral-gray-100 text-navy-900 hover:bg-bg-app-soft active:scale-95 transition-all">
          <Camera className="w-6 h-6 text-accent-orange" />
          <span className="font-bold">Foto aufnehmen</span>
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
          <DropdownMenuTrigger disabled title="NOT_AVAILABLE: Mehrstufige Auftragsaktionen sind gesperrt" className="flex-1 text-text-muted font-bold h-12 rounded-lg flex items-center justify-center border border-transparent transition-colors outline-none disabled:cursor-not-allowed">
            <MoreHorizontal className="w-5 h-5 mr-2" /> Weitere
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled className="font-bold">
              Nacharbeit starten
            </DropdownMenuItem>
            <DropdownMenuItem disabled className="font-bold text-navy-700">
              Auftrag schließen
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="font-bold text-danger-red">
              Auftrag stornieren
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

      </div>
    </div>
  );
}
