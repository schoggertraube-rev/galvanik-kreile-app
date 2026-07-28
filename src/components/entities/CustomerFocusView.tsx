"use client";

import { useState } from "react";
import { MockCustomer } from "@/lib/mockData";
import { X, Save, Phone, Mail, MapPin } from "lucide-react";
import "@/lib/repositories/customersRepository";

interface CustomerFocusViewProps {
  customer: MockCustomer;
  onClose: () => void;
  onSave: (changes: Partial<MockCustomer>) => Promise<void>;
}

export function CustomerFocusView({ customer, onClose, onSave }: CustomerFocusViewProps) {
  const [phone, setPhone] = useState(customer.phone || "");
  const [email, setEmail] = useState(customer.email || "");
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ phone, email });
      setHasChanges(false);
    } catch (e) {
      console.error("Fehler beim Speichern", e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg-app">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-navy-900 text-white shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="font-sans text-lg font-bold">Kundenkartei</h2>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-navy-700 text-white uppercase tracking-wider">
            ID: {customer.id}
          </span>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <X className="w-5 h-5 text-white/70 hover:text-white" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        
        {/* Core Info */}
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-navy-900 leading-tight">{customer.name}</h1>
          <div className="flex items-center gap-1 text-sm font-semibold text-text-muted">
            <MapPin className="w-4 h-4" />
            <span>{customer.address}, {customer.city}</span>
          </div>
        </div>

        {/* Inline Editing: Kontakt */}
        <div className="space-y-4">
          <label className="text-xs font-bold text-navy-900 uppercase tracking-wider block border-b border-neutral-gray-200 pb-2">
            Kontaktdaten (Inline Edit)
          </label>
          
          <div className="space-y-3 max-w-md">
            <div>
              <label className="text-xs font-bold text-text-muted block mb-1">Telefon</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="tel"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setHasChanges(true); }}
                  className="w-full h-10 pl-10 pr-3 rounded-lg border border-neutral-gray-200 bg-white text-navy-900 font-semibold focus:outline-none focus:ring-2 focus:ring-navy-900 focus:border-transparent transition-all"
                  placeholder="Telefonnummer..."
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-text-muted block mb-1">E-Mail</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setHasChanges(true); }}
                  className="w-full h-10 pl-10 pr-3 rounded-lg border border-neutral-gray-200 bg-white text-navy-900 font-semibold focus:outline-none focus:ring-2 focus:ring-navy-900 focus:border-transparent transition-all"
                  placeholder="E-Mail Adresse..."
                />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Footer / Actions */}
      <div className="p-4 border-t border-neutral-gray-200 bg-white flex justify-end gap-3 shrink-0">
        <button 
          onClick={onClose}
          className="px-6 py-2.5 text-sm font-bold text-text-muted hover:text-navy-900 hover:bg-neutral-gray-100 rounded-xl transition-colors"
        >
          Schließen
        </button>
        <button 
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className={`px-6 py-2.5 text-sm font-bold rounded-xl flex items-center gap-2 transition-all ${
            hasChanges && !isSaving
              ? "bg-navy-900 text-white hover:bg-navy-800 shadow-md"
              : "bg-neutral-gray-100 text-neutral-gray-400 cursor-not-allowed"
          }`}
        >
          <Save className="w-4 h-4" />
          {isSaving ? "Speichere..." : "Änderungen speichern"}
        </button>
      </div>

    </div>
  );
}
