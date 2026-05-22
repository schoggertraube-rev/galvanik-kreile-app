"use client";

import { useState } from "react";
import { IntakeEntry } from "@/components/intake/IntakeEntry";
import { CameraCapture } from "@/components/intake/CameraCapture";
import { OCRReviewPanel } from "@/components/intake/OCRReviewPanel";
import { CustomerMatchPanel } from "@/components/intake/CustomerMatchPanel";
import { SuggestedItemsPanel } from "@/components/intake/SuggestedItemsPanel";
import { IntakeCompletionSummary } from "@/components/intake/IntakeCompletionSummary";
import { OCRScan } from "@/lib/services/ocrService";
import {
  Camera,
  Search,
  Plus,
  Trash2,
  ArrowLeft,
  ChevronRight,
  UserPlus,
  UserCheck,
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
  | "manual_items"
  | "manual_summary";

export default function NewOrderWizard() {
  const [step, setStep] = useState<WizardStep>("entry");

  // Shared payload
  const [ocrScan, setOcrScan] = useState<OCRScan | null>(null);
  const [parsedOcrData, setParsedOcrData] = useState<Record<string, string> | null>(null);
  const [customerSelection, setCustomerSelection] = useState<{
    id: string | null;
    newName?: string;
  } | null>(null);
  const [items, setItems] = useState<Record<string, unknown>[]>([]);

  // Manual flow states
  const [manualSearch, setManualSearch] = useState("");
  const [manualSearchResults, setManualSearchResults] = useState<Customer[]>([]);
  const [manualSearching, setManualSearching] = useState(false);
  const [manualItems, setManualItems] = useState([
    { name: "", quantity: 1, surfaceRequested: "" },
  ]);

  const handleManualSearch = async () => {
    if (!manualSearch.trim()) return;
    setManualSearching(true);
    const results = await customersRepository.findSimilar(manualSearch.trim());
    setManualSearchResults(results);
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
      { name: "", quantity: 1, surfaceRequested: "" },
    ]);

  const removeManualItem = (index: number) =>
    setManualItems(manualItems.filter((_, i) => i !== index));

  // Progress steps for camera flow
  const cameraSteps = ["camera", "ocr_review", "customer_match", "items", "summary"];

  return (
    <div className="min-h-screen bg-slate-50 pt-8 pb-24 px-4 md:px-8">
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
                    : "bg-slate-200"
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
            className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold text-sm mb-6 px-3 py-2 rounded-xl hover:bg-slate-100 transition-all"
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
            className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold text-sm mb-6 px-3 py-2 rounded-xl hover:bg-slate-100 transition-all"
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
            className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold text-sm mb-6 px-3 py-2 rounded-xl hover:bg-slate-100 transition-all"
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
        />
      )}

      {/* ── MANUAL FLOW – Step 1: Kundensuche ── */}
      {step === "manual_customer" && (
        <div className="w-full max-w-3xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-300">
          <button
            onClick={() => setStep("entry")}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold text-sm px-3 py-2 rounded-xl hover:bg-slate-100 transition-all"
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
                      i === cur ? "bg-blue-600 scale-y-150" : i < cur ? "bg-blue-300" : "bg-slate-200"
                    }`}
                  />
                );
              })}
            </div>
            <h2 className="text-3xl font-black font-serif text-slate-900">
              Manuelle Auftragserfassung
            </h2>
            <p className="text-slate-500 font-medium">
              Schritt 1 von 3 — Kunden suchen oder neu anlegen
            </p>
          </div>

          <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
            {/* Search */}
            <div>
              <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-2 pl-1">
                Kunde suchen
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={manualSearch}
                  onChange={(e) => setManualSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleManualSearch()}
                  placeholder="Name oder Kundennummer eingeben..."
                  className="w-full text-xl font-bold bg-slate-50 p-4 rounded-2xl border-2 border-slate-200 outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
                <button
                  onClick={handleManualSearch}
                  className="h-[64px] w-[64px] rounded-2xl border-2 border-slate-300 hover:border-blue-500 hover:bg-blue-50 text-blue-600 shrink-0 flex items-center justify-center transition-all"
                  title="Suchen"
                >
                  <Search className="w-6 h-6" />
                </button>
                <button
                  onClick={() => setStep("camera")}
                  className="h-[64px] w-[64px] rounded-2xl border-2 border-slate-300 hover:border-blue-500 hover:bg-blue-50 text-blue-600 shrink-0 flex items-center justify-center transition-all group"
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
                <h3 className="font-bold text-slate-600 text-sm uppercase tracking-wider">
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
                    className="w-full text-left bg-white border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 hover:shadow-md p-4 rounded-2xl flex items-center justify-between transition-all active:scale-98"
                  >
                    <div>
                      <h4 className="font-extrabold text-lg text-slate-900">
                        {c.name}
                      </h4>
                      <p className="text-sm text-slate-500 font-medium">
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
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center text-slate-500 font-medium">
                  Kein Ergebnis für &bdquo;{manualSearch}&ldquo;
                </div>
              )}

            {/* New customer */}
            <div className="border-t border-slate-200 pt-6">
              <Button
                onClick={() => {
                  setCustomerSelection({
                    id: null,
                    newName: manualSearch.trim() || "Neuer Kunde",
                  });
                  setManualItems([{ name: "", quantity: 1, surfaceRequested: "" }]);
                  setStep("manual_items");
                }}
                variant="outline"
                className="w-full h-14 text-base font-extrabold rounded-2xl border-2 border-dashed border-slate-300 hover:bg-slate-50 text-slate-700 active:scale-95 transition-all"
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

      {/* ── MANUAL FLOW – Step 2: Teile ── */}
      {step === "manual_items" && customerSelection && (
        <div className="w-full max-w-3xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-300">
          <button
            onClick={() => setStep("manual_customer")}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold text-sm px-3 py-2 rounded-xl hover:bg-slate-100 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Zurück zur Kundensuche
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
                      i === cur ? "bg-blue-600 scale-y-150" : i < cur ? "bg-blue-300" : "bg-slate-200"
                    }`}
                  />
                );
              })}
            </div>
            <h2 className="text-3xl font-black font-serif text-slate-900">
              Bauteile erfassen
            </h2>
            <p className="text-slate-500 font-medium">
              Schritt 2 von 3 — Kunde:{" "}
              <strong className="text-slate-700">
                {customerSelection.newName || "Bestandskunde"}
              </strong>
            </p>
          </div>

          <div className="space-y-4">
            {manualItems.map((item, i) => (
              <div
                key={i}
                className="bg-white border-2 border-slate-200 rounded-3xl p-5 shadow-sm flex gap-4 items-start focus-within:border-blue-400 transition-colors"
              >
                <div className="flex-1 space-y-4">
                  <div className="flex gap-4">
                    <div className="w-24 shrink-0">
                      <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-1 pl-1">
                        Menge
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) =>
                          updateManualItem(i, "quantity", parseInt(e.target.value) || 1)
                        }
                        className="w-full text-xl font-black text-center bg-slate-50 p-3 rounded-xl border-2 border-slate-200 outline-none focus:border-blue-500 focus:bg-white"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-1 pl-1">
                        Bezeichnung
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateManualItem(i, "name", e.target.value)}
                          placeholder="z.B. Zylinderkopf"
                          className="w-full text-xl font-bold bg-slate-50 p-3 rounded-xl border-2 border-slate-200 outline-none focus:border-blue-500 focus:bg-white"
                        />
                        <button
                          onClick={() => setStep("camera")}
                          className="h-[50px] w-[50px] rounded-xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 text-blue-600 shrink-0 flex items-center justify-center transition-all"
                          title="Foto machen (OCR)"
                        >
                          <Camera className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-1 pl-1">
                      Gewünschte Oberfläche (optional)
                    </label>
                    <input
                      type="text"
                      value={item.surfaceRequested}
                      onChange={(e) =>
                        updateManualItem(i, "surfaceRequested", e.target.value)
                      }
                      placeholder="z.B. Vernickeln, Verchromen..."
                      className="w-full text-base font-bold text-slate-700 bg-slate-50 p-3 rounded-xl border-2 border-slate-200 outline-none focus:border-blue-500 focus:bg-white"
                    />
                  </div>
                </div>

                {manualItems.length > 1 && (
                  <button
                    onClick={() => removeManualItem(i)}
                    className="mt-6 h-12 w-12 p-0 flex items-center justify-center rounded-xl text-red-600 bg-red-50 hover:bg-red-100 border-2 border-red-200 transition-all shrink-0"
                    title="Teil entfernen"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}

            <button
              onClick={addManualItem}
              className="w-full h-16 border-2 border-dashed border-slate-300 text-slate-500 font-extrabold hover:bg-slate-50 hover:border-blue-300 hover:text-blue-700 rounded-3xl transition-all flex items-center justify-center gap-2"
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
            className="w-full h-16 text-lg font-extrabold rounded-2xl bg-blue-900 text-white hover:bg-blue-800 shadow-xl active:scale-95 transition-all disabled:opacity-40"
          >
            Teile bestätigen <ChevronRight className="ml-2 w-6 h-6" />
          </Button>
        </div>
      )}

      {/* ── MANUAL FLOW – Step 3: Zusammenfassung & Speichern ── */}
      {step === "manual_summary" && customerSelection && (
        <IntakeCompletionSummary
          customerSelection={customerSelection}
          items={items}
        />
      )}
    </div>
  );
}
