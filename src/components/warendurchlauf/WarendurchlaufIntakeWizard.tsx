"use client";

import { usePageView } from "@/hooks/usePageView";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { CameraCapture } from "@/components/intake/CameraCapture";
import { CustomerMatchPanel } from "@/components/intake/CustomerMatchPanel";
import { SuggestedItemsPanel } from "@/components/intake/SuggestedItemsPanel";
import { IntakeCompletionSummary } from "@/components/intake/IntakeCompletionSummary";
import { OcrMatchResult } from "@/components/intake/OcrMatchResult";
import { NewCustomerForm } from "@/components/customers/NewCustomerForm";
import { processImage } from "@/app/actions/ocr.actions";
import {
  Camera,
  Plus,
  Trash2,
  ArrowLeft,
  ChevronRight,
  UserPlus,
  UserCheck,
  CheckCircle,
  Loader2,
  Scan,
  Upload,
  AlertOctagon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { customersRepository, Customer } from "@/lib/repositories/customersRepository";
import { orderSchema } from "@/lib/validation/orderSchema";
import { AppActionButton } from "@/components/ui/AppActionButton";
import { AppBackButton } from "@/components/ui/AppBackButton";

type WizardStep =
  | "camera"
  | "ocr_review"
  | "customer_match"
  | "items"
  | "summary"
  | "manual_customer"
  | "manual_customer_edit"
  | "manual_items"
  | "manual_summary"
  | "ocr_match_result";

interface WizardProps {
  initialMode?: "camera" | "manual";
  onClose?: () => void;
}

export function WarendurchlaufIntakeWizard({ initialMode, onClose }: WizardProps = {}) {
  usePageView();

  const searchParams = useSearchParams();
  const initialDraftId = searchParams.get("draftId");

  const [step, setStep] = useState<WizardStep>(
    initialMode === "manual" || searchParams.get("mode") === "new-order" ? "manual_customer" : "camera"
  );

  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftMissing, setDraftMissing] = useState(false);
  const [draftNotes, setDraftNotes] = useState("");

  // Shared payload
  const [ocrPreviewUrl, setOcrPreviewUrl] = useState<string | undefined>();
  const [parsedOcrData, setParsedOcrData] = useState<Record<string, string> | null>(null);
  const [abortModalOpen, setAbortModalOpen] = useState(false);
  const [customerSelection, setCustomerSelection] = useState<{
    id: string | null;
    newName?: string;
  } | null>(null);
  const [newCustomerDetails] = useState({
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
  const [itemErrors, setItemErrors] = useState<Record<number, Record<string, string[]>>>({});

  useEffect(() => {
    if (initialDraftId && !draftLoaded) {
      const draftStr = sessionStorage.getItem(initialDraftId);
      if (draftStr) {
        try {
          const draft = JSON.parse(draftStr);
          // Prefill logic via queueMicrotask to avoid synchronous setState warning in effect
          queueMicrotask(() => {
            if (draft.customerId || draft.customerName) {
              setManualSearch(draft.customerName || "");
              setCustomerSelection({ id: draft.customerId || null, newName: draft.customerName || "" });
              setStep("manual_items"); // Skip to items if customer is somewhat known
            }

            if (draft.itemName || draft.material || draft.surfaceRequested) {
              setManualItems([{
                name: draft.itemName || draft.material || "",
                quantity: 1,
                surfaceRequested: draft.surfaceRequested || "",
                photo: ""
              }]);
            }

            if (draft.notes) {
              setDraftNotes(draft.notes);
            }
            setDraftLoaded(true);
          });
        } catch (e) {
          console.error("Failed to parse phone note draft", e);
          setDraftMissing(true);
        }
      } else {
        setDraftMissing(true);
      }
    }
  }, [initialDraftId, draftLoaded]);

  const handleManualSearch = async () => {
    const term = manualSearch.trim();
    if (!term) return;

    // Wenn der Nutzer denselben Begriff bereits gesucht hat und die Enter-Taste erneut drÃ¼ckt,
    // gehen wir direkt zur Neukundenerfassung Ã¼ber.
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setManualSearching(true); // Re-using this state for loading indicator

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const scan = await processImage(base64);
      setParsedOcrData({
        customerName: scan.customerName || scan.company || "",
        customerNumber: "", // Not natively in OcrResult right now, can be added if needed
        itemName: scan.articleDescription || "",
        quantity: scan.quantity?.toString() || "",
        surfaceRequested: scan.surface || "",
      });
      setOcrPreviewUrl(base64);
      setStep("ocr_match_result");
      setManualSearching(false);
    };
    reader.readAsDataURL(file);
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
        const scanResult = await processImage(base64Photo);

        setManualItems((prev) => {
          const updated = [...prev];
          let { name, quantity, surfaceRequested } = updated[index];

          if (scanResult.articleDescription) name = scanResult.articleDescription;
          if (scanResult.quantity) quantity = scanResult.quantity;
          if (scanResult.surface) surfaceRequested = scanResult.surface;

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
    <div
      className="min-h-screen bg-transparent pt-8 pb-24 px-4 md:px-8"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
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
                    ? "bg-navy-700 scale-y-150"
                    : isPast
                    ? "bg-navy-700"
                    : "bg-neutral-gray-100"
                }`}
              />
            );
          })}
        </div>
      )}

      {step === "camera" && (
        <CameraCapture
          onScanComplete={(scan, base64Image) => {
            setParsedOcrData({
              customerName: scan.customerName || scan.company || "",
              customerNumber: "",
              itemName: scan.articleDescription || "",
              quantity: scan.quantity?.toString() || "",
              surfaceRequested: scan.surface || "",
            });
            if (base64Image) {
              setOcrPreviewUrl(base64Image);
            }
            setStep("ocr_match_result");
          }}
          onCancel={() => {
              setAbortModalOpen(true);
            }}
        />
      )}

      {step === "customer_match" && parsedOcrData && (
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => setStep("ocr_match_result")}
            className="flex items-center gap-2 text-text-muted hover:text-navy-900 font-bold text-sm mb-6 px-3 py-2 rounded-xl hover:bg-bg-app-soft transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            ZurÃ¼ck zur PrÃ¼fung
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
            className="flex items-center gap-2 text-text-muted hover:text-navy-900 font-bold text-sm mb-6 px-3 py-2 rounded-xl hover:bg-bg-app-soft transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            ZurÃ¼ck zur Kundenzuordnung
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

      {/* Draft Notices */}
      {draftLoaded && step.startsWith("manual_") && (
        <div className="max-w-3xl mx-auto mb-6 bg-navy-50 border border-navy-200 rounded-xl p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 font-bold text-navy-900">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-navy-100 text-navy-600"><CheckCircle size={14}/></span>
            Telefonnotiz Ã¼bernommen
          </div>
          <div className="text-sm text-navy-700">
            Diese Angaben wurden aus dem laufenden GesprÃ¤ch vorbereitet. Bitte prÃ¼fen und ergÃ¤nzen.
          </div>
          {draftNotes && (
            <div className="mt-2 text-xs text-navy-600 bg-white p-3 rounded-lg border border-navy-100">
              <strong>Notiz:</strong> {draftNotes}
            </div>
          )}
        </div>
      )}
      {draftMissing && step.startsWith("manual_") && (
        <div className="max-w-3xl mx-auto mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 font-bold text-red-900">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600"><AlertOctagon size={14}/></span>
            Telefonnotiz-Draft nicht gefunden
          </div>
          <div className="text-sm text-red-700">
            Bitte Daten manuell erfassen oder zur Telefonnotiz zurÃ¼ckkehren.
          </div>
        </div>
      )}

      {/* â”€â”€ MANUAL FLOW â€“ Step 1: Kundensuche â”€â”€ */}
      {step === "manual_customer" && (
        <div className="w-full max-w-3xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-300">
          <button
            onClick={() => setAbortModalOpen(true)}
            className="flex items-center gap-2 text-text-muted hover:text-navy-900 font-bold text-sm px-3 py-2 rounded-xl hover:bg-bg-app-soft transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Abbrechen
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
                      i === cur ? "bg-navy-700 scale-y-150" : i < cur ? "bg-navy-700" : "bg-neutral-gray-100"
                    }`}
                  />
                );
              })}
            </div>
            <h2 className="text-3xl font-black font-serif text-navy-900">
              Manuelle Auftragserfassung
            </h2>
            <p className="text-text-muted font-medium">
              Schritt 1 von 3 â€” Kunden suchen oder neu anlegen
            </p>
          </div>

          <div className="bg-white border-2 border-neutral-gray-300 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
            {/* Search */}
            <div>
              <label className="block text-[11px] font-extrabold text-text-muted uppercase tracking-widest mb-2 pl-1">
                Kunde suchen
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={manualSearch}
                  onChange={(e) => setManualSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleManualSearch()}
                  placeholder="Name oder Kundennummer eingeben..."
                  className="w-full text-xl font-bold bg-bg-app-soft p-4 rounded-2xl border-2 border-neutral-gray-300 outline-none focus:border-navy-700 focus:bg-white transition-all"
                />
                <label
                  className="h-[64px] w-[64px] rounded-2xl border-2 border-gold-600 hover:border-navy-700 hover:bg-gold-100 text-navy-700 shrink-0 flex items-center justify-center transition-all cursor-pointer group"
                  title="Dokument hochladen"
                >
                  <Upload className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  <input type="file" className="hidden" accept=".pdf,image/jpeg,image/png" onChange={handleFileUpload} />
                </label>
                <button
                  onClick={() => setStep("camera")}
                  className="h-[64px] w-[64px] rounded-2xl border-2 border-gold-600 hover:border-navy-700 hover:bg-gold-100 text-navy-700 shrink-0 flex items-center justify-center transition-all group"
                  title="Kamera nutzen (OCR)"
                >
                  <Camera className="w-6 h-6 group-hover:scale-110 transition-transform" />
                </button>
              </div>
            </div>

            {/* Search Results */}
            {manualSearching && (
              <div className="flex justify-center py-6">
                <div className="w-10 h-10 border-4 border-navy-700 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!manualSearching && manualSearchResults.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-bold text-text-muted text-sm uppercase tracking-wider">
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
                    className="w-full text-left bg-white border-2 border-neutral-gray-300 hover:border-navy-700 hover:bg-gold-100 hover:shadow-md p-4 rounded-2xl flex items-center justify-between transition-all active:scale-98"
                  >
                    <div>
                      <h4 className="font-extrabold text-lg text-navy-900">
                        {c.name}
                      </h4>
                      <p className="text-sm text-text-muted font-medium">
                        {c.customerNumber} Â· {c.city || "Kein Ort"}
                      </p>
                    </div>
                    <UserCheck className="h-6 w-6 text-navy-700 shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {!manualSearching &&
              manualSearchResults.length === 0 &&
              manualSearch.trim() && (
                <div className="bg-bg-app-soft border-2 border-dashed border-neutral-gray-300 rounded-2xl p-6 text-center text-text-muted font-medium">
                  Kein Ergebnis fÃ¼r &bdquo;{manualSearch}&ldquo;
                </div>
              )}

            {/* New customer */}
            <div className="border-t border-neutral-gray-300 pt-6">
              <Button
                onClick={() => {
                  setCustomerSelection({
                    id: null,
                    newName: manualSearch.trim() || "Neuer Kunde",
                  });
                  setStep("manual_customer_edit");
                }}
                variant="outline"
                className="w-full h-14 text-base font-extrabold rounded-2xl border-2 border-dashed border-gold-600 hover:bg-bg-app-soft text-navy-900 active:scale-95 transition-all"
              >
                <UserPlus className="mr-3 h-5 w-5" />
                {manualSearch.trim()
                  ? `Neu anlegen: â€ž${manualSearch.trim()}"`
                  : "Neuen Kunden anlegen"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* â”€â”€ MANUAL FLOW â€“ Step 1b: Neukunde Details â”€â”€ */}
      {step === "manual_customer_edit" && customerSelection && (
        <NewCustomerForm
          customerId={customerSelection.id}
          onClose={() => setStep("manual_customer")}
          onSave={(id) => {
            setCustomerSelection({ id, newName: customerSelection.newName });
            setManualItems([{ name: "", quantity: 1, surfaceRequested: "" }]);
            setStep("manual_items");
          }}
        />
      )}

      {/* â”€â”€ MANUAL FLOW â€“ Step 2: Teile â”€â”€ */}
      {step === "manual_items" && customerSelection && (
        <div className="w-full max-w-3xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-300">
          <button
            onClick={() => setStep(customerSelection.id === null ? "manual_customer_edit" : "manual_customer")}
            className="flex items-center gap-2 text-text-muted hover:text-navy-900 font-bold text-sm px-3 py-2 rounded-xl hover:bg-bg-app-soft transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            ZurÃ¼ck zur {customerSelection.id === null ? "Kundenkarte" : "Kundensuche"}
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
                      i === cur ? "bg-navy-700 scale-y-150" : i < cur ? "bg-navy-700" : "bg-neutral-gray-100"
                    }`}
                  />
                );
              })}
            </div>
            <h2 className="text-3xl font-black font-serif text-navy-900">
              Bauteile erfassen
            </h2>
            <p className="text-text-muted font-medium">
              Schritt 2 von 3 â€” Kunde:{" "}
              <strong className="text-navy-900">
                {customerSelection.newName || "Bestandskunde"}
              </strong>
            </p>
          </div>

          <div className="space-y-4">
            {manualItems.map((item, i) => (
              <div
                key={i}
                className="bg-white border-2 border-neutral-gray-300 rounded-3xl p-5 shadow-sm flex gap-4 items-start focus-within:border-navy-700 transition-colors"
              >
                <div className="flex-1 space-y-4">
                  <div className="flex gap-4">
                    <div className="w-24 shrink-0">
                      <label className="block text-[11px] font-extrabold text-text-muted uppercase tracking-widest mb-1 pl-1">
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
                        className="w-full text-xl font-black text-center bg-bg-app-soft p-3 rounded-xl border-2 border-neutral-gray-300 outline-none focus:border-navy-700 focus:bg-white"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[11px] font-extrabold text-text-muted uppercase tracking-widest mb-1 pl-1">
                        Bezeichnung
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateManualItem(i, "name", e.target.value)}
                          placeholder="z.B. Zylinderkopf"
                          className={`w-full text-xl font-bold bg-bg-app-soft p-3 rounded-xl border-2 outline-none focus:bg-white ${itemErrors[i]?.name ? "border-danger-red text-danger-red focus:border-danger-red" : "border-neutral-gray-300 focus:border-navy-700"}`}
                        />
                        <label
                          className={`h-[50px] w-[50px] rounded-xl border-2 shrink-0 flex items-center justify-center transition-all cursor-pointer ${
                            isScanningIndex === i
                              ? "border-navy-700 bg-gold-100 text-navy-700"
                              : "border-neutral-gray-300 hover:border-navy-700 hover:bg-gold-100 text-navy-700"
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
                      {itemErrors[i]?.name && <p className="text-danger-red text-xs mt-1 font-bold">{itemErrors[i].name[0]}</p>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-extrabold text-text-muted uppercase tracking-widest mb-1 pl-1">
                      GewÃ¼nschte OberflÃ¤che (optional)
                    </label>
                    <input
                      type="text"
                      value={item.surfaceRequested}
                      onChange={(e) =>
                        updateManualItem(i, "surfaceRequested", e.target.value)
                      }
                      placeholder="z.B. Vernickeln, Verchromen..."
                      className="w-full text-base font-bold text-navy-900 bg-bg-app-soft p-3 rounded-xl border-2 border-neutral-gray-300 outline-none focus:border-navy-700 focus:bg-white"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3 shrink-0 pt-6">
                  <label className="cursor-pointer" title="Vorher-Foto ergÃ¤nzen">
                    <div className={`h-12 w-12 flex items-center justify-center rounded-xl border-2 transition-all ${item.photo ? 'bg-gold-100 border-green-300 text-green-600' : 'bg-gold-100 hover:bg-navy-700 border-navy-700 text-navy-700'}`}>
                      {item.photo ? <CheckCircle className="w-6 h-6"/> : <Camera className="w-6 h-6"/>}
                    </div>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleManualPhotoCapture(i, e)} />
                  </label>
                  {manualItems.length > 1 && (
                    <button
                      onClick={() => removeManualItem(i)}
                      className="h-12 w-12 p-0 flex items-center justify-center rounded-xl text-danger-red bg-accent-orange-soft hover:bg-danger-red border-2 border-danger-red transition-all shrink-0"
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
              className="w-full h-16 border-2 border-dashed border-gold-600 text-text-muted font-extrabold hover:bg-bg-app-soft hover:border-white/30 hover:text-navy-700 rounded-3xl transition-all flex items-center justify-center gap-2"
            >
              <Plus className="h-6 w-6" />
              Weiteres Teil hinzufÃ¼gen
            </button>
          </div>

          <AppActionButton
            onClick={() => {
              setItemErrors({});
              // Try to validate parts using Zod schema's part definition
              let hasErrors = false;
              const newErrors: Record<number, Record<string, string[]>> = {};

              manualItems.forEach((it, idx) => {
                const partSchema = orderSchema.shape.parts.element;
                const parsed = partSchema.safeParse(it);
                if (!parsed.success) {
                  hasErrors = true;
                  newErrors[idx] = parsed.error.flatten().fieldErrors;
                }
              });

              if (hasErrors) {
                setItemErrors(newErrors);
                return;
              }

              const valid = manualItems.filter((it) => it.name.trim());
              setItems(valid);
              setStep("manual_summary");
            }}
            variant="primary"
            icon={<ChevronRight className="w-5 h-5" />}
            className="w-full h-16 text-lg"
          >
            Teile bestÃ¤tigen
          </AppActionButton>
        </div>
      )}

      {/* â”€â”€ MANUAL FLOW â€“ Step 3: Zusammenfassung & Speichern â”€â”€ */}
      {step === "manual_summary" && customerSelection && (
        <IntakeCompletionSummary
          customerSelection={customerSelection}
          newCustomerDetails={newCustomerDetails}
          items={items}
          onBack={() => setStep("manual_items")}
        />
      )}

      {/* â”€â”€ OCR MATCH RESULT (N3 & N4) â”€â”€ */}
      {step === "ocr_match_result" && parsedOcrData && (
        <div className="w-full h-full flex flex-col pt-10">
          <div className="mb-4 text-center">
            <button
              onClick={() => setAbortModalOpen(true)}
              className="inline-flex items-center gap-2 text-text-muted hover:text-navy-900 font-bold text-sm px-3 py-2 rounded-xl hover:bg-bg-app-soft transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Abbrechen
            </button>
          </div>
          <OcrMatchResult
            ocrData={parsedOcrData}
            previewUrl={ocrPreviewUrl}
            onComplete={() => {
              // Successfully created an order or skipped
              if (onClose) onClose();
            }}
          />
        </div>
      )}

      {/* Abort Confirmation Dialog */}
      {abortModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl space-y-6 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-danger-red/10 text-danger-red rounded-full flex items-center justify-center mx-auto mb-2">
              <AlertOctagon className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-black font-serif text-navy-900 mb-2">Wirklich abbrechen?</h3>
              <p className="text-sm font-medium text-text-muted">Alle bisherigen Eingaben gehen verloren. Dieser Vorgang kann nicht rÃ¼ckgÃ¤ngig gemacht werden.</p>
            </div>
            <div className="flex flex-col gap-3 pt-2">
              <AppActionButton
                onClick={() => {
                  setAbortModalOpen(false);
                  if (onClose) {
                    onClose();
                  } else {
                    window.location.href = "/warendurchlauf";
                  }
                }}
                variant="danger"
                className="w-full h-12"
              >
                Ja, abbrechen
              </AppActionButton>
              <Button
                onClick={() => setAbortModalOpen(false)}
                variant="outline"
                className="w-full h-12 rounded-xl font-bold border-2 border-neutral-gray-200 text-navy-900"
              >
                ZurÃ¼ck zum Formular
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
