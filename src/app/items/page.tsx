"use client";

import { usePageView } from "@/hooks/usePageView";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  Package, 
  MapPin, 
  Plus, 
  Minus, 
  Droplets, 
  Thermometer, 
  FlaskConical, 
  Check, 
  History, 
  Activity, 
  Lock,
  Unlock,
  User
} from "lucide-react";
import { inventoryRepository, InventoryItem, StockMovement } from "@/lib/repositories/inventoryRepository";
import { bathsRepository, Bath, BathMeasurementLog, BathAddition } from "@/lib/repositories/bathsRepository";
import { PageHeader } from "@/components/ui/PageHeader";
import { trackUiEvent } from "@/lib/tracking/tracking";
import { DetailOverlay } from "@/components/ui/DetailOverlay";

export default function ItemsPage() {
  usePageView();
  const [activeSection, setActiveSection] = useState<"inventory" | "baths">("inventory");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  
  // Data States
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [baths, setBaths] = useState<Bath[]>([]);
  const [bathMeasurements, setBathMeasurements] = useState<BathMeasurementLog[]>([]);
  const [bathAdditions, setBathAdditions] = useState<BathAddition[]>([]);
  
  // Selection States
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedBathId, setSelectedBathId] = useState<string | null>(null);
  
  // Forms States
  const [bookingQty, setBookingQty] = useState<number>(5);
  const [bookingType, setBookingType] = useState<"stock_in" | "stock_out">("stock_in");
  const [bookingReason, setBookingReason] = useState<string>("");
  
  const [measTemp, setMeasTemp] = useState<string>("");
  const [measPh, setMeasPh] = useState<string>("");
  const [measConc, setMeasConc] = useState<string>("");
  const [measVisual, setMeasVisual] = useState<string>("clean");
  const [measNote, setMeasNote] = useState<string>("");
  
  const [addChemId, setAddChemId] = useState<string>("");
  const [addQty, setAddQty] = useState<number>(5);
  const [addReason, setAddReason] = useState<string>("Standardpflege");

  // Load repositories data
  const loadData = useCallback(async () => {
    const items = await inventoryRepository.getAllItems();
    const movements = await inventoryRepository.getAllMovements();
    const allBaths = await bathsRepository.getAllBaths();
    const allMeasurements = await bathsRepository.getAllMeasurements();
    const allAdditions = await bathsRepository.getAllAdditions();
    
    setInventoryItems(items);
    setStockMovements(movements);
    setBaths(allBaths);
    setBathMeasurements(allMeasurements);
    setBathAdditions(allAdditions);
    
    setSelectedItemId(prev => prev || (items.length > 0 ? items[0].id : null));
    setSelectedBathId(prev => prev || (allBaths.length > 0 ? allBaths[0].id : null));
  }, []);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (active) {
        await loadData();
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [loadData]);

  // Listen to custom local storage storage updates to stay synced with other components
  useEffect(() => {
    const handleStorageChange = () => {
      loadData();
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [loadData]);

  // Handlers for Quick Action Stock Increment/Decrement directly in list row
  const handleQuickAdjust = async (itemId: string, direction: "plus" | "minus", event: React.MouseEvent) => {
    event.stopPropagation(); // Avoid selecting row when pressing button
    const targetItem = inventoryItems.find(i => i.id === itemId);
    if (!targetItem) return;

    try {
      await inventoryRepository.createMovement({
        inventoryItemId: itemId,
        movementType: direction === "plus" ? "stock_in" : "stock_out",
        quantity: 1,
        unit: targetItem.unit,
        reason: direction === "plus" ? "Schnellbuchung Zugang" : "Schnellbuchung Entnahme",
        createdBy: "meister@kreile.de"
      });
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  // Detailed Form Stock booking handler
  const handleDetailedBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId) return;
    const targetItem = inventoryItems.find(i => i.id === selectedItemId);
    if (!targetItem) return;

    try {
      await inventoryRepository.createMovement({
        inventoryItemId: selectedItemId,
        movementType: bookingType,
        quantity: bookingQty,
        unit: targetItem.unit,
        reason: bookingReason || (bookingType === "stock_in" ? "Bestandserhöhung" : "Bestandsminderung"),
        createdBy: "meister@kreile.de"
      });
      setBookingQty(5);
      setBookingReason("");
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  // Detailed Form Bath Measurement handler
  const handleMeasurementBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBathId) return;

    try {
      await bathsRepository.addMeasurement(selectedBathId, {
        temperature: measTemp ? parseFloat(measTemp) : null,
        ph: measPh ? parseFloat(measPh) : null,
        concentration: measConc ? parseFloat(measConc) : null,
        visualState: measVisual,
        note: measNote || undefined,
        measuredBy: "meister@kreile.de"
      });
      setMeasTemp("");
      setMeasPh("");
      setMeasConc("");
      setMeasVisual("clean");
      setMeasNote("");
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  // Detailed Form Chemical Addition booking handler
  const handleAdditionBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBathId || !addChemId) return;
    const targetChem = inventoryItems.find(i => i.id === addChemId);
    if (!targetChem) return;

    try {
      // 1. Log chemical addition in bath registry
      await bathsRepository.addAddition(selectedBathId, {
        inventoryItemId: addChemId,
        inventoryItemName: targetChem.name,
        quantity: addQty,
        unit: targetChem.unit,
        reason: addReason,
        createdBy: "meister@kreile.de"
      });

      // 2. Atomically reduce chemical quantity in warehouse inventory
      await inventoryRepository.createMovement({
        inventoryItemId: addChemId,
        movementType: "consumption",
        quantity: addQty,
        unit: targetChem.unit,
        reason: `Dosierung in Bad: ${baths.find(b => b.id === selectedBathId)?.name || "Unbekannt"}`,
        createdBy: "meister@kreile.de"
      });

      setAddChemId("");
      setAddQty(5);
      setAddReason("Standardpflege");
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  // Detailed Form manual bath status override (e.g. Lock / Unlock)
  const handleStatusOverride = async (status: "stable" | "critical", note: string) => {
    if (!selectedBathId) return;
    try {
      await bathsRepository.updateBathStatusManual(selectedBathId, status, note);
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  // Category and Search Filtering for Inventory Items
  const filteredInventoryItems = inventoryItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.sku.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.storageLocation.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    if (filterCategory === "all") return true;
    if (filterCategory === "critical") return item.currentStock < item.minStock;
    return item.category === filterCategory;
  });

  // Search Filtering for Baths
  const filteredBaths = baths.filter(bath => {
    return bath.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
           bath.bathNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
           bath.processType.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const selectedItem = inventoryItems.find(i => i.id === selectedItemId) || null;
  const selectedBath = baths.find(b => b.id === selectedBathId) || null;
  
  const selectedItemMovements = selectedItemId ? stockMovements.filter(m => m.inventoryItemId === selectedItemId) : [];
  const selectedBathMeasurements = selectedBathId ? bathMeasurements.filter(m => m.bathId === selectedBathId) : [];
  const selectedBathAdditions = selectedBathId ? bathAdditions.filter(a => a.bathId === selectedBathId) : [];

  // Chemistry materials lists for chemical addition options in dropdown
  const chemicalList = inventoryItems.filter(item => item.category === "chemical");

  return (
    <div className="space-y-6 pb-12 font-sans antialiased text-navy-900">
      
      <PageHeader
        title="Lager & Chemieverwaltung"
        subtitle="Tablet-Leitstand für Bestände, Materialbewegungen und chemische Beschichtung"
      />

      {/* Tab-Switcher */}
      <div className="flex gap-1 bg-white border border-neutral-gray-100 rounded-2xl p-1 w-fit">
        <button
          onClick={() => { setActiveSection("inventory"); setSearchTerm(""); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeSection === "inventory"
              ? "bg-navy-900 text-white shadow-sm"
              : "text-text-muted hover:text-navy-900"
          }`}
        >
          <Package className="h-4 w-4" />
          Lagerbestand
        </button>
        <button
          onClick={() => { setActiveSection("baths"); setSearchTerm(""); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeSection === "baths"
              ? "bg-navy-900 text-white shadow-sm"
              : "text-text-muted hover:text-navy-900"
          }`}
        >
          <FlaskConical className="h-4 w-4" />
          Badregelkarte
        </button>
      </div>

      {/* Main Grid View - 13.5" Optimized Side-by-Side Dual Panels */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        
        {/* Left Side: Main Tables / Cards Grid (60-65% width) */}
        <div className="xl:col-span-2 space-y-4 w-full">
          
          {/* Filters and search layout */}
          <div className="bg-white p-4 rounded-2xl border border-neutral-gray-300 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <Input
                className="pl-10 h-11 bg-bg-app-soft border-neutral-gray-300 rounded-xl w-full text-base font-medium"
                placeholder={activeSection === "inventory" ? "Artikel suchen nach Name, SKU, Lagerort..." : "Beschichtung suchen..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            {/* Horizontal Categorized touch-chips for inventory */}
            {activeSection === "inventory" && (
              <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none flex-wrap">
                {[
                  { key: "all", name: "Alle" },
                  { key: "chemical", name: "Chemie" },
                  { key: "consumable", name: "Verbrauch" },
                  { key: "tooling", name: "Werkzeuge" },
                  { key: "packaging", name: "Verpackung" },
                  { key: "critical", name: "⚠️ Kritisch" }
                ].map(chip => (
                  <button
                    key={chip.key}
                    onClick={() => setFilterCategory(chip.key)}
                    className={`h-9 px-4 rounded-xl text-xs font-bold transition-all border ${
                      filterCategory === chip.key
                        ? "bg-navy-900 text-white border-navy-900"
                        : "bg-bg-app hover:bg-gold-100 text-text-muted border-neutral-gray-100"
                    }`}
                  >
                    {chip.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 1: INVENTORY VIEWS */}
          {activeSection === "inventory" && (
            <Card className="border-neutral-gray-300 shadow-sm overflow-hidden">
              <div className="p-0">
                <div className="divide-y divide-neutral-gray-100">
                  {filteredInventoryItems.length > 0 ? (
                    filteredInventoryItems.map((item) => {
                      const isCritical = item.currentStock < item.minStock;
                      const isSelected = selectedItemId === item.id;
                      
                      return (
                        <div
                          key={item.id}
                          onClick={() => { setSelectedItemId(item.id); trackUiEvent("detail_open", { target: "inventory", id: item.id }); }}
                          className={`p-4 hover:bg-bg-app-soft/50 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                            isSelected ? "bg-bg-app border-l-4 border-navy-900" : "border-l-4 border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            {/* Visual Category avatar */}
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shrink-0 ${
                              isCritical 
                                ? "bg-accent-orange-soft text-danger-red border-danger-red animate-pulse" 
                                : item.category === "chemical" 
                                  ? "bg-surface-tinted text-navy-700 border-navy-500"
                                  : item.category === "consumable" 
                                    ? "bg-gold-100 text-gold-600 border-gold-600"
                                    : "bg-bg-app-soft text-navy-900 border-neutral-gray-300"
                            }`}>
                              {item.category === "chemical" ? (
                                <FlaskConical className="h-6 w-6" />
                              ) : (
                                <Package className="h-6 w-6" />
                              )}
                            </div>
                            
                            <div>
                              <h4 className="font-extrabold text-navy-900 flex items-center gap-2 flex-wrap text-base">
                                {item.name}
                                <Badge variant="outline" className="font-mono text-[10px] bg-bg-app-soft py-0 text-text-muted font-bold">
                                  {item.sku}
                                </Badge>
                                {isCritical && (
                                  <Badge className="bg-danger-red text-white text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 border border-danger-red animate-pulse">
                                    Mindestbestand unterschritten
                                  </Badge>
                                )}
                              </h4>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted mt-1 font-semibold">
                                <span className="text-navy-900 flex items-center gap-1">
                                  <MapPin className="h-3.5 w-3.5 text-accent-orange" /> {item.storageLocation}
                                </span>
                                <span>•</span>
                                <span>Min-Soll: {item.minStock} {item.unit}</span>
                                {item.isHazardous && (
                                  <>
                                    <span>•</span>
                                    <span className="text-danger-red font-bold uppercase text-[9px]">Gefahrstoff ☣️</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Stock value count + large touch +/- quick adjustments */}
                          <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-0 pt-3 sm:pt-0">
                            <div className="text-left sm:text-right">
                              <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">Lagerbestand</span>
                              <span className={`text-2xl font-black ${isCritical ? "text-danger-red font-serif" : "text-navy-900"}`}>
                                {item.currentStock} <span className="text-sm font-bold text-text-muted">{item.unit}</span>
                              </span>
                            </div>
                            
                            {/* Stepper buttons for hand gloves tablet adjustment */}
                            <div className="flex items-center gap-1.5 bg-bg-app-soft p-1 rounded-xl border border-neutral-gray-300">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-9 w-9 bg-white text-navy-900 rounded-lg shadow-sm hover:bg-bg-app-soft border border-neutral-gray-300 cursor-pointer"
                                onClick={(e) => handleQuickAdjust(item.id, "minus", e)}
                              >
                                <Minus className="h-4.5 w-4.5 font-bold" />
                              </Button>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-9 w-9 bg-white text-navy-900 rounded-lg shadow-sm hover:bg-bg-app-soft border border-neutral-gray-300 cursor-pointer"
                                onClick={(e) => handleQuickAdjust(item.id, "plus", e)}
                              >
                                <Plus className="h-4.5 w-4.5 font-bold" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-12 text-center text-text-muted">
                      <Package className="h-12 w-12 text-text-muted mx-auto mb-3" />
                      <p className="font-bold text-lg">Keine Lagerartikel gefunden</p>
                      <p className="text-sm mt-1">Ändere deine Suchbegriffe oder Filteroptionen.</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* SECTION 2: DIGITAL BATH REGULATION CARD VIEWS */}
          {activeSection === "baths" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredBaths.length > 0 ? (
                filteredBaths.map((bath) => {
                  const isSelected = selectedBathId === bath.id;
                  const isCritical = bath.status === "critical";
                  const isWatch = bath.status === "watch";
                  
                  return (
                    <Card
                      key={bath.id}
                      onClick={() => { setSelectedBathId(bath.id); trackUiEvent("detail_open", { target: "bath", id: bath.id }); }}
                      className={`cursor-pointer transition-all duration-300 relative border-2 ${
                        isSelected 
                          ? "ring-2 ring-navy-900 border-navy-900 shadow-md scale-[1.01]" 
                          : isCritical 
                            ? "border-danger-red bg-accent-orange-soft/20 hover:bg-accent-orange-soft/40" 
                            : isWatch
                              ? "border-gold-600 bg-gold-100/20 hover:bg-gold-100/40"
                              : "border-neutral-gray-300 hover:border-gold-600"
                      }`}
                    >
                      <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black text-text-muted bg-bg-app-soft border border-neutral-gray-300 px-2 py-0.5 rounded-md">
                              {bath.bathNumber}
                            </span>
                            <span className="text-xs text-text-muted font-bold uppercase tracking-wider">
                              {bath.processType === "nickel" ? "Nickelbad" : bath.processType === "chrome" ? "Verchromung" : bath.processType === "degreasing" ? "Reinigung" : "Entmetallisierung"}
                            </span>
                          </div>
                          <CardTitle className="text-xl font-extrabold text-navy-900 tracking-tight mt-1 font-serif">
                            {bath.name}
                          </CardTitle>
                        </div>
                        
                        <Badge className={`font-extrabold text-[10px] uppercase tracking-wider px-2.5 py-1 ${
                          isCritical 
                            ? "bg-danger-red text-white border border-danger-red animate-pulse"
                            : isWatch 
                              ? "bg-gold-1000 text-white border border-gold-600"
                              : "bg-success-green text-white border border-success-green"
                        }`}>
                          {bath.status === "critical" ? "KRITISCH" : bath.status === "watch" ? "BEACHTEN" : "STABIL"}
                        </Badge>
                      </CardHeader>
                      
                      <CardContent className="pb-4 px-4 pt-1 space-y-4">
                        {/* Target parameters summary grids */}
                        <div className="grid grid-cols-3 gap-2 bg-white/70 p-3 rounded-xl border border-neutral-gray-100">
                          <div className="text-center">
                            <div className="flex items-center justify-center text-text-muted gap-0.5">
                              <Thermometer className="h-3.5 w-3.5" />
                              <span className="text-[9px] font-bold uppercase tracking-wider">Temperatur</span>
                            </div>
                            <span className="text-base font-black text-navy-900 block mt-0.5">
                              {bath.targetValues.temperatureMin}–{bath.targetValues.temperatureMax} °C
                            </span>
                          </div>
                          <div className="text-center border-x border-neutral-gray-100">
                            <div className="flex items-center justify-center text-text-muted gap-0.5">
                              <Droplets className="h-3.5 w-3.5" />
                              <span className="text-[9px] font-bold uppercase tracking-wider">pH-Wert</span>
                            </div>
                            <span className="text-base font-black text-navy-900 block mt-0.5">
                              {bath.targetValues.phMin}–{bath.targetValues.phMax}
                            </span>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center justify-center text-text-muted gap-0.5">
                              <Activity className="h-3.5 w-3.5" />
                              <span className="text-[9px] font-bold uppercase tracking-wider">Konz.</span>
                            </div>
                            <span className="text-base font-black text-navy-900 block mt-0.5">
                              {bath.targetValues.concentrationMin}–{bath.targetValues.concentrationMax}%
                            </span>
                          </div>
                        </div>

                        {bath.lastMeasurementAt && (
                          <p className="text-[10px] text-text-muted font-semibold flex items-center justify-between px-1">
                            <span>Letzte Prüfung: {new Date(bath.lastMeasurementAt).toLocaleDateString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span>
                            {bath.nextMeasurementDueAt && (
                              <span className={new Date(bath.nextMeasurementDueAt) < new Date() ? "text-danger-red font-extrabold animate-pulse" : ""}>
                                Nächste fällig: {new Date(bath.nextMeasurementDueAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            )}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <div className="col-span-2 p-12 text-center text-text-muted">
                  <FlaskConical className="h-12 w-12 text-text-muted mx-auto mb-3" />
                  <p className="font-bold text-lg">Keine galvanische Beschichtung gefunden</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Detail View, Logs, and Forms Panels (35-40% width) */}
        <div className="w-full shrink-0">
          
          {/* SECTION 1 DETAIL CARD: INVENTORY DETAILS */}
          {activeSection === "inventory" && selectedItem && (
            <Card className="shadow-md border-neutral-gray-100 overflow-hidden sticky top-24">
              <div className="bg-navy-900 text-white p-5 relative">
                <div className="absolute right-0 top-0 -mt-10 -mr-10 w-28 h-28 bg-gold-1000/10 rounded-full blur-2xl pointer-events-none"></div>
                <span className="text-[9px] uppercase font-black text-text-muted tracking-widest font-mono">Lager-Akte</span>
                <h3 className="font-black text-2xl leading-none mt-1.5 font-serif text-white">{selectedItem.name}</h3>
                <div className="flex gap-2 items-center mt-2.5">
                  <Badge variant="outline" className="text-[10px] border-navy-700 bg-navy-900 text-text-muted font-mono font-bold">
                    SKU: {selectedItem.sku}
                  </Badge>
                  <Badge className={`text-[9px] uppercase tracking-wider font-extrabold py-0.5 px-2.5 ${
                    selectedItem.category === "chemical" 
                      ? "bg-navy-700 text-white border-navy-500" 
                      : "bg-gold-600 text-white border-gold-600"
                  }`}>
                    {selectedItem.category === "chemical" ? "Chemie" : selectedItem.category === "consumable" ? "Verbrauchsmaterial" : selectedItem.category === "tooling" ? "Werkzeuge" : "Verpackung"}
                  </Badge>
                </div>
              </div>

              {/* Main Specification Data */}
              <div className="p-5 border-b border-neutral-gray-100 bg-bg-app-soft/50 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[9px] font-black text-text-muted uppercase tracking-wider block">Lagerort</span>
                    <p className="text-sm font-extrabold text-navy-900 flex items-center gap-1 mt-0.5">
                      <MapPin className="h-4 w-4 text-accent-orange shrink-0" /> {selectedItem.storageLocation}
                    </p>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-text-muted uppercase tracking-wider block">Mindest-Sollbestand</span>
                    <p className="text-sm font-extrabold text-navy-900 mt-0.5">
                      {selectedItem.minStock} {selectedItem.unit}
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-neutral-gray-300">
                  <div>
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Verfügbarer Bestand</span>
                    <span className={`text-2xl font-black block mt-0.5 ${
                      selectedItem.currentStock < selectedItem.minStock ? "text-danger-red" : "text-navy-900"
                    }`}>
                      {selectedItem.currentStock} {selectedItem.unit}
                    </span>
                  </div>
                  <Badge className={`font-black text-[10px] uppercase py-1 px-3 ${
                    selectedItem.currentStock < selectedItem.minStock 
                      ? "bg-accent-orange-soft text-danger-red border-danger-red hover:bg-accent-orange-soft animate-pulse" 
                      : "bg-success-green-soft text-success-green border-success-green hover:bg-success-green-soft"
                  }`}>
                    {selectedItem.currentStock < selectedItem.minStock ? "⚠️ NACHBESTELLEN" : "✅ STABIL"}
                  </Badge>
                </div>
              </div>

              {/* Action 1 Form: Book inventory transaction */}
              <CardContent className="p-5 space-y-6">
                <form onSubmit={handleDetailedBooking} className="space-y-4 bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-300">
                  <span className="text-xs font-black text-navy-900 uppercase tracking-wider block mb-1">
                    Bestand buchen
                  </span>
                  
                  {/* Stock direction switcher buttons */}
                  <div className="grid grid-cols-2 gap-2 bg-neutral-gray-100/50 p-1 rounded-xl border">
                    <button
                      type="button"
                      onClick={() => setBookingType("stock_in")}
                      className={`py-2 rounded-lg font-bold text-xs transition-all ${
                        bookingType === "stock_in"
                          ? "bg-white text-navy-900 shadow-sm border border-neutral-gray-300"
                          : "text-text-muted hover:text-navy-900 bg-transparent border-0"
                      }`}
                    >
                      <Plus className="h-3.5 w-3.5 inline mr-1" /> Stock In (Eingang)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBookingType("stock_out")}
                      className={`py-2 rounded-lg font-bold text-xs transition-all ${
                        bookingType === "stock_out"
                          ? "bg-white text-danger-red shadow-sm border border-neutral-gray-300"
                          : "text-text-muted hover:text-navy-900 bg-transparent border-0"
                      }`}
                    >
                      <Minus className="h-3.5 w-3.5 inline mr-1" /> Stock Out (Abgang)
                    </button>
                  </div>

                  {/* Quantity and reason controls */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest pl-0.5">Menge ({selectedItem.unit})</label>
                    <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-xl border border-neutral-gray-300">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-lg shrink-0"
                        onClick={() => setBookingQty(q => Math.max(1, q - 1))}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <input
                        type="number"
                        min="1"
                        value={bookingQty}
                        onChange={(e) => setBookingQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full text-center font-extrabold text-lg text-navy-900 bg-transparent border-0 outline-none"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-lg shrink-0"
                        onClick={() => setBookingQty(q => q + 1)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-text-muted uppercase tracking-widest pl-0.5">Grund / Bemerkung</label>
                    <Input
                      type="text"
                      className="bg-white border-neutral-gray-300 rounded-xl font-semibold text-navy-900 text-sm h-10"
                      placeholder="z.B. Lieferung Fa. BASF, Materialbruch etc."
                      value={bookingReason}
                      onChange={(e) => setBookingReason(e.target.value)}
                    />
                  </div>

                  <Button
                    type="submit"
                    className={`w-full h-11 text-xs font-black rounded-xl text-white shadow-sm hover:brightness-95 cursor-pointer flex items-center justify-center gap-1.5 ${
                      bookingType === "stock_in" ? "bg-navy-900 border-navy-900" : "bg-danger-red border-danger-red"
                    }`}
                  >
                    {bookingType === "stock_in" ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                    <span>Buchung abschließen</span>
                  </Button>
                </form>

                {/* History list of selected item stock movements */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-black text-text-muted uppercase tracking-widest flex items-center gap-1 pl-0.5">
                    <History className="h-4 w-4" />
                    Bewegungshistorie
                  </h4>
                  
                  <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                    {selectedItemMovements.length > 0 ? (
                      selectedItemMovements.map((mov) => {
                        const isIn = mov.movementType === "stock_in";
                        const isConsumption = mov.movementType === "consumption";
                        
                        return (
                          <div key={mov.id} className="p-3 bg-white rounded-xl border border-neutral-gray-100 text-xs flex justify-between gap-3 shadow-xs">
                            <div className="space-y-0.5">
                              <span className="font-bold text-navy-900 block leading-tight">
                                {mov.reason || (isIn ? "Wareneingang" : "Warenabgang")}
                              </span>
                              <div className="flex items-center gap-2 text-[10px] text-text-muted font-semibold mt-0.5">
                                <span>{new Date(mov.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                                <span>•</span>
                                <span className="flex items-center gap-0.5">
                                  <User className="h-2.5 w-2.5" /> Max M.
                                </span>
                              </div>
                            </div>
                            
                            <span className={`font-black text-sm whitespace-nowrap ${
                              isIn 
                                ? "text-success-green" 
                                : isConsumption 
                                  ? "text-accent-orange" 
                                  : "text-danger-red"
                            }`}>
                              {isIn ? "+" : "-"}{mov.quantity} {mov.unit}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-[11px] text-text-muted py-3 text-center">Noch keine Buchungen für diesen Artikel vorhanden.</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* SECTION 2 DETAIL CARD: BATH DETAILS & DIGITAL RULE CARD ACTIONS */}
          <DetailOverlay
            open={activeSection === "baths" && !!selectedBath}
            onClose={() => setSelectedBathId(null)}
            title="Prozess-Kontrollkarte"
            subtitle={selectedBath?.name}
            badgeContent={selectedBath ? `Bad ${selectedBath.bathNumber}` : undefined}
          >
            {selectedBath && (
              <div>
              <div className="p-4 bg-bg-app-soft border-b border-neutral-gray-100 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Badge className={`font-extrabold text-[10px] uppercase py-1 px-2.5 ${
                    selectedBath.status === "critical" 
                      ? "bg-accent-orange-soft text-danger-red border-danger-red hover:bg-accent-orange-soft animate-pulse" 
                      : selectedBath.status === "watch"
                        ? "bg-gold-100 text-gold-600 border-gold-600 hover:bg-gold-100"
                        : "bg-success-green-soft text-success-green border-success-green hover:bg-success-green-soft"
                  }`}>
                    {selectedBath.status === "critical" ? "🔴 KRITISCH" : selectedBath.status === "watch" ? "🟡 BEOBACHTEN" : "🟢 PROZESS STABIL"}
                  </Badge>
                </div>

                {/* manual Override Lock / Unlock button */}
                {selectedBath.status === "critical" ? (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-8 text-[11px] font-bold gap-1 text-success-green border-success-green bg-success-green-soft hover:bg-success-green cursor-pointer"
                    onClick={() => handleStatusOverride("stable", "Meister-Freigabe nach manueller Sichtprüfung.")}
                  >
                    <Unlock className="h-3.5 w-3.5" /> Bad Freigeben
                  </Button>
                ) : (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-8 text-[11px] font-bold gap-1 text-danger-red border-danger-red bg-accent-orange-soft hover:bg-danger-red cursor-pointer"
                    onClick={() => handleStatusOverride("critical", "Präventive Sperrung durch Meister wegen Verunreinigung.")}
                  >
                    <Lock className="h-3.5 w-3.5" /> Bad Sperren
                  </Button>
                )}
              </div>

              {/* Dynamic scrollable sub-tabs for bath forms (Measurements or Additions) */}
              <CardContent className="p-5 space-y-6 max-h-[580px] overflow-y-auto pr-2">
                
                {/* FORM 1: Enter Chemical Bath Measurement */}
                <form onSubmit={handleMeasurementBooking} className="space-y-3.5 bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-300">
                  <div className="flex items-center gap-1.5 text-xs font-black text-navy-900 uppercase tracking-wider mb-1">
                    <Activity className="h-4 w-4 text-navy-900" />
                    <span>Messung eintragen</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-text-muted uppercase tracking-widest pl-0.5">Temp (°C)</label>
                      <Input
                        type="number"
                        step="0.1"
                        className="bg-white border-neutral-gray-300 rounded-lg text-xs font-bold text-center h-9 pr-0"
                        placeholder={`Soll: ${selectedBath.targetValues.temperatureMin}-${selectedBath.targetValues.temperatureMax}`}
                        value={measTemp}
                        onChange={(e) => setMeasTemp(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-text-muted uppercase tracking-widest pl-0.5">pH-Wert</label>
                      <Input
                        type="number"
                        step="0.05"
                        className="bg-white border-neutral-gray-300 rounded-lg text-xs font-bold text-center h-9 pr-0"
                        placeholder={`Soll: ${selectedBath.targetValues.phMin}-${selectedBath.targetValues.phMax}`}
                        value={measPh}
                        onChange={(e) => setMeasPh(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-text-muted uppercase tracking-widest pl-0.5">Konz (%)</label>
                      <Input
                        type="number"
                        step="1"
                        className="bg-white border-neutral-gray-300 rounded-lg text-xs font-bold text-center h-9 pr-0"
                        placeholder={`Soll: ${selectedBath.targetValues.concentrationMin}-${selectedBath.targetValues.concentrationMax}`}
                        value={measConc}
                        onChange={(e) => setMeasConc(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-text-muted uppercase tracking-widest pl-0.5">Sichtprüfung</label>
                      <select
                        className="w-full bg-white border border-neutral-gray-300 rounded-lg text-xs font-bold text-navy-900 h-9 px-2.5 focus:border-navy-700 outline-none"
                        value={measVisual}
                        onChange={(e) => setMeasVisual(e.target.value)}
                      >
                        <option value="clean">Sauber / Klar</option>
                        <option value="cloudy">Trüb / Beobachten</option>
                        <option value="contaminated">Verunreinigt ⚠️</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-text-muted uppercase tracking-widest pl-0.5">Bemerkung</label>
                      <Input
                        type="text"
                        className="bg-white border-neutral-gray-300 rounded-lg text-xs font-semibold h-9"
                        placeholder="Frei text..."
                        value={measNote}
                        onChange={(e) => setMeasNote(e.target.value)}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-10 text-xs font-black bg-navy-900 border-navy-900 rounded-xl text-white hover:bg-navy-700 shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Check className="h-4 w-4" />
                    <span>Messwerte speichern</span>
                  </Button>
                </form>

                {/* FORM 2: Log Chemical addition (Dosierung) */}
                <form onSubmit={handleAdditionBooking} className="space-y-3.5 bg-bg-app-soft p-4 rounded-xl border border-neutral-gray-300">
                  <div className="flex items-center gap-1.5 text-xs font-black text-navy-900 uppercase tracking-wider mb-1">
                    <FlaskConical className="h-4 w-4 text-navy-900" />
                    <span>Chemie zusetzen (Dosierung)</span>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-text-muted uppercase tracking-widest pl-0.5">Gefahrstoff / Zusatz chemie</label>
                    <select
                      className="w-full bg-white border border-neutral-gray-300 rounded-lg text-xs font-bold text-navy-900 h-9 px-2.5 focus:border-navy-700 outline-none"
                      value={addChemId}
                      onChange={(e) => setAddChemId(e.target.value)}
                      required
                    >
                      <option value="">-- Chemie-Bestand wählen --</option>
                      {chemicalList.map(chem => (
                        <option key={chem.id} value={chem.id}>
                          {chem.name} (Verfügbar: {chem.currentStock} {chem.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <label className="block text-[9px] font-bold text-text-muted uppercase tracking-widest pl-0.5">Zusatzmenge</label>
                      <div className="flex items-center gap-2 bg-white px-2 py-0.5 rounded-lg border border-neutral-gray-300">
                        <button
                          type="button"
                          className="h-7 w-7 rounded-md border text-text-muted bg-bg-app-soft flex items-center justify-center font-bold text-sm"
                          onClick={() => setAddQty(q => Math.max(1, q - 1))}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          className="w-full text-center font-extrabold text-xs text-navy-900 bg-transparent border-0 outline-none h-7"
                          value={addQty}
                          onChange={(e) => setAddQty(Math.max(1, parseInt(e.target.value) || 1))}
                        />
                        <button
                          type="button"
                          className="h-7 w-7 rounded-md border text-text-muted bg-bg-app-soft flex items-center justify-center font-bold text-sm"
                          onClick={() => setAddQty(q => q + 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-text-muted uppercase tracking-widest pl-0.5">Grund der Dosierung</label>
                      <Input
                        type="text"
                        className="bg-white border-neutral-gray-300 rounded-lg text-xs font-semibold h-9"
                        placeholder="z.B. pH-Senkung"
                        value={addReason}
                        onChange={(e) => setAddReason(e.target.value)}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-10 text-xs font-black bg-navy-900 border-navy-900 rounded-xl text-white hover:bg-navy-700 shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Zusatz buchen & Abbuchen</span>
                  </Button>
                </form>

                {/* Combined Timeline log of recent measurements & additions */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-black text-text-muted uppercase tracking-widest flex items-center gap-1 pl-0.5">
                    <History className="h-4 w-4" />
                    Messungs- & Zusatzhistorie
                  </h4>
                  
                  <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                    {/* Render measurements */}
                    {selectedBathMeasurements.map((m) => (
                      <div key={m.id} className="p-3 bg-white rounded-xl border border-neutral-gray-100 text-xs space-y-1.5 shadow-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-navy-900">
                            Prüfung · {m.measuredBy === "meister@kreile.de" ? "Meister" : "Fachkraft"}
                          </span>
                          <Badge className={`text-[8px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 ${
                            m.statusAfterMeasurement === "critical"
                              ? "bg-accent-orange-soft text-danger-red border border-danger-red"
                              : m.statusAfterMeasurement === "watch"
                                ? "bg-gold-100 text-gold-600 border border-gold-600"
                                : "bg-success-green-soft text-success-green border border-success-green"
                          }`}>
                            {m.statusAfterMeasurement === "critical" ? "Kritisch" : m.statusAfterMeasurement === "watch" ? "Beobachten" : "Stabil"}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-1 bg-bg-app-soft p-2 rounded-lg border border-neutral-gray-100 text-[10px] text-center font-semibold text-text-muted">
                          <div>T: {m.temperature ? `${m.temperature}°C` : "N/A"}</div>
                          <div className="border-x">pH: {m.ph ? m.ph : "N/A"}</div>
                          <div>K: {m.concentration ? `${m.concentration}%` : "N/A"}</div>
                        </div>

                        {m.note && <p className="text-[10px] text-text-muted italic bg-bg-app-soft/50 p-1.5 rounded border border-dashed border-neutral-gray-300 leading-normal">{m.note}</p>}
                        
                        <span className="text-[9px] text-text-muted block font-semibold">
                          {new Date(m.measuredAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))}

                    {/* Render additions */}
                    {selectedBathAdditions.map((a) => (
                      <div key={a.id} className="p-3 bg-surface-tinted/40 rounded-xl border border-navy-500 text-xs space-y-1 shadow-xs">
                        <div className="flex justify-between items-center text-navy-700 font-bold">
                          <span>🧪 Chemie-Dosierung</span>
                          <span>+{a.quantity} {a.unit}</span>
                        </div>
                        <p className="text-navy-900 font-semibold text-[11px] leading-tight">
                          Zusatz von <span className="font-extrabold">{a.inventoryItemName}</span>
                        </p>
                        <p className="text-text-muted text-[10px]">{a.reason}</p>
                        <span className="text-[9px] text-navy-700 block font-semibold pt-0.5">
                          {new Date(a.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))}

                    {selectedBathMeasurements.length === 0 && selectedBathAdditions.length === 0 && (
                      <p className="text-[11px] text-text-muted py-3 text-center">Noch keine Historie erfasst.</p>
                    )}
                  </div>
                </div>
              </CardContent>
              </div>
            )}
          </DetailOverlay>

        </div>

      </div>
      
    </div>
  );
}
