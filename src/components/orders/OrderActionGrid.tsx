import { useState, useRef } from "react";
import { Play, CheckCircle, Camera, Phone, Printer, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { eventsRepository } from "@/lib/repositories/eventsRepository";
import { ordersRepository } from "@/lib/repositories/ordersRepository";
import { STATION_CONFIGS } from "@/constants/stations";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

export function OrderActionGrid({ 
  orderId,
  customerId,
  currentStationId,
  customerPhone,
  onCompleteStation, 
  onPrint 
}: { 
  orderId: string;
  customerId?: string;
  currentStationId: string;
  customerPhone?: string;
  onCompleteStation?: () => void;
  onPrint?: () => void;
}) {
  const [isStarting, setIsStarting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleStartStation = async () => {
    setIsStarting(true);
  };

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
      } else if (status === "cancelled") {
        await ordersRepository.updateOrder(orderId, { status: "cancelled" });
        await eventsRepository.addEvent({ orderId, customerId, eventType: "QUALITY_CHECK_FAILED" });
      } else {
        await ordersRepository.updateOrder(orderId, { status: "completed" });
        await eventsRepository.addEvent({ orderId, customerId, eventType: "STATION_COMPLETED" });
      }
      if (typeof window !== "undefined") window.dispatchEvent(new Event("storage"));
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-extrabold text-slate-500 uppercase tracking-widest pl-1">Schnellaktionen</h3>
      <div className="grid grid-cols-2 gap-4">
        
        {isStarting ? (
          <div className="h-24 flex flex-col justify-center gap-2 rounded-2xl bg-blue-50 border-2 border-blue-600 p-2">
            <select className="w-full text-xs p-1 rounded" id="startStationSelect" defaultValue={currentStationId}>
              {Object.values(STATION_CONFIGS).map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
            </select>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setIsStarting(false)} className="flex-1 h-6 text-xs px-0">Abbrechen</Button>
              <Button size="sm" className="flex-1 h-6 text-xs bg-blue-600 text-white px-0" onClick={async () => {
                const sel = (document.getElementById("startStationSelect") as HTMLSelectElement).value;
                await ordersRepository.updateOrder(orderId, { currentStationId: sel, station: sel, status: "in_progress" });
                await eventsRepository.addEvent({ orderId, customerId, eventType: "STATION_STARTED", metadata: { stationId: sel } });
                if (typeof window !== "undefined") window.dispatchEvent(new Event("storage"));
                setIsStarting(false);
              }}>Starten</Button>
            </div>
          </div>
        ) : (
          <Button disabled title="In Entwicklung" onClick={handleStartStation} className="h-24 flex flex-col gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white shadow-lg active:scale-95 transition-all opacity-50">
            <Play className="w-6 h-6" />
            <span className="font-bold">Station starten</span>
          </Button>
        )}

        <Button onClick={onCompleteStation} className="h-24 flex flex-col gap-2 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white shadow-lg active:scale-95 transition-all">
          <CheckCircle className="w-6 h-6" />
          <span className="font-bold">Station abschließen</span>
        </Button>
        <Button onClick={onPrint} variant="outline" className="h-24 flex flex-col gap-2 rounded-2xl border-2 border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95 transition-all">
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
        <Button disabled title="In Entwicklung" onClick={() => fileInputRef.current?.click()} variant="outline" className="h-24 flex flex-col gap-2 rounded-2xl border-2 border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95 transition-all opacity-50">
          <Camera className="w-6 h-6 text-orange-500" />
          <span className="font-bold">Foto aufnehmen</span>
        </Button>
      </div>
      
      {/* Secondary Actions Row */}
      <div className="flex gap-4">
        {customerPhone ? (
          <a href={`tel:${customerPhone}`} className="flex-1 block">
            <Button variant="outline" className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 text-slate-700 hover:bg-slate-50 font-bold h-12 active:scale-95 transition-all">
              <Phone className="w-4 h-4 text-green-600" />
              <span>Kunde anrufen</span>
            </Button>
          </a>
        ) : (
          <Button disabled title="Keine Telefonnummer hinterlegt" variant="outline" className="flex-1 flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 text-slate-400 font-bold h-12">
            <Phone className="w-4 h-4" />
            <span>Kunde anrufen</span>
          </Button>
        )}
        
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="ghost" className="flex-1 text-slate-500 hover:text-slate-800 font-bold h-12">
              <MoreHorizontal className="w-5 h-5 mr-2" /> Weitere
            </Button>
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
