"use client";

import { AlertTriangle, LogIn } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/app/actions/auth";
import { useErfassung } from "@/components/erfassung/ErfassungProvider";

interface SessionWarningBannerProps {
  show: boolean;
}

export function SessionWarningBanner({ show }: SessionWarningBannerProps) {
  const router = useRouter();
  const { isOpen, closeErfassung } = useErfassung();
  const reloginInFlight = useRef(false);
  const [pending, setPending] = useState(false);

  if (!show) return null;

  const handleRelogin = async () => {
    if (reloginInFlight.current) return;

    reloginInFlight.current = true;
    setPending(true);

    if (isOpen) {
      closeErfassung();
    }

    try {
      await logout();
    } catch {
      // Auch bei einer gestörten Logout-Action zur öffentlichen Anmeldung wechseln.
    } finally {
      router.replace("/start");
    }
  };

  return (
    <div
      role="alert"
      data-testid="session-warning-banner"
      className="bg-danger-red text-white px-4 py-3 font-medium flex items-center justify-between gap-4 z-[9999] shadow-md border-b border-red-700 animate-in fade-in slide-in-from-top duration-300"
    >
      <div className="flex items-center gap-2.5">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <span className="text-sm">
          Sitzung abgelaufen oder nicht angemeldet – bitte neu anmelden, um alle Funktionen nutzen zu können.
        </span>
      </div>
      <button
        type="button"
        onClick={handleRelogin}
        disabled={pending}
        aria-busy={pending}
        data-testid="session-warning-relogin"
        className="bg-white text-danger-red px-3.5 py-1.5 rounded-lg text-xs font-bold hover:bg-neutral-gray-100 transition-colors flex items-center gap-1.5 shrink-0 disabled:opacity-60"
      >
        <LogIn className="w-3.5 h-3.5" />
        {pending ? "Wird abgemeldet …" : "Neu anmelden"}
      </button>
    </div>
  );
}
