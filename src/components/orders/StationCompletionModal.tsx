import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Plus, Minus, Search, AlertTriangle } from "lucide-react";
import { computeStationCost, ConsumableUse } from "@/lib/costs/stationCost";
import { completeStationCapture, getCaptureOverview } from "@/app/actions/capture.actions";
import { publishInventorySync } from "@/lib/inventory/inventorySync";
import {
  getOrderStationLabel,
  parseOrderStation,
  type OrderStation,
} from "@/lib/orders/orderMutationContract";

type CompletionArticle = {
  id: string;
  name: string;
  unit: string | null;
  currentStock: number;
  pricePerUnit?: number;
};

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
  
  const [allConsumables, setAllConsumables] = useState<CompletionArticle[]>([]);
  const [bookedMaterials, setBookedMaterials] = useState<(ConsumableUse & { name: string, price: number, priceMissing: boolean, unit: string | null })[]>([]);
  
  const [showSearchList, setShowSearchList] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hourlyRate, setHourlyRate] = useState<number | null>(null);
  const [nextStation, setNextStation] = useState<OrderStation | null>(null);
  const [routeBlockedReason, setRouteBlockedReason] = useState<string | null>(null);
  const [writeCapability, setWriteCapability] = useState<{ available: boolean; reason: string | null }>({
    available: false,
    reason: "Schreibfähigkeit wurde noch nicht vom Server bestätigt.",
  });
  const [catalogTruncated, setCatalogTruncated] = useState(false);
  const [clientRequestId] = useState(() => crypto.randomUUID());

  let currentStation: OrderStation | null = null;
  try {
    currentStation = parseOrderStation(currentStationId);
  } catch {
    // Invalid legacy station values remain visible and make submission fail closed.
  }
  const currentStationLabel = currentStation ? getOrderStationLabel(currentStation) : "Unbekannte Station";
  const nextStationLabel = nextStation ? getOrderStationLabel(nextStation) : null;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const result = await getCaptureOverview(orderId, currentStationId);
      if (cancelled) return;
      if (!result.ok) {
        setNextStation(null);
        setRouteBlockedReason("LOAD_FAILED");
        setLoadError(result.message);
        setWriteCapability({ available: false, reason: result.message });
        setCatalogTruncated(false);
        return;
      }
      setAllConsumables(result.data.articles.map((article) => ({
        id: article.id,
        name: article.name,
        unit: article.unit,
        currentStock: article.currentStock,
        ...(article.unitCostEur === null ? {} : { pricePerUnit: article.unitCostEur }),
      })));
      setHourlyRate(result.data.selectedRate?.valueEurPerHour ?? null);
      setNextStation(result.data.routeExecution.nextStation);
      setRouteBlockedReason(result.data.routeExecution.reason);
      setWriteCapability(result.data.writeCapability);
      setCatalogTruncated(result.data.inventoryCatalog.truncated);
      setLoadError(null);
    };
    void load();
    return () => { cancelled = true; };
  }, [currentStationId, orderId]);

  const handleAddMaterial = (item: CompletionArticle) => {
    if (bookedMaterials.some(m => m.inventoryItemId === item.id)) return;
    setBookedMaterials([
      ...bookedMaterials,
      { inventoryItemId: item.id, name: item.name, quantity: 1, price: item.pricePerUnit ?? 0, priceMissing: item.pricePerUnit === undefined, unit: item.unit }
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
    hourlyRate ?? 0,
    multiplier
  );

  const missingRate = minutes > 0 && hourlyRate === null;
  const missingMaterialPrice = bookedMaterials.some((material) => material.priceMissing);
  const missingMaterialUnit = bookedMaterials.some((material) => !material.unit?.trim());
  const insufficientMaterialStock = bookedMaterials.some((material) => {
    const item = allConsumables.find((entry) => entry.id === material.inventoryItemId);
    return !item || material.quantity > item.currentStock;
  });
  const normalizedMaterialSearch = searchTerm.trim().toLocaleLowerCase("de-DE");
  const matchingConsumables = allConsumables.filter((item) => (
    item.name.toLocaleLowerCase("de-DE").includes(normalizedMaterialSearch)
    && !bookedMaterials.some((material) => material.inventoryItemId === item.id)
  ));
  const canSubmit = currentStation !== null
    && currentStation !== "warenausgang"
    && nextStation !== null
    && routeBlockedReason === null
    && loadError === null
    && writeCapability.available
    && (minutes > 0 || bookedMaterials.length > 0)
    && !missingRate
    && !missingMaterialPrice
    && !missingMaterialUnit
    && !insufficientMaterialStock;

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const result = await completeStationCapture({
        orderId,
        expectedStation: currentStationId,
        minutes,
        multiplier,
        taskType,
        note,
        materials: bookedMaterials.map((material) => ({
          inventoryItemId: material.inventoryItemId,
          quantity: material.quantity,
        })),
        clientRequestId,
      });
      if (!result.ok) throw new Error(result.message);

      if (bookedMaterials.length > 0) publishInventorySync();
      try {
        onClose();
      } catch {
        setSubmitError("Stationsabschluss ist bestätigt. Nur die Ansicht konnte anschließend nicht geschlossen werden; bitte nicht erneut abschließen.");
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Stationsabschluss konnte nicht bestätigt werden.");
    } finally {
      setIsSubmitting(false);
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
          <button disabled={isSubmitting} onClick={onClose} className="p-2 hover:bg-neutral-gray-100 rounded-full disabled:opacity-50"><X className="w-5 h-5" /></button>
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
          {loadError && <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Erfassungsgrundlage nicht verfügbar: {loadError}. Der Abschluss bleibt gesperrt.</div>}
          {!loadError && !writeCapability.available && <div role="status" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{writeCapability.reason} Der Abschluss bleibt gesperrt; es wurde nichts gebucht.</div>}
          {!currentStation && <div role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">Die gespeicherte Station ist nicht Teil des kanonischen Prozessvertrags. Der Abschluss bleibt gesperrt.</div>}
          {currentStation === "warenausgang" && <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Warenausgang benötigt einen eigenen atomaren Übergabe-/Versandbeleg mit Empfänger, Modus und Zeitpunkt. Der generische Stationsabschluss markiert keinen Auftrag als versendet.</div>}
          {missingRate && <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Für diese Station fehlt ein bestätigter Mitarbeiter- oder Stationskostensatz. Eine EUR-Summe und der Abschluss bleiben gesperrt.</div>}
          {missingMaterialPrice && <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Mindestens ein ausgewählter Lagerartikel hat keinen bestätigten Einkaufspreis. Die Kosten und der Abschluss bleiben gesperrt.</div>}
          {missingMaterialUnit && <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Mindestens ein ausgewählter Lagerartikel hat keine bestätigte Einheit. Der Abschluss bleibt gesperrt.</div>}
          {insufficientMaterialStock && <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Mindestens eine Materialmenge überschreitet den bestätigten Bestand. Der Abschluss bleibt gesperrt.</div>}
          {routeBlockedReason === "BATH_PARTICIPATION_REQUIRED" && <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Für Galvanik fehlt ein atomarer Badbeteiligungsbeleg. Dieser Dialog kann den Prozess nicht ersatzweise abschließen.</div>}
          {routeBlockedReason === "QUALITY_RECEIPT_REQUIRED" && <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Für die Qualitätssicherung fehlt ein atomarer Prüfbeleg. Dieser Dialog kann den Prozess nicht ersatzweise abschließen.</div>}
          {routeBlockedReason && !["LOAD_FAILED", "BATH_PARTICIPATION_REQUIRED", "QUALITY_RECEIPT_REQUIRED"].includes(routeBlockedReason) && <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Keine einheitliche ausführbare v1-Positionsroute belegt ({routeBlockedReason}). Der Abschluss bleibt gesperrt.</div>}
          {submitError && <div role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">{submitError}</div>}
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
                      {mat.priceMissing && <AlertTriangle className="w-4 h-4 text-accent-orange" />}
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
                      {catalogTruncated && (
                        <p role="status" className="px-3 py-2 text-xs font-semibold text-amber-800">
                          Der Katalog ist auf die ersten 250 Artikel begrenzt. Ein nicht angezeigter Artikel ist damit nicht als fehlend bestätigt.
                        </p>
                      )}
                      {matchingConsumables.map(item => (
                        <button key={item.id} onClick={() => handleAddMaterial(item)} className="w-full text-left px-3 py-2 text-sm hover:bg-bg-app-soft rounded-lg flex justify-between">
                          <span className="font-bold">{item.name}</span>
                          <span className="text-navy-500">{item.pricePerUnit === undefined ? "Preis fehlt" : `${item.pricePerUnit.toFixed(2)} € / ${item.unit || "Einheit nicht erfasst"}`}</span>
                        </button>
                      ))}
                      {matchingConsumables.length === 0 && (
                        <p role="status" className="px-3 py-2 text-xs font-semibold text-text-muted">
                          {catalogTruncated
                            ? "Kein Treffer in den ersten 250 geladenen Artikeln; der Gesamtkatalog ist damit nicht leer bestätigt."
                            : "Keine weiteren passenden Lagerartikel vorhanden."}
                        </p>
                      )}
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
                    <span className="text-text-muted">Arbeitszeit ({minutes} min{hourlyRate === null ? " · Kostensatz fehlt" : ` × ${hourlyRate.toFixed(2)} €/h × ${multiplier}`})</span>
                    <span className="font-bold">{missingRate ? "nicht berechenbar" : `${costs.laborCost.toFixed(2)} €`}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-text-muted">Material ({bookedMaterials.length} Positionen)</span>
                    <span className="font-bold">{missingMaterialPrice ? "nicht berechenbar" : `${costs.materialCost.toFixed(2)} €`}</span>
                  </div>
                  <div className="pt-4 border-t border-neutral-gray-100 flex justify-between items-center text-lg">
                    <span className="font-black text-navy-900">Gesamtkosten Station</span>
                    <span className="font-black text-navy-700">{missingRate || missingMaterialPrice ? "nicht berechenbar" : `${costs.total.toFixed(2)} €`}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-neutral-gray-100 flex justify-between items-center bg-bg-app-soft">
          <Button variant="ghost" disabled={isSubmitting} onClick={onClose}>Abbrechen</Button>
          <Button 
            disabled={!canSubmit || isSubmitting}
            className="bg-navy-700 hover:bg-navy-700 text-white font-bold" 
            onClick={handleSubmit}
          >
            {isSubmitting
              ? "Wird atomar bestätigt..."
              : nextStation && nextStationLabel
                ? `Abschließen und zu ${nextStationLabel} ›`
                : "Stationsabschluss gesperrt"}
          </Button>
        </div>

      </div>
    </div>
  );
}
