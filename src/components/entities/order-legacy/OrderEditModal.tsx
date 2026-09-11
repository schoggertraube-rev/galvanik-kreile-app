"use client";

import { useState } from "react";
import { X, Save, FileText, Calendar, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Order } from "@/lib/repositories/ordersRepository";
import type { Customer } from "@/lib/repositories/customersRepository";

export function OrderEditModal({
  order,
  customers,
  onClose,
  onSave
}: {
  order: Order;
  customers: Customer[];
  onClose: () => void;
  onSave: (changes: Partial<Order>) => Promise<void>;
}) {
  // Helper to format ISO to YYYY-MM-DD for date inputs
  const formatDateForInput = (isoString?: string) => {
    if (!isoString) return "";
    try {
      return isoString.split('T')[0];
    } catch {
      return "";
    }
  };

  const [formData, setFormData] = useState<Partial<Order>>({
    task: order.task || order.title || "",
    customerId: order.customerId || "",
    rawIntakeDate: formatDateForInput(order.rawIntakeDate),
    rawDueDate: formatDateForInput(order.rawDueDate),
  });
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.task?.trim()) {
      alert("Der Titel/die Aufgabe darf nicht leer sein.");
      return;
    }
    if (!formData.customerId?.trim()) {
      alert("Bitte weisen Sie einen Kunden zu.");
      return;
    }

    setSaving(true);
    try {
      // Convert YYYY-MM-DD back to ISO if they exist
      const finalChanges: Partial<Order> = {
        task: formData.task,
        customerId: formData.customerId,
      };

      if (formData.rawIntakeDate) {
        // Just append a default time to make it valid ISO
        finalChanges.rawIntakeDate = new Date(`${formData.rawIntakeDate}T08:00:00Z`).toISOString();
      }
      if (formData.rawDueDate) {
        finalChanges.rawDueDate = new Date(`${formData.rawDueDate}T17:00:00Z`).toISOString();
      }

      await onSave(finalChanges);
      onClose();
    } catch (err: unknown) {
      console.error("Failed to save order:", err);
      alert(`Fehler beim Speichern des Auftrags: ${(err as Error)?.message || "Unbekannter Fehler"}`);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key: keyof Order, val: string | null) => {
    setFormData(prev => ({ ...prev, [key]: val }));
    setIsDirty(true);
  };

  const handleCancel = () => {
    if (isDirty) {
      if (window.confirm("Bist du sicher? Deine ungespeicherten Änderungen gehen verloren.")) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-navy-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-neutral-gray-100 animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="p-6 border-b border-neutral-gray-100 flex justify-between items-center bg-bg-app-soft">
          <div>
            <h2 className="text-2xl font-black font-serif text-navy-900">Auftrag bearbeiten</h2>
            <p className="text-navy-500 text-xs font-bold uppercase tracking-widest mt-1">
              Auftrags-Nr: {order.orderNumber}
            </p>
          </div>
          <button 
            type="button"
            onClick={handleCancel} 
            className="p-2 hover:bg-neutral-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Section: Basisdaten */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-text-muted uppercase tracking-widest flex items-center gap-1.5 border-b border-neutral-gray-100 pb-2">
              <FileText className="w-4 h-4 text-navy-700" /> Basisdaten
            </h3>
            
            <div className="space-y-1">
              <label className="text-xs font-extrabold text-navy-500">Titel / Aufgabe</label>
              <Input 
                value={formData.task || ""} 
                onChange={e => updateField("task", e.target.value)} 
                className="rounded-xl border-2 border-neutral-gray-100 focus:border-navy-700"
                placeholder="z.B. Vernickeln von 100 Zahnrädern"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-extrabold text-navy-500 flex items-center gap-1.5">
                <User className="w-4 h-4" /> Kunde / Auftraggeber
              </label>
              <select 
                value={formData.customerId || ""} 
                onChange={e => updateField("customerId", e.target.value)}
                className="w-full h-10 px-3 rounded-xl border-2 border-neutral-gray-100 text-sm focus:border-navy-700 outline-none"
                required
              >
                <option value="" disabled>-- Bitte Kunden wählen --</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Section: Termine */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-text-muted uppercase tracking-widest flex items-center gap-1.5 border-b border-neutral-gray-100 pb-2">
              <Calendar className="w-4 h-4 text-navy-700" /> Termine
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-navy-500">Eingangsdatum</label>
                <Input 
                  type="date"
                  value={formData.rawIntakeDate || ""} 
                  onChange={e => updateField("rawIntakeDate", e.target.value)} 
                  className="rounded-xl border-2 border-neutral-gray-100 focus:border-navy-700"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-extrabold text-navy-500">Fälligkeit / Liefertermin</label>
                <Input 
                  type="date"
                  value={formData.rawDueDate || ""} 
                  onChange={e => updateField("rawDueDate", e.target.value)} 
                  className="rounded-xl border-2 border-neutral-gray-100 focus:border-navy-700"
                />
              </div>
            </div>
          </div>

        </form>

        {/* Footer */}
        <div className="p-6 border-t border-neutral-gray-100 flex justify-between items-center bg-bg-app-soft">
          <Button 
            type="button" 
            variant="ghost" 
            onClick={handleCancel} 
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
            {saving ? "Wird gespeichert..." : "Änderungen speichern"}
          </Button>
        </div>

      </div>
    </div>
  );
}
