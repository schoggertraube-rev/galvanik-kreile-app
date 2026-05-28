"use client";

import { usePathname } from "next/navigation";
import { KreileHeader } from "./KreileHeader";
import { RightNav } from "./RightNav";
import { PwaRegister } from "./PwaRegister";

export function KreileAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

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

      {/* Header — fixe Höhe 72px */}
      <KreileHeader />

      {/* Body: Hauptinhalt */}
      <div className="flex flex-1 min-h-0">   {/* min-h-0 verhindert Flex-Overflow */}

        {/* Linke Navigation (zuvor rechts) */}
        <div className="hidden md:flex shrink-0">
          <RightNav />
        </div>

        {/* Scroll-Container für Seiteninhalt */}
        <main
          className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8"
        >
          {/* Max-Width Container — auf großen Screens zentriert */}
          <div className="max-w-[1400px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
