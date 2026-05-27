import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Minus, X, Search, Package, Check } from "lucide-react";
import { inventoryRepository, InventoryItem } from "@/lib/repositories/inventoryRepository";
import { eventsRepository } from "@/lib/repositories/eventsRepository";
import { createStatusEvent } from "@/app/actions/status-events.actions";

interface MaterialBooking {
  id: string;
  name: string;
  qty: number;
  unit: string;
}

export function OrderMaterialTimeDrawer({ orderId, customerId, onClose }: { orderId: string, customerId?: string, onClose: () => void }) {
  const [minutes, setMinutes] = useState(45);
  const [allConsumables, setAllConsumables] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearchList, setShowSearchList] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Material state representing currently selected materials to book
  const [bookedMaterials, setBookedMaterials] = useState<MaterialBooking[]>([
    { id: "inv-5", name: "Schleifband P240", qty: 3, unit: "pcs" },
    { id: "inv-6", name: "Schleifpapier P320", qty: 1, unit: "pcs" }
  ]);

  // Load all consumables on mount
  useEffect(() => {
    const loadConsumables = async () => {
      const all = await inventoryRepository.getAllItems();
      // Only offer consumable items for booking
      setAllConsumables(all.filter(i => i.isConsumable));
    };
    loadConsumables();
  }, []);

  // Filter list of additions matching search
  const filteredSearchList = allConsumables.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const isAlreadyBooked = bookedMaterials.some(m => m.id === item.id);
    return matchesSearch && !isAlreadyBooked;
  });

  const handleAddMaterial = (item: InventoryItem) => {
    setBookedMaterials([
      ...bookedMaterials,
      { id: item.id, name: item.name, qty: 1, unit: item.unit }
    ]);
    setSearchTerm("");
    setShowSearchList(false);
  };

  const handleQtyChange = (index: number, direction: "plus" | "minus") => {
    const newMats = [...bookedMaterials];
    if (direction === "plus") {
      newMats[index].qty += 1;
    } else {
      newMats[index].qty = Math.max(0, newMats[index].qty - 1);
    }
    // Filter out items with 0 quantity
    setBookedMaterials(newMats.filter(m => m.qty > 0));
  };

  const handleSubmit = async () => {
    try {
      // 1. Book and subtract each material from inventory item stock
      for (const mat of bookedMaterials) {
        if (mat.qty <= 0) continue;
        
        await inventoryRepository.createMovement({
          inventoryItemId: mat.id,
          movementType: "consumption",
          quantity: mat.qty,
          unit: mat.unit,
          orderId: orderId,
          reason: `Verbrauchsbuchung in Auftrag ${orderId}`,
          createdBy: "meister@kreile.de"
        });

        // Add timeline status event for stock deduction
        await eventsRepository.addEvent({
          orderId: orderId,
          customerId: customerId,
          eventType: "COSTS_BOOKED",
          metadata: { description: `MATERIAL_CONSUMED: ${mat.qty}x ${mat.name}`, materialId: mat.id, quantity: mat.qty, unit: mat.unit }
        });
        createStatusEvent({ orderId, eventType: "COSTS_BOOKED", notes: `MATERIAL_CONSUMED: ${mat.qty}x ${mat.name}` }).catch(e => console.warn(e));
      }

      // 2. Book time and add time logging timeline event
      if (minutes > 0) {
        await eventsRepository.addEvent({
          orderId: orderId,
          customerId: customerId,
          eventType: "COSTS_BOOKED",
          metadata: { description: `WORK_TIME_LOGGED: ${minutes} Minuten`, minutes }
        });
        createStatusEvent({ orderId, eventType: "COSTS_BOOKED", notes: `WORK_TIME_LOGGED: ${minutes} Minuten` }).catch(e => console.warn(e));
      }

      setSuccessMsg("Erfolgreich gebucht! Aktualisiere Cockpit...");
      
      // Dispatch custom storage event for header / other widgets to instantly repaint
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("storage"));
      }

      setTimeout(() => {
        onClose();
      }, 1000);

    } catch (e) {
      console.error("Fehler beim Buchen des Verbrauchs", e);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-end z-50 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right-full duration-300">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-neutral-gray-100">
          <div>
            <h2 className="text-2xl font-black font-serif text-navy-900">Verbrauch & Zeit</h2>
            <p className="text-text-muted text-xs mt-1">Auftrag: {orderId}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-gray-100 rounded-full transition-colors cursor-pointer"><X /></button>
        </div>
        
        {/* Success Alert Banner */}
        {successMsg && (
          <div className="bg-success-green-soft text-success-green border-y border-success-green py-3.5 px-6 font-bold text-sm flex items-center gap-2">
            <Check className="h-5 w-5 text-success-green animate-bounce" />
            {successMsg}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Time Picker Stepper */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-text-muted uppercase tracking-widest pl-0.5">Arbeitszeit (Minuten)</h3>
            <div className="flex items-center justify-between bg-bg-app-soft p-4 rounded-2xl border border-neutral-gray-100">
              <Button 
                variant="outline" 
                className="h-12 w-12 rounded-full border border-neutral-gray-300 cursor-pointer" 
                onClick={() => setMinutes(m => Math.max(0, m - 15))}
              >
                <Minus className="w-5 h-5 text-navy-900 font-bold" />
              </Button>
              <span className="text-4xl font-black text-navy-900 w-24 text-center">{minutes}</span>
              <Button 
                variant="outline" 
                className="h-12 w-12 rounded-full border border-neutral-gray-300 cursor-pointer" 
                onClick={() => setMinutes(m => m + 15)}
              >
                <Plus className="w-5 h-5 text-navy-900 font-bold" />
              </Button>
            </div>
          </div>

          {/* Booked Consumables List */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-text-muted uppercase tracking-widest pl-0.5">Verbrauchsmaterial</h3>
            <div className="space-y-2.5">
              {bookedMaterials.map((m, i) => (
                <div key={m.id} className="flex justify-between items-center bg-white p-3 rounded-2xl border border-neutral-gray-100 shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <Package className="h-5 w-5 text-slate-450 shrink-0" />
                    <span className="font-bold text-navy-900 text-sm">{m.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 w-8 rounded-lg shrink-0 cursor-pointer" 
                      onClick={() => handleQtyChange(i, "minus")}
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </Button>
                    <span className="w-6 text-center font-bold text-base text-navy-900">{m.qty}</span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 w-8 rounded-lg shrink-0 cursor-pointer" 
                      onClick={() => handleQtyChange(i, "plus")}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Material Add Search Input Field */}
            <div className="relative mt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <Input
                  className="pl-9 h-11 bg-bg-app-soft border-neutral-gray-100 rounded-xl w-full text-sm font-semibold"
                  placeholder="Material suchen..."
                  value={searchTerm}
                  onFocus={() => setShowSearchList(true)}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowSearchList(true);
                  }}
                />
              </div>

              {/* Float popover of search list */}
              {showSearchList && searchTerm && (
                <div className="absolute top-12 left-0 right-0 max-h-52 overflow-y-auto bg-white border border-neutral-gray-100 rounded-xl shadow-lg z-20 divide-y divide-neutral-gray-100">
                  {filteredSearchList.length > 0 ? (
                    filteredSearchList.map(item => (
                      <div
                        key={item.id}
                        onClick={() => handleAddMaterial(item)}
                        className="p-3 hover:bg-bg-app-soft cursor-pointer text-xs font-bold text-slate-850 flex justify-between items-center"
                      >
                        <span>{item.name} ({item.sku})</span>
                        <span className="text-[10px] text-text-muted bg-neutral-gray-100 border border-neutral-gray-100 px-2 py-0.5 rounded font-mono">
                          Lager: {item.currentStock} {item.unit}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-center text-text-muted text-xs font-semibold">Keine weiteren Materialien gefunden</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-6 border-t border-neutral-gray-100 bg-bg-app-soft">
          <Button 
            className="w-full h-15 text-base font-black rounded-2xl bg-navy-700 hover:bg-navy-700 text-white shadow-xl active:scale-95 transition-all cursor-pointer" 
            onClick={handleSubmit}
            disabled={successMsg !== null || (bookedMaterials.length === 0 && minutes === 0)}
          >
            Buchen & Speichern
          </Button>
        </div>
      </div>
    </div>
  );
}
