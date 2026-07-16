"use client";

import { usePageView } from "@/hooks/usePageView";
import { useState } from "react";
import { CameraCapture } from "@/components/intake/CameraCapture";
import { SuggestedItemsPanel } from "@/components/intake/SuggestedItemsPanel";
import { OcrResult } from "@/lib/ocr/geminiOcr";
import { PageHeader } from "@/components/ui/PageHeader";
import { createOrderFromScan } from "@/app/actions/orders.actions";
import { RefreshCw, CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";

export default function ScanPage() {
  usePageView();
  const [scan, setScan] = useState<OcrResult | null>(null);
  const [confirmMessage, setConfirmMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [customerChoices, setCustomerChoices] = useState<Array<{ id: string; name: string; companyName?: string | null }> | null>(null);
  const [lastConfirmedParts, setLastConfirmedParts] = useState<Record<string, unknown>[] | null>(null);

  const handleConfirmOrder = async (options?: {
    customerId?: string;
    customParts?: Record<string, unknown>[];
  }) => {
    if (!scan) return;
    setLoading(true);
    setError(null);
    setConfirmMessage("");

    const rawParts = options?.customParts || lastConfirmedParts || [
      {
        name: scan.articleDescription || "",
        quantity: scan.quantity,
        surfaceRequested: scan.surface || "",
        material: scan.material || "",
      },
    ];

    try {
      const parts = rawParts.map((part, index) => {
        const name = typeof part.name === "string" ? part.name.trim() : "";
        const quantity = Number(part.quantity);
        if (!name || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1_000_000) {
          throw new Error(`Position ${index + 1} benötigt eine erkannte Bezeichnung und eine gültige ganze Menge.`);
        }
        const surfaceRequested = typeof part.surfaceRequested === "string" ? part.surfaceRequested.trim() : "";
        const material = typeof part.material === "string" ? part.material.trim() : "";
        return {
          name,
          quantity,
          ...(surfaceRequested ? { surfaceRequested } : {}),
          ...(material ? { material } : {}),
        };
      });
      const customerName = (scan.customerName || scan.company || "").trim();
      const title = (scan.articleDescription || "").trim() || parts[0]?.name;
      if (!title) throw new Error("Es wurde kein belastbarer Auftragstitel erkannt.");
      if (!options?.customerId && !customerName) throw new Error("Es wurde kein Kunde erkannt oder ausgewählt.");

      const res = await createOrderFromScan({
        customerId: options?.customerId,
        ...(!options?.customerId ? { customerName } : {}),
        title,
        parts,
      });

      if (res.ok) {
        setConfirmMessage("Auftrag wurde in der Datenbank bestätigt.");
        setScan(null);
        setError(null);
        setCustomerChoices(null);
        setLastConfirmedParts(null);
      } else {
        if (res.error === "CUSTOMER_AMBIGUOUS") {
          setCustomerChoices(res.details as Array<{ id: string; name: string; companyName?: string | null }> || []);
          setLastConfirmedParts(parts);
          setError("Kundenname ist mehrdeutig. Bitte wähle den passenden Kunden aus.");
        } else if (res.error === "CUSTOMER_NOT_FOUND") {
          setLastConfirmedParts(parts);
          setError("Kunde nicht gefunden. Bitte zuerst vollständige Kundendaten im Kundenmodul erfassen und danach erneut bestätigen.");
        } else {
          setError(res.message || "Fehler beim Erstellen des Auftrags");
        }
      }
    } catch (err: unknown) {
      setError("Ein Fehler ist aufgetreten: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4">
      <PageHeader title="Scan & KI‑Erfassung" subtitle="Dokumente, Lieferscheine oder Bauteile – mit KI schnell erfassen" />
      
      {confirmMessage && (
        <div className="mb-4 p-4 bg-[#E8F5E9] text-[#2E7D32] rounded-2xl shadow-sm border border-[#C8E6C9] flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 shrink-0" />
          <span className="font-bold">{confirmMessage}</span>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-[#FFEBEE] text-[#C62828] rounded-2xl shadow-sm border border-[#FFCDD2] flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 shrink-0" />
          <span className="font-bold">{error}</span>
        </div>
      )}

      {/* Choice Modal for Ambiguous Customer */}
      {customerChoices && (
        <div className="mb-6 p-6 bg-white border-2 border-accent-orange rounded-3xl shadow-lg space-y-4">
          <div className="flex items-center gap-3 text-accent-orange">
            <HelpCircle className="w-8 h-8" />
            <h3 className="text-xl font-bold">Kunde auswählen</h3>
          </div>
          <p className="text-sm text-text-muted">Es wurden mehrere Kunden gefunden. Bitte wähle den passenden aus:</p>
          <div className="grid gap-2">
            {customerChoices.map((c) => (
              <button
                key={c.id}
                onClick={() => handleConfirmOrder({ customerId: c.id })}
                disabled={loading}
                className="w-full text-left p-4 rounded-xl border border-neutral-gray-300 hover:bg-neutral-gray-100 transition-colors font-bold flex justify-between items-center"
              >
                <span>{c.name}</span>
                {c.companyName && <span className="text-xs text-text-muted">{c.companyName}</span>}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              setCustomerChoices(null);
              setError(null);
            }}
            className="w-full bg-neutral-gray-200 p-3 rounded-xl font-bold"
          >
            Abbrechen
          </button>
        </div>
      )}

      {scan ? (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-neutral-gray-300">
            <h2 className="text-xl font-bold mb-4">Erkanntes Dokument</h2>
            <pre className="text-xs bg-gray-100 p-4 rounded-xl overflow-auto whitespace-pre-wrap">
              {scan.rawText}
            </pre>
            <div className="mt-4 flex gap-4">
              <button 
                onClick={() => setScan(null)}
                disabled={loading}
                className="flex-1 bg-neutral-gray-200 p-3 rounded-xl font-bold"
              >
                Erneut scannen
              </button>
              <button 
                onClick={() => handleConfirmOrder()}
                disabled={loading}
                className="flex-1 bg-navy-900 text-white p-3 rounded-xl font-bold flex items-center justify-center gap-2"
              >
                {loading && <RefreshCw className="animate-spin w-5 h-5" />}
                Bestätigen
              </button>
            </div>
          </div>
          
          <SuggestedItemsPanel 
            ocrData={{
              customerName: scan.customerName || scan.company || "",
              itemName: scan.articleDescription || "",
              quantity: scan.quantity?.toString() || "",
              surfaceRequested: scan.surface || ""
            }} 
            onConfirm={(items) => handleConfirmOrder({ customParts: items })} 
          />
        </div>
      ) : (
        <CameraCapture onScanComplete={setScan} />
      )}
    </div>
  );
}
