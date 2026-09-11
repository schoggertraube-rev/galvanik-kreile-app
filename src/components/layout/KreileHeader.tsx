"use client";

import Image from "next/image";
import Link from "next/link";
import { LogOut, Search, Settings } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { usePermissions } from "@/lib/auth/PermissionsContext";
import { GlobalSearch } from "./GlobalSearch";

export function KreileHeader() {
  const router = useRouter();
  const { initials, name, role, status } = usePermissions();
  const [loggingOut, setLoggingOut] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const canConfigure = role === "admin" || role === "developer";
  const today = new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date());

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    document.cookie = "bypass-auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    await logout();
    router.replace("/start");
  }

  return (
    <header className="target-header">
      <Link href="/" className="target-brand" aria-label="Kreile Startseite">
        <Image
          src="/assets/logo/kreile-wordmark-skyline.svg"
          alt="Kreile"
          width={200}
          height={79}
          unoptimized
          priority
        />
      </Link>
      <button
        type="button"
        className="hidden min-h-12 min-w-0 max-w-xl flex-1 items-center gap-3 rounded-2xl border border-[#d8d0c4] bg-white px-4 text-left text-sm text-[#526274] shadow-sm transition-colors hover:border-[#b8923f] md:flex"
        aria-label="Kunde, Auftrag, Teil, Material, Oberfläche oder Termin suchen"
        onClick={() => setSearchOpen(true)}
      >
        <Search aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">
          Kunde, Auftrag, Teil, Material, Oberfläche oder Termin suchen
        </span>
        <kbd className="rounded-md border border-[#d8d0c4] px-2 py-1 text-xs">Ctrl K</kbd>
      </button>
      <div className="target-header__context">
        <span>{today}</span>
        {status === "authenticated" && name && <strong>{name}</strong>}
      </div>
      <div className="target-header__actions">
        <button
          type="button"
          className="target-icon-button md:hidden"
          aria-label="Suche öffnen"
          onClick={() => setSearchOpen(true)}
        >
          <Search aria-hidden="true" />
        </button>
        {canConfigure && (
          <Link href="/settings" className="target-icon-button" aria-label="Einstellungen">
            <Settings aria-hidden="true" />
          </Link>
        )}
        {status === "authenticated" && (
          <>
            <span className="target-avatar" aria-hidden="true">{initials}</span>
            <button
              type="button"
              className="target-icon-button"
              onClick={handleLogout}
              disabled={loggingOut}
              aria-label="Abmelden"
            >
              <LogOut aria-hidden="true" />
            </button>
          </>
        )}
      </div>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
