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
  const [title, setTitle] = useState(ocrData?.itemName || "Neuer Auftrag");
  const [quantity, setQuantity] = useState(ocrData?.quantity || "1");
  const [surface, setSurface] = useState(ocrData?.surfaceRequested || "");
  const [task, setTask] = useState("");
  
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => {
      titleInputRef.current?.focus();
    }, 100);
  }, []);

  const handleSave = async () => {
    try {
      setLoading(true);
      let finalAttachmentUrl = "";
      
      if (previewUrl && previewUrl.startsWith("data:")) {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        
        // Convert base64 to Blob
        const response = await fetch(previewUrl);
        const blob = await response.blob();
        
        const fileName = `order_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.jpg`;
        const { data, error } = await supabase.storage.from("attachments").upload(fileName, blob);
        
        if (!error && data) {
          const { data: publicUrlData } = supabase.storage.from("attachments").getPublicUrl(fileName);
          finalAttachmentUrl = publicUrlData.publicUrl;
        }
      }

      await ordersRepository.create({
        customerId,
        title,
        task,
        station: "wareneingang",
        attachmentUrl: finalAttachmentUrl || undefined,
        parts: [
          {
            name: title,
            quantity: parseInt(quantity, 10) || 1,
            surfaceRequested: surface,
          }
        ]
      });
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error("Fehler beim Erfassen des Auftrags", err);
    } finally {
      setLoading(false);
    }
  };

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
                <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-800 rounded-lg border border-blue-100">
                  <FileText className="w-5 h-5" />
                  <span className="text-sm font-bold">Lieferschein / Dokument angehängt</span>
                  <CheckCircle2 className="w-4 h-4 ml-auto text-green-600" />
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-neutral-gray-100 bg-white flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={loading} className="font-bold">
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={loading || !title} className="bg-navy-900 hover:bg-navy-800 text-white font-bold min-w-[140px]">
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
