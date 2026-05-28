"use client";

import Link from "next/link";
import Image from "next/image";
import { Search, Camera, Bell, Calendar } from "lucide-react";
import { GlobalSearch } from "./GlobalSearch";
import { useState, useEffect, useRef } from "react";
import { OfflineManager } from "@/lib/offline/OfflineManager";
import { ordersRepository } from "@/lib/repositories/ordersRepository";
import { logout } from "@/app/actions/auth";
import { trackUiEvent } from "@/lib/tracking/tracking";

export function KreileHeader() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [syncQueueCount, setSyncQueueCount] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  
  // User Dropdown State
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [userInitials, setUserInitials] = useState<string>("?");
  const userDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load initials from local storage on mount
    const initials = localStorage.getItem("kreile_user_initials");
    if (initials) setUserInitials(initials);
  }, []);

  // Click outside to close user dropdown
  useEffect(() => {
    if (!userDropdownOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [userDropdownOpen]);

  const handleLogout = async () => {
    localStorage.removeItem("kreile_user_role");
    localStorage.removeItem("kreile_user_initials");
    document.cookie = "bypass-auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    setUserDropdownOpen(false);
    await logout(); // Calls server action to destroy supabase session
  };

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
    <header className="h-[72px] shrink-0 bg-bg-app flex items-center px-4 md:px-6 gap-4 z-40 relative">

      {/* LEFT: GK Monogram + Brand */}
      <Link href="/" className="flex items-center gap-3 shrink-0 group">
        <Image
          src="/logo.png"
          alt="Kreile Galvanik"
          width={180}
          height={40}
          className="h-10 w-auto object-contain"
          priority
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
          <Link
            href="/scan"
            onClick={(e) => {
              e.stopPropagation();
              trackUiEvent("nav_click", { target: "/scan", source: "quick_action" });
            }}
            className="p-2 hover:bg-neutral-gray-100 rounded-full transition-colors z-10"
            title="Schnellannahme (Scan)"
          >
            <Camera className="w-5 h-5 text-navy-500 shrink-0 group-hover:text-accent-orange transition-colors" strokeWidth={1.5} />
          </Link>
        </button>
      </div>

      {/* RIGHT: Aktionen */}
      <div className="flex items-center gap-2 md:gap-3 ml-auto shrink-0">

        {/* Mobile Suche */}
        <button
          onClick={() => setSearchOpen(true)}
          className="md:hidden w-9 h-9 rounded-full bg-white border border-neutral-gray-100 flex items-center justify-center text-navy-900"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Datum-Pill */}
        <div className="hidden lg:flex items-center gap-2 bg-white border border-neutral-gray-100 rounded-full px-3 h-9 text-sm font-semibold text-navy-900 shadow-sm">
          <Calendar className="w-4 h-4 text-text-muted" />
          <span>Heute · {dateString}</span>
          <span className="w-2 h-2 rounded-full bg-accent-orange animate-pulse" />
        </div>

        {/* Online/Offline Pill mit Zähler */}
        <button
          onClick={() => OfflineManager.toggleSimulatedOffline()}
          className={`hidden sm:flex items-center gap-2 rounded-full px-3 h-9 text-sm font-bold border transition-colors shadow-sm ${
            isOffline
              ? "bg-bg-app-soft border-neutral-gray-100 text-text-muted"
              : "bg-white border-neutral-gray-100 text-navy-900"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isOffline ? "bg-accent-orange" : "bg-success-green"}`} />
          <span>{isOffline ? "Offline" : "Online"}</span>
          {orderCount > 0 && (
            <span className="bg-gold-1000 text-white text-[10px] font-black rounded-full px-1.5 py-px min-w-[20px] text-center">
              {orderCount > 99 ? "99+" : orderCount}
            </span>
          )}
        </button>

        {/* Glocke mit rotem Badge */}
        <div className="relative">
          <button className="w-9 h-9 rounded-full bg-white border border-neutral-gray-100 flex items-center justify-center text-navy-900 hover:border-neutral-gray-300 transition-colors shadow-sm">
            <Bell className="w-4 h-4" />
          </button>
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-danger-red rounded-full text-[9px] text-white font-black flex items-center justify-center">
            3
          </span>
        </div>

        {/* Profilbild rund (Kreis 48px) */}
        <div className="relative" ref={userDropdownRef}>
          <button 
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="w-12 h-12 rounded-full bg-navy-700 hover:bg-navy-900 transition-colors text-white flex items-center justify-center text-sm font-black shrink-0 shadow-sm cursor-pointer"
          >
            {userInitials}
          </button>
          
          {userDropdownOpen && (
            <div className="absolute right-0 top-14 mt-2 w-48 bg-white border-2 border-neutral-gray-100 rounded-2xl shadow-xl z-50 p-2 animate-in slide-in-from-top-2 fade-in duration-200">
              <div className="px-3 py-2 border-b border-neutral-gray-100 mb-1">
                <p className="text-xs font-bold text-navy-900">Angemeldet als</p>
                <p className="text-[10px] text-text-muted">{userInitials}</p>
              </div>
              <Link
                href="/settings"
                onClick={() => setUserDropdownOpen(false)}
                className="block w-full text-left px-3 py-2 text-sm font-bold text-navy-900 hover:bg-neutral-gray-100 rounded-xl transition-colors cursor-pointer mb-1"
              >
                Einstellungen
              </Link>
              <button
                onClick={handleLogout}
                className="w-full text-left px-3 py-2 text-sm font-bold text-danger-red hover:bg-danger-red/10 rounded-xl transition-colors cursor-pointer"
              >
                Abmelden
              </button>
            </div>
          )}
        </div>

      </div>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
