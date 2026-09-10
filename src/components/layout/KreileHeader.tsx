"use client";

import Image from "next/image";
import Link from "next/link";
import { LogOut, Settings } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { usePermissions } from "@/lib/auth/PermissionsContext";

export function KreileHeader() {
  const router = useRouter();
  const { initials, name, role, status } = usePermissions();
  const [loggingOut, setLoggingOut] = useState(false);
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
      <div className="target-header__context">
        <span>{today}</span>
        {status === "authenticated" && name && <strong>{name}</strong>}
      </div>
      <div className="target-header__actions">
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
    </header>
  );
}
