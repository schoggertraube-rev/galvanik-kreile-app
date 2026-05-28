"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { LicensePlan, FeatureKey, DataReadiness, FeatureOverride, UserLicenseRole } from "./types";
import { DEFAULT_PLAN, DEFAULT_ROLE, DEFAULT_READINESS, DEFAULT_OVERRIDES } from "@/config/license.config";

interface LicenseContextValue {
  plan: LicensePlan;
  role: UserLicenseRole;
  readiness: Record<FeatureKey, DataReadiness>;
  overrides: FeatureOverride[];
}

const LicenseContext = createContext<LicenseContextValue | undefined>(undefined);

export interface LicenseProviderProps {
  children: ReactNode;
  plan?: LicensePlan;
  role?: UserLicenseRole;
  readiness?: Record<FeatureKey, DataReadiness>;
  overrides?: FeatureOverride[];
}

export function LicenseProvider({
  children,
  plan = DEFAULT_PLAN,
  role = DEFAULT_ROLE,
  readiness = DEFAULT_READINESS,
  overrides = DEFAULT_OVERRIDES,
}: LicenseProviderProps) {
  const value: LicenseContextValue = {
    plan,
    role,
    readiness,
    overrides,
  };

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
}

export function useLicense(): LicenseContextValue {
  const context = useContext(LicenseContext);
  if (context === undefined) {
    throw new Error("useLicense must be used within a LicenseProvider");
  }
  return context;
}
