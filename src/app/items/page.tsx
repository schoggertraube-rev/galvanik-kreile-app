"use client";

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

export default function ItemsPage() {
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
    <div className="space-y-6 pb-12 font-sans antialiased text-slate-900">
      
      {/* Title & Section Selector Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight font-serif flex items-center gap-3">
            <Package className="h-8 w-8 text-blue-900" />
            Lager & Chemieverwaltung
          </h1>
          <p className="text-slate-500 mt-1">
            Tablet-Leitstand für Bestände, Materialbewegungen und chemische Bäder
          </p>
        </div>

        {/* Tab switch button groups for touchscreens */}
        <div className="bg-slate-100 p-1 rounded-2xl flex gap-1 border">
          <Button 
            onClick={() => {
              setActiveSection("inventory");
              setSearchTerm("");
            }}
            className={`px-6 py-2.5 rounded-xl font-bold transition-all text-sm cursor-pointer ${
              activeSection === "inventory" 
                ? "bg-white text-blue-950 shadow-sm border border-slate-200 hover:bg-white" 
                : "bg-transparent text-slate-600 hover:bg-slate-200/50 hover:text-slate-950 shadow-none border-none"
            }`}
          >
            <Package className="h-4 w-4 mr-2" />
            Lagerbestand & Chemie
          </Button>
          <Button 
            onClick={() => {
              setActiveSection("baths");
              setSearchTerm("");
            }}
            className={`px-6 py-2.5 rounded-xl font-bold transition-all text-sm cursor-pointer ${
              activeSection === "baths" 
                ? "bg-white text-blue-950 shadow-sm border border-slate-200 hover:bg-white" 
                : "bg-transparent text-slate-600 hover:bg-slate-200/50 hover:text-slate-950 shadow-none border-none"
            }`}
          >
            <FlaskConical className="h-4 w-4 mr-2" />
            Digitale Badregelkarte
          </Button>
        </div>
      </div>

      {/* Main Grid View - 13.5" Optimized Side-by-Side Dual Panels */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        
        {/* Left Side: Main Tables / Cards Grid (60-65% width) */}
        <div className="xl:col-span-2 space-y-4 w-full">
          
          {/* Filters and search layout */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                className="pl-10 h-11 bg-slate-50 border-slate-200 rounded-xl w-full text-base font-medium"
                placeholder={activeSection === "inventory" ? "Artikel suchen nach Name, SKU, Lagerort..." : "Bäder suchen..."}
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
                        ? "bg-blue-900 text-white border-blue-900"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
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
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <div className="p-0">
                <div className="divide-y divide-slate-150">
                  {filteredInventoryItems.length > 0 ? (
                    filteredInventoryItems.map((item) => {
                      const isCritical = item.currentStock < item.minStock;
                      const isSelected = selectedItemId === item.id;
                      
                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedItemId(item.id)}
                          className={`p-4 hover:bg-slate-50/50 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                            isSelected ? "bg-slate-50/80 border-l-4 border-blue-900" : "border-l-4 border-transparent"
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            {/* Visual Category avatar */}
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shrink-0 ${
                              isCritical 
                                ? "bg-red-50 text-red-650 border-red-200 animate-pulse" 
                                : item.category === "chemical" 
                                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                  : item.category === "consumable" 
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-slate-50 text-slate-700 border-slate-200"
                            }`}>
                              {item.category === "chemical" ? (
                                <FlaskConical className="h-6 w-6" />
                              ) : (
                                <Package className="h-6 w-6" />
                              )}
                            </div>
                            
                            <div>
                              <h4 className="font-extrabold text-slate-950 flex items-center gap-2 flex-wrap text-base">
                                {item.name}
                                <Badge variant="outline" className="font-mono text-[10px] bg-slate-100 py-0 text-slate-600 font-bold">
                                  {item.sku}
                                </Badge>
                                {isCritical && (
                                  <Badge className="bg-red-600 text-white text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 border border-red-700 animate-pulse">
                                    Mindestbestand unterschritten
                                  </Badge>
                                )}
                              </h4>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1 font-semibold">
                                <span className="text-slate-700 flex items-center gap-1">
                                  <MapPin className="h-3.5 w-3.5 text-orange-500" /> {item.storageLocation}
                                </span>
                                <span>•</span>
                                <span>Min-Soll: {item.minStock} {item.unit}</span>
                                {item.isHazardous && (
                                  <>
                                    <span>•</span>
                                    <span className="text-red-500 font-bold uppercase text-[9px]">Gefahrstoff ☣️</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Stock value count + large touch +/- quick adjustments */}
                          <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-0 pt-3 sm:pt-0">
                            <div className="text-left sm:text-right">
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Lagerbestand</span>
                              <span className={`text-2xl font-black ${isCritical ? "text-red-600 font-serif" : "text-slate-900"}`}>
                                {item.currentStock} <span className="text-sm font-bold text-slate-500">{item.unit}</span>
                              </span>
                            </div>
                            
                            {/* Stepper buttons for hand gloves tablet adjustment */}
                            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-9 w-9 bg-white text-slate-800 rounded-lg shadow-sm hover:bg-slate-50 border border-slate-200 cursor-pointer"
                                onClick={(e) => handleQuickAdjust(item.id, "minus", e)}
                              >
                                <Minus className="h-4.5 w-4.5 font-bold" />
                              </Button>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-9 w-9 bg-white text-slate-800 rounded-lg shadow-sm hover:bg-slate-50 border border-slate-200 cursor-pointer"
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
                    <div className="p-12 text-center text-slate-500">
                      <Package className="h-12 w-12 text-slate-300 mx-auto mb-3" />
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
                      onClick={() => setSelectedBathId(bath.id)}
                      className={`cursor-pointer transition-all duration-300 relative border-2 ${
                        isSelected 
                          ? "ring-2 ring-blue-900 border-blue-900 shadow-md scale-[1.01]" 
                          : isCritical 
                            ? "border-red-200 bg-red-50/20 hover:bg-red-50/40" 
                            : isWatch
                              ? "border-amber-200 bg-amber-50/20 hover:bg-amber-50/40"
                              : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                              {bath.bathNumber}
                            </span>
                            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                              {bath.processType === "nickel" ? "Nickelbad" : bath.processType === "chrome" ? "Verchromung" : bath.processType === "degreasing" ? "Reinigung" : "Entmetallisierung"}
                            </span>
                          </div>
                          <CardTitle className="text-xl font-extrabold text-slate-900 tracking-tight mt-1 font-serif">
                            {bath.name}
                          </CardTitle>
                        </div>
                        
                        <Badge className={`font-extrabold text-[10px] uppercase tracking-wider px-2.5 py-1 ${
                          isCritical 
                            ? "bg-red-650 text-white border border-red-700 animate-pulse"
                            : isWatch 
                              ? "bg-amber-500 text-white border border-amber-600"
                              : "bg-emerald-600 text-white border border-emerald-700"
                        }`}>
                          {bath.status === "critical" ? "KRITISCH" : bath.status === "watch" ? "BEACHTEN" : "STABIL"}
                        </Badge>
                      </CardHeader>
                      
                      <CardContent className="pb-4 px-4 pt-1 space-y-4">
                        {/* Target parameters summary grids */}
                        <div className="grid grid-cols-3 gap-2 bg-white/70 p-3 rounded-xl border border-slate-150">
                          <div className="text-center">
                            <div className="flex items-center justify-center text-slate-400 gap-0.5">
                              <Thermometer className="h-3.5 w-3.5" />
                              <span className="text-[9px] font-bold uppercase tracking-wider">Temperatur</span>
                            </div>
                            <span className="text-base font-black text-slate-800 block mt-0.5">
                              {bath.targetValues.temperatureMin}–{bath.targetValues.temperatureMax} °C
                            </span>
                          </div>
                          <div className="text-center border-x border-slate-150">
                            <div className="flex items-center justify-center text-slate-400 gap-0.5">
                              <Droplets className="h-3.5 w-3.5" />
                              <span className="text-[9px] font-bold uppercase tracking-wider">pH-Wert</span>
                            </div>
                            <span className="text-base font-black text-slate-800 block mt-0.5">
                              {bath.targetValues.phMin}–{bath.targetValues.phMax}
                            </span>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center justify-center text-slate-400 gap-0.5">
                              <Activity className="h-3.5 w-3.5" />
                              <span className="text-[9px] font-bold uppercase tracking-wider">Konz.</span>
                            </div>
                            <span className="text-base font-black text-slate-800 block mt-0.5">
                              {bath.targetValues.concentrationMin}–{bath.targetValues.concentrationMax}%
                            </span>
                          </div>
                        </div>

                        {bath.lastMeasurementAt && (
                          <p className="text-[10px] text-slate-400 font-semibold flex items-center justify-between px-1">
                            <span>Letzte Prüfung: {new Date(bath.lastMeasurementAt).toLocaleDateString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span>
                            {bath.nextMeasurementDueAt && (
                              <span className={new Date(bath.nextMeasurementDueAt) < new Date() ? "text-red-500 font-extrabold animate-pulse" : ""}>
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
                <div className="col-span-2 p-12 text-center text-slate-500">
                  <FlaskConical className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="font-bold text-lg">Keine galvanischen Bäder gefunden</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Detail View, Logs, and Forms Panels (35-40% width) */}
        <div className="w-full shrink-0">
          
          {/* SECTION 1 DETAIL CARD: INVENTORY DETAILS */}
          {activeSection === "inventory" && selectedItem && (
            <Card className="shadow-md border-blue-100 overflow-hidden sticky top-24">
              <div className="bg-slate-900 text-white p-5 relative">
                <div className="absolute right-0 top-0 -mt-10 -mr-10 w-28 h-28 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
                <span className="text-[9px] uppercase font-black text-slate-400 tracking-widest font-mono">Lager-Akte</span>
                <h3 className="font-black text-2xl leading-none mt-1.5 font-serif text-white">{selectedItem.name}</h3>
                <div className="flex gap-2 items-center mt-2.5">
                  <Badge variant="outline" className="text-[10px] border-slate-700 bg-slate-800 text-slate-300 font-mono font-bold">
                    SKU: {selectedItem.sku}
                  </Badge>
                  <Badge className={`text-[9px] uppercase tracking-wider font-extrabold py-0.5 px-2.5 ${
                    selectedItem.category === "chemical" 
                      ? "bg-indigo-600 text-white border-indigo-700" 
                      : "bg-amber-600 text-white border-amber-700"
                  }`}>
                    {selectedItem.category === "chemical" ? "Chemie" : selectedItem.category === "consumable" ? "Verbrauchsmaterial" : selectedItem.category === "tooling" ? "Werkzeuge" : "Verpackung"}
                  </Badge>
                </div>
              </div>

              {/* Main Specification Data */}
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Lagerort</span>
                    <p className="text-sm font-extrabold text-slate-800 flex items-center gap-1 mt-0.5">
                      <MapPin className="h-4 w-4 text-orange-500 shrink-0" /> {selectedItem.storageLocation}
                    </p>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Mindest-Sollbestand</span>
                    <p className="text-sm font-extrabold text-slate-800 mt-0.5">
                      {selectedItem.minStock} {selectedItem.unit}
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Verfügbarer Bestand</span>
                    <span className={`text-2xl font-black block mt-0.5 ${
                      selectedItem.currentStock < selectedItem.minStock ? "text-red-600" : "text-blue-900"
                    }`}>
                      {selectedItem.currentStock} {selectedItem.unit}
                    </span>
                  </div>
                  <Badge className={`font-black text-[10px] uppercase py-1 px-3 ${
                    selectedItem.currentStock < selectedItem.minStock 
                      ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-50 animate-pulse" 
                      : "bg-emerald-50 text-emerald-700 border-emerald-250 hover:bg-emerald-50"
                  }`}>
                    {selectedItem.currentStock < selectedItem.minStock ? "⚠️ NACHBESTELLEN" : "✅ STABIL"}
                  </Badge>
                </div>
              </div>

              {/* Action 1 Form: Book inventory transaction */}
              <CardContent className="p-5 space-y-6">
                <form onSubmit={handleDetailedBooking} className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider block mb-1">
                    Bestand buchen
                  </span>
                  
                  {/* Stock direction switcher buttons */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-200/50 p-1 rounded-xl border">
                    <button
                      type="button"
                      onClick={() => setBookingType("stock_in")}
                      className={`py-2 rounded-lg font-bold text-xs transition-all ${
                        bookingType === "stock_in"
                          ? "bg-white text-blue-900 shadow-sm border border-slate-200"
                          : "text-slate-600 hover:text-slate-900 bg-transparent border-0"
                      }`}
                    >
                      <Plus className="h-3.5 w-3.5 inline mr-1" /> Stock In (Eingang)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBookingType("stock_out")}
                      className={`py-2 rounded-lg font-bold text-xs transition-all ${
                        bookingType === "stock_out"
                          ? "bg-white text-red-700 shadow-sm border border-slate-200"
                          : "text-slate-600 hover:text-slate-900 bg-transparent border-0"
                      }`}
                    >
                      <Minus className="h-3.5 w-3.5 inline mr-1" /> Stock Out (Abgang)
                    </button>
                  </div>

                  {/* Quantity and reason controls */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-0.5">Menge ({selectedItem.unit})</label>
                    <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
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
                        className="w-full text-center font-extrabold text-lg text-slate-800 bg-transparent border-0 outline-none"
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
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-0.5">Grund / Bemerkung</label>
                    <Input
                      type="text"
                      className="bg-white border-slate-200 rounded-xl font-semibold text-slate-800 text-sm h-10"
                      placeholder="z.B. Lieferung Fa. BASF, Materialbruch etc."
                      value={bookingReason}
                      onChange={(e) => setBookingReason(e.target.value)}
                    />
                  </div>

                  <Button
                    type="submit"
                    className={`w-full h-11 text-xs font-black rounded-xl text-white shadow-sm hover:brightness-95 cursor-pointer flex items-center justify-center gap-1.5 ${
                      bookingType === "stock_in" ? "bg-blue-900 border-blue-950" : "bg-red-650 border-red-700"
                    }`}
                  >
                    {bookingType === "stock_in" ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                    <span>Buchung abschließen</span>
                  </Button>
                </form>

                {/* History list of selected item stock movements */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 pl-0.5">
                    <History className="h-4 w-4" />
                    Bewegungshistorie
                  </h4>
                  
                  <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                    {selectedItemMovements.length > 0 ? (
                      selectedItemMovements.map((mov) => {
                        const isIn = mov.movementType === "stock_in";
                        const isConsumption = mov.movementType === "consumption";
                        
                        return (
                          <div key={mov.id} className="p-3 bg-white rounded-xl border border-slate-150 text-xs flex justify-between gap-3 shadow-xs">
                            <div className="space-y-0.5">
                              <span className="font-bold text-slate-800 block leading-tight">
                                {mov.reason || (isIn ? "Wareneingang" : "Warenabgang")}
                              </span>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold mt-0.5">
                                <span>{new Date(mov.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                                <span>•</span>
                                <span className="flex items-center gap-0.5">
                                  <User className="h-2.5 w-2.5" /> Max M.
                                </span>
                              </div>
                            </div>
                            
                            <span className={`font-black text-sm whitespace-nowrap ${
                              isIn 
                                ? "text-emerald-600" 
                                : isConsumption 
                                  ? "text-orange-600" 
                                  : "text-red-600"
                            }`}>
                              {isIn ? "+" : "-"}{mov.quantity} {mov.unit}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-[11px] text-slate-400 py-3 text-center">Noch keine Buchungen für diesen Artikel vorhanden.</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* SECTION 2 DETAIL CARD: BATH DETAILS & DIGITAL RULE CARD ACTIONS */}
          {activeSection === "baths" && selectedBath && (
            <Card className="shadow-md border-blue-100 overflow-hidden sticky top-24">
              <div className="bg-slate-900 text-white p-5 relative">
                <div className="absolute right-0 top-0 -mt-10 -mr-10 w-28 h-28 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[9px] uppercase font-black text-slate-400 tracking-widest font-mono">Prozess-Kontrollkarte</span>
                    <h3 className="font-black text-2xl leading-none mt-1.5 font-serif text-white">{selectedBath.name}</h3>
                  </div>
                  <span className="font-mono text-base font-black text-blue-200 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl">
                    {selectedBath.bathNumber}
                  </span>
                </div>
              </div>

              {/* Quick Locked status block */}
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Badge className={`font-extrabold text-[10px] uppercase py-1 px-2.5 ${
                    selectedBath.status === "critical" 
                      ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-50 animate-pulse" 
                      : selectedBath.status === "watch"
                        ? "bg-amber-50 text-amber-700 border-amber-250 hover:bg-amber-50"
                        : "bg-emerald-50 text-emerald-700 border-emerald-250 hover:bg-emerald-50"
                  }`}>
                    {selectedBath.status === "critical" ? "🔴 KRITISCH" : selectedBath.status === "watch" ? "🟡 BEOBACHTEN" : "🟢 PROZESS STABIL"}
                  </Badge>
                </div>

                {/* manual Override Lock / Unlock button */}
                {selectedBath.status === "critical" ? (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-8 text-[11px] font-bold gap-1 text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 cursor-pointer"
                    onClick={() => handleStatusOverride("stable", "Meister-Freigabe nach manueller Sichtprüfung.")}
                  >
                    <Unlock className="h-3.5 w-3.5" /> Bad Freigeben
                  </Button>
                ) : (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-8 text-[11px] font-bold gap-1 text-red-650 border-red-200 bg-red-50 hover:bg-red-100 cursor-pointer"
                    onClick={() => handleStatusOverride("critical", "Präventive Sperrung durch Meister wegen Verunreinigung.")}
                  >
                    <Lock className="h-3.5 w-3.5" /> Bad Sperren
                  </Button>
                )}
              </div>

              {/* Dynamic scrollable sub-tabs for bath forms (Measurements or Additions) */}
              <CardContent className="p-5 space-y-6 max-h-[580px] overflow-y-auto pr-2">
                
                {/* FORM 1: Enter Chemical Bath Measurement */}
                <form onSubmit={handleMeasurementBooking} className="space-y-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                    <Activity className="h-4 w-4 text-blue-900" />
                    <span>Messung eintragen</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-0.5">Temp (°C)</label>
                      <Input
                        type="number"
                        step="0.1"
                        className="bg-white border-slate-200 rounded-lg text-xs font-bold text-center h-9 pr-0"
                        placeholder={`Soll: ${selectedBath.targetValues.temperatureMin}-${selectedBath.targetValues.temperatureMax}`}
                        value={measTemp}
                        onChange={(e) => setMeasTemp(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-0.5">pH-Wert</label>
                      <Input
                        type="number"
                        step="0.05"
                        className="bg-white border-slate-200 rounded-lg text-xs font-bold text-center h-9 pr-0"
                        placeholder={`Soll: ${selectedBath.targetValues.phMin}-${selectedBath.targetValues.phMax}`}
                        value={measPh}
                        onChange={(e) => setMeasPh(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-0.5">Konz (%)</label>
                      <Input
                        type="number"
                        step="1"
                        className="bg-white border-slate-200 rounded-lg text-xs font-bold text-center h-9 pr-0"
                        placeholder={`Soll: ${selectedBath.targetValues.concentrationMin}-${selectedBath.targetValues.concentrationMax}`}
                        value={measConc}
                        onChange={(e) => setMeasConc(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-0.5">Sichtprüfung</label>
                      <select
                        className="w-full bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 h-9 px-2.5 focus:border-blue-900 outline-none"
                        value={measVisual}
                        onChange={(e) => setMeasVisual(e.target.value)}
                      >
                        <option value="clean">Sauber / Klar</option>
                        <option value="cloudy">Trüb / Beobachten</option>
                        <option value="contaminated">Verunreinigt ⚠️</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-0.5">Bemerkung</label>
                      <Input
                        type="text"
                        className="bg-white border-slate-200 rounded-lg text-xs font-semibold h-9"
                        placeholder="Frei text..."
                        value={measNote}
                        onChange={(e) => setMeasNote(e.target.value)}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-10 text-xs font-black bg-blue-900 border-blue-950 rounded-xl text-white hover:bg-blue-800 shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Check className="h-4 w-4" />
                    <span>Messwerte speichern</span>
                  </Button>
                </form>

                {/* FORM 2: Log Chemical addition (Dosierung) */}
                <form onSubmit={handleAdditionBooking} className="space-y-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 uppercase tracking-wider mb-1">
                    <FlaskConical className="h-4 w-4 text-blue-900" />
                    <span>Chemie zusetzen (Dosierung)</span>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-0.5">Gefahrstoff / Zusatz chemie</label>
                    <select
                      className="w-full bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 h-9 px-2.5 focus:border-blue-900 outline-none"
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
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-0.5">Zusatzmenge</label>
                      <div className="flex items-center gap-2 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                        <button
                          type="button"
                          className="h-7 w-7 rounded-md border text-slate-600 bg-slate-50 flex items-center justify-center font-bold text-sm"
                          onClick={() => setAddQty(q => Math.max(1, q - 1))}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          className="w-full text-center font-extrabold text-xs text-slate-800 bg-transparent border-0 outline-none h-7"
                          value={addQty}
                          onChange={(e) => setAddQty(Math.max(1, parseInt(e.target.value) || 1))}
                        />
                        <button
                          type="button"
                          className="h-7 w-7 rounded-md border text-slate-600 bg-slate-50 flex items-center justify-center font-bold text-sm"
                          onClick={() => setAddQty(q => q + 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-0.5">Grund der Dosierung</label>
                      <Input
                        type="text"
                        className="bg-white border-slate-200 rounded-lg text-xs font-semibold h-9"
                        placeholder="z.B. pH-Senkung"
                        value={addReason}
                        onChange={(e) => setAddReason(e.target.value)}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-10 text-xs font-black bg-blue-900 border-blue-950 rounded-xl text-white hover:bg-blue-800 shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Zusatz buchen & Abbuchen</span>
                  </Button>
                </form>

                {/* Combined Timeline log of recent measurements & additions */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 pl-0.5">
                    <History className="h-4 w-4" />
                    Messungs- & Zusatzhistorie
                  </h4>
                  
                  <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                    {/* Render measurements */}
                    {selectedBathMeasurements.map((m) => (
                      <div key={m.id} className="p-3 bg-white rounded-xl border border-slate-150 text-xs space-y-1.5 shadow-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-800">
                            Prüfung · {m.measuredBy === "meister@kreile.de" ? "Meister" : "Fachkraft"}
                          </span>
                          <Badge className={`text-[8px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 ${
                            m.statusAfterMeasurement === "critical"
                              ? "bg-red-50 text-red-700 border border-red-200"
                              : m.statusAfterMeasurement === "watch"
                                ? "bg-amber-50 text-amber-700 border border-amber-250"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-250"
                          }`}>
                            {m.statusAfterMeasurement === "critical" ? "Kritisch" : m.statusAfterMeasurement === "watch" ? "Beobachten" : "Stabil"}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-1 bg-slate-50 p-2 rounded-lg border border-slate-100 text-[10px] text-center font-semibold text-slate-600">
                          <div>T: {m.temperature ? `${m.temperature}°C` : "N/A"}</div>
                          <div className="border-x">pH: {m.ph ? m.ph : "N/A"}</div>
                          <div>K: {m.concentration ? `${m.concentration}%` : "N/A"}</div>
                        </div>

                        {m.note && <p className="text-[10px] text-slate-500 italic bg-slate-50/50 p-1.5 rounded border border-dashed border-slate-200 leading-normal">{m.note}</p>}
                        
                        <span className="text-[9px] text-slate-400 block font-semibold">
                          {new Date(m.measuredAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))}

                    {/* Render additions */}
                    {selectedBathAdditions.map((a) => (
                      <div key={a.id} className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100 text-xs space-y-1 shadow-xs">
                        <div className="flex justify-between items-center text-indigo-950 font-bold">
                          <span>🧪 Chemie-Dosierung</span>
                          <span>+{a.quantity} {a.unit}</span>
                        </div>
                        <p className="text-slate-700 font-semibold text-[11px] leading-tight">
                          Zusatz von <span className="font-extrabold">{a.inventoryItemName}</span>
                        </p>
                        <p className="text-slate-500 text-[10px]">{a.reason}</p>
                        <span className="text-[9px] text-indigo-400 block font-semibold pt-0.5">
                          {new Date(a.createdAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))}

                    {selectedBathMeasurements.length === 0 && selectedBathAdditions.length === 0 && (
                      <p className="text-[11px] text-slate-400 py-3 text-center">Noch keine Historie erfasst.</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

        </div>

      </div>
      
    </div>
  );
}
