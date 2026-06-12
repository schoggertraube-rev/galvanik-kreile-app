"use client";

import { useState, useEffect } from "react";
import { useErfassung } from "../ErfassungProvider";
import { Sparkles, ChevronDown, Check, Loader2, MapPin, Search } from "lucide-react";
import { createCustomerFromErfassung } from "@/app/actions/erfassung.actions";
import { extractCustomerDataFromFreetext, enrichCustomerData } from "@/app/actions/ai-enrichment.actions";

export function CustomerWizard() {
  const { options, closeErfassung, openErfassung, setIsDirty } = useErfassung();
  
  // State for the mandatory sections
  const [customerType, setCustomerType] = useState<"privat" | "business" | "lead">("privat");
  const [company, setCompany] = useState(options?.prefill?.company || "");
  const [contactName, setContactName] = useState(options?.prefill?.contactName || "");
  const [email, setEmail] = useState(options?.prefill?.email || "");
  const [phone, setPhone] = useState(options?.prefill?.phone || "");
  
  // Structured Address
  const [address, setAddress] = useState(options?.prefill?.address || "");
  const [street, setStreet] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [city, setCity] = useState("");
  
  
  const [notes, setNotes] = useState("");
  const [behaviorNote, setBehaviorNote] = useState(options?.prefill?.behaviorNote || "");
  
  const [freetext, setFreetext] = useState(options?.prefill?.rawText || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [successResult, setSuccessResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autofilledFields, setAutofilledFields] = useState<string[]>([]);
  const [inlineMessage, setInlineMessage] = useState<{ type: 'success'|'error', text: string } | null>(null);

  const getHighlight = (field: string) => autofilledFields.includes(field) ? ' ring-2 ring-green-400 !bg-green-50 transition-all duration-300' : '';

  useEffect(() => {
    const dirty = company.trim().length > 0 || contactName.trim().length > 0 || email.trim().length > 0 || freetext.trim().length > 0 || behaviorNote.trim().length > 0;
    setIsDirty(dirty);
  }, [company, contactName, email, freetext, behaviorNote, setIsDirty]);

  const handleSave = async () => {
    setError(null);
    if (customerType === "privat") {
      if (!contactName) return setError("Vor- und Nachname sind für Privatkunden erforderlich.");
    } else if (customerType === "business") {
      if (!company) return setError("Firma ist für Geschäftskunden erforderlich.");
    } else {
      if (!company && !contactName) return setError("Name oder Firma ist für Leads erforderlich.");
    }
    
    setIsSubmitting(true);
    try {
      const result = await createCustomerFromErfassung({
        company,
        contactName,
        email,
        phone,
        address,
        street,
        zipCode,
        city,
        country: "",
        notes,
        behaviorNote,
        source: options?.source || "manual",
        sourceRef: options?.sourceRef || null,
        type: customerType,
        isLead: customerType === "lead"
      });
      
      if (!result.ok) {
        setError("Fehler beim Speichern: " + result.error);
        setIsSubmitting(false);
        return;
      }
      
      setSuccessResult(result.customer);
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError("Fehler beim Speichern: " + e.message);
      } else {
        setError("Fehler beim Speichern");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExtractFreetext = async () => {
    if (!freetext) return;
    setIsExtracting(true);
    setInlineMessage(null);
    try {
      const res = await extractCustomerDataFromFreetext(freetext);
      if (res.ok && res.data) {
        const d = res.data;
        const filled: string[] = [];
        if (d.type) { setCustomerType(d.type); filled.push("customerType"); }
        if (d.company) { setCompany(d.company); filled.push("company"); }
        if (d.contactName) { setContactName(d.contactName); filled.push("contactName"); }
        if (d.email) { setEmail(d.email); filled.push("email"); }
        if (d.phone) { setPhone(d.phone); filled.push("phone"); }
        if (d.street) { setStreet(d.street); filled.push("street"); }
        if (d.zipCode) { setZipCode(d.zipCode); filled.push("zipCode"); }
        if (d.city) { setCity(d.city); filled.push("city"); }
        if (d.notes) { setNotes(d.notes); filled.push("notes"); }
        
        // Build address line
        setAddress([d.street, d.zipCode, d.city].filter(Boolean).join(", "));
        
        setAutofilledFields(filled);
        setInlineMessage({ type: 'success', text: "Daten aus Freitext erkannt und ausgefüllt!" });
        setTimeout(() => {
          setAutofilledFields([]);
          setInlineMessage(null);
        }, 2000);
      } else {
        setInlineMessage({ type: 'error', text: res.error || "Fehler beim Extrahieren" });
      }
    } finally {
      setIsExtracting(false);
    }
  };

  const handleEnrichWeb = async () => {
    if (!company && !city) {
      setInlineMessage({ type: 'error', text: "Mindestens Firma oder Stadt muss angegeben werden." });
      return;
    }
    setIsEnriching(true);
    setInlineMessage(null);
    try {
      const res = await enrichCustomerData(company, city);
      if (res.ok && res.data) {
        const d = res.data;
        const filled: string[] = [];
        if (d.street) { setStreet(d.street); filled.push("street"); }
        if (d.zipCode) { setZipCode(d.zipCode); filled.push("zipCode"); }
        if (d.city) { setCity(d.city); filled.push("city"); }
        if (d.website && !notes.includes(d.website)) { setNotes(prev => prev ? prev + "\\nWeb: " + d.website : "Web: " + d.website); filled.push("notes"); }
        if (d.phone && !phone) { setPhone(d.phone); filled.push("phone"); }
        if (d.email && !email) { setEmail(d.email); filled.push("email"); }
        
        setAddress([d.street || street, d.zipCode || zipCode, d.city || city].filter(Boolean).join(", "));
        
        setAutofilledFields(filled);
        setInlineMessage({ type: 'success', text: "Daten per Web/Gemini ergänzt! (Confidence: " + d.confidence + ")" });
        setTimeout(() => {
          setAutofilledFields([]);
          setInlineMessage(null);
        }, 2000);
      } else {
        setInlineMessage({ type: 'error', text: res.error || "Fehler beim Recherchieren" });
      }
    } finally {
      setIsEnriching(false);
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
          Der Kunde <strong>{successResult.name}</strong> wurde mit der Nummer <strong>{successResult.customerNumber}</strong> gespeichert.
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
          Kunde erfassen (V2)
        </h2>
        <p className="text-sm text-gray-500">
          KI-Assistent für die strukturierte Erfassung von Neukunden.
        </p>
      </div>

      {/* Main Form */}
      <div className="px-8 pb-8 space-y-6 overflow-y-auto flex-1">
        
        {/* KI Assistenz */}
        <section className="bg-linear-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3 text-indigo-900">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <h3 className="font-serif text-lg">Assistenz & Autofill</h3>
          </div>
          <textarea 
            value={freetext} 
            onChange={e => setFreetext(e.target.value)} 
            placeholder="Z.B. 'Herr Müller aus Fulda, Oldtimerteile, möchte Rückruf, Tel: 0151...'"
            className="w-full bg-white border border-indigo-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-300 focus:outline-none mb-3"
            rows={2}
          />
          <div className="flex gap-3">
            <button 
              onClick={handleExtractFreetext}
              disabled={isExtracting || !freetext}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              {isExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Aus Freitext erkennen
            </button>
            <button 
              onClick={handleEnrichWeb}
              disabled={isEnriching || (!company && !city)}
              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 disabled:opacity-50 text-indigo-700 border border-indigo-200 rounded-lg text-sm font-semibold transition-colors"
            >
              {isEnriching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Per Web/Gemini ergänzen
            </button>
          </div>
          {inlineMessage && (
            <div className={`mt-3 p-3 rounded-md text-sm ${inlineMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {inlineMessage.text}
            </div>
          )}
        </section>

        {/* 1. Kundentyp */}
        <section className="bg-white rounded-xl border border-[#e5dcd0] shadow-sm p-5">
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">Kundentyp</label>
          <div className="flex gap-6 p-1 bg-gray-100 rounded-lg max-w-md">
            {["privat", "business", "lead"].map((type) => (
              <label key={type} className={`flex-1 flex justify-center items-center gap-2 cursor-pointer py-2 px-4 rounded-md transition-all ${customerType === type ? 'bg-white shadow-sm font-bold text-navy-900' : 'text-gray-500 hover:text-gray-700'}`}>
                <input type="radio" checked={customerType === type} onChange={() => setCustomerType(type as "privat" | "business" | "lead")} className="hidden" />
                <span className="text-sm capitalize">{type === "business" ? "Firma" : type}</span>
              </label>
            ))}
          </div>
        </section>

        {/* 2. Stammdaten */}
        <section className="bg-white rounded-xl border border-[#e5dcd0] shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-lg text-[#1a1c23]">Stammdaten</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(customerType === "business" || customerType === "lead" || company) && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  Firma {customerType === "business" && <span className="text-red-500">*</span>}
                </label>
                <input type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="Galvanik-Bürkle GmbH" className={`w-full bg-[#fcfaf6] border border-[#e5dcd0] rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#e5dcd0] focus:outline-none${getHighlight("company")}`} />
              </div>
            )}
            
            {(customerType === "privat" || customerType === "lead" || customerType === "business") && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                  {customerType === "privat" ? "Vor- / Nachname" : "Ansprechpartner"} {customerType === "privat" && <span className="text-red-500">*</span>}
                </label>
                <input type="text" value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Max Mustermann" className={`w-full bg-[#fcfaf6] border border-[#e5dcd0] rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#e5dcd0] focus:outline-none${getHighlight("contactName")}`} />
              </div>
            )}
          </div>
        </section>

        {/* 3. Kontaktdaten */}
        <section className="bg-white rounded-xl border border-[#e5dcd0] shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-lg text-[#1a1c23]">Kontaktdaten</h3>
            {customerType === "privat" && <span className="text-xs text-gray-500 font-medium">Empfohlen: Tel oder E-Mail</span>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">E-Mail</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="info@beispiel.de" className={`w-full bg-[#fcfaf6] border border-[#e5dcd0] rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#e5dcd0] focus:outline-none${getHighlight("email")}`} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Telefon</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+49 123 45678" className={`w-full bg-[#fcfaf6] border border-[#e5dcd0] rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#e5dcd0] focus:outline-none${getHighlight("phone")}`} />
            </div>
          </div>
        </section>

        {/* 4. Adresse (Smart Field) */}
        <section className="bg-white rounded-xl border border-[#e5dcd0] shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-lg text-[#1a1c23] flex items-center gap-2"><MapPin className="w-5 h-5 text-gray-400" /> Adresse</h3>
          </div>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Anschrift (Gesamt)</label>
                <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Musterstraße 1, 12345 Musterstadt" className="w-full bg-[#fcfaf6] border border-[#e5dcd0] rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#e5dcd0] focus:outline-none" />
              </div>
              <button disabled className="shrink-0 h-[46px] px-4 bg-gray-100 text-gray-400 border border-gray-200 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-not-allowed">
                <MapPin className="w-4 h-4" />
                Google Places nicht verbunden
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-3 md:col-span-1">
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Straße & Nr</label>
                <input type="text" value={street} onChange={e => setStreet(e.target.value)} className={`w-full bg-[#fcfaf6] border border-[#e5dcd0] rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#e5dcd0] focus:outline-none${getHighlight("street")}`} />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">PLZ</label>
                <input type="text" value={zipCode} onChange={e => setZipCode(e.target.value)} className={`w-full bg-[#fcfaf6] border border-[#e5dcd0] rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#e5dcd0] focus:outline-none${getHighlight("zipCode")}`} />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Stadt</label>
                <input type="text" value={city} onChange={e => setCity(e.target.value)} className={`w-full bg-[#fcfaf6] border border-[#e5dcd0] rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#e5dcd0] focus:outline-none${getHighlight("city")}`} />
              </div>
            </div>
            {(!street || !city) && (
               <p className="text-xs text-gray-400 italic flex items-center gap-1">Nutze &quot;Per Web ergänzen&quot; oder &quot;Freitext erkennen&quot; zum Auffüllen.</p>
            )}
          </div>
        </section>

        {/* 5. Bemerkungen & Verhaltensnotiz */}
        <section className="bg-white rounded-xl border border-[#e5dcd0] shadow-sm p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Interne Bemerkung (Allgemein)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Hat mehrere Oldtimer. Bringt Teile meist persönlich..." className={`w-full bg-[#fcfaf6] border border-[#e5dcd0] rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#e5dcd0] focus:outline-none${getHighlight("notes")}`} rows={2} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">Verhaltensnotiz (Wichtig!)</label>
            <textarea value={behaviorNote} onChange={e => setBehaviorNote(e.target.value)} placeholder="Will telefonisch informiert werden. Sehr preissensibel..." className="w-full bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-amber-300 focus:outline-none" rows={2} />
          </div>
        </section>

      </div>

      {/* Footer */}
      <div className="px-4 sm:px-8 py-4 bg-white/95 backdrop-blur border-t border-[#e5dcd0] flex flex-col sm:flex-row justify-between items-center gap-3 z-20 sticky bottom-0">
        <button onClick={closeErfassung} className="px-6 py-3 font-semibold text-gray-600 hover:text-gray-900 transition-colors">Abbrechen</button>
        <button
          onClick={handleSave}
          disabled={isSubmitting || (customerType === "privat" && !contactName)}
          className="flex items-center gap-2 px-8 py-3 bg-[#1a1c23] hover:bg-black text-white rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Speichern"}
        </button>
          {error && (
            <p className="text-sm text-red-600 mt-2">{error}</p>
          )}
      </div>
    </div>
  );
}
