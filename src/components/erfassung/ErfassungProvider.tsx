"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { ErfassungModal } from "./ErfassungModal";

export type ErfassungMode = "gate" | "customer" | "order" | "quote" | "scan" | "phone" | "inquiry";

export interface ErfassungPrefill {
  customer?: any;
  items?: any[];
  order?: any;
  behaviorNote?: any;
  [key: string]: any;
}

export interface OpenErfassungOptions {
  mode: ErfassungMode;
  intent?: "create_customer" | "create_order" | "create_quote";
  customerId?: string | null;
  source?: "manual" | "phone" | "inquiry" | "scan" | "search" | "customer" | "order" | "shortcut";
  sourceRef?: string | null;
  prefill?: ErfassungPrefill;
  returnTo?: string;
}

interface ErfassungContextType {
  isOpen: boolean;
  options: OpenErfassungOptions | null;
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
  openErfassung: (options: OpenErfassungOptions | ErfassungMode, legacyData?: any) => void;
  closeErfassung: () => void;
}

const ErfassungContext = createContext<ErfassungContextType | null>(null);

export function ErfassungProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<OpenErfassungOptions | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const openErfassung = (newOptions: OpenErfassungOptions | ErfassungMode, legacyData?: any) => {
    if (typeof newOptions === 'string') {
      // Legacy support
      const mode = (newOptions as string) === 'manual' ? 'gate' : newOptions; // Map manual to gate initially or order
      setOptions({
        mode: mode as ErfassungMode,
        prefill: legacyData
      });
    } else {
      setOptions(newOptions);
    }
    setIsOpen(true);
    setIsDirty(false);
  };

  const closeErfassung = () => {
    setIsOpen(false);
    setTimeout(() => {
      setOptions(null);
    }, 300); // Wait for transition
  };

  return (
    <ErfassungContext.Provider value={{ isOpen, options, isDirty, setIsDirty, openErfassung, closeErfassung }}>
      {children}
      {isOpen && options && (
        <ErfassungModal />
      )}
    </ErfassungContext.Provider>
  );
}

export function useErfassung() {
  const ctx = useContext(ErfassungContext);
  if (!ctx) throw new Error("useErfassung must be used within ErfassungProvider");
  return ctx;
}
