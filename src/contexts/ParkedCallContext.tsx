"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

interface ParkedCallData {
  id: string;
  parkedAt: number;
}

interface ParkedCallContextType {
  activeParkedCall: ParkedCallData | null;
  parkCall: (data: ParkedCallData) => void;
  resumeCall: () => void;
  dismissParkedHint: () => void;
}

const STORAGE_KEY = "kreile_parked_call_session_v2";
const ParkedCallContext = createContext<ParkedCallContextType | undefined>(undefined);

function storedCall(): ParkedCallData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const entry = value as Record<string, unknown>;
    if (typeof entry.id !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(entry.id) || typeof entry.parkedAt !== "number") return null;
    return { id: entry.id, parkedAt: entry.parkedAt };
  } catch {
    return null;
  }
}

export function ParkedCallProvider({ children }: { children: ReactNode }) {
  const [activeParkedCall, setActiveParkedCall] = useState<ParkedCallData | null>(storedCall);
  const router = useRouter();

  const parkCall = useCallback((data: ParkedCallData) => {
    setActiveParkedCall(data);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("Geparkter Telefonnotiz-Hinweis konnte nicht in dieser Sitzung gespeichert werden", error);
    }
  }, []);

  const dismissParkedHint = useCallback(() => {
    setActiveParkedCall(null);
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Geparkter Telefonnotiz-Hinweis konnte nicht entfernt werden", error);
    }
  }, []);

  const resumeCall = useCallback(() => {
    if (!activeParkedCall) return;
    router.push(`/telefonnotiz?source=kommunikation&resumeId=${encodeURIComponent(activeParkedCall.id)}&returnTo=%2Fkommunikation`);
  }, [activeParkedCall, router]);

  return (
    <ParkedCallContext.Provider value={{ activeParkedCall, parkCall, resumeCall, dismissParkedHint }}>
      {children}
    </ParkedCallContext.Provider>
  );
}

export function useParkedCall() {
  const context = useContext(ParkedCallContext);
  if (!context) throw new Error("useParkedCall must be used within a ParkedCallProvider");
  return context;
}
