"use client";

import { usePathname } from "next/navigation";
import { KreileHeader } from "./KreileHeader";
import { RightNav } from "./RightNav";
import { MobileNav } from "./MobileNav";
import { MobileBottomNav } from "./MobileBottomNav";
import { TabletTopFlowNav } from "./TabletTopFlowNav";
import { PwaRegister } from "./PwaRegister";
import { useEffect, useState } from "react";
import { getSystemStats } from "@/app/actions/systemStats";
import { AlertTriangle } from "lucide-react";
import { RealtimeSyncProvider } from "./RealtimeSyncManager";
import { ParkedCallProvider } from "@/contexts/ParkedCallContext";
import { FloatingParkedCall } from "@/components/telefonnotiz/FloatingParkedCall";
import { OrderOverlay } from "@/components/orders/OrderOverlay";
import { CustomerOverlay } from "@/components/customers/CustomerOverlay";

export function KreileAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      getSystemStats().then(stats => {
        if (!stats.reachable || stats.provider !== 'supabase') {
          setIsDemoMode(true);
        }
      }).catch(() => setIsDemoMode(true));
    } else {
      setIsDemoMode(false);
    }
  }, []);

  const isStartScreen = pathname === "/start" || pathname === "/login";

  if (isStartScreen) {
    return (
      <ParkedCallProvider>
        <RealtimeSyncProvider>
          <div className="min-h-screen bg-bg-app text-kreile-text antialiased">
            <PwaRegister />
            {children}
            <FloatingParkedCall />
            <OrderOverlay />
            <CustomerOverlay />
          </div>
        </RealtimeSyncProvider>
      </ParkedCallProvider>
    );
  }

  return (
    <ParkedCallProvider>
      <RealtimeSyncProvider>
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
          <KreileHeader onMenuToggle={() => setMobileNavOpen(true)} />

          {/* Tablet Landscape Top Nav is removed per F-MENU-ANIM (Hamburger on tablet) */}
          {/* <TabletTopFlowNav className="hidden md:flex xl:hidden shrink-0" /> */}

          {/* Body: Hauptinhalt */}
          <div className="flex flex-1 min-h-0">   {/* min-h-0 verhindert Flex-Overflow */}

            {/* Linke Navigation (Desktop Sidebar, sichtbar ab lg) */}
            <div className="hidden lg:flex shrink-0">
              {/* Desktop (≥1024px): RightNav permanent sichtbar */}
              <RightNav />
            </div>

            <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

            {/* Scroll-Container für Seiteninhalt */}
            <main
              className={`flex-1 relative flex flex-col ${
                pathname.startsWith('/warendurchlauf') ? "bg-[#fcfbf9] lg:rounded-tl-[40px] border-l border-t border-[#d8d0c4] shadow-[-4px_-4px_16px_rgba(0,0,0,0.02)]" :
                pathname.startsWith('/kommunikation') ? "bg-transparent overflow-hidden overflow-x-hidden" : 
                "bg-transparent lg:rounded-tl-[40px] border-l border-t border-[#d8d0c4] shadow-[-4px_-4px_16px_rgba(0,0,0,0.02)] overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8"
              }`}
            >
              {/* Max-Width Container — auf großen Screens zentriert */}
              <div className="w-full h-full pb-24 md:pb-0 flex flex-col min-h-0">
                {children}
              </div>
            </main>
          </div>

          {/* Mobile Bottom Nav (nur auf Handys sichtbar) */}
          <MobileBottomNav className="flex md:hidden z-40" />

          {/* Global Floating Parked Call Button & Prompt */}
          <FloatingParkedCall />
          
          {/* Global Order Overlay Drawer */}
          <OrderOverlay />
          
          {/* Global Customer Overlay */}
          <CustomerOverlay />
        </div>
      </RealtimeSyncProvider>
    </ParkedCallProvider>
  );
}
