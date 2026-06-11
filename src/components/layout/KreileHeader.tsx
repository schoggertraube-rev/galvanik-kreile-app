"use client";

import Link from "next/link";
// Image from next/image available but not used for dynamic logo URLs
import { Search, Camera, Bell, Calendar, Menu } from "lucide-react";
import { GlobalSearch } from "./GlobalSearch";
import { useState, useEffect, useRef } from "react";
import { OfflineManager } from "@/lib/offline/OfflineManager";
import { ordersRepository } from "@/lib/repositories/ordersRepository";
import { logout } from "@/app/actions/auth";
import { trackUiEvent } from "@/lib/tracking/tracking";
import { useRealtimeStatus } from "./RealtimeSyncManager";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { getCompanySettings } from "@/app/actions/company.actions";
import { useTestpilot } from "@/components/testpilot/TestpilotProvider";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import { useSync } from "@/lib/offline/SyncContext";
import { useErfassung } from "@/components/erfassung/ErfassungProvider";

interface KreileHeaderProps {
  onMenuToggle: () => void;
}

export function KreileHeader({ onMenuToggle }: KreileHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [orderCount, setOrderCount] = useState(0);
  const [logoUrl, setLogoUrl] = useState("/assets/logo/kreile-wordmark-skyline.svg");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const { initials } = usePermissions();
  const { status: realtimeStatus } = useRealtimeStatus();
  const { isRecording } = useTestpilot();
  const { isOnline, outboxItems, syncNow } = useSync();
  const { openErfassung } = useErfassung();

  // User Dropdown State
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [storedInitials, setStoredInitials] = useState<string>("?");

  useEffect(() => {
    // Defer the local storage read to avoid hydration mismatch and synchronous setState warnings
    const timer = setTimeout(() => {
      setStoredInitials(localStorage.getItem("kreile_user_initials") ?? "?");
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const userInitials = initials && initials !== "?" ? initials : storedInitials;
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close user dropdown
  useEffect(() => {
    if (!userDropdownOpen && !notificationsOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (userDropdownOpen && userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
      if (notificationsOpen && notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [userDropdownOpen, notificationsOpen]);

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
      const orders = await ordersRepository.getAll();
      setOrderCount(orders?.length ?? 0);
      try {
        const settings = await getCompanySettings();
        if (settings.logoUrl) setLogoUrl(settings.logoUrl);
      } catch (e) {
        console.error("Failed to load settings in header", e);
      }
    };
    updateState();

    const events = ["kreile-network-change", "kreile-sync-queue-updated", "online", "offline"];
    events.forEach(e => window.addEventListener(e, updateState));
    return () => events.forEach(e => window.removeEventListener(e, updateState));
  }, []);

  return (
    <header className="h-[72px] shrink-0 bg-transparent flex items-center px-4 md:px-6 gap-4 z-[100] relative">
      {/* Hamburger Menu Mobile & Tablet (< 1024px) */}
      <button
        className="flex lg:hidden p-3 -ml-2 text-navy-900 hover:bg-neutral-gray-100 rounded-full min-w-[48px] min-h-[48px] items-center justify-center shrink-0"
        onClick={onMenuToggle}
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* LEFT: GK Monogram + Brand */}
      <Link href="/" className="hidden md:flex items-center gap-3 shrink-0 group">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt="Firmenlogo"
          className="h-10 w-auto object-contain max-w-[200px]"
        />
      </Link>

      {/* Mobile Logo Only */}
      <Link href="/" className="md:hidden flex items-center shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt="Firmenlogo"
          className="h-7 w-auto object-contain kreile-logo max-w-[140px]"
        />
      </Link>

      {/* CENTER: Suchleiste mit Skyline */}
      <div className="flex-1 max-w-2xl mx-auto hidden md:block relative">
        <div
          onClick={() => setSearchOpen(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') setSearchOpen(true); }}
          className="w-full relative flex items-center bg-white/50 backdrop-blur-md border border-white/60 rounded-2xl h-14 px-5 gap-3 hover:bg-white hover:border-neutral-gray-200 hover:shadow-md transition-all duration-300 group shadow-sm cursor-text"
        >
          <Search className="w-5 h-5 text-navy-500 shrink-0 pointer-events-none" strokeWidth={1.5} />
          <span className="text-sm text-text-muted flex-1 text-left pointer-events-none">
            Bei Auftrag, Kunde, Teilenummer suchen...
          </span>
          {/* Skyline decorative SVG in der Mitte */}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-0 h-10 w-48 overflow-hidden opacity-12 pointer-events-none">
            <svg viewBox="0 0 160 30" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <polyline points="0,30 0,20 10,20 10,12 15,12 15,18 20,18 20,8 25,8 25,18 30,18 30,14 35,14 35,6 40,6 40,14 45,14 45,20 50,20 50,10 55,10 55,20 60,20 60,4 65,4 65,20 70,20 70,16 75,16 75,20 80,20 80,12 85,12 85,20 90,20 90,16 95,16 95,20 100,20 100,8 105,8 105,20 110,20 110,14 115,14 115,20 120,20 120,10 125,10 125,20 130,20 130,16 135,16 135,20 140,20 140,18 145,18 145,22 150,22 150,18 155,18 155,24 160,24 160,30" stroke="#B8923F" strokeWidth="1.5" fill="none"/>
            </svg>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              openErfassung("scan");
            }}
            className="p-2 hover:bg-neutral-gray-100 rounded-full transition-colors z-10"
            title="Schnellannahme (Scan)"
          >
            <Camera className="w-5 h-5 text-navy-500 shrink-0 group-hover:text-accent-orange transition-colors" strokeWidth={1.5} />
          </button>
        </div>
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
        <Link href="/kalender" className="hidden lg:flex items-center gap-2 bg-white/50 backdrop-blur-sm border border-white/60 rounded-full px-3 h-9 text-sm font-semibold text-navy-900 shadow-sm hover:bg-white hover:border-neutral-gray-200 transition-all duration-300">
          <Calendar className="w-4 h-4 text-text-muted" />
          <span>Heute · {dateString}</span>
          <span className="w-2 h-2 rounded-full bg-accent-orange animate-pulse" />
        </Link>

        {/* Online/Offline Pill mit Zähler */}
        <button
          onClick={() => {
            if (isOnline) {
              syncNow();
            } else {
              OfflineManager.toggleSimulatedOffline();
            }
          }}
          className={`hidden sm:flex items-center gap-2 rounded-full px-3 h-9 text-sm font-bold border transition-all duration-300 shadow-sm hover:bg-white hover:border-neutral-gray-200 ${
            !isOnline || outboxItems.length > 0
              ? "bg-bg-app-soft/50 backdrop-blur-sm border-white/60 text-text-muted"
              : "bg-white/50 backdrop-blur-sm border-white/60 text-navy-900"
          }`}
          title={!isOnline ? "Offline Modus aktiv" : (outboxItems.length > 0 ? "Klicken zum Synchronisieren" : "Online und synchron")}
        >
          <span className={`w-2 h-2 rounded-full ${!isOnline ? "bg-accent-orange" : (outboxItems.length > 0 ? "bg-gold-500 animate-pulse" : "bg-success-green")}`} />
          <span>{!isOnline ? "Offline" : (outboxItems.length > 0 ? "Syncing..." : "Online")}</span>
          {outboxItems.length > 0 && (
            <span className="bg-accent-orange text-white text-[10px] font-black rounded-full px-1.5 py-px min-w-[20px] text-center">
              {outboxItems.length > 99 ? "99+" : outboxItems.length}
            </span>
          )}
        </button>

        {/* Testpilot Recording Indicator */}
        {isRecording && (
          <Link href="/admin/testanalyse/live" className="hidden sm:flex items-center gap-2 rounded-full px-3 h-9 text-sm font-bold bg-red-100 border border-red-200 text-red-700 hover:bg-red-200 transition-colors shadow-sm animate-pulse" title="Zur Live-Testanalyse">
            <span className="w-2 h-2 rounded-full bg-red-600" />
            <span>Testaufzeichnung</span>
          </Link>
        )}

        {/* Live-Sync Indicator */}
        {realtimeStatus !== "disabled" && (
          <div className="hidden lg:flex items-center gap-1.5 px-3 h-9 rounded-full bg-white/50 backdrop-blur-sm border border-white/60 shadow-sm text-xs font-bold text-navy-700 transition-all duration-300 hover:bg-white">
            {realtimeStatus === "active" ? (
              <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live</>
            ) : realtimeStatus === "connecting" ? (
              <><span className="w-1.5 h-1.5 rounded-full bg-accent-orange animate-pulse" /> Sync...</>
            ) : (
              <><span className="w-1.5 h-1.5 rounded-full bg-danger-red" /> Getrennt</>
            )}
          </div>
        )}

        {/* Glocke mit rotem Badge */}
        <div className="relative hidden md:block" ref={notificationsRef}>
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="w-9 h-9 rounded-full bg-white/50 backdrop-blur-sm border border-white/60 flex items-center justify-center text-navy-900 hover:bg-white hover:border-neutral-gray-200 transition-all duration-300 shadow-sm"
          >
            <Bell className="w-4 h-4" />
          </button>
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-danger-red rounded-full text-[9px] text-white font-black flex items-center justify-center">
            3
          </span>

          {notificationsOpen && (
            <div className="absolute right-0 top-12 mt-2 w-72 bg-white border-2 border-neutral-gray-100 rounded-2xl shadow-xl z-50 p-2 animate-in slide-in-from-top-2 fade-in duration-200">
              <div className="px-3 py-2 border-b border-neutral-gray-100 mb-1 flex justify-between items-center">
                <p className="text-xs font-bold text-navy-900">Benachrichtigungen</p>
                <span className="text-[10px] bg-bg-app px-2 py-0.5 rounded-full text-text-muted">3 Neu</span>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <div className="px-3 py-2 hover:bg-neutral-gray-100 rounded-xl transition-colors cursor-pointer mb-1 border-l-2 border-accent-orange">
                  <p className="text-[11px] font-bold text-navy-900">Materialengpass Galvanik</p>
                  <p className="text-[10px] text-text-muted mt-0.5">Nickel-Bad 3 benötigt zeitnah neues Material für anstehende Großaufträge.</p>
                  <p className="text-[9px] text-text-muted mt-1 opacity-60">Vor 12 Min</p>
                </div>
                <div className="px-3 py-2 hover:bg-neutral-gray-100 rounded-xl transition-colors cursor-pointer mb-1 border-l-2 border-success-green">
                  <p className="text-[11px] font-bold text-navy-900">5 Aufträge fertiggestellt</p>
                  <p className="text-[10px] text-text-muted mt-0.5">Die QS hat 5 Werkstücke freigegeben. Bereit für den Warenausgang.</p>
                  <p className="text-[9px] text-text-muted mt-1 opacity-60">Vor 45 Min</p>
                </div>
                <div className="px-3 py-2 hover:bg-neutral-gray-100 rounded-xl transition-colors cursor-pointer border-l-2 border-danger-red">
                  <p className="text-[11px] font-bold text-navy-900">Kundenanfrage verzögert</p>
                  <p className="text-[10px] text-text-muted mt-0.5">Auftrag A-202611 nähert sich dem Abgabetermin (morgen).</p>
                  <p className="text-[9px] text-text-muted mt-1 opacity-60">Vor 2 Std</p>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Theme Switcher (Desktop & Mobile) */}
        <div className="ml-2">
          <ThemeToggle />
        </div>

        {/* Profilbild rund (Kreis 48px) */}
        <div className="relative" ref={userDropdownRef}>
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="w-10 h-10 rounded-full bg-navy-700/90 backdrop-blur-sm border border-navy-500 hover:bg-navy-900 transition-all duration-300 text-white flex items-center justify-center text-sm font-black shrink-0 shadow-sm cursor-pointer"
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
              {/* Settings and other tabs are handled within /settings */}
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
