"use client";

import { AlertTriangle, LogIn } from "lucide-react";
import Link from "next/link";

interface SessionWarningBannerProps {
  show: boolean;
}

export function SessionWarningBanner({ show }: SessionWarningBannerProps) {
  if (!show) return null;

  return (
    <div className="bg-danger-red text-white px-4 py-3 font-medium flex items-center justify-between gap-4 z-[9999] shadow-md border-b border-red-700 animate-in fade-in slide-in-from-top duration-300">
      <div className="flex items-center gap-2.5">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <span className="text-sm">
          Sitzung abgelaufen oder nicht angemeldet – bitte neu anmelden, um alle Funktionen nutzen zu können.
        </span>
      </div>
      <Link
        href="/start"
        className="bg-white text-danger-red px-3.5 py-1.5 rounded-lg text-xs font-bold hover:bg-neutral-gray-100 transition-colors flex items-center gap-1.5 shrink-0"
      >
        <LogIn className="w-3.5 h-3.5" />
        Neu anmelden
      </Link>
    </div>
  );
}
