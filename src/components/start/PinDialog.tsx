"use client";

import { useState } from "react";
import { X, Delete } from "lucide-react";

interface PinDialogProps {
  initials: string;
  onClose: () => void;
  onSubmit: (pin: string) => Promise<boolean>;
}

export function PinDialog({ initials, onClose, onSubmit }: PinDialogProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  const handleInput = async (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      setError(false);
      
      if (newPin.length === 4) {
        const accepted = await onSubmit(newPin);
        if (!accepted) {
          setError(true);
          setTimeout(() => setPin(""), 600);
        }
      }
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
    setError(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/30 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-sm rounded-[32px] shadow-kreile-soft border border-neutral-gray-100 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 flex items-center justify-between border-b border-neutral-gray-100 bg-bg-app-soft">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-bg-app rounded-xl flex items-center justify-center font-black text-navy-900">
              {initials}
            </div>
            <div>
              <h3 className="font-bold text-navy-900">Entsperren</h3>
              <p className="text-[10px] text-text-muted uppercase font-semibold tracking-wider">PIN eingeben</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-gray-100/50 text-navy-900 hover:bg-neutral-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* PIN Indicators */}
        <div className="p-8 pb-4 flex justify-center gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div 
              key={i} 
              className={`w-4 h-4 rounded-full transition-all duration-200 ${
                pin.length > i ? "bg-navy-900 scale-110" : "bg-neutral-gray-100 scale-100"
              } ${error ? "bg-danger-red" : ""}`}
            />
          ))}
        </div>
        
        {error && (
          <p className="text-center text-danger-red text-xs font-bold mb-2 animate-pulse">PIN inkorrekt</p>
        )}
        {!error && (
          <p className="text-center text-text-muted text-xs mb-2 opacity-0 select-none">Platzhalter</p>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2 p-6 pt-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => void handleInput(num.toString())}
              className="h-16 rounded-2xl bg-bg-app hover:bg-bg-app-soft border border-transparent hover:border-neutral-gray-300 text-2xl font-black text-navy-900 transition-all active:scale-95"
            >
              {num}
            </button>
          ))}
          <div className="col-start-2">
            <button
              onClick={() => void handleInput("0")}
              className="w-full h-16 rounded-2xl bg-bg-app hover:bg-bg-app-soft border border-transparent hover:border-neutral-gray-300 text-2xl font-black text-navy-900 transition-all active:scale-95"
            >
              0
            </button>
          </div>
          <button
            onClick={handleDelete}
            disabled={pin.length === 0}
            className="h-16 flex items-center justify-center rounded-2xl text-text-muted hover:text-navy-900 hover:bg-bg-app transition-colors active:scale-95 disabled:opacity-30"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>
        
      </div>
    </div>
  );
}
