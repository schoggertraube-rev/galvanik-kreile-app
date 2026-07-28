"use client";

import { createContext, useCallback, useContext, useState } from "react";

interface ParkedCallData {
  id: string;
  rawText: string;
  matchedCustomerName?: string;
  matchedOrderNumber?: string;
  parkedAt: number;
}

interface ParkedCallContextType {
  activeParkedCall: ParkedCallData | null;
  parkCall: (data: ParkedCallData) => void;
  resumeCall: () => void;
  finishCall: () => void;
  showResumePrompt: boolean;
  setShowResumePrompt: (show: boolean) => void;
}

const ParkedCallContext = createContext<ParkedCallContextType | undefined>(undefined);

/**
 * A browser draft has neither an authenticated actor nor a tenant-bound
 * receipt. Keep the provider inert and do not read, write, or delete legacy
 * local storage until a durable server-side recovery contract exists.
 */
export function ParkedCallProvider({ children }: { children: React.ReactNode }) {
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const parkCall = useCallback((_data: ParkedCallData) => {
void _data;
    throw new Error("NOT_CONFIGURED: Telefonnotizen benötigen einen geprüften Mandanten- und Receipt-Vertrag.");
  }, []);
  const resumeCall = useCallback(() => undefined, []);
  const finishCall = useCallback(() => undefined, []);

  return (
    <ParkedCallContext.Provider value={{
      activeParkedCall: null,
      parkCall,
      resumeCall,
      finishCall,
      showResumePrompt,
      setShowResumePrompt,
    }}>
      {children}
    </ParkedCallContext.Provider>
  );
}

export function useParkedCall() {
  const context = useContext(ParkedCallContext);
  if (context === undefined) {
    throw new Error("useParkedCall must be used within ParkedCallProvider");
  }
  return context;
}
