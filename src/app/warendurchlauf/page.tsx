"use client";

import { useState } from "react";
import { IntakeEntry } from "@/components/intake/IntakeEntry";
import { CameraCapture } from "@/components/intake/CameraCapture";
import { OCRReviewPanel } from "@/components/intake/OCRReviewPanel";
import { CustomerMatchPanel } from "@/components/intake/CustomerMatchPanel";
import { SuggestedItemsPanel } from "@/components/intake/SuggestedItemsPanel";
import { IntakeCompletionSummary } from "@/components/intake/IntakeCompletionSummary";
import { OCRScan, ocrService } from "@/lib/services/ocrService";
import {
  Camera,
  Search,
  Plus,
  Trash2,
  ArrowLeft,
  ChevronRight,
  UserPlus,
  UserCheck,
  CheckCircle,
  Loader2,
  Scan,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { customersRepository, Customer } from "@/lib/repositories/customersRepository";

type WizardStep =
  | "entry"
  | "camera"
  | "ocr_review"
  | "customer_match"
  | "items"
  | "summary"
  | "manual_customer"
  | "manual_customer_edit"
  | "manual_items"
  | "manual_summary";

const generateAutofillDetails = (companyName: string) => {
  const name = companyName.trim();
  
  // Plausible cities and streets in Germany
  const cities = ["Stuttgart", "München", "Nürnberg", "Heilbronn", "Ludwigsburg", "Karlsruhe", "Esslingen", "Mannheim"];
  const streets = ["Industriestraße", "Gewerbestraße", "Kanalstraße", "Siemensstraße", "Carl-Benz-Straße", "Daimlerstraße", "Dieselstraße", "Zeppelinstraße"];
  
  // Hash name to get deterministic index
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash);
  const city = cities[index % cities.length];
  const street = `${streets[index % streets.length]} ${1 + (index % 120)}`;
  const zip = String(70000 + (index % 9999)); // Swabian/Baden-Württemberg zip range
  
  const domain = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 15) || "metallbau";
    
  const email = `info@${domain}.de`;
  const phone = `07${11 + (index % 80)} ${200000 + (index % 799999)}`;
  const notes = `Firmendaten automatisch geladen aus Branchenverzeichnis für „${name}“.`;
  
  return { street, zip, city, email, phone, notes };
};

export default function NewOrderWizard() {
  const [step, setStep] = useState<WizardStep>("entry");

  // Shared payload
  const [ocrScan, setOcrScan] = useState<OCRScan | null>(null);
  const [parsedOcrData, setParsedOcrData] = useState<Record<string, string> | null>(null);
  const [customerSelection, setCustomerSelection] = useState<{
    id: string | null;
    newName?: string;
  } | null>(null);
  const [newCustomerDetails, setNewCustomerDetails] = useState({
    street: "",
    zip: "",
    city: "",
    email: "",
    phone: "",
    notes: ""
  });
  const [items, setItems] = useState<Record<string, unknown>[]>([]);

  // Manual flow states
  const [manualSearch, setManualSearch] = useState("");
  const [manualSearchResults, setManualSearchResults] = useState<Customer[]>([]);
  const [manualSearching, setManualSearching] = useState(false);
  const [lastSearchedTerm, setLastSearchedTerm] = useState("");
  const [manualItems, setManualItems] = useState<{ name: string; quantity: number | string; surfaceRequested: string; photo?: string }[]>([
    { name: "", quantity: 1, surfaceRequested: "", photo: "" },
  ]);
  const [isScanningIndex, setIsScanningIndex] = useState<number | null>(null);

  const handleManualSearch = async () => {
    const term = manualSearch.trim();
    if (!term) return;

    // Wenn der Nutzer denselben Begriff bereits gesucht hat und die Enter-Taste erneut drückt,
    // gehen wir direkt zur Neukundenerfassung über.
    if (term === lastSearchedTerm && manualSearchResults.length > 0) {
      setCustomerSelection({ id: null, newName: term });
      setStep("manual_customer_edit");
      return;
    }

    setManualSearching(true);
    const results = await customersRepository.findSimilar(term);
    setLastSearchedTerm(term);
    if (results.length === 0) {
      setCustomerSelection({ id: null, newName: term });
      setStep("manual_customer_edit");
    } else {
      setManualSearchResults(results);
    }
    setManualSearching(false);
  };

  const updateManualItem = (
    index: number,
    key: string,
    val: string | number
  ) => {
    const newItems = [...manualItems];
    newItems[index] = { ...newItems[index], [key]: val };
    setManualItems(newItems);
  };

  const addManualItem = () =>
    setManualItems([
      ...manualItems,
      { name: "", quantity: 1, surfaceRequested: "", photo: "" },
    ]);

  const removeManualItem = (index: number) =>
    setManualItems(manualItems.filter((_, i) => i !== index));

  const handleManualPhotoCapture = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      updateManualItem(index, "photo", event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleInlineItemScan = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Photo = event.target?.result as string;
      updateManualItem(index, "photo", base64Photo);

      setIsScanningIndex(index);
      try {
        const scanResult = await ocrService.simulateScan("part_photo");
        
        setManualItems((prev) => {
          const updated = [...prev];
          let { name, quantity, surfaceRequested } = updated[index];

          scanResult.extractedFields.forEach((field) => {
            if (field.key === "itemName" && field.value) name = field.value;
            if (field.key === "quantity" && field.value) quantity = field.value;
            if (field.key === "surfaceRequested" && field.value) surfaceRequested = field.value;
          });

          updated[index] = {
            ...updated[index],
            name,
            quantity,
            surfaceRequested,
            photo: base64Photo,
          };
          return updated;
        });
      } catch (err) {
        console.error("OCR Error:", err);
      } finally {
        setIsScanningIndex(null);
      }
    };
    reader.readAsDataURL(file);
  };

  // Progress steps for camera flow
  const cameraSteps = ["camera", "ocr_review", "customer_match", "items", "summary"];

  return (
    <div className="min-h-screen bg-transparent pt-8 pb-24 px-4 md:px-8">
      {/* Progress indicator for camera flow */}
      {cameraSteps.includes(step) && (
        <div className="max-w-3xl mx-auto mb-8 flex justify-center gap-2">
          {cameraSteps.map((s, i) => {
            const currentIndex = cameraSteps.indexOf(step);
            const isPast = i < currentIndex;
            const isCurrent = i === currentIndex;
            return (
              <div
                key={s}
                className={`h-2 w-12 rounded-full transition-all duration-300 ${
                  isCurrent
                    ? "bg-blue-600 scale-y-150"
                    : isPast
                    ? "bg-blue-300"
                    : "bg-kreile-border"
                }`}
              />
            );
          })}
        </div>
      )}

      {/* ── ENTRY SCREEN ── */}
      {step === "entry" && (
        <IntakeEntry onSelect={(mode) => setStep(mode === "camera" ? "camera" : "manual_customer")} />
      )}

      {/* ── CAMERA FLOW ── */}
      {step === "camera" && (
        <CameraCapture
          onScanComplete={(scan) => {
            setOcrScan(scan);
            setStep("ocr_review");
          }}
          onCancel={() => setStep("entry")}
        />
      )}

      {step === "ocr_review" && ocrScan && (
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => setStep("camera")}
            className="flex items-center gap-2 text-kreile-muted hover:text-kreile-navy font-bold text-sm mb-6 px-3 py-2 rounded-xl hover:bg-kreile-surface-warm transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Zurück zur Kamera
          </button>
          <OCRReviewPanel
            scan={ocrScan}
            onConfirm={(data) => {
              setParsedOcrData(data);
              setStep("customer_match");
            }}
          />
        </div>
      )}

      {step === "customer_match" && parsedOcrData && (
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => setStep("ocr_review")}
            className="flex items-center gap-2 text-kreile-muted hover:text-kreile-navy font-bold text-sm mb-6 px-3 py-2 rounded-xl hover:bg-kreile-surface-warm transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Zurück zur Prüfung
          </button>
          <CustomerMatchPanel
            ocrData={parsedOcrData}
            onConfirm={(custId, newName) => {
              setCustomerSelection({ id: custId, newName });
              setStep("items");
            }}
          />
        </div>
      )}

      {step === "items" && parsedOcrData && (
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => setStep("customer_match")}
            className="flex items-center gap-2 text-kreile-muted hover:text-kreile-navy font-bold text-sm mb-6 px-3 py-2 rounded-xl hover:bg-kreile-surface-warm transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Zurück zur Kundenzuordnung
          </button>
          <SuggestedItemsPanel
            ocrData={parsedOcrData}
            onConfirm={(finalItems) => {
              setItems(finalItems);
              setStep("summary");
            }}
          />
        </div>
      )}

      {step === "summary" && customerSelection && (
        <IntakeCompletionSummary
          customerSelection={customerSelection}
          items={items}
          onBack={() => setStep("items")}
        />
      )}

      {/* ── MANUAL FLOW – Step 1: Kundensuche ── */}
      {step === "manual_customer" && (
        <div className="w-full max-w-3xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-300">
          <button
            onClick={() => setStep("entry")}
            className="flex items-center gap-2 text-kreile-muted hover:text-kreile-navy font-bold text-sm px-3 py-2 rounded-xl hover:bg-kreile-surface-warm transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Zurück
          </button>

          <div className="text-center space-y-2">
            <div className="flex justify-center gap-2 mb-4">
              {["manual_customer", "manual_items", "manual_summary"].map((s, i) => {
                const steps = ["manual_customer", "manual_items", "manual_summary"];
                const cur = steps.indexOf(step);
                return (
                  <div
                    key={s}
                    className={`h-2 w-12 rounded-full transition-all duration-300 ${
                      i === cur ? "bg-blue-600 scale-y-150" : i < cur ? "bg-blue-300" : "bg-kreile-border"
                    }`}
                  />
                );
              })}
            </div>
            <h2 className="text-3xl font-black font-serif text-kreile-navy">
              Manuelle Auftragserfassung
            </h2>
            <p className="text-kreile-muted font-medium">
              Schritt 1 von 3 — Kunden suchen oder neu anlegen
            </p>
          </div>

          <div className="bg-white border-2 border-kreile-border-strong rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
            {/* Search */}
            <div>
              <label className="block text-[11px] font-extrabold text-kreile-muted uppercase tracking-widest mb-2 pl-1">
                Kunde suchen
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={manualSearch}
                  onChange={(e) => setManualSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleManualSearch()}
                  placeholder="Name oder Kundennummer eingeben..."
                  className="w-full text-xl font-bold bg-kreile-surface-soft p-4 rounded-2xl border-2 border-kreile-border-strong outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
                <button
                  onClick={handleManualSearch}
                  className="h-[64px] w-[64px] rounded-2xl border-2 border-kreile-gold-muted hover:border-blue-500 hover:bg-blue-50 text-blue-600 shrink-0 flex items-center justify-center transition-all"
                  title="Suchen"
                >
                  <Search className="w-6 h-6" />
                </button>
                <button
                  onClick={() => setStep("camera")}
                  className="h-[64px] w-[64px] rounded-2xl border-2 border-kreile-gold-muted hover:border-blue-500 hover:bg-blue-50 text-blue-600 shrink-0 flex items-center justify-center transition-all group"
                  title="Kamera nutzen (OCR)"
                >
                  <Camera className="w-6 h-6 group-hover:scale-110 transition-transform" />
                </button>
              </div>
            </div>

            {/* Search Results */}
            {manualSearching && (
              <div className="flex justify-center py-6">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!manualSearching && manualSearchResults.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-bold text-kreile-muted text-sm uppercase tracking-wider">
                  Gefundene Kunden
                </h3>
                {manualSearchResults.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setCustomerSelection({ id: c.id, newName: c.name });
                      setManualItems([{ name: "", quantity: 1, surfaceRequested: "" }]);
                      setStep("manual_items");
                    }}
                    className="w-full text-left bg-white border-2 border-kreile-border-strong hover:border-blue-500 hover:bg-blue-50 hover:shadow-md p-4 rounded-2xl flex items-center justify-between transition-all active:scale-98"
                  >
                    <div>
                      <h4 className="font-extrabold text-lg text-kreile-navy">
                        {c.name}
                      </h4>
                      <p className="text-sm text-kreile-muted font-medium">
                        {c.customerNumber} · {c.city || "Kein Ort"}
                      </p>
                    </div>
                    <UserCheck className="h-6 w-6 text-blue-600 shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {!manualSearching &&
              manualSearchResults.length === 0 &&
              manualSearch.trim() && (
                <div className="bg-kreile-surface-soft border-2 border-dashed border-kreile-border-strong rounded-2xl p-6 text-center text-kreile-muted font-medium">
                  Kein Ergebnis für &bdquo;{manualSearch}&ldquo;
                </div>
              )}

            {/* New customer */}
            <div className="border-t border-kreile-border-strong pt-6">
              <Button
                onClick={() => {
                  setCustomerSelection({
                    id: null,
                    newName: manualSearch.trim() || "Neuer Kunde",
                  });
                  setStep("manual_customer_edit");
                }}
                variant="outline"
                className="w-full h-14 text-base font-extrabold rounded-2xl border-2 border-dashed border-kreile-gold-muted hover:bg-kreile-surface-soft text-kreile-navy active:scale-95 transition-all"
              >
                <UserPlus className="mr-3 h-5 w-5" />
                {manualSearch.trim()
                  ? `Neu anlegen: „${manualSearch.trim()}"`
                  : "Neuen Kunden anlegen"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── MANUAL FLOW – Step 1b: Neukunde Details ── */}
      {step === "manual_customer_edit" && customerSelection && (
        <div className="w-full max-w-3xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-300">
          <button
            onClick={() => setStep("manual_customer")}
            className="flex items-center gap-2 text-kreile-muted hover:text-kreile-navy font-bold text-sm px-3 py-2 rounded-xl hover:bg-kreile-surface-warm transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Zurück zur Kundensuche
          </button>

          <div className="text-center space-y-2">
            <h2 className="text-3xl font-black font-serif text-kreile-navy">
              Kundenprofil vervollständigen
            </h2>
            <p className="text-kreile-muted font-medium">
              Neukunde: <strong className="text-kreile-navy">{customerSelection.newName}</strong>
            </p>
          </div>

          <div className="bg-white border-2 border-kreile-border-strong rounded-3xl p-6 md:p-8 shadow-xl space-y-4">
            <div className="flex gap-4 mb-4">
              <Button
                onClick={() => {
                  const company = customerSelection.newName || manualSearch.trim() || "Neuer Kunde";
                  setNewCustomerDetails(generateAutofillDetails(company));
                }}
                variant="outline"
                className="w-full font-bold text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100"
              >
                <Search className="w-4 h-4 mr-2" /> Internet Autofill (Branchensuche)
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-kreile-muted uppercase">Straße & Hausnummer</label>
                <input type="text" autoComplete="street-address" value={newCustomerDetails.street} onChange={(e) => setNewCustomerDetails({...newCustomerDetails, street: e.target.value})} className="w-full p-3 rounded-xl border-2 border-kreile-border-strong focus:border-blue-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-kreile-muted uppercase">PLZ</label>
                  <input type="text" autoComplete="postal-code" value={newCustomerDetails.zip} onChange={(e) => setNewCustomerDetails({...newCustomerDetails, zip: e.target.value})} className="w-full p-3 rounded-xl border-2 border-kreile-border-strong focus:border-blue-500 outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-kreile-muted uppercase">Ort</label>
                  <input type="text" autoComplete="address-level2" value={newCustomerDetails.city} onChange={(e) => setNewCustomerDetails({...newCustomerDetails, city: e.target.value})} className="w-full p-3 rounded-xl border-2 border-kreile-border-strong focus:border-blue-500 outline-none" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-kreile-muted uppercase">E-Mail</label>
                <input type="email" autoComplete="email" value={newCustomerDetails.email} onChange={(e) => setNewCustomerDetails({...newCustomerDetails, email: e.target.value})} className="w-full p-3 rounded-xl border-2 border-kreile-border-strong focus:border-blue-500 outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-kreile-muted uppercase">Telefon</label>
                <input type="tel" autoComplete="tel" value={newCustomerDetails.phone} onChange={(e) => setNewCustomerDetails({...newCustomerDetails, phone: e.target.value})} className="w-full p-3 rounded-xl border-2 border-kreile-border-strong focus:border-blue-500 outline-none" />
              </div>
            </div>

            <Button
              onClick={() => {
                setManualItems([{ name: "", quantity: 1, surfaceRequested: "" }]);
                setStep("manual_items");
              }}
              className="w-full h-14 mt-6 text-lg font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700"
            >
              Weiter zu Bauteilen <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* ── MANUAL FLOW – Step 2: Teile ── */}
      {step === "manual_items" && customerSelection && (
        <div className="w-full max-w-3xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-300">
          <button
            onClick={() => setStep(customerSelection.id === null ? "manual_customer_edit" : "manual_customer")}
            className="flex items-center gap-2 text-kreile-muted hover:text-kreile-navy font-bold text-sm px-3 py-2 rounded-xl hover:bg-kreile-surface-warm transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Zurück zur {customerSelection.id === null ? "Kundenkarte" : "Kundensuche"}
          </button>

          <div className="text-center space-y-2">
            <div className="flex justify-center gap-2 mb-4">
              {["manual_customer", "manual_items", "manual_summary"].map((s, i) => {
                const steps = ["manual_customer", "manual_items", "manual_summary"];
                const cur = steps.indexOf(step);
                return (
                  <div
                    key={s}
                    className={`h-2 w-12 rounded-full transition-all duration-300 ${
                      i === cur ? "bg-blue-600 scale-y-150" : i < cur ? "bg-blue-300" : "bg-kreile-border"
                    }`}
                  />
                );
              })}
            </div>
            <h2 className="text-3xl font-black font-serif text-kreile-navy">
              Bauteile erfassen
            </h2>
            <p className="text-kreile-muted font-medium">
              Schritt 2 von 3 — Kunde:{" "}
              <strong className="text-kreile-navy">
                {customerSelection.newName || "Bestandskunde"}
              </strong>
            </p>
          </div>

          <div className="space-y-4">
            {manualItems.map((item, i) => (
              <div
                key={i}
                className="bg-white border-2 border-kreile-border-strong rounded-3xl p-5 shadow-sm flex gap-4 items-start focus-within:border-blue-400 transition-colors"
              >
                <div className="flex-1 space-y-4">
                  <div className="flex gap-4">
                    <div className="w-24 shrink-0">
                      <label className="block text-[11px] font-extrabold text-kreile-muted uppercase tracking-widest mb-1 pl-1">
                        Menge
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateManualItem(i, "quantity", val === "" ? "" : Math.max(1, parseInt(val) || 1));
                        }}
                        className="w-full text-xl font-black text-center bg-kreile-surface-soft p-3 rounded-xl border-2 border-kreile-border-strong outline-none focus:border-blue-500 focus:bg-white"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[11px] font-extrabold text-kreile-muted uppercase tracking-widest mb-1 pl-1">
                        Bezeichnung
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateManualItem(i, "name", e.target.value)}
                          placeholder="z.B. Zylinderkopf"
                          className="w-full text-xl font-bold bg-kreile-surface-soft p-3 rounded-xl border-2 border-kreile-border-strong outline-none focus:border-blue-500 focus:bg-white"
                        />
                        <label
                          className={`h-[50px] w-[50px] rounded-xl border-2 shrink-0 flex items-center justify-center transition-all cursor-pointer ${
                            isScanningIndex === i 
                              ? "border-blue-500 bg-blue-50 text-blue-600" 
                              : "border-kreile-border-strong hover:border-blue-500 hover:bg-blue-50 text-blue-600"
                          }`}
                          title="Teil scannen (OCR)"
                        >
                          {isScanningIndex === i ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Scan className="w-5 h-5" />
                          )}
                          <input 
                            type="file" 
                            accept="image/*" 
                            capture="environment" 
                            className="hidden" 
                            onChange={(e) => handleInlineItemScan(i, e)} 
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-extrabold text-kreile-muted uppercase tracking-widest mb-1 pl-1">
                      Gewünschte Oberfläche (optional)
                    </label>
                    <input
                      type="text"
                      value={item.surfaceRequested}
                      onChange={(e) =>
                        updateManualItem(i, "surfaceRequested", e.target.value)
                      }
                      placeholder="z.B. Vernickeln, Verchromen..."
                      className="w-full text-base font-bold text-kreile-navy bg-kreile-surface-soft p-3 rounded-xl border-2 border-kreile-border-strong outline-none focus:border-blue-500 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3 shrink-0 pt-6">
                  <label className="cursor-pointer" title="Vorher-Foto ergänzen">
                    <div className={`h-12 w-12 flex items-center justify-center rounded-xl border-2 transition-all ${item.photo ? 'bg-green-50 border-green-300 text-green-600' : 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-600'}`}>
                      {item.photo ? <CheckCircle className="w-6 h-6"/> : <Camera className="w-6 h-6"/>}
                    </div>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleManualPhotoCapture(i, e)} />
                  </label>
                  {manualItems.length > 1 && (
                    <button
                      onClick={() => removeManualItem(i)}
                      className="h-12 w-12 p-0 flex items-center justify-center rounded-xl text-red-650 bg-red-50 hover:bg-red-100 border-2 border-red-200 transition-all shrink-0"
                      title="Teil entfernen"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            <button
              onClick={addManualItem}
              className="w-full h-16 border-2 border-dashed border-kreile-gold-muted text-kreile-muted font-extrabold hover:bg-kreile-surface-soft hover:border-white/30 hover:text-blue-700 rounded-3xl transition-all flex items-center justify-center gap-2"
            >
              <Plus className="h-6 w-6" />
              Weiteres Teil hinzufügen
            </button>
          </div>

          <Button
            onClick={() => {
              const valid = manualItems.filter((it) => it.name.trim());
              if (valid.length === 0) return;
              setItems(valid);
              setStep("manual_summary");
            }}
            disabled={!manualItems.some((it) => it.name.trim())}
            className="w-full h-16 text-lg font-extrabold rounded-2xl bg-kreile-navy text-white hover:bg-kreile-navy-soft shadow-xl active:scale-95 transition-all disabled:opacity-40"
          >
            Teile bestätigen <ChevronRight className="ml-2 w-6 h-6" />
          </Button>
        </div>
      )}

      {/* ── MANUAL FLOW – Step 3: Zusammenfassung & Speichern ── */}
      {step === "manual_summary" && customerSelection && (
        <IntakeCompletionSummary
          customerSelection={customerSelection}
          newCustomerDetails={newCustomerDetails}
          items={items}
          onBack={() => setStep("manual_items")}
        />
      )}
    </div>
  );
}
