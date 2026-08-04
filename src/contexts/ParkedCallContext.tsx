"use client";
import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useSyncExternalStore } from "react";
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
const PARKED_CALL_STORAGE_KEY = "kreile_parked_call";
const PARKED_CALL_STORAGE_EVENT = "kreile-parked-call-change";

let cachedParkedCallRaw: string | null | undefined;
let cachedParkedCall: ParkedCallData | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isParkedCallData(value: unknown): value is ParkedCallData {
  if (!isRecord(value)) return false;

  const { id, rawText, matchedCustomerName, matchedOrderNumber, parkedAt } = value;
  return typeof id === "string"
    && typeof rawText === "string"
    && typeof parkedAt === "number"
    && (matchedCustomerName === undefined || typeof matchedCustomerName === "string")
    && (matchedOrderNumber === undefined || typeof matchedOrderNumber === "string");
}

function getParkedCallSnapshot(): ParkedCallData | null {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(PARKED_CALL_STORAGE_KEY);
  if (raw === cachedParkedCallRaw) return cachedParkedCall;

  cachedParkedCallRaw = raw;
  if (!raw) {
    cachedParkedCall = null;
    return cachedParkedCall;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    cachedParkedCall = isParkedCallData(parsed) ? parsed : null;
  } catch {
    cachedParkedCall = null;
  }

  return cachedParkedCall;
}

function subscribeToParkedCall(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key === PARKED_CALL_STORAGE_KEY) onStoreChange();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(PARKED_CALL_STORAGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(PARKED_CALL_STORAGE_EVENT, onStoreChange);
  };
}

function saveParkedCall(data: ParkedCallData): void {
  if (typeof window === "undefined") return;

  const raw = JSON.stringify(data);
  cachedParkedCallRaw = raw;
  cachedParkedCall = data;
  localStorage.setItem(PARKED_CALL_STORAGE_KEY, raw);
  window.dispatchEvent(new Event(PARKED_CALL_STORAGE_EVENT));
}

function clearParkedCall(): void {
  if (typeof window === "undefined") return;

  cachedParkedCallRaw = null;
  cachedParkedCall = null;
  localStorage.removeItem(PARKED_CALL_STORAGE_KEY);
  window.dispatchEvent(new Event(PARKED_CALL_STORAGE_EVENT));
}

export function ParkedCallProvider({ children }: { children: React.ReactNode }) {
  const activeParkedCall = useSyncExternalStore(subscribeToParkedCall, getParkedCallSnapshot, () => null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const INACTIVITY_LIMIT = 5000; // 5 seconds

  const parkCall = useCallback((data: ParkedCallData) => {
    saveParkedCall(data);
  }, []);

  const finishCall = useCallback(() => {
    setShowResumePrompt(false);
    clearParkedCall();
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
