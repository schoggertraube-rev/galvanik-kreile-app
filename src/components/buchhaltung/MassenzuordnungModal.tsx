import { useState } from "react";
import { X, Save } from "lucide-react";

interface MassenzuordnungModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssign: (kontoId: string, kostenstelleId: string) => Promise<void>;
  count: number;
}

export function MassenzuordnungModal({ isOpen, onClose, onAssign, count }: MassenzuordnungModalProps) {
  const [konto, setKonto] = useState("");
  const [kostenstelle, setKostenstelle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!konto && !kostenstelle) {
      alert("Bitte wählen Sie mindestens ein Konto oder eine Kostenstelle.");
      return;
    }
    setIsSubmitting(true);
    try {
      await onAssign(konto, kostenstelle);
      onClose();
    } catch (e) {
      alert("Fehler bei der Zuordnung");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-4 border-b border-neutral-100">
          <h2 className="text-lg font-bold text-[#1e1b18]">Massenzuordnung ({count} Belege)</h2>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1">Sachkonto (SKR03)</label>
            <select
              value={konto}
              onChange={(e) => setKonto(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Nicht ändern --</option>
              <option value="4930">4930 - Bürobedarf</option>
              <option value="3400">3400 - Wareneingang</option>
              <option value="4210">4210 - Miete</option>
              <option value="4260">4260 - Instandhaltung</option>
              <option value="4670">4670 - Reisekosten</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1">Kostenstelle</label>
            <select
              value={kostenstelle}
              onChange={(e) => setKostenstelle(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Nicht ändern --</option>
              <option value="ks-gal">GAL - Galvanik</option>
              <option value="ks-pol">POL - Politur</option>
              <option value="ks-sch">SCH - Schleifen</option>
              <option value="ks-buero">Büro / Verwaltung</option>
            </select>
          </div>
        </div>
        <div className="p-4 bg-neutral-50 flex justify-end gap-3 border-t border-neutral-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-neutral-600 hover:bg-neutral-200 rounded-xl transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? "Speichert..." : <><Save className="w-4 h-4" /> Anwenden</>}
          </button>
        </div>
      </div>
    </div>
  );
}
