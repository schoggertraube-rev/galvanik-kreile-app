"use client";

import { useState, useEffect, useRef } from "react";
import { FocusOverlay } from "@/components/entities/FocusOverlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ordersRepository } from "@/lib/repositories/ordersRepository";
import { X, Save, FileText, CheckCircle2 } from "lucide-react";

interface NewOrderFormProps {
  onClose: () => void;
  customerId: string;
  customerName: string;
  ocrData?: Record<string, string>;
  previewUrl?: string; // Base64 image
  onSuccess?: () => void;
}

export function NewOrderForm({ onClose, customerId, customerName, ocrData, previewUrl, onSuccess }: NewOrderFormProps) {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState(ocrData?.itemName?.trim() || "");
  const [quantity, setQuantity] = useState(ocrData?.quantity?.trim() || "");
  const [surface, setSurface] = useState(ocrData?.surfaceRequested || "");
  const [task, setTask] = useState("");
  const [success, setSuccess] = useState(false);
  const [persistedOrderNumber, setPersistedOrderNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      titleInputRef.current?.focus();
    }, 100);
    return () => window.clearTimeout(timer);
  }, []);

  const handleSave = async () => {
    const normalizedTitle = title.trim();
    const normalizedTask = task.trim();
    const normalizedSurface = surface.trim();
    const parsedQuantity = Number(quantity);

    if (!normalizedTitle || normalizedTitle.length > 200) {
      setError("Bitte eine Bezeichnung mit maximal 200 Zeichen eingeben.");
      return;
    }
    if (!Number.isSafeInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 1_000_000) {
      setError("Die Stückzahl muss eine ganze Zahl zwischen 1 und 1.000.000 sein.");
      return;
    }
    if (normalizedTask.length > 2_000 || normalizedSurface.length > 100) {
      setError("Hinweise oder Oberfläche überschreiten das zulässige Größenlimit.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const created = await ordersRepository.create({
        customerId,
        title: normalizedTitle,
        ...(normalizedTask ? { task: normalizedTask } : {}),
        source: "customer",
        parts: [
          {
            name: normalizedTitle,
            quantity: parsedQuantity,
            ...(normalizedSurface ? { surfaceRequested: normalizedSurface } : {}),
          },
        ],
      });
      setPersistedOrderNumber(created.orderNumber);
      setSuccess(true);
    } catch (err: unknown) {
      console.error("Fehler beim Erfassen des Auftrags", err);
      setError(err instanceof Error ? err.message : "Der Auftrag konnte nicht gespeichert werden.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <FocusOverlay isOpen={true} onClose={() => { if (onSuccess) onSuccess(); else onClose(); }}>
        <div className="flex flex-col h-[400px] max-w-[500px] mx-auto mt-20 bg-white rounded-2xl relative justify-center items-center p-8 text-center shadow-xl border border-neutral-gray-200">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-serif text-navy-900 mb-2">Auftrag gespeichert!</h2>
          <p className="text-gray-600 mb-8">
            Auftrag <strong>{persistedOrderNumber}</strong> für {customerName} wurde in der Datenbank bestätigt.
          </p>
          <Button
            onClick={() => {
              if (onSuccess) onSuccess();
              else onClose();
            }}
            className="w-full max-w-xs h-12 bg-navy-900 text-white font-bold rounded-lg hover:bg-navy-800 transition-all"
          >
            Schließen
          </Button>
        </div>
      </FocusOverlay>
    );
  }

  return (
    <FocusOverlay isOpen={true} onClose={onClose}>
      <div className="flex h-full max-w-[800px] mx-auto pt-10 px-4 pb-4">
        
        <div className="flex-1 bg-white rounded-2xl shadow-xl border border-neutral-gray-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-neutral-gray-100 flex items-center justify-between bg-bg-app-soft/50">
            <div>
              <h2 className="text-xl font-black font-serif text-navy-900">
                Auftrag erfassen
              </h2>
              <p className="text-xs text-text-muted font-bold mt-1">
                Kunde: <span className="text-navy-900">{customerName}</span>
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-neutral-gray-200">
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="space-y-4">
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-navy-900">Bezeichnung / Bauteil *</label>
                <Input 
                  ref={titleInputRef}
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  placeholder="z.B. Bleche 2mm"
                  className="font-medium text-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-navy-900">Stückzahl</label>
                  <Input 
                    type="number"
                    value={quantity} 
                    onChange={e => setQuantity(e.target.value)} 
                    className="font-medium"
                    min="1"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-navy-900">Oberfläche</label>
                  <Input 
                    value={surface} 
                    onChange={e => setSurface(e.target.value)} 
                    placeholder="z.B. verzinkt"
                    className="font-medium"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-navy-900">Zusätzliche Hinweise (optional)</label>
                <textarea 
                  value={task} 
                  onChange={e => setTask(e.target.value)} 
                  placeholder="Besondere Anforderungen..."
                  className="w-full text-sm p-3 border border-neutral-gray-300 rounded-lg min-h-[100px] font-medium resize-none focus:outline-none focus:border-navy-700"
                />
              </div>

              {previewUrl && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-900 rounded-lg border border-amber-200">
                  <FileText className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    Dokument nur als Vorschau erkannt; eine dauerhafte Auftragsablage ist hier noch nicht angebunden.
                  </span>
                </div>
              )}

              {error && (
                <div role="alert" className="p-3 rounded-lg border border-red-200 bg-red-50 text-sm font-semibold text-red-800">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-neutral-gray-100 bg-white flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={loading} className="font-bold">
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={loading || !title.trim() || !quantity.trim()} className="bg-navy-900 hover:bg-navy-800 text-white font-bold min-w-[140px]">
              {loading ? "Speichert..." : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Auftrag anlegen
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </FocusOverlay>
  );
}
