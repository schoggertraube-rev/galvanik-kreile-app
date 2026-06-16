"use client";

import { useState, useEffect } from "react";
import { useErfassung } from "../ErfassungProvider";
import { User, Sparkles, ChevronDown, Check, Loader2 } from "lucide-react";
import { CustomerSection } from "./CustomerSection";
import { ItemsSection } from "./ItemsSection";
import { DateSection } from "./DateSection";
import { createOrderFromErfassung } from "@/app/actions/erfassung.actions";

export function ManualWizard() {
  const { options, closeErfassung, setIsDirty } = useErfassung();
  
  // State for the three mandatory sections
  const [customer, setCustomer] = useState<Record<string, unknown> | null>(options?.prefill?.customer || null);
  const [items, setItems] = useState<Record<string, unknown>[]>(options?.prefill?.items || []);
  const [dateInfo, setDateInfo] = useState<Record<string, unknown>>({ priority: options?.prefill?.order?.priority || "normal", shipping: "abholung" });
  
  // Optional toggles
  const [showFreetext, setShowFreetext] = useState(false);
  const [freetext, setFreetext] = useState("");
  const [showBehavior, setShowBehavior] = useState(!!options?.prefill?.behaviorNote);
  const [behaviorNote, setBehaviorNote] = useState((options?.prefill?.behaviorNote as string) || "");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<{ isQuote?: boolean; orderNumber?: string; id?: string } | null>(null);
  const { openErfassung } = useErfassung();

  useEffect(() => {
    const dirty = !!customer || items.length > 0 || freetext.trim().length > 0 || behaviorNote.trim().length > 0;
    setIsDirty(dirty);
  }, [customer, items, freetext, behaviorNote, setIsDirty]);

  useEffect(() => {
    if (options?.customerId && !customer) {
      // Fetch customer data if only ID was provided
      fetch(`/api/erfassung/customer-search`) // this might not work perfectly, better to use the server action directly?
        // Actually, we can just use getCustomerByIdDb directly from an action
        import("@/app/actions/customers.actions").then(({ getCustomerByIdDb }) => {
          getCustomerByIdDb(options.customerId as string).then(res => {
            if (res.ok && res.data) {
              setCustomer(res.data);
            }
          });
        });
    }
  }, [options?.customerId, customer]);

  const handleSave = async () => {
    // Basic validation
    if (!customer?.id) return alert("Bitte wähle einen Kunden aus.");
    if (items.length === 0) return alert("Bitte füge mindestens ein Teil hinzu.");
    if (!dateInfo.dueDate) return alert("Bitte gib einen Liefertermin an.");
    
    if (dateInfo.dueDate) {
      const selectedDate = new Date(dateInfo.dueDate as string);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        return alert("Der Termin darf nicht in der Vergangenheit liegen.");
      }
    }

    setIsSubmitting(true);
    try {
      const result = await createOrderFromErfassung({
        customerId: customer.id,
        items,
        priority: dateInfo.priority,
        dueDate: dateInfo.dueDate,
        timeWindow: dateInfo.timeWindow,
        calendarSync: dateInfo.calendarSync,
        freetextOriginal: freetext,
        behaviorNote,
        isQuote: options?.intent === "create_quote",
        source: options?.source || "manual",
        sourceRef: options?.sourceRef || null,
        title: items[0]?.name || "Unbenannt",
      });

      if (!result.ok) {
        alert("Fehler beim Speichern: " + result.error);
        setIsSubmitting(false);
        return;
      }

      setSuccessResult(result.order as { isQuote?: boolean; orderNumber?: string; id?: string });
    } catch (e: unknown) {
      if (e instanceof Error) {
        alert("Fehler beim Speichern: " + e.message);
      } else {
        alert("Fehler beim Speichern");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateNewCustomer = (searchName: string) => {
    openErfassung({
      mode: "customer",
      intent: "create_customer",
      source: "order", // we came from order
      prefill: { company: searchName, items, order: dateInfo, rawText: freetext }
    });
  };

  if (successResult) {
    const handleOpenOrder = () => {
      closeErfassung();
      if (successResult.id) {
        import("@/lib/overlayStore").then((mod) => {
          mod.useOverlayStore.getState().openOrder(successResult.id as string);
        });
      }
    };

    return (
      <div className="flex flex-col h-full bg-[#fcfaf6] rounded-2xl overflow-hidden relative justify-center items-center p-8 text-center">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
          <Check className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-serif text-[#1a1c23] mb-2">Auftrag erfolgreich angelegt!</h2>
        <p className="text-gray-600 mb-8">
          Der {successResult.isQuote ? "Kostenvoranschlag" : "Auftrag"} wurde mit der Nummer <strong>{successResult.orderNumber}</strong> gespeichert.
        </p>
        
        <div className="flex flex-col gap-3 w-full max-w-sm">
          <button
            onClick={handleOpenOrder}
            className="w-full px-6 py-3 font-bold text-white bg-[#1a1c23] border border-transparent rounded-lg hover:bg-black transition-all"
          >
            Auftrag öffnen
          </button>
          <button
            onClick={closeErfassung}
            className="w-full px-6 py-3 font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-all"
          >
            Schließen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#fcfaf6] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 sticky top-0 z-10 bg-[#fcfaf6]">
        <h2 className="text-2xl font-serif text-[#1a1c23] mb-1">
          {options?.intent === "create_quote" ? "KV-Anfrage anlegen" : "Auftrag manuell erfassen"}
        </h2>
        <p className="text-sm text-gray-500">
          Drei Pflichtsektionen — Freitext und Verhaltensnotiz als optionale Ergänzungen unten.
        </p>
      </div>

      {/* Main Form */}
      <div className="px-8 pb-8 space-y-6 overflow-y-auto flex-1">
        
        {/* 1. Kunde */}
        <section className="bg-white rounded-xl border border-[#e5dcd0] shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-[#1a1c23] text-white flex items-center justify-center text-xs font-bold">1</div>
              <h3 className="font-serif text-lg text-[#1a1c23]">Kunde</h3>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 rounded-full">PFLICHT</span>
          </div>
          <CustomerSection 
            customer={customer} 
            onChange={setCustomer} 
            onCreateNew={handleCreateNewCustomer}
          />
        </section>

        {/* The Gate: Only show Items and Date if customer is selected */}
        {customer && (
          <>
            {/* 2. Teile */}
            <section className="bg-white rounded-xl border border-[#e5dcd0] shadow-sm p-5 animate-in fade-in duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#1a1c23] text-white flex items-center justify-center text-xs font-bold">2</div>
                  <h3 className="font-serif text-lg text-[#1a1c23]">Teile</h3>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 rounded-full">PFLICHT</span>
              </div>
              <ItemsSection items={items} onChange={setItems} />
            </section>

            {/* 3. Termin */}
            <section className="bg-white rounded-xl border border-[#e5dcd0] shadow-sm p-5 animate-in fade-in duration-300">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#1a1c23] text-white flex items-center justify-center text-xs font-bold">3</div>
                  <h3 className="font-serif text-lg text-[#1a1c23]">Termin & Lieferung</h3>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 rounded-full">PFLICHT</span>
              </div>
              <DateSection dateInfo={dateInfo} onChange={setDateInfo} customer={customer} />
            </section>
          </>
        )}

        {/* Accordions */}
        <div className="space-y-3 pt-2">
          {/* Freitext */}
          <div className="bg-[#fcfaf6] border border-[#e5dcd0] rounded-xl overflow-hidden">
            <button 
              onClick={() => setShowFreetext(!showFreetext)}
              className="w-full p-4 flex items-center justify-between hover:bg-white transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-900 text-sm">Freitext nutzen — KI ergänzt Felder oben</div>
                  <div className="text-xs text-gray-500">Optional. Schreib drauflos, die KI füllt die strukturierten Felder.</div>
                </div>
              </div>
              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showFreetext ? 'rotate-180' : ''}`} />
            </button>
            {showFreetext && (
              <div className="p-4 bg-white border-t border-[#e5dcd0]">
                 <textarea 
                  className="w-full bg-[#fcfaf6] border border-[#e5dcd0] rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#e5dcd0] focus:outline-none" 
                  rows={3} 
                  placeholder="Kunde hat angerufen, liefert 50 Stahlrohre zum Verzinken..." 
                  value={freetext} 
                  onChange={(e) => setFreetext(e.target.value)} 
                />
              </div>
            )}
          </div>
          
          {/* Verhaltensnotiz */}
          <div className="bg-[#fcfaf6] border border-[#e5dcd0] rounded-xl overflow-hidden">
            <button 
              onClick={() => setShowBehavior(!showBehavior)}
              className="w-full p-4 flex items-center justify-between hover:bg-white transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600">
                  <User className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-900 text-sm">Verhaltensnotiz zum Kunden</div>
                  <div className="text-xs text-gray-500">Optional. Geht ins Kundenprofil, nicht in den Auftrag.</div>
                </div>
              </div>
              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showBehavior ? 'rotate-180' : ''}`} />
            </button>
            {showBehavior && (
              <div className="p-4 bg-white border-t border-[#e5dcd0]">
                 <textarea 
                  className="w-full bg-[#fcfaf6] border border-[#e5dcd0] rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#e5dcd0] focus:outline-none" 
                  rows={3} 
                  placeholder="Besondere Vorlieben, typisches Verhalten..." 
                  value={behaviorNote} 
                  onChange={(e) => setBehaviorNote(e.target.value)} 
                />
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Footer (Only show if customer selected) */}
      {customer && (
        <div className="px-4 sm:px-8 py-4 bg-white/95 backdrop-blur border-t border-[#e5dcd0] flex flex-col sm:flex-row justify-between items-center gap-3 z-20 sticky bottom-0">
          <button onClick={closeErfassung} className="px-6 py-3 font-semibold text-gray-600 hover:text-gray-900 transition-colors">Abbrechen</button>
          <button
            onClick={handleSave}
            disabled={isSubmitting || items.length === 0}
            className="flex items-center gap-2 px-8 py-3 bg-[#1a1c23] hover:bg-black text-white rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (options?.intent === "create_quote" ? "KV-Anfrage senden" : "Auftrag anlegen")}
          </button>
        </div>
      )}
      {!customer && (
        <div className="px-4 sm:px-8 py-4 bg-white/95 backdrop-blur border-t border-[#e5dcd0] flex flex-col sm:flex-row justify-between items-center gap-3 z-20 sticky bottom-0">
          <button onClick={closeErfassung} className="px-6 py-3 font-semibold text-gray-600 hover:text-gray-900 transition-colors">Abbrechen</button>
        </div>
      )}
    </div>
  );
}
