"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Save } from "lucide-react";
import { AiBadge } from "../shared/AiBadge";

export function Eingangskarte({
  scanId,
  extractedData,
  fieldConfidence,
  reviewRequired,
  onSave
}: {
  scanId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extractedData: any;
  fieldConfidence: Record<string, number>;
  reviewRequired: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSave: (scanId: string, updatedData: any) => Promise<void>;
}) {
  const [data, setData] = useState(extractedData || {});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!extractedData || Object.keys(extractedData).length === 0) {
    return <div className="p-4 text-center text-gray-500 bg-gray-50 rounded-lg">Noch keine Scan-Daten vorhanden</div>;
  }

  const isLowConfidence = (field: string) => {
    return fieldConfidence?.[field] !== undefined && fieldConfidence[field] < 0.8;
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSave(scanId, data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCustomerChange = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    setData({
      ...data,
      customer: {
        ...(data.customer || {}),
        [field]: e.target.value
      }
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            Eingangskarte - Review
            <AiBadge />
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Diese Daten sind ein KI-Vorschlag. Bitte prüfen und ggf. korrigieren. Dies erstellt noch keinen verbindlichen Auftrag!
          </p>
        </div>
        {!reviewRequired && (
          <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full text-sm font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Review abgeschlossen
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm border border-red-200">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <h4 className="font-semibold text-gray-700">Kunde / Absender</h4>
        
        <div className="grid gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              Firmenname
              {isLowConfidence("customer.companyName") && <span title="Unsichere Erkennung"><AlertTriangle className="w-4 h-4 text-amber-500" /></span>}
            </label>
            <input
              type="text"
              value={data.customer?.companyName || data.customer?.name || ""}
              onChange={(e) => handleCustomerChange(e, "companyName")}
              className={`w-full p-2 border rounded-lg ${isLowConfidence("customer.companyName") ? 'border-amber-300 bg-amber-50' : 'border-gray-300'}`}
              disabled={!reviewRequired}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              Adresse
              {isLowConfidence("customer.address") && <span title="Unsichere Erkennung"><AlertTriangle className="w-4 h-4 text-amber-500" /></span>}
            </label>
            <input
              type="text"
              value={data.customer?.address || ""}
              onChange={(e) => handleCustomerChange(e, "address")}
              className={`w-full p-2 border rounded-lg ${isLowConfidence("customer.address") ? 'border-amber-300 bg-amber-50' : 'border-gray-300'}`}
              disabled={!reviewRequired}
            />
          </div>
        </div>
      </div>

      {reviewRequired && (
        <div className="pt-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Review abschließen
          </button>
        </div>
      )}
    </div>
  );
}
