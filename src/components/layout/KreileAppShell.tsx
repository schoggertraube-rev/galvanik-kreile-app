"use client";

import { usePathname } from "next/navigation";
import { KreileHeader } from "./KreileHeader";
import { RightNav } from "./RightNav";
import { MobileBottomNav } from "./MobileBottomNav";
import { TabletTopFlowNav } from "./TabletTopFlowNav";
import { PwaRegister } from "./PwaRegister";
import { useEffect, useState } from "react";
import { getSystemStats } from "@/app/actions/systemStats";
import { AlertTriangle } from "lucide-react";

export function KreileAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    getSystemStats().then(stats => {
      if (!stats.reachable || stats.provider !== 'supabase') {
        setIsDemoMode(true);
      }
    }).catch(() => setIsDemoMode(true));
  }, []);

  // Start/Login-Screen: kein Header, keine Nav
  const isStartScreen = pathname === "/start" || pathname === "/login";

  if (isStartScreen) {
    return (
      <div className="min-h-screen bg-bg-app text-kreile-text antialiased">
        <PwaRegister />
        {children}
      </div>
    );
  }

  return (
    <div
      className="flex flex-col bg-bg-app text-navy-900 antialiased"
      style={{ height: "100dvh" }}          // dvh für korrekte mobile Viewport-Höhe
    >
      <PwaRegister />

      {/* Demo/Offline Banner */}
      {isDemoMode && (
        <div className="bg-accent-orange text-white px-4 py-1.5 text-xs font-bold flex items-center justify-center gap-2 z-50">
          <AlertTriangle className="w-4 h-4" />
          ⚠️ Demo-/Offline-Modus aktiv: Supabase nicht erreichbar oder deaktiviert. Änderungen werden ggf. nicht dauerhaft gespeichert.
        </div>
      )}

      {/* Header — fixe Höhe 72px */}
      <KreileHeader />

      {/* Tablet Landscape Top Nav (nur sichtbar zwischen md und xl) */}
      <TabletTopFlowNav className="hidden md:flex xl:hidden shrink-0" />

      {/* Body: Hauptinhalt */}
      <div className="flex flex-1 min-h-0">   {/* min-h-0 verhindert Flex-Overflow */}

        {/* Linke Navigation (Desktop Sidebar, sichtbar ab xl) */}
        <div className="hidden xl:flex shrink-0">
          <RightNav />
        </div>

        {/* Scroll-Container für Seiteninhalt */}
        <main
          className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8"
        >
          {/* Max-Width Container — auf großen Screens zentriert */}
          <div className="max-w-[1400px] mx-auto w-full pb-24 md:pb-0">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Nav (nur auf Handys sichtbar) */}
      <MobileBottomNav className="flex md:hidden z-40" />
    </div>
  );
}
