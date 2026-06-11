"use client";

import { useState, useEffect } from "react";
import { useErfassung } from "../ErfassungProvider";
import { User, Sparkles, ChevronDown, Check, Loader2 } from "lucide-react";
import { createCustomerFromErfassung } from "@/app/actions/erfassung.actions";

export function CustomerWizard() {
  const { options, closeErfassung, openErfassung, setIsDirty } = useErfassung();
  
  // State for the mandatory sections
  const [company, setCompany] = useState(options?.prefill?.company || "");
  const [contactName, setContactName] = useState(options?.prefill?.contactName || "");
  const [email, setEmail] = useState(options?.prefill?.email || "");
  const [phone, setPhone] = useState(options?.prefill?.phone || "");
  const [address, setAddress] = useState(options?.prefill?.address || "");
  
  // Optional toggles
  const [showFreetext, setShowFreetext] = useState(false);
  const [freetext, setFreetext] = useState(options?.prefill?.rawText || "");
  const [showBehavior, setShowBehavior] = useState(!!options?.prefill?.behaviorNote);
  const [behaviorNote, setBehaviorNote] = useState(options?.prefill?.behaviorNote || "");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<any>(null);

  useEffect(() => {
    const dirty = company.trim().length > 0 || contactName.trim().length > 0 || email.trim().length > 0 || freetext.trim().length > 0 || behaviorNote.trim().length > 0;
    setIsDirty(dirty);
  }, [company, contactName, email, freetext, behaviorNote, setIsDirty]);

  const handleSave = async () => {
    if (!company && !contactName) return alert("Bitte Firma oder Name angeben.");
    
    setIsSubmitting(true);
    try {
      const result = await createCustomerFromErfassung({
        company,
        contactName,
        email,
        phone,
        address,
        behaviorNote,
        source: options?.source || "manual",
        sourceRef: options?.sourceRef || null,
        isLead: false // Default
      });
      
      if (!result.ok) {
        alert("Fehler beim Speichern: " + result.error);
        setIsSubmitting(false);
        return;
      }
      
      setSuccessResult(result.customer);
    } catch (e: any) {
      alert("Fehler beim Speichern: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextToOrder = () => {
    openErfassung({
      mode: "order",
      customerId: successResult.id,
      source: options?.source,
      sourceRef: options?.sourceRef,
      prefill: { ...options?.prefill, customer: successResult }
    });
  };

  if (successResult) {
    return (
      <div className="flex flex-col h-full bg-[#fcfaf6] rounded-2xl overflow-hidden relative justify-center items-center p-8 text-center">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
          <Check className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-serif text-[#1a1c23] mb-2">Kunde erfolgreich angelegt!</h2>
        <p className="text-gray-600 mb-8">
          Der Kunde <strong>{successResult.name}</strong> wurde in der Datenbank gespeichert.
        </p>
        
        <div className="flex flex-col gap-3 w-full max-w-sm">
          <button
            onClick={handleNextToOrder}
            className="w-full px-6 py-3 font-bold text-white bg-[#1a1c23] rounded-lg hover:bg-black transition-all"
          >
            Auftrag für diesen Kunden anlegen
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
          Kunde manuell erfassen
        </h2>
        <p className="text-sm text-gray-500">
          Stamm- und Kontaktdaten — Freitext und Verhaltensnotiz als optionale Ergänzungen unten.
        </p>
      </div>

      {/* Main Form */}
      <div className="px-8 pb-8 space-y-6 overflow-y-auto flex-1">
        
        {/* 1. Stammdaten */}
        <section className="bg-white rounded-xl border border-[#e5dcd0] shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-[#1a1c23] text-white flex items-center justify-center text-xs font-bold">1</div>
              <h3 className="font-serif text-lg text-[#1a1c23]">Stammdaten</h3>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 rounded-full">PFLICHT</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Firma</label>
              <input type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="z.B. Galvanik-Bürkle GmbH" className="w-full bg-[#fcfaf6] border border-[#e5dcd0] rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#e5dcd0] focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Ansprechpartner</label>
              <input type="text" value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Max Mustermann" className="w-full bg-[#fcfaf6] border border-[#e5dcd0] rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#e5dcd0] focus:outline-none" />
            </div>
          </div>
        </section>

        {/* 2. Kontaktdaten */}
        <section className="bg-white rounded-xl border border-[#e5dcd0] shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-[#1a1c23] text-white flex items-center justify-center text-xs font-bold">2</div>
              <h3 className="font-serif text-lg text-[#1a1c23]">Kontaktdaten</h3>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">E-Mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="info@beispiel.de" className="w-full bg-[#fcfaf6] border border-[#e5dcd0] rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#e5dcd0] focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Telefon</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+49 123 45678" className="w-full bg-[#fcfaf6] border border-[#e5dcd0] rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#e5dcd0] focus:outline-none" />
            </div>
          </div>
        </section>

        {/* 3. Adresse */}
        <section className="bg-white rounded-xl border border-[#e5dcd0] shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-[#1a1c23] text-white flex items-center justify-center text-xs font-bold">3</div>
              <h3 className="font-serif text-lg text-[#1a1c23]">Adresse</h3>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Straße, PLZ, Ort</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Musterstraße 1, 12345 Musterstadt" className="w-full bg-[#fcfaf6] border border-[#e5dcd0] rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#e5dcd0] focus:outline-none" />
          </div>
        </section>

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
                  placeholder="Kunde angerufen, neue E-Mail ist max@... Adresse bleibt." 
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
                  <div className="text-xs text-gray-500">Optional. Geht ins Kundenprofil.</div>
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

      {/* Footer / Actions */}
      <div className="bg-[#f3eee8] border-t border-[#e5dcd0] px-8 py-5 flex justify-between items-center sticky bottom-0">
        <button
          onClick={closeErfassung}
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          Abbrechen
        </button>
        <button
          onClick={handleSave}
          disabled={isSubmitting}
          className="px-6 py-2.5 text-sm font-bold text-white bg-[#1a1c23] rounded-lg hover:bg-black transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Kunde anlegen"} {!isSubmitting && <Check className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
