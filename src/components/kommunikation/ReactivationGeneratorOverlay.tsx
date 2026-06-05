"use client";

import React, { useState } from "react";
import { X, Calendar, Send, CheckCircle2, Bot, Sparkles } from "lucide-react";

interface ReactivationGeneratorOverlayProps {
  customer: { name: string };
  lastOrderTitle: string;
  lastOrderDate: string;
  onClose: () => void;
}

export function ReactivationGeneratorOverlay({ customer, lastOrderTitle, lastOrderDate, onClose }: ReactivationGeneratorOverlayProps) {
  const [step, setStep] = useState<"generate" | "review" | "scheduled">("generate");
  const [tone, setTone] = useState<"persönlich" | "sachlich" | "hochwertig" | "kurz">("persönlich");
  const [subject, setSubject] = useState(`Fortsetzung Ihrer Restauration: ${lastOrderTitle}`);
  const [body, setBody] = useState(
    `Guten Tag Herr/Frau ${customer.name?.split(" ").pop() || "Kunde"},\n\nwir hatten im vergangenen Jahr (${lastOrderDate}) die ${lastOrderTitle} bei uns.\n\nFalls Sie die Restauration fortsetzen möchten — etwa mit weiteren Anbauteilen — können wir gerne wieder eine Einschätzung vorbereiten.\n\nMit freundlichen Grüßen,\nIhr KREILE-Team`
  );

  const handleGenerate = () => {
    // Simulate generation delay
    setStep("review");
  };

  const handleSchedule = () => {
    setStep("scheduled");
    setTimeout(onClose, 3000);
  };

  return (
    <div className="fixed inset-0 z-110 flex items-center justify-center p-4 lg:p-8 bg-navy-900/60 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in slide-in-from-bottom-8">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-gray-100 flex justify-between items-center bg-gold-50">
          <div className="flex items-center gap-3">
            <div className="bg-gold-200 p-2 rounded-xl text-gold-900">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black font-serif text-navy-900">Reaktivierungs-E-Mail vorbereiten</h2>
              <p className="text-sm font-medium text-navy-700">Umsatzchance: {customer.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gold-200 rounded-full transition-colors text-gold-900">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === "generate" && (
            <div className="space-y-6">
              <div className="bg-bg-app-soft p-4 rounded-2xl border border-neutral-gray-100 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted font-bold">Kunde:</span>
                  <span className="text-navy-900 font-bold">{customer.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted font-bold">Letzter Auftrag:</span>
                  <span className="text-navy-900 font-bold">{lastOrderTitle}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted font-bold">Zeitpunkt:</span>
                  <span className="text-navy-900 font-bold">{lastOrderDate}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-navy-900 mb-2">Tonalität wählen</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {["persönlich", "sachlich", "hochwertig", "kurz"].map(t => (
                    <button 
                      key={t}
                      onClick={() => setTone(t as typeof tone)}
                      className={`py-2 px-3 rounded-xl border-2 text-sm font-bold transition-colors capitalize ${tone === t ? "border-navy-900 bg-navy-900 text-white" : "border-neutral-gray-200 bg-white text-navy-700 hover:border-navy-400"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-blue-50 text-blue-800 text-sm rounded-xl flex gap-3 items-start border border-blue-200">
                <Bot className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" />
                <p>
                  <strong>Hinweis:</strong> Die App entwirft einen maßgeschneiderten Text auf Basis der Historie.
                  Es wird noch keine E-Mail versendet. Du kannst den Text vor dem Versand bearbeiten.
                </p>
              </div>

              <button onClick={handleGenerate} className="w-full py-3 bg-navy-900 hover:bg-navy-800 text-white font-bold rounded-xl flex items-center justify-center gap-2">
                <Sparkles size={18} /> Entwurf generieren
              </button>
            </div>
          )}

          {step === "review" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">Betreff</label>
                <input 
                  type="text" 
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full border-2 border-neutral-gray-200 rounded-xl px-4 py-2 text-sm font-bold text-navy-900 focus:border-navy-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">Nachrichtentext</label>
                <textarea 
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full border-2 border-neutral-gray-200 rounded-xl px-4 py-3 text-sm text-navy-900 focus:border-navy-500 focus:outline-none min-h-[200px]"
                />
              </div>

              <div className="bg-green-50 border border-green-200 p-4 rounded-2xl flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-bold text-green-900">Versand-Vorschlag</h4>
                  <p className="text-xs text-green-800">Dienstag, 10:15 Uhr (Optimal für B2B)</p>
                </div>
                <Calendar className="text-green-700" size={24} />
              </div>
            </div>
          )}

          {step === "scheduled" && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-20 h-20 bg-success-green/20 rounded-full flex items-center justify-center text-success-green">
                <CheckCircle2 size={40} />
              </div>
              <h3 className="text-2xl font-black text-navy-900">Entwurf geplant!</h3>
              <p className="text-text-muted">Die E-Mail wurde in den Postausgang gelegt und wird zum optimalen Zeitpunkt versendet.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === "review" && (
          <div className="px-6 py-4 border-t border-neutral-gray-100 flex justify-between items-center bg-gray-50">
            <button onClick={() => setStep("generate")} className="px-4 py-2 text-sm font-bold text-navy-700 hover:bg-neutral-gray-200 rounded-lg">
              Zurück
            </button>
            <div className="flex gap-2">
              <button onClick={() => {}} className="px-4 py-2 text-sm font-bold border-2 border-neutral-gray-200 text-navy-900 hover:bg-neutral-gray-100 rounded-xl">
                Nur speichern
              </button>
              <button onClick={handleSchedule} className="px-6 py-2 text-sm font-bold bg-navy-900 hover:bg-navy-800 text-white rounded-xl flex items-center gap-2">
                <Send size={16} /> Planen & Senden
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
