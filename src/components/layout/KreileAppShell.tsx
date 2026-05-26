"use client";

import { usePathname } from "next/navigation";
import { KreileHeader } from "./KreileHeader";
import { KreileSidebar } from "./KreileSidebar";
import { KreileBottomNav } from "./KreileBottomNav";
import { PwaRegister } from "./PwaRegister";

export function KreileAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Start/Login-Screen: kein Header, keine Nav
  const isStartScreen = pathname === "/start";

  if (isStartScreen) {
    return (
      <div className="min-h-screen bg-kreile-bg text-kreile-text antialiased">
        <PwaRegister />
        {children}
      </div>
    );
  }

  return (
    <div
      className="flex flex-col bg-kreile-bg text-kreile-text antialiased"
      style={{ height: "100dvh" }}          // dvh für korrekte mobile Viewport-Höhe
    >
      <PwaRegister />

      {/* Header — fixe Höhe 72px */}
      <KreileHeader />

      {/* Body: Hauptinhalt */}
      <div className="flex flex-1 min-h-0">   {/* min-h-0 verhindert Flex-Overflow */}

        {/* Scroll-Container für Seiteninhalt */}
        <main
          className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-28 md:p-6 md:pb-32 lg:p-8 lg:pb-32"
        >
          {/* Max-Width Container — auf großen Screens zentriert */}
          <div className="max-w-[1400px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>

      {/* Bottom Navigation (auf allen Screens sichtbar gem. Spezifikation) */}
      <KreileBottomNav />
    </div>
  );
}
