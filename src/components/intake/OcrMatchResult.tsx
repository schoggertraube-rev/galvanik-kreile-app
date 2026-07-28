"use client";

import { useState, useEffect } from "react";
import { UserPlus, UserCheck, FilePlus2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { matchCustomer } from "@/lib/customers/matchCustomer";
import { Customer } from "@/lib/repositories/customersRepository";
import { eventsRepository } from "@/lib/repositories/eventsRepository";
import { NewCustomerForm } from "@/components/customers/NewCustomerForm";
import { NewOrderForm } from "@/components/orders/NewOrderForm";
import Image from "next/image";

interface OcrMatchResultProps {
  ocrData: Record<string, string>;
  attachmentUrl?: string;
  previewUrl?: string; // Data URL for image or generic PDF icon
  onComplete: () => void; // Triggered when flow is finished
}

export function OcrMatchResult({ ocrData, attachmentUrl, previewUrl, onComplete }: OcrMatchResultProps) {
void attachmentUrl;
  const [matches, setMatches] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string, name: string } | null>(null);
  
  useEffect(() => {
    async function search() {
      // Create a concatenated string from the OCR fields
      const ocrText = Object.values(ocrData).join(" ");
      const results = await matchCustomer(ocrText);
      setMatches(results);
      setLoading(false);
      
      // Tracking
      eventsRepository.addEvent({ 
        eventType: "OCR_SCAN_COMPLETED", 
        metadata: { 
          action: "ocr_match_completed", 
          matchCount: results.length 
        } 
      });
    }
    search();
  }, [ocrData]);

  const handleCustomerSelected = (cust: Customer) => {
    setSelectedCustomer({ id: cust.id, name: cust.name });
    eventsRepository.addEvent({ 
      eventType: "CUSTOMER_MATCHED", 
      metadata: { action: "customer_match_selected" } 
    });
  };

  const handleNewCustomerCreated = (newId: string) => {
    setShowNewCustomer(false);
    // In a real app we'd fetch the new customer name, for now just use "Neu angelegt"
    setSelectedCustomer({ id: newId, name: "Neu angelegt" });
    eventsRepository.addEvent({ 
      eventType: "CUSTOMER_MATCHED", 
      metadata: { action: "customer_created_from_ocr" } 
    });
  };

  if (showNewCustomer) {
    return (
      <NewCustomerForm 
        onClose={() => setShowNewCustomer(false)}
        previewUrl={previewUrl}
        onSave={handleNewCustomerCreated}
      />
    );
  }

  if (selectedCustomer) {
    return (
      <NewOrderForm 
        onClose={() => setSelectedCustomer(null)}
        customerId={selectedCustomer.id}
        customerName={selectedCustomer.name}
        ocrData={ocrData}
        previewUrl={previewUrl}
        onSuccess={() => {
          setSelectedCustomer(null);
          onComplete();
        }}
      />
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 animate-in slide-in-from-right-8 duration-300">
      <div className="text-center space-y-2 mb-6">
        <h2 className="text-3xl font-black font-serif text-navy-900">OCR Ergebnis</h2>
        <p className="text-navy-500 font-medium">Wir haben das Dokument analysiert.</p>
      </div>
      
      {/* Attachment Preview Section */}
      {previewUrl && (
        <div className="flex justify-center mb-8">
          <div className="relative rounded-2xl overflow-hidden border-2 border-neutral-gray-200 shadow-md">
            <Image 
              src={previewUrl.startsWith("data:application/pdf") ? "/pdf-icon.png" : previewUrl} 
              alt="Scan Vorschau"
              width={200}
              height={200}
              className="object-cover max-h-[200px]"
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-12 h-12 border-4 border-navy-700 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {matches.length > 0 ? (
            <div className="space-y-3">
              <h3 className="font-bold text-navy-900 text-sm uppercase tracking-wider pl-1">Gefundene Kunden ({matches.length})</h3>
              {matches.map(m => (
                <div key={m.id} className="bg-white border-2 border-neutral-gray-100 hover:border-navy-700 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between transition-all gap-4">
                  <div className="flex-1 w-full text-left">
                    <h4 className="font-extrabold text-lg text-navy-900">{m.name}</h4>
                    <p className="text-sm text-navy-500 font-medium">{m.customerNumber} · {m.city || "Kein Ort"}</p>
                  </div>
                  <div className="flex gap-2 w-full md:w-auto">
                    <Button 
                      variant="outline"
                      className="border-2 border-danger-red text-danger-red hover:bg-danger-red-soft font-bold rounded-xl"
                      onClick={() => setMatches(matches.filter(x => x.id !== m.id))}
                    >
                      Nicht dieser
                    </Button>
                    <Button 
                      className="bg-navy-900 hover:bg-navy-800 text-white font-bold rounded-xl"
                      onClick={() => handleCustomerSelected(m)}
                    >
                      <FilePlus2 className="w-4 h-4 mr-2" />
                      Auftrag erfassen
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-bg-app-soft border-2 border-neutral-gray-100 border-dashed rounded-3xl p-8 text-center">
              <Search className="h-12 w-12 text-text-muted mx-auto mb-4" />
              <h3 className="font-extrabold text-navy-900 text-xl">Kein Bestandskunde gefunden</h3>
              <p className="text-navy-500 mt-1 font-medium">Es wurde kein passender Kunde zum Scan gefunden.</p>
            </div>
          )}

          <div className="pt-6 border-t border-neutral-gray-100 mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button 
              onClick={() => setShowNewCustomer(true)}
              variant="outline"
              className="h-14 text-base font-extrabold rounded-2xl border-2 border-text-muted hover:bg-neutral-gray-100 text-navy-900 active:scale-95 transition-all"
            >
              <UserPlus className="mr-2 h-5 w-5" />
              Neuen Kunden anlegen
            </Button>
            <Button 
              onClick={() => {
                // Here we might just go back or to manual search
                onComplete();
              }}
              variant="outline"
              className="h-14 text-base font-extrabold rounded-2xl border-2 border-text-muted hover:bg-neutral-gray-100 text-navy-900 active:scale-95 transition-all"
            >
              <UserCheck className="mr-2 h-5 w-5" />
              Manuell zuordnen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
