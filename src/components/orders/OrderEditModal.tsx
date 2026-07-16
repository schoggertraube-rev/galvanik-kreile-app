"use client";

import { useState } from "react";
import { X, Save, FileText, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Order } from "@/lib/repositories/ordersRepository";
import type { OrderUpdateInput } from "@/lib/orders/orderMutationContract";

function formatDateForInput(isoString?: string) {
  return isoString ? isoString.split("T")[0] : "";
}

export function OrderEditModal({
  order,
  onClose,
  onSave,
}: {
  order: Order;
  onClose: () => void;
  onSave: (changes: OrderUpdateInput) => Promise<void>;
}) {
  const [title, setTitle] = useState(order.title || "");
  const [task, setTask] = useState(order.task || "");
  const [dueDate, setDueDate] = useState(formatDateForInput(order.rawDueDate || order.dueDate));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDirty = title !== order.title
    || task !== (order.task || "")
    || dueDate !== formatDateForInput(order.rawDueDate || order.dueDate);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedTitle = title.trim();
    const normalizedTask = task.trim();
    if (!normalizedTitle || normalizedTitle.length > 200 || normalizedTask.length > 2_000) {
      setError("Titel oder Hinweise sind leer beziehungsweise zu lang.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        title: normalizedTitle,
        task: normalizedTask || null,
        dueDate: dueDate || null,
      });
      onClose();
    } catch (err: unknown) {
      console.error("Failed to save order:", err);
      setError(err instanceof Error ? err.message : "Auftrag konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (!isDirty || window.confirm("Ungespeicherte Änderungen verwerfen?")) onClose();
  };

  return (
    <div className="fixed inset-0 bg-navy-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-neutral-gray-100 animate-in zoom-in-95 duration-300">
        <div className="p-6 border-b border-neutral-gray-100 flex justify-between items-center bg-bg-app-soft">
          <div>
            <h2 className="text-2xl font-black font-serif text-navy-900">Auftrag bearbeiten</h2>
            <p className="text-navy-500 text-xs font-bold uppercase tracking-widest mt-1">
              Auftrags-Nr: {order.orderNumber}
            </p>
          </div>
          <button type="button" onClick={handleCancel} className="p-2 hover:bg-neutral-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8">
          <div className="space-y-4">
            <h3 className="text-xs font-black text-text-muted uppercase tracking-widest flex items-center gap-1.5 border-b border-neutral-gray-100 pb-2">
              <FileText className="w-4 h-4 text-navy-700" /> Basisdaten
            </h3>
            <div className="space-y-1">
              <label className="text-xs font-extrabold text-navy-500">Titel</label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-extrabold text-navy-500">Hinweise</label>
              <textarea
                value={task}
                onChange={(event) => setTask(event.target.value)}
                maxLength={2_000}
                className="w-full min-h-24 rounded-xl border-2 border-neutral-gray-100 p-3 text-sm focus:border-navy-700 outline-none"
              />
            </div>
            <p className="text-xs text-text-muted">
              Kunde und Eingangszeit sind Identitäts-/Auditdaten und werden in diesem Formular nicht umgeschrieben.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-black text-text-muted uppercase tracking-widest flex items-center gap-1.5 border-b border-neutral-gray-100 pb-2">
              <Calendar className="w-4 h-4 text-navy-700" /> Zugesagter Liefertermin
            </h3>
            <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </div>

          {error && <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm font-semibold">{error}</div>}
        </form>

        <div className="p-6 border-t border-neutral-gray-100 flex justify-between items-center bg-bg-app-soft">
          <Button type="button" variant="ghost" onClick={handleCancel} className="rounded-xl">Abbrechen</Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !isDirty}
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
