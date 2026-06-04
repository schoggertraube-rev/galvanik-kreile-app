"use client";
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

interface ParkedCallData {
  id: string; // The DB id of the phone note
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

export function ParkedCallProvider({ children }: { children: React.ReactNode }) {
  const [activeParkedCall, setActiveParkedCall] = useState<ParkedCallData | null>(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const INACTIVITY_LIMIT = 5000; // 5 seconds

  // Initialize from localStorage if exists
  useEffect(() => {
    try {
      const stored = localStorage.getItem("kreile_parked_call");
      if (stored) {
        setActiveParkedCall(JSON.parse(stored));
      }
    } catch (e) {}
  }, []);

  const parkCall = useCallback((data: ParkedCallData) => {
    setActiveParkedCall(data);
    localStorage.setItem("kreile_parked_call", JSON.stringify(data));
  }, []);

  const finishCall = useCallback(() => {
    setActiveParkedCall(null);
    setShowResumePrompt(false);
    localStorage.removeItem("kreile_parked_call");
  }, []);

  const resumeCall = useCallback(() => {
    setShowResumePrompt(false);
    if (activeParkedCall) {
      // We navigate to /telefonnotiz and pass the ID so it can load the draft
      router.push(`/telefonnotiz?resumeId=${activeParkedCall.id}`);
    }
  }, [activeParkedCall, router]);

  // Inactivity Logic
  const resetTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    // Only start timer if there is an active call AND we are NOT on the telefonnotiz page
    if (activeParkedCall && pathname !== "/telefonnotiz" && !showResumePrompt) {
      inactivityTimerRef.current = setTimeout(() => {
        setShowResumePrompt(true);
      }, INACTIVITY_LIMIT);
    }
  }, [activeParkedCall, pathname, showResumePrompt]);

  useEffect(() => {
    // Attach global event listeners
    const events = ["mousemove", "keydown", "touchstart", "click", "scroll"];
    
    events.forEach(e => window.addEventListener(e, resetTimer));
    
    // Initial start
    resetTimer();

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [resetTimer]);

  return (
    <ParkedCallContext.Provider value={{
      activeParkedCall,
      parkCall,
      resumeCall,
      finishCall,
      showResumePrompt,
      setShowResumePrompt
    }}>
      {children}
    </ParkedCallContext.Provider>
  );
}

export function useParkedCall() {
  const context = useContext(ParkedCallContext);
  if (context === undefined) {
    throw new Error("useParkedCall must be used within a ParkedCallProvider");
  }
  return context;
}
