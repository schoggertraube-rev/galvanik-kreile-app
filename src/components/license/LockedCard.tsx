"use client";
// src/components/license/LockedCard.tsx
// Zentrale Locked-Card Komponente gemäß Spec — immer sichtbar, niemals ausgeblendet
import { Lock } from "lucide-react";
import type { FeatureFlag } from "@/lib/license/types";

type Visibility = "full" | "minimal";

interface LockedCardProps {
  flag: FeatureFlag;
  visibility?: Visibility;
  children?: React.ReactNode;
  className?: string;
}

export function LockedCard({
  flag,
  visibility = "minimal",
  children,
  className = "",
}: LockedCardProps) {
  if (flag.enabled && flag.dataReadinessState === "reliable") {
    // Active: render children directly
    return <div className={className}>{children}</div>;
  }

  const isLocked = !flag.enabled;
  const isDataThin = flag.enabled && flag.dataReadinessState !== "reliable";

  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`}>
      {/* Demo content — blurred behind lock */}
      {children && (
        <div
          className="pointer-events-none select-none"
          style={{ opacity: 0.35, filter: "blur(3px)" }}
          aria-hidden
        >
          {children}
        </div>
      )}

      {/* Overlay */}
      {isLocked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/60 backdrop-blur-xs p-4 text-center">
          <Lock className="w-5 h-5 text-navy-500" />
          {visibility === "full" && flag.unlockTier && (
            <span className="text-[10px] font-bold text-navy-700 bg-gold-100 border border-navy-700 rounded-full px-2 py-0.5">
              Verfügbar im{" "}
              {flag.unlockTier.charAt(0).toUpperCase() + flag.unlockTier.slice(1)}-Plan
            </span>
          )}
          <p className="text-xs text-navy-500 max-w-[180px]">
            {visibility === "full" ? flag.hintLong : "Funktion zurzeit nicht verfügbar"}
          </p>
        </div>
      )}

      {/* Data-thin overlay — no lock, just a subtle hint */}
      {isDataThin && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-white/50 p-4 text-center">
          <span className="text-xl">⏳</span>
          <p className="text-xs text-navy-500 max-w-[180px]">{flag.hintShort}</p>
        </div>
      )}
    </div>
  );
}
