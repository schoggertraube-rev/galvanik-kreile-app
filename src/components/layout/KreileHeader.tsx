"use client";

import Link from "next/link";
import { Search, Camera, Bell, Calendar } from "lucide-react";
import { GlobalSearch } from "./GlobalSearch";
import { useState, useEffect } from "react";
import { OfflineManager } from "@/lib/offline/OfflineManager";
import { ordersRepository } from "@/lib/repositories/ordersRepository";

export function KreileHeader() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [syncQueueCount, setSyncQueueCount] = useState(0);
  const [orderCount, setOrderCount] = useState(0);

  const today = new Date();
  const dateString = today.toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });

  useEffect(() => {
    const updateState = async () => {
      setIsOffline(OfflineManager.isOffline());
      const count = await OfflineManager.getPendingCount();
      setSyncQueueCount(count);
      const orders = await ordersRepository.getAll();
      setOrderCount(orders?.length ?? 0);
    };
    updateState();

    const events = ["storage", "kreile-network-change", "kreile-sync-queue-updated", "online", "offline"];
    events.forEach(e => window.addEventListener(e, updateState));
    return () => events.forEach(e => window.removeEventListener(e, updateState));
  }, []);

  return (
    <header className="h-[72px] shrink-0 bg-white border-b border-kreile-border flex items-center px-4 md:px-6 gap-4 z-40 relative">

      {/* LEFT: GK Monogram + Brand */}
      <Link href="/" className="flex items-center gap-3 shrink-0 group">
        <img
          src="/assets/logo/kreile-logo-compact.svg"
          alt="GK Galvanik Kreile Logo"
          className="h-14 w-auto object-contain"
        />
      </Link>

      {/* CENTER: Suchleiste mit Skyline */}
      <div className="flex-1 max-w-2xl mx-auto hidden md:block relative">
        <button
          onClick={() => setSearchOpen(true)}
          className="w-full relative flex items-center bg-white border border-neutral-gray-100 rounded-2xl h-14 px-5 gap-3 hover:border-neutral-gray-300 transition-colors group shadow-sm"
        >
          <Search className="w-5 h-5 text-navy-500 shrink-0" strokeWidth={1.5} />
          <span className="text-sm text-text-muted flex-1 text-left">
            Bei Auftrag, Kunde, Teilenummer suchen...
          </span>
          {/* Skyline decorative SVG in der Mitte */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-0 h-10 w-48 overflow-hidden opacity-12 pointer-events-none">
            <svg viewBox="0 0 160 30" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <polyline points="0,30 0,20 10,20 10,12 15,12 15,18 20,18 20,8 25,8 25,18 30,18 30,14 35,14 35,6 40,6 40,14 45,14 45,20 50,20 50,10 55,10 55,20 60,20 60,4 65,4 65,20 70,20 70,16 75,16 75,20 80,20 80,12 85,12 85,20 90,20 90,16 95,16 95,20 100,20 100,8 105,8 105,20 110,20 110,14 115,14 115,20 120,20 120,10 125,10 125,20 130,20 130,16 135,16 135,20 140,20 140,18 145,18 145,22 150,22 150,18 155,18 155,24 160,24 160,30" stroke="#B8923F" strokeWidth="1.5" fill="none"/>
            </svg>
          </div>
          <Camera className="w-5 h-5 text-navy-500 shrink-0 group-hover:text-accent-orange transition-colors" strokeWidth={1.5} />
        </button>
      </div>

      {/* RIGHT: Aktionen */}
      <div className="flex items-center gap-2 md:gap-3 ml-auto shrink-0">

        {/* Mobile Suche */}
        <button
          onClick={() => setSearchOpen(true)}
          className="md:hidden w-9 h-9 rounded-full bg-kreile-bg border border-kreile-border flex items-center justify-center text-kreile-navy"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Datum-Pill */}
        <div className="hidden lg:flex items-center gap-2 bg-kreile-bg border border-kreile-border rounded-full px-3 h-9 text-sm font-semibold text-kreile-navy">
          <Calendar className="w-4 h-4 text-kreile-muted" />
          <span>Heute · {dateString}</span>
          <span className="w-2 h-2 rounded-full bg-status-orange" />
        </div>

        {/* Online/Offline Pill mit Zähler */}
        <button
          onClick={() => OfflineManager.toggleSimulatedOffline()}
          className={`hidden sm:flex items-center gap-2 rounded-full px-3 h-9 text-sm font-bold border transition-colors ${
            isOffline
              ? "bg-kreile-bg border-kreile-border text-kreile-muted"
              : "bg-kreile-bg border-kreile-border text-kreile-navy"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isOffline ? "bg-status-orange" : "bg-status-green"}`} />
          <span>{isOffline ? "Offline" : "Online"}</span>
          {orderCount > 0 && (
            <span className="bg-kreile-navy text-white text-[10px] font-black rounded-full px-1.5 py-px min-w-[20px] text-center">
              {orderCount > 99 ? "99+" : orderCount}
            </span>
          )}
        </button>

        {/* Glocke mit rotem Badge */}
        <div className="relative">
          <button className="w-9 h-9 rounded-full bg-kreile-bg border border-kreile-border flex items-center justify-center text-kreile-navy hover:border-kreile-border-strong transition-colors">
            <Bell className="w-4 h-4" />
          </button>
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-status-red rounded-full text-[9px] text-white font-black flex items-center justify-center">
            3
          </span>
        </div>

        {/* Profilbild rund */}
        <button className="w-9 h-9 rounded-full bg-kreile-navy text-white flex items-center justify-center text-xs font-black shrink-0">
          MK
        </button>

      </div>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
