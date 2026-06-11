"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { ErfassungModal } from "./ErfassungModal";

export type ErfassungFlow = "manual" | "scan" | "phone" | "inquiry";

interface ErfassungContextType {
  isOpen: boolean;
  flow: ErfassungFlow | null;
  contextData: any;
  openErfassung: (flow: ErfassungFlow, data?: any) => void;
  closeErfassung: () => void;
}

const ErfassungContext = createContext<ErfassungContextType | null>(null);

export function ErfassungProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [flow, setFlow] = useState<ErfassungFlow | null>(null);
  const [contextData, setContextData] = useState<any>(null);

  const openErfassung = (newFlow: ErfassungFlow, data?: any) => {
    setFlow(newFlow);
    setContextData(data || null);
    setIsOpen(true);
  };

  const closeErfassung = () => {
    setIsOpen(false);
    setTimeout(() => {
      setFlow(null);
      setContextData(null);
    }, 300); // Wait for transition
  };

  return (
    <ErfassungContext.Provider value={{ isOpen, flow, contextData, openErfassung, closeErfassung }}>
      {children}
      {isOpen && flow && (
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
