import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Plus, Minus, Search, AlertTriangle } from "lucide-react";
import { inventoryRepository, InventoryItem } from "@/lib/repositories/inventoryRepository";
import { eventsRepository } from "@/lib/repositories/eventsRepository";
import { ordersRepository } from "@/lib/repositories/ordersRepository";
import { getNextStation } from "@/lib/stations/nextStation";
import { computeStationCost, ConsumableUse } from "@/lib/costs/stationCost";
import { STATION_CONFIGS } from "@/constants/stations";
import { DEFAULT_HOURLY_RATE_EUR } from "@/constants/pricing";
import { parseOrderStation } from "@/lib/orders/orderMutationContract";

export function StationCompletionModal({ 
  orderId, 
  currentStationId, 
  onClose 
}: { 
  orderId: string, 
  customerId?: string, 
  currentStationId: string, 
  onClose: () => void 
}) {
  const [activeTab, setActiveTab] = useState<"erfassung" | "kosten">("erfassung");
  const [minutes, setMinutes] = useState(0);
  const [taskType, setTaskType] = useState("Schleifen");
  const [note, setNote] = useState("");
  const [multiplier, setMultiplier] = useState(1);
  
  const [allConsumables, setAllConsumables] = useState<InventoryItem[]>([]);
  const [bookedMaterials, setBookedMaterials] = useState<(ConsumableUse & { name: string, price: number, unit: string })[]>([]);
  
  const [showSearchList, setShowSearchList] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const currentStationLabel = Object.values(STATION_CONFIGS).find(s => s.key === currentStationId)?.name || currentStationId;
  const nextStation = getNextStation(currentStationId);
  const nextStationLabel = nextStation 
    ? Object.values(STATION_CONFIGS).find(s => s.key === nextStation)?.name || nextStation 
    : "Warenausgang";

  useEffect(() => {
    const load = async () => {
      const all = await inventoryRepository.getAllItems();
      setAllConsumables(all.filter(i => i.isConsumable));
    };
    load();
  }, []);

  const handleAddMaterial = (item: InventoryItem) => {
    if (bookedMaterials.some(m => m.inventoryItemId === item.id)) return;
    setBookedMaterials([
      ...bookedMaterials,
      { inventoryItemId: item.id, name: item.name, quantity: 1, price: item.pricePerUnit || 0, unit: item.unit }
    ]);
    setSearchTerm("");
    setShowSearchList(false);
  };

  const handleQtyChange = (index: number, direction: "plus" | "minus") => {
    const newMats = [...bookedMaterials];
    if (direction === "plus") {
      newMats[index].quantity += 1;
    } else {
      newMats[index].quantity = Math.max(0, newMats[index].quantity - 1);
    }
    setBookedMaterials(newMats.filter(m => m.quantity > 0));
  };

  const costs = computeStationCost(
    [{ netMinutes: minutes }],
    bookedMaterials,
    allConsumables,
    DEFAULT_HOURLY_RATE_EUR,
    multiplier
  );

  const canSubmit = minutes > 0 || bookedMaterials.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      for (const mat of bookedMaterials) {
        await inventoryRepository.createMovement({
          inventoryItemId: mat.inventoryItemId,
          movementType: "consumption",
          quantity: mat.quantity,
          unit: mat.unit,
          orderId: orderId,
          reason: `Verbrauchsbuchung in ${currentStationLabel}`,
        });
      }

      await eventsRepository.addEvent({
        orderId,
        eventType: "COSTS_BOOKED",
        metadata: { durationMinutes: minutes, materialCount: bookedMaterials.length, stationId: currentStationId }
      });

      await eventsRepository.addEvent({
        orderId,
        eventType: "STATION_COMPLETED",
        metadata: { stationId: currentStationId }
      });

      if (nextStation) {
        const persistedNextStation = parseOrderStation(nextStation);
        await ordersRepository.updateOrder(orderId, { currentStationId: persistedNextStation, status: "ready" });
        await eventsRepository.addEvent({
          orderId,
          eventType: "STATION_READY",
          metadata: { stationId: persistedNextStation }
        });
      } else {
        await ordersRepository.updateOrder(orderId, { status: "shipped", currentStationId: "warenausgang" });
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("storage"));
      }

      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-neutral-gray-100 flex justify-between items-center bg-bg-app-soft">
          <div>
            <h2 className="text-xl font-black text-navy-900">Stationsabschluss · {currentStationLabel}</h2>
            <p className="text-navy-500 text-sm mt-1">Auftrag {orderId}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-gray-100 rounded-full"><X className="w-5 h-5" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-gray-100 px-6 pt-2 gap-6 bg-bg-app-soft">
          <button 
            className={`pb-3 font-bold text-sm border-b-2 transition-colors ${activeTab === "erfassung" ? "border-navy-700 text-navy-700" : "border-transparent text-navy-500 hover:text-navy-900"}`}
            onClick={() => setActiveTab("erfassung")}
          >
            Erfassung
          </button>
          <button 
            className={`pb-3 font-bold text-sm border-b-2 transition-colors ${activeTab === "kosten" ? "border-navy-700 text-navy-700" : "border-transparent text-navy-500 hover:text-navy-900"}`}
            onClick={() => setActiveTab("kosten")}
          >
            Kostenübersicht
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === "erfassung" ? (
            <div className="space-y-8">
              {/* Arbeitszeit */}
              <div className="space-y-4">
                <h3 className="font-bold text-navy-900 uppercase tracking-wider text-xs">Arbeitszeit</h3>
                <div className="flex items-center gap-4 bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-100">
                  <Button variant="outline" onClick={() => setMinutes(Math.max(0, minutes - 15))} className="w-12 h-12 rounded-full"><Minus /></Button>
                  <div className="flex-1 text-center font-black text-2xl text-navy-900">{minutes} <span className="text-sm font-normal text-navy-500">Minuten</span></div>
                  <Button variant="outline" onClick={() => setMinutes(minutes + 15)} className="w-12 h-12 rounded-full"><Plus /></Button>
                </div>

                {/* Erschwernis / Zusatzaufwand */}
                <div>
                  <label className="text-xs font-bold text-navy-500 block mb-2">Erschwernis / Zusatzaufwand</label>
                  <div className="grid grid-cols-4 gap-2 bg-bg-app-soft p-1.5 rounded-xl border border-neutral-gray-100">
                    {[
                      { val: 1, label: "1x", text: "Standard" },
                      { val: 2, label: "2x", text: "Erhöht" },
                      { val: 3, label: "3x", text: "Stark" },
                      { val: 4, label: "4x", text: "Extrem" }
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setMultiplier(opt.val)}
                        className={`py-2 px-1 rounded-lg text-xs font-bold transition-all ${
                          multiplier === opt.val
                            ? "bg-navy-900 text-white shadow-xs"
                            : "text-slate-605 hover:bg-neutral-gray-100/60"
                        }`}
                        title={opt.text}
                      >
                        {opt.label} <span className="font-normal opacity-80">({opt.text})</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-navy-500 block mb-1">Tätigkeit</label>
                    <select className="w-full h-10 px-3 rounded-lg border border-neutral-gray-100 text-sm" value={taskType} onChange={e => setTaskType(e.target.value)}>
                      <option>Schleifen</option>
                      <option>Polieren</option>
                      <option>Setup</option>
                      <option>Sonstiges</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-navy-500 block mb-1">Bemerkung (optional)</label>
                    <Input className="h-10 text-sm" value={note} onChange={e => setNote(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Material */}
              <div className="space-y-4">
                <h3 className="font-bold text-navy-900 uppercase tracking-wider text-xs">Materialverbrauch</h3>
                
                {bookedMaterials.map((mat, idx) => (
                  <div key={mat.inventoryItemId} className="flex items-center justify-between p-3 border border-neutral-gray-100 rounded-xl">
                    <div className="flex items-center gap-3">
                      {!mat.price && <AlertTriangle className="w-4 h-4 text-accent-orange" />}
                      <span className="font-bold text-sm">{mat.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleQtyChange(idx, "minus")} className="p-1 border rounded-md hover:bg-bg-app-soft"><Minus className="w-4 h-4" /></button>
                        <span className="w-8 text-center font-bold text-sm">{mat.quantity}</span>
                        <button onClick={() => handleQtyChange(idx, "plus")} className="p-1 border rounded-md hover:bg-bg-app-soft"><Plus className="w-4 h-4" /></button>
                      </div>
                      <span className="text-sm text-navy-500 w-24 text-right">× {mat.price.toFixed(2)} €</span>
                    </div>
                  </div>
                ))}

                <div className="relative">
                  <Button variant="outline" className="w-full justify-start text-navy-500 border-dashed" onClick={() => setShowSearchList(!showSearchList)}>
                    <Plus className="w-4 h-4 mr-2" /> Material hinzufügen
                  </Button>
                  {showSearchList && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-neutral-gray-100 rounded-xl shadow-xl z-10 max-h-48 overflow-y-auto p-2">
                      <div className="relative mb-2">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                        <Input className="pl-9 h-9 text-sm" placeholder="Suchen..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                      </div>
                      {allConsumables.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) && !bookedMaterials.some(m => m.inventoryItemId === c.id)).map(item => (
                        <button key={item.id} onClick={() => handleAddMaterial(item)} className="w-full text-left px-3 py-2 text-sm hover:bg-bg-app-soft rounded-lg flex justify-between">
                          <span className="font-bold">{item.name}</span>
                          <span className="text-navy-500">{item.pricePerUnit?.toFixed(2) || "0.00"} € / {item.unit}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-bg-app-soft rounded-2xl p-6 border border-neutral-gray-100">
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-text-muted">Arbeitszeit ({minutes} min × {DEFAULT_HOURLY_RATE_EUR} €/h)</span>
                    <span className="font-bold">{costs.laborCost.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-text-muted">Material ({bookedMaterials.length} Positionen)</span>
                    <span className="font-bold">{costs.materialCost.toFixed(2)} €</span>
                  </div>
                  <div className="pt-4 border-t border-neutral-gray-100 flex justify-between items-center text-lg">
                    <span className="font-black text-navy-900">Gesamtkosten Station</span>
                    <span className="font-black text-navy-700">{costs.total.toFixed(2)} €</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-neutral-gray-100 flex justify-between items-center bg-bg-app-soft">
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button 
            disabled={!canSubmit} 
            className="bg-navy-700 hover:bg-navy-700 text-white font-bold" 
            onClick={handleSubmit}
          >
            {nextStation ? `Abschließen und zu ${nextStationLabel} ›` : "Auftrag versendet markieren"}
          </Button>
        </div>

      </div>
    </div>
  );
}
