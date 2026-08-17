"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { useErfassung } from "../ErfassungProvider";

export function CustomerWizard() {
  const { options, closeErfassung, setIsDirty } = useErfassung();
  const [customerType, setCustomerType] = useState<"privat" | "business" | "lead">("privat");
  const [company, setCompany] = useState((options?.prefill?.company as string) || "");
  const [contactName, setContactName] = useState((options?.prefill?.contactName as string) || "");
  const [email, setEmail] = useState((options?.prefill?.email as string) || "");
  const [phone, setPhone] = useState((options?.prefill?.phone as string) || "");
  const [address, setAddress] = useState((options?.prefill?.address as string) || "");
  const [street, setStreet] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("DE");
  const [notes, setNotes] = useState("");
  const [behaviorNote, setBehaviorNote] = useState((options?.prefill?.behaviorNote as string) || "");
  const [freetext, setFreetext] = useState((options?.prefill?.rawText as string) || "");

  useEffect(() => {
    setIsDirty([company, contactName, email, freetext, behaviorNote].some((value) => value.trim().length > 0));
  }, [behaviorNote, company, contactName, email, freetext, setIsDirty]);

  const validatePostalCode = (selectedCountry: string, postalCode: string) => {
    if (!postalCode) return true;
    if (selectedCountry === "DE") return /^\d{5}$/.test(postalCode.trim());
    if (selectedCountry === "CH" || selectedCountry === "AT") return /^\d{4}$/.test(postalCode.trim());
    return postalCode.trim().length >= 3 && postalCode.trim().length <= 10;
  };
  const inputClass = "w-full bg-[#fcfaf6] border border-[#e5dcd0] rounded-lg p-3 text-sm focus:ring-2 focus:ring-[#e5dcd0] focus:outline-none";

  return (
    <div className="flex flex-col h-full bg-[#fcfaf6] rounded-2xl overflow-hidden">
      <div className="px-8 py-6 sticky top-0 z-10 bg-[#fcfaf6]"><h2 className="text-2xl font-serif text-[#1a1c23] mb-1">Kunde erfassen (V2)</h2><p className="text-sm text-gray-500">Manuelle, strukturierte Erfassung von Neukunden.</p></div>
      <div className="px-8 pb-8 space-y-6 overflow-y-auto flex-1">
        <section className="bg-linear-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-100 shadow-sm p-5"><h3 className="font-serif text-lg text-indigo-900 mb-3">Assistenz & Autofill</h3><textarea value={freetext} onChange={(event) => setFreetext(event.target.value)} placeholder="Freitext für die manuelle Übernahme" className="w-full bg-white border border-indigo-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-300 focus:outline-none mb-3" rows={2} /><div className="flex gap-3"><button disabled className="flex items-center gap-2 px-4 py-2 bg-indigo-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">Aus Freitext erkennen</button><button disabled className="flex items-center gap-2 px-4 py-2 bg-white disabled:opacity-50 text-indigo-700 border border-indigo-200 rounded-lg text-sm font-semibold">Per Web/Gemini ergänzen</button></div><p className="mt-3 text-sm font-semibold text-indigo-900">NOT_AVAILABLE: KI-/Provider-Assistenzen sind bis zum sicheren W3-KI-/Provider-Vertrag nicht verfügbar.</p></section>
        <section className="bg-white rounded-xl border border-[#e5dcd0] shadow-sm p-5"><label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">Kundentyp</label><div className="flex gap-6 p-1 bg-gray-100 rounded-lg max-w-md">{(["privat", "business", "lead"] as const).map((type) => <label key={type} className="flex-1 flex justify-center items-center gap-2 cursor-pointer py-2 px-4 rounded-md"><input type="radio" checked={customerType === type} onChange={() => setCustomerType(type)} className="hidden" /><span className="text-sm capitalize">{type === "business" ? "Firma" : type}</span></label>)}</div></section>
        <section className="bg-white rounded-xl border border-[#e5dcd0] shadow-sm p-5"><h3 className="font-serif text-lg text-[#1a1c23] mb-4">Stammdaten</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{(customerType === "business" || customerType === "lead" || company) && <div><label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Firma</label><input type="text" value={company} onChange={(event) => setCompany(event.target.value)} className={inputClass} /></div>}<div><label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">{customerType === "privat" ? "Vor- / Nachname" : "Ansprechpartner"}</label><input type="text" value={contactName} onChange={(event) => setContactName(event.target.value)} className={inputClass} /></div></div></section>
        <section className="bg-white rounded-xl border border-[#e5dcd0] shadow-sm p-5"><h3 className="font-serif text-lg text-[#1a1c23] mb-4">Kontaktdaten</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">E-Mail</label><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} /></div><div><label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Telefon</label><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className={inputClass} /></div></div></section>
        <section className="bg-white rounded-xl border border-[#e5dcd0] shadow-sm p-5"><h3 className="font-serif text-lg text-[#1a1c23] flex items-center gap-2 mb-4"><MapPin className="w-5 h-5 text-gray-400" />Adresse</h3><div className="space-y-4"><div><label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Anschrift (Gesamt)</label><input type="text" value={address} onChange={(event) => setAddress(event.target.value)} className={inputClass} /></div><div className="grid grid-cols-4 gap-4"><div className="col-span-2"><label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Straße</label><input type="text" value={street} onChange={(event) => setStreet(event.target.value)} className={inputClass} /></div><div className="col-span-2"><label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Nr</label><input type="text" value={houseNumber} onChange={(event) => setHouseNumber(event.target.value)} className={inputClass} /></div><div className="col-span-2"><label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Land</label><select value={country} onChange={(event) => setCountry(event.target.value)} className={inputClass}><option value="DE">Deutschland</option><option value="AT">Österreich</option><option value="CH">Schweiz</option><option value="OTHER">Anderes</option></select></div><div className="col-span-2"><label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">PLZ</label><input type="text" value={zipCode} onChange={(event) => setZipCode(event.target.value)} className={inputClass} />{zipCode && !validatePostalCode(country, zipCode) && <p className="text-[10px] text-red-500 mt-1">Ungültige PLZ für {country}</p>}</div><div className="col-span-4"><label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Stadt</label><input type="text" value={city} onChange={(event) => setCity(event.target.value)} className={inputClass} /></div></div>{(!street || !city) && <p className="text-xs text-gray-400 italic">Bitte die Adresse manuell vervollständigen.</p>}</div></section>
        <section className="bg-white rounded-xl border border-[#e5dcd0] shadow-sm p-5 space-y-4"><div><label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Interne Bemerkung (Allgemein)</label><textarea value={notes} onChange={(event) => setNotes(event.target.value)} className={inputClass} rows={2} /></div><div><label className="block text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">Verhaltensnotiz (Wichtig!)</label><textarea value={behaviorNote} onChange={(event) => setBehaviorNote(event.target.value)} className={inputClass} rows={2} /></div></section>
      </div>
      <div className="px-4 sm:px-8 py-4 bg-white/95 backdrop-blur border-t border-[#e5dcd0] flex flex-col sm:flex-row justify-between items-center gap-3 z-20 sticky bottom-0"><button onClick={closeErfassung} className="px-6 py-3 font-semibold text-gray-600 hover:text-gray-900 transition-colors">Abbrechen</button><button disabled className="flex items-center gap-2 px-8 py-3 bg-[#1a1c23] text-white rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">Speichern</button><p className="text-sm text-gray-600">NOT_AVAILABLE: Kundenerstellung benötigt den W3-Command-Vertrag.</p></div>
    </div>
  );
}
