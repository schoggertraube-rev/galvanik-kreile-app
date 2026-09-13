"use client";

import { useEffect, useRef, useState } from "react";
import { ResponsiveDetailDrawer } from "@/components/ui/ResponsiveDetailDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { customersRepository } from "@/lib/repositories/customersRepository";
import { Customer } from "@/lib/types/customer";
import { Building2, Camera, Copy, FilePlus2, Save, Upload } from "lucide-react";
import Image from "next/image";

interface NewCustomerFormProps {
  onClose: () => void;
  customerId?: string | null;
  previewUrl?: string;
  onSave?: (customerId: string) => void;
  inline?: boolean;
}

export function NewCustomerForm({ onClose, customerId, previewUrl, onSave, inline = false }: NewCustomerFormProps) {
  void onSave;
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [street, setStreet] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (customerId) {
      customersRepository.getById(customerId).then((data) => {
        if (!data) return;
        setCustomer(data);
        setName(data.name || "");
        setCompanyName(data.companyName || "");
        setStreet(data.address || "");
        setZipCode(data.zipCode || "");
        setCity(data.city || "");
        setPhone(data.phone || "");
        setEmail(data.email || "");
        setNotes(data.notes || "");
        setImageUrls(data.imageUrls || []);
      });
    }
    const focusTimer = setTimeout(() => nameInputRef.current?.focus(), 100);
    return () => clearTimeout(focusTimer);
  }, [customerId]);

  const content = (
    <div className="flex flex-col lg:flex-row gap-6 w-full">
      <div className="flex-1 flex flex-col gap-6">
        <p className="text-xs text-text-muted font-bold -mt-2 mb-2">Kundennummer: <span className="font-mono text-navy-900 bg-neutral-gray-100 px-2 py-0.5 rounded border">{customer?.customerNumber ?? "Noch nicht vergeben"}</span></p>
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2"><label className="text-xs font-bold text-navy-900">Name *</label><Input ref={nameInputRef} value={name} onChange={(event) => setName(event.target.value)} placeholder="Max Mustermann" className="font-medium" /></div>
            <div className="space-y-2"><label className="text-xs font-bold text-navy-900">Firma (optional)</label><div className="relative"><Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-gray-400" /><Input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Muster GmbH" className="pl-9 font-medium" /></div></div>
          </div>
          <div className="space-y-4 bg-bg-app-soft/30 p-4 rounded-xl border border-neutral-gray-100"><h3 className="text-xs font-black text-navy-900 uppercase tracking-wider">Adresse</h3><div className="space-y-4"><div className="space-y-2"><label className="text-xs font-bold text-navy-900">Straße & Hausnummer</label><Input value={street} onChange={(event) => setStreet(event.target.value)} placeholder="Musterstraße 1" className="font-medium" /><p className="text-[10px] text-text-muted mt-1">Adresse bitte manuell eingeben.</p></div><div className="grid grid-cols-3 gap-4"><div className="col-span-1 space-y-2"><label className="text-xs font-bold text-navy-900">PLZ</label><Input value={zipCode} onChange={(event) => setZipCode(event.target.value)} placeholder="12345" className="font-medium" /></div><div className="col-span-2 space-y-2"><label className="text-xs font-bold text-navy-900">Stadt</label><Input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Musterstadt" className="font-medium" /></div></div></div></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div className="space-y-2"><label className="text-xs font-bold text-navy-900">Telefon</label><Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+49 123 456789" className="font-medium" /></div><div className="space-y-2"><label className="text-xs font-bold text-navy-900">E-Mail</label><Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="max@beispiel.de" type="email" className="font-medium" /></div></div>
          <div className="space-y-2"><label className="text-xs font-bold text-navy-900">Notiz</label><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Besondere Hinweise..." className="w-full text-sm p-3 border border-neutral-gray-300 rounded-lg min-h-[80px] font-medium resize-none focus:outline-none focus:border-navy-700" /></div>
          <div className="space-y-2"><label className="text-xs font-bold text-navy-900">Bilder & Dokumente (JPG/PNG)</label><div className="flex items-center gap-4 flex-wrap"><button disabled title="Nicht verfügbar: sicherer Server-Command-Vertrag fehlt." className="bg-white border-2 border-dashed border-neutral-gray-300 rounded-xl p-4 flex flex-col items-center justify-center min-w-[120px] opacity-50 cursor-not-allowed"><Camera className="w-5 h-5 text-navy-900 mb-2" /><span className="text-[10px] font-bold text-navy-900 text-center">Kamera<br />starten</span></button><button disabled title="Nicht verfügbar: sicherer Server-Command-Vertrag fehlt." className="bg-white border-2 border-dashed border-neutral-gray-300 rounded-xl p-4 flex flex-col items-center justify-center min-w-[120px] opacity-50 cursor-not-allowed"><Upload className="w-5 h-5 text-navy-900 mb-2" /><span className="text-[10px] font-bold text-navy-900 text-center">Datei<br />hochladen</span></button><div className="flex gap-3 overflow-x-auto pb-2">{imageUrls.map((url, index) => <div key={`existing-${index}`} className="relative shrink-0 group"><Image src={url} alt="Customer file" width={64} height={64} className="w-16 h-16 object-cover rounded-xl border border-neutral-gray-200" /></div>)}{previewUrl && !imageUrls.length && <div className="relative shrink-0 group"><Image src={previewUrl} alt="Scanned Preview" width={64} height={64} className="w-16 h-16 object-cover rounded-xl border border-neutral-gray-200" /></div>}</div></div></div>
        </div>
        <div className="pt-4 mt-2 border-t border-neutral-gray-100 flex justify-end gap-3"><Button variant="outline" onClick={onClose} className="font-bold h-12 px-6">Abbrechen</Button><Button disabled className="bg-navy-900 hover:bg-navy-800 text-white font-bold h-12 px-8 min-w-[140px]"><Save className="w-5 h-5 mr-2" />Speichern</Button></div>
        <p className="text-sm text-text-muted">{customerId ? "NOT_AVAILABLE: Kundenänderungen benötigen den W3-Command-Vertrag." : "NOT_AVAILABLE: Kundenerstellung benötigt den W3-Command-Vertrag."}</p>
      </div>
      <div className="w-full lg:w-[300px] flex flex-col gap-4"><div className="bg-white rounded-2xl shadow-xl border border-neutral-gray-200 p-5 space-y-4"><h3 className="text-sm font-black font-serif text-navy-900 border-b border-neutral-gray-100 pb-2">Aktionen</h3><Button disabled className="w-full justify-start h-12 bg-white border border-neutral-gray-200 text-navy-900 font-bold shadow-sm"><FilePlus2 className="w-4 h-4 mr-3 text-gold-600" />Auftrag anlegen</Button>{customerId && customer?.orders && customer.orders.length > 0 && <Button disabled className="w-full justify-start h-12 bg-white border border-neutral-gray-200 text-navy-900 font-bold shadow-sm"><Copy className="w-4 h-4 mr-3 text-gold-600" />Letzten Auftrag duplizieren</Button>}<p className="text-[10px] text-text-muted leading-relaxed mt-4">Auftragsaktionen werden erst nach einem sicheren W3-Command-Vertrag verfügbar.</p></div></div>
    </div>
  );

  return inline ? content : <ResponsiveDetailDrawer isOpen={true} onClose={onClose} title={customerId ? "Kunde bearbeiten" : "Neuen Kunden anlegen"} centered={true}>{content}</ResponsiveDetailDrawer>;
}
