"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { AppShortcutOverlay } from "@/components/ui/AppShortcutOverlay";

export type ShortcutType = "new_order" | "new_customer" | "new_document" | "new_complaint" | null;

interface AppShortcutContextValue {
  openShortcut: (type: ShortcutType) => void;
  closeShortcut: () => void;
  activeShortcut: ShortcutType;
}

const AppShortcutContext = createContext<AppShortcutContextValue | null>(null);

export function useAppShortcut() {
  const ctx = useContext(AppShortcutContext);
  if (!ctx) throw new Error("useAppShortcut must be used within AppShortcutProvider");
  return ctx;
}

export function AppShortcutProvider({ children }: { children: React.ReactNode }) {
  const [activeShortcut, setActiveShortcut] = useState<ShortcutType>(null);

  const openShortcut = useCallback((type: ShortcutType) => {
    setActiveShortcut(type);
  }, []);

  const closeShortcut = useCallback(() => {
    setActiveShortcut(null);
  }, []);

  return (
    <AppShortcutContext.Provider value={{ openShortcut, closeShortcut, activeShortcut }}>
      {children}
      {activeShortcut && <AppShortcutOverlay type={activeShortcut} onClose={closeShortcut} />}
    </AppShortcutContext.Provider>
  );
}
