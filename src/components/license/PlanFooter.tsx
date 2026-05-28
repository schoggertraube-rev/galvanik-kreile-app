"use client";
// src/components/license/PlanFooter.tsx
// Plan-Anzeige für Inhaber-Rolle im Settings/Footer
import { useLicenseContext } from "@/hooks/useFeatureFlag";

const tierLabels: Record<string, string> = {
  basis: "Basis",
  pro: "Pro",
  premium: "Premium",
  enterprise: "Enterprise",
};

export function PlanFooter({ role }: { role: string }) {
  const { plan } = useLicenseContext();

  // Only inhaber sees plan info
  if (role !== "inhaber" && role !== "admin" && role !== "anbieter_admin") return null;

  // Adapt to the new LicensePlan string type, defaulting to active
  const planName = typeof plan === 'string' ? plan : (plan as any).tier || "basis";
  const planStatus = typeof plan === 'string' ? "active" : (plan as any).status || "active";

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-bg-app-soft border-t border-neutral-gray-100 text-xs text-navy-500">
      <span>
        Plan:{" "}
        <strong className="text-navy-900">
          {tierLabels[planName] ?? planName}
        </strong>
      </span>
      <span
        className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
          planStatus === "active"
            ? "bg-success-green/10 text-success-green"
            : planStatus === "demo"
            ? "bg-gold-100 text-accent-orange"
            : "bg-red-100 text-red-600"
        }`}
      >
        {planStatus === "active" ? "Aktiv" : planStatus === "demo" ? "Demo" : "Gesperrt"}
      </span>
    </div>
  );
}
