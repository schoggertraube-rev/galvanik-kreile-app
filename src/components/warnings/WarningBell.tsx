"use client";
import { useState } from "react";
import { Bell } from "lucide-react";
import { useWarningBell } from "@/lib/warnings/hooks";
import { WarningDrawer } from "./WarningDrawer";

export function WarningBell() {
  const { totalCount, highestSeverity } = useWarningBell();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const badgeColor =
    highestSeverity === "critical"
      ? "bg-red-600"
      : highestSeverity === "warn"
      ? "bg-amber-500"
      : "bg-navy-700";

  return (
    <>
      <button
        onClick={() => setDrawerOpen(true)}
        className="relative flex items-center justify-center w-9 h-9 rounded-full hover:bg-neutral-gray-100 transition-colors"
        title={`${totalCount} aktive Warnungen`}
        aria-label="Warnungen öffnen"
      >
        <Bell className={`w-5 h-5 ${totalCount > 0 ? "text-navy-900" : "text-text-muted"}`} />
        {totalCount > 0 && (
          <span
            className={`absolute -top-0.5 -right-0.5 ${badgeColor} text-white text-[9px] font-black min-w-[16px] h-4 flex items-center justify-center rounded-full px-1 animate-pulse`}
          >
            {totalCount > 99 ? "99+" : totalCount}
          </span>
        )}
      </button>

      <WarningDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
