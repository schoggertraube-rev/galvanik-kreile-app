// src/config/lockHints.ts
// Standardisierte Tooltip-Texte für gesperrte Features
import type { LicenseTier } from "@/lib/license/types";

const tierLabel = (tier: LicenseTier): string => {
  const labels: Record<LicenseTier, string> = {
    basis: "Basis",
    pro: "Pro",
    premium: "Premium",
    enterprise: "Enterprise",
  };
  return labels[tier];
};

export const LOCK_HINTS = {
  plan_only: (unlockTier: LicenseTier) =>
    `Verfügbar im ${tierLabel(unlockTier)}-Plan. Sprechen Sie uns an.`,
  data_only: (kpi: string, reason: string) =>
    `${kpi} wird verlässlich, sobald ${reason}.`,
  plan_and_data: (unlockTier: LicenseTier, reason: string) =>
    `Verfügbar im ${tierLabel(unlockTier)}-Plan. Auch dann erst aussagekräftig, sobald ${reason}.`,
  override_disabled: (reason: string) =>
    `Vom Anbieter deaktiviert. Grund: ${reason}.`,
};
