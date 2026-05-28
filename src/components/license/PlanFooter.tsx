"use client";
// src/components/license/PlanFooter.tsx
import React from "react";
import { useLicense } from "@/lib/license/LicenseContext";
import { LicensePlan } from "@/lib/license/types";

const tierLabels: Record<LicensePlan, string> = {
  basis: "Basis",
  pro: "Pro",
  premium: "Premium",
  enterprise: "Enterprise",
};

export function PlanFooter() {
  const { plan, role } = useLicense();

  // Rendert NUR wenn role === "inhaber"
  if (role !== "inhaber") return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-bg-app-soft border-t border-neutral-gray-100 text-xs text-navy-500">
      <span>
        Plan:{" "}
        <strong className="text-navy-900">
          {tierLabels[plan] ?? plan}
        </strong>
      </span>
      <span className="font-bold px-2 py-0.5 rounded-full text-[10px] bg-success-green/10 text-success-green">
        Aktiv
      </span>
    </div>
  );
}
