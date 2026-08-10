"use client";

import { useState, useEffect } from "react";
import { useErfassung } from "../ErfassungProvider";
import { Check, Loader2, MapPin } from "lucide-react";
import { createCustomerDb } from "@/app/actions/customers.actions";

export function CustomerWizard() {
  const { options, closeErfassung, openErfassung, setIsDirty } = useErfassung();
  
  // State for the mandatory sections
  const [customerType, setCustomerType] = useState<"privat" | "business" | "lead">("privat");
  const [company, setCompany] = useState((options?.prefill?.company as string) || "");
  const [contactName, setContactName] = useState((options?.prefill?.contactName as string) || "");
  const [email, setEmail] = useState((options?.prefill?.email as string) || "");
  const [phone, setPhone] = useState((options?.prefill?.phone as string) || "");
  
  // Structured Address
  const [address, setAddress] = useState((options?.prefill?.address as string) || "");
  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("DE");
  
  
  const [notes, setNotes] = useState("");
  const [behaviorNote, setBehaviorNote] = useState((options?.prefill?.behaviorNote as string) || "");
  
  const [freetext, setFreetext] = useState((options?.prefill?.rawText as string) || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<{ id: string; customerNumber: string | null; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autofilledFields] = useState<string[]>([]);

  const getHighlight = (field: string) => autofilledFields.includes(field) ? ' ring-2 ring-green-400 !bg-green-50 transition-all duration-300' : '';

  useEffect(() => {
    const dirty = company.trim().length > 0 || contactName.trim().length > 0 || email.trim().length > 0 || freetext.trim().length > 0 || behaviorNote.trim().length > 0;
    setIsDirty(dirty);
  }, [company, contactName, email, freetext, behaviorNote, setIsDirty]);

  const validatePostalCode = (c: string, z: string) => {
    if (!z) return true; // Optional field, only validate if provided
    const normalized = z.trim();
    if (c === "DE") return /^\d{5}$/.test(normalized);
    if (c === "CH") return /^\d{4}$/.test(normalized);
    if (c === "AT") return /^\d{4}$/.test(normalized);
    return normalized.length >= 3 && normalized.length <= 10;
  };

  const handleSave = async () => {
    setError(null);
    if (customerType === "privat") {
      if (!contactName) return setError("Vor- und Nachname sind für Privatkunden erforderlich.");
    } else if (customerType === "business") {
      if (!company) return setError("Firma ist für Geschäftskunden erforderlich.");
    } else {
      if (!company && !contactName) return setError("Name oder Firma ist für Leads erforderlich.");
    }
    
    if (!street || !houseNumber || !zipCode || !city || !country || !email || !phone) {
      return setError("Bitte füllen Sie alle Pflichtfelder aus (Name/Firma, Straße, Hausnummer, PLZ, Ort, Land, E-Mail, Telefon).");
    }

    if (zipCode && !validatePostalCode(country, zipCode)) {
      return setError("Die Postleitzahl passt nicht zum ausgewählten Land.");
    }
    
    setIsSubmitting(true);
    try {
      const result = await createCustomerDb({
        company,
        firstName: contactName.split(' ')[0] || '',
        lastName: contactName.split(' ').slice(1).join(' ') || '',
        email,
        phone,
        address,
        street,
        houseNumber,
        postalCode: zipCode,
        city,
        country,
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
      
      setSuccessResult(result.data as { id: string; customerNumber: string | null; name: string });
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

  const handleNextToOrder = () => {
    openErfassung({
      mode: "order",
      customerId: successResult?.id || "",
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
            onClick={() => {
              closeErfassung();
              if (typeof window !== "undefined") {
                window.location.href = `/customers/${successResult.id}`;
              }
            }}
            className="w-full px-6 py-3 font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-all"
          >
            Zur Kundenakte
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
          Manuelle, strukturierte Erfassung von Neukunden.
        </p>
      </div>

      {/* Main Form */}
      <div className="px-8 pb-8 space-y-6 overflow-y-auto flex-1">
        
        {/* Provider-Assistenzen bleiben bis zum W3-Vertrag deaktiviert. */}
        <section className="bg-linear-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3 text-indigo-900">
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
              disabled
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              Aus Freitext erkennen
            </button>
            <button 
              disabled
              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 disabled:opacity-50 text-indigo-700 border border-indigo-200 rounded-lg text-sm font-semibold transition-colors"
            >
              Per Web/Gemini ergänzen
            </button>
          </div>
          <p className="mt-3 text-sm font-semibold text-indigo-900">
            NOT_AVAILABLE: KI-/Provider-Assistenzen sind bis zum sicheren W3-KI-/Provider-Vertrag nicht verfügbar.
          </p>
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
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-4 md:col-span-2 flex gap-2">
                <div className="flex-[2]">
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Straße</label>
                  <input type="text" value={street} onChange={e => setStreet(e.target.value)} className={`w-full bg-[#fcfaf6] border border-[#e5dcd0] rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#e5dcd0] focus:outline-none${getHighlight("street")}`} />
                </div>
                <div className="flex-[1]">
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Nr</label>
                  <input type="text" value={houseNumber} onChange={e => setHouseNumber(e.target.value)} className={`w-full bg-[#fcfaf6] border border-[#e5dcd0] rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#e5dcd0] focus:outline-none${getHighlight("houseNumber")}`} />
                </div>
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Land</label>
                <select value={country} onChange={e => setCountry(e.target.value)} className="w-full bg-[#fcfaf6] border border-[#e5dcd0] rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#e5dcd0] focus:outline-none">
                  <option value="DE">Deutschland</option>
                  <option value="AT">Österreich</option>
                  <option value="CH">Schweiz</option>
                  <option value="OTHER">Anderes</option>
                </select>
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">PLZ</label>
                <input type="text" value={zipCode} onChange={e => setZipCode(e.target.value)} className={`w-full bg-[#fcfaf6] border ${zipCode && !validatePostalCode(country, zipCode) ? 'border-red-500 bg-red-50' : 'border-[#e5dcd0]'} rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#e5dcd0] focus:outline-none${getHighlight("zipCode")}`} />
                {zipCode && !validatePostalCode(country, zipCode) && (
                  <p className="text-[10px] text-red-500 mt-1">Ungültige PLZ für {country}</p>
                )}
              </div>
              <div className="col-span-4">
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Stadt</label>
                <input type="text" value={city} onChange={e => setCity(e.target.value)} className={`w-full bg-[#fcfaf6] border border-[#e5dcd0] rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#e5dcd0] focus:outline-none${getHighlight("city")}`} />
              </div>
            </div>
            {(!street || !city) && (
               <p className="text-xs text-gray-400 italic flex items-center gap-1">Bitte die Adresse manuell vervollständigen.</p>
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
