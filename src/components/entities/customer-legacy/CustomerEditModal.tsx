"use client";

import { useState } from "react";
import { X, Save, Shield, User, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Customer } from "@/lib/repositories/customersRepository";

export function CustomerEditModal({
  customer,
  onClose,
  onSave
}: {
  customer: Customer;
  onClose: () => void;
  onSave: (changes: Partial<Customer>) => Promise<void>;
}) {
  const [formData, setFormData] = useState<Partial<Customer>>({
    name: customer.name || "",
    type: customer.type || "business",
    phone: customer.phone || "",
    email: customer.email || "",
    city: customer.city || "",
    address: customer.address || "",
    prefComm: customer.prefComm || "E-Mail",
    risk: customer.risk || "Niedrig",
    riskNote: customer.riskNote || "",
    notes: customer.notes || ""
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      alert("Der Kundenname darf nicht leer sein.");
      return;
    }
    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      console.error("Failed to save customer:", err);
      alert("Fehler beim Speichern des Kunden.");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key: keyof Customer, val: string | null) => {
    setFormData(prev => ({ ...prev, [key]: val }));
  };

  return (
    <div className="fixed inset-0 bg-navy-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-[95vw] rounded-3xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden border border-neutral-gray-100 animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="p-6 border-b border-neutral-gray-100 flex justify-between items-center bg-bg-app-soft">
          <div>
            <h2 className="text-2xl font-black font-serif text-navy-900">Kundenakte bearbeiten</h2>
            <p className="text-navy-500 text-xs font-bold uppercase tracking-widest mt-1">
              Kunden-Nr: {customer.customerNumber || "N/A"}
            </p>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-2 hover:bg-neutral-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-none [&::-webkit-scrollbar]:hidden">
          
          {/* Section: Stammdaten */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-text-muted uppercase tracking-widest flex items-center gap-1.5 border-b border-neutral-gray-100 pb-2">
              <User className="w-4 h-4 text-navy-700" /> Stammdaten & Typ
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-navy-500">Firmen- oder Kundenname</label>
                <Input 
                  value={formData.name} 
                  onChange={e => updateField("name", e.target.value)} 
                  className="rounded-xl border-2 border-neutral-gray-100 focus:border-navy-700"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-navy-500">Kundentyp</label>
                <select 
                  value={formData.type} 
                  onChange={e => updateField("type", e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border-2 border-neutral-gray-100 text-sm focus:border-navy-700 outline-none"
                >
                  <option value="business">Geschäftskunde</option>
                  <option value="private">Privatkunde</option>
                  <option value="institution">Institution</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section: Kontakt & Kommunikation */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-text-muted uppercase tracking-widest flex items-center gap-1.5 border-b border-neutral-gray-100 pb-2">
              <MapPin className="w-4 h-4 text-navy-700" /> Kontakt & Standort
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-navy-500">E-Mail Adresse</label>
                <Input 
                  type="email"
                  value={formData.email} 
                  onChange={e => updateField("email", e.target.value)} 
                  className="rounded-xl border-2 border-neutral-gray-100 focus:border-navy-700"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-navy-500">Telefonnummer</label>
                <Input 
                  type="tel"
                  value={formData.phone} 
                  onChange={e => updateField("phone", e.target.value)} 
                  className="rounded-xl border-2 border-neutral-gray-100 focus:border-navy-700"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-navy-500">Straße & Hausnummer</label>
                <Input 
                  value={formData.address} 
                  onChange={e => updateField("address", e.target.value)} 
                  className="rounded-xl border-2 border-neutral-gray-100 focus:border-navy-700"
                  placeholder="Musterstraße 42"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-navy-500">Stadt / Ort</label>
                <Input 
                  value={formData.city} 
                  onChange={e => updateField("city", e.target.value)} 
                  className="rounded-xl border-2 border-neutral-gray-100 focus:border-navy-700"
                  placeholder="70173 Stuttgart"
                />
              </div>
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-extrabold text-navy-500">Bevorzugter Kommunikationskanal</label>
              <select 
                value={formData.prefComm} 
                onChange={e => updateField("prefComm", e.target.value)}
                className="w-full h-10 px-3 rounded-xl border-2 border-neutral-gray-100 text-sm focus:border-navy-700 outline-none"
              >
                <option value="E-Mail">E-Mail</option>
                <option value="Telefon">Telefon</option>
                <option value="Brief / Post">Brief / Post</option>
              </select>
            </div>
          </div>

          {/* Section: Risiko & Besonderheiten */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-text-muted uppercase tracking-widest flex items-center gap-1.5 border-b border-neutral-gray-100 pb-2">
              <Shield className="w-4 h-4 text-navy-700" /> Bonitäts- & Risikoprofil
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-navy-500">Zahlungsrisiko / Bonität</label>
                <select 
                  value={formData.risk} 
                  onChange={e => updateField("risk", e.target.value)}
                  className={`w-full h-10 px-3 rounded-xl border-2 text-sm outline-none font-bold ${
                    formData.risk === "Hoch" 
                      ? "border-danger-red bg-accent-orange-soft text-danger-red" 
                      : formData.risk === "Mittel"
                      ? "border-accent-orange bg-gold-100 text-accent-orange"
                      : "border-neutral-gray-100 bg-white text-navy-900"
                  }`}
                >
                  <option value="Niedrig">Niedrig (Standard)</option>
                  <option value="Mittel">Mittel (Achtung)</option>
                  <option value="Hoch">Hoch (Vorkasse / Sperre)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-navy-500">Risiko-Begründung / Interne Notiz</label>
                <Input 
                  value={formData.riskNote} 
                  onChange={e => updateField("riskNote", e.target.value)} 
                  className="rounded-xl border-2 border-neutral-gray-100 focus:border-navy-700"
                  placeholder="z.B. Nur Vorkasse bei Kleinaufträgen"
                />
              </div>
            </div>
          </div>

          {/* Section: Besonderheiten */}
          <div className="space-y-2">
            <label className="text-xs font-black text-text-muted uppercase tracking-widest block border-b border-neutral-gray-100 pb-2">
              Besonderheiten / Technische Vorgaben
            </label>
            <textarea 
              value={formData.notes} 
              onChange={e => updateField("notes", e.target.value)}
              className="w-full min-h-[100px] p-3 rounded-xl border-2 border-neutral-gray-100 focus:border-navy-700 outline-none text-sm"
              placeholder="z.B. Bevorzugt Nickel-Oberfläche glänzend, Verpackung in Spezialkarton..."
            />
          </div>
        </form>

        {/* Footer */}
        <div className="p-6 border-t border-neutral-gray-100 flex justify-between items-center bg-bg-app-soft">
          <Button 
            type="button" 
            variant="ghost" 
            onClick={onClose} 
            className="rounded-xl"
          >
            Abbrechen
          </Button>
          <Button 
            type="submit" 
            onClick={handleSubmit}
            disabled={saving}
            className="bg-navy-700 hover:bg-navy-700 text-white font-bold rounded-xl flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? "Wird gespeichert..." : "Kundenkarte speichern"}
          </Button>
        </div>

      </div>
    </div>
  );
}
