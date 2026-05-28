"use client";
// src/components/license/QuotaBanner.tsx
// Kontingent-Banner für Inhaber (warnt, blockiert NICHT)
import { useLicenseContext } from "@/hooks/useFeatureFlag";

function getUsagePercent(current: number, max: number): number {
  if (max === 0) return 0;
  return Math.round((current / max) * 100);
}

export function QuotaBanner({ role }: { role: string }) {
  const { plan } = useLicenseContext();

  // Only inhaber sees quotas
  if (role !== "inhaber" && role !== "admin") return null;

  const { quotas } = plan;
  const ordersPct = getUsagePercent(quotas.currentMonthOrders, quotas.ordersPerMonth);
  const storagePct = getUsagePercent(quotas.currentStorageGb, quotas.photoStorageGb);
  const usersPct = getUsagePercent(quotas.currentActiveUsers, quotas.activeUsers);

  const maxPct = Math.max(ordersPct, storagePct, usersPct);

  if (maxPct < 80 || quotas.ordersPerMonth === 0) return null;

  const bannerStyle =
    maxPct >= 120
      ? "bg-red-50 border-red-200 text-red-700"
      : maxPct >= 100
      ? "bg-amber-50 border-amber-200 text-amber-700"
      : "bg-blue-50 border-blue-200 text-blue-700";

  const label =
    maxPct >= 120
      ? "⚠️ Kontingent stark überschritten"
      : maxPct >= 100
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
