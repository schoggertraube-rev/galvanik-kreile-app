"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Lock, Delete } from "lucide-react";

interface PinDialogProps {
  initials: string;
  onClose: () => void;
}

export function PinDialog({ initials, onClose }: PinDialogProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const router = useRouter();

  const handleInput = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      setError(false);
      
      if (newPin.length === 4) {
        // Demologik: PIN 1234 ist korrekt
        if (newPin === "1234") {
          router.push("/");
        } else {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-kreile-navy/30 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-sm rounded-[32px] shadow-kreile-soft border border-kreile-border overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 flex items-center justify-between border-b border-kreile-border bg-kreile-surface-soft">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-kreile-bg rounded-xl flex items-center justify-center font-black text-kreile-navy">
              {initials}
            </div>
            <div>
              <h3 className="font-bold text-kreile-navy">Entsperren</h3>
              <p className="text-[10px] text-kreile-muted uppercase font-semibold tracking-wider">PIN eingeben</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-kreile-border/50 text-kreile-navy hover:bg-kreile-border transition-colors"
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
                pin.length > i ? "bg-kreile-navy scale-110" : "bg-kreile-border scale-100"
              } ${error ? "bg-status-red" : ""}`}
            />
          ))}
        </div>
        
        {error && (
          <p className="text-center text-status-red text-xs font-bold mb-2 animate-pulse">PIN inkorrekt (Versuche 1234)</p>
        )}
        {!error && (
          <p className="text-center text-kreile-muted text-xs mb-2 opacity-0 select-none">Platzhalter</p>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2 p-6 pt-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleInput(num.toString())}
              className="h-16 rounded-2xl bg-kreile-bg hover:bg-kreile-surface-warm border border-transparent hover:border-kreile-border-strong text-2xl font-black text-kreile-navy transition-all active:scale-95"
            >
              {num}
            </button>
          ))}
          <div className="col-start-2">
            <button
              onClick={() => handleInput("0")}
              className="w-full h-16 rounded-2xl bg-kreile-bg hover:bg-kreile-surface-warm border border-transparent hover:border-kreile-border-strong text-2xl font-black text-kreile-navy transition-all active:scale-95"
            >
              0
            </button>
          </div>
          <button
            onClick={handleDelete}
            disabled={pin.length === 0}
            className="h-16 flex items-center justify-center rounded-2xl text-kreile-muted hover:text-kreile-navy hover:bg-kreile-bg transition-colors active:scale-95 disabled:opacity-30"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>
        
      </div>
    </div>
  );
}
