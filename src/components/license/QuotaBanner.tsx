"use client";
// src/components/license/QuotaBanner.tsx
// Kontingent-Banner für Inhaber (warnt, blockiert NICHT)
import React from "react";
import { useLicense } from "@/lib/license/LicenseContext";
import { QUOTA_CONFIG } from "@/config/license.config";

export function QuotaBanner() {
  const { role } = useLicense();

  // Only inhaber sees quotas
  if (role !== "inhaber") return null;

  const max = QUOTA_CONFIG.limit;
  const current = QUOTA_CONFIG.currentUsage;
  
  if (max === 0) return null;
  const usagePct = Math.round((current / max) * 100);

  if (usagePct < 80) return null;

  const bannerStyle =
    usagePct >= 120
      ? "bg-red-50 border-red-200 text-red-700"
      : usagePct >= 100
      ? "bg-amber-50 border-amber-200 text-amber-700"
      : "bg-blue-50 border-blue-200 text-blue-700";

  const label =
    usagePct >= 120
      ? "⚠️ Kontingent stark überschritten"
      : usagePct >= 100
      ? "⚠️ Kontingent überschritten"
      : "ℹ️ Kontingent fast erreicht";

  return (
    <div className={`mx-4 mt-2 rounded-xl border px-4 py-3 text-xs font-medium ${bannerStyle}`}>
      <p className="font-bold">{label}</p>
      <p className="mt-0.5 text-[10px] opacity-80">
        Die Werkstatt arbeitet weiter. Sprechen Sie uns für ein Upgrade an.
      </p>
    </div>
  );
}
