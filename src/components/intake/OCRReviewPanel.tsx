"use client";
import { useState } from "react";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OCRScan } from "@/lib/services/ocrService";

export function OCRReviewPanel({ scan, onConfirm }: { scan: OCRScan; onConfirm: (data: Record<string, string>) => void }) {
  const [fields, setFields] = useState(scan.extractedFields);

  const handleChange = (index: number, val: string) => {
    const newFields = [...fields];
    newFields[index].value = val;
    newFields[index].reviewState = "edited";
    setFields(newFields);
  };

  const hasUncertain = fields.some(f => f.confidence < 0.85 && f.reviewState === "uncertain");

  // Konvertiere die Array-Werte zu einem einfachen Key-Value-Objekt für den nächsten Schritt
  const handleNext = () => {
    const parsedData: Record<string, string> = {};
    fields.forEach(f => parsedData[f.key] = f.value);
    onConfirm(parsedData);
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 animate-in slide-in-from-right-8 duration-300">
      <div className="text-center space-y-1 mb-6">
        <h2 className="text-3xl font-black font-serif text-navy-900">Scan-Ergebnis prüfen</h2>
        <p className="text-navy-500 font-medium">Bitte kontrolliere die von der KI erfassten Daten.</p>
      </div>

      {hasUncertain && (
        <div className="bg-gold-100 border-2 border-accent-orange rounded-2xl p-5 flex gap-4 items-center shadow-sm">
          <div className="bg-orange-100 p-3 rounded-full">
            <AlertTriangle className="text-accent-orange h-6 w-6" />
          </div>
          <div>
            <h4 className="font-extrabold text-accent-orange">Prüfung erforderlich</h4>
            <p className="text-sm font-medium text-accent-orange mt-1">Die gelb markierten Felder sind unsicher. Bitte manuell korrigieren.</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {fields.map((f, i) => {
          const isUncertain = f.confidence < 0.85 && f.reviewState === "uncertain";
          return (
            <div 
              key={f.key} 
              className={`p-4 rounded-xl border-2 transition-all ${isUncertain ? 'bg-gold-100 border-yellow-400 shadow-md scale-[1.01]' : 'bg-white border-neutral-gray-100 focus-within:border-navy-700'}`}
            >
              <label className="block text-xs font-bold text-navy-500 uppercase tracking-wider mb-1">
                {f.key} 
                {isUncertain && <span className="text-yellow-700 ml-2 bg-yellow-200/50 px-2 py-0.5 rounded-full text-[10px]">(KI-Score: {Math.round(f.confidence*100)}%)</span>}
              </label>
              <input 
                value={f.value}
                onChange={e => handleChange(i, e.target.value)}
                className={`w-full text-lg font-bold bg-transparent outline-none ${isUncertain ? 'text-yellow-900' : 'text-navy-900'}`}
              />
            </div>
          );
        })}
      </div>

      <div className="pt-6">
        <Button 
          onClick={handleNext}
          className={`w-full h-16 text-lg font-extrabold rounded-2xl shadow-lg transition-all ${
            hasUncertain ? "bg-text-muted text-navy-500 hover:bg-text-muted" : "bg-green-600 text-white hover:bg-green-700"
          }`}
        >
          {hasUncertain ? "Bitte alle gelben Felder prüfen" : "Sieht gut aus — Weiter"}
          {!hasUncertain && <ChevronRight className="ml-2 h-6 w-6" />}
        </Button>
      </div>
    </div>
  );
}
