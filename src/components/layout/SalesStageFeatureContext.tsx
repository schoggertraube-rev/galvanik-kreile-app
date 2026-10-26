"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { readSalesStageFeaturesAction } from "@/app/actions/settings.actions";
import { isFeatureEnabled, type SalesStageFeature, type SalesStageFeatureId } from "@/modules/fundament/public";
import { usePermissions } from "@/lib/auth/PermissionsContext";

type SalesStageFeatureContextValue = {
  loaded: boolean;
  isFeatureEnabled: (id: SalesStageFeatureId) => boolean;
};

const SalesStageFeatureContext = createContext<SalesStageFeatureContextValue>({
  loaded: false,
  isFeatureEnabled: () => false,
});

export function SalesStageFeatureProvider({ children }: { children: React.ReactNode }) {
  const { status, loading, role, name } = usePermissions();
  const authKey = status === "authenticated" ? `${role ?? ""}:${name}` : null;
  const [snapshot, setSnapshot] = useState<{ authKey: string; features: SalesStageFeature[] } | null>(null);

  useEffect(() => {
    let active = true;
    if (!authKey || loading) return () => { active = false; };
    const requestedFor = authKey;
    void readSalesStageFeaturesAction().then((result) => {
      if (!active) return;
      setSnapshot({ authKey: requestedFor, features: result.code === "OK" ? result.features : [] });
    });
    return () => { active = false; };
  }, [authKey, loading]);

  const loaded = !loading && (authKey === null || snapshot?.authKey === authKey);

  const value = useMemo<SalesStageFeatureContextValue>(() => {
    const features = authKey !== null && snapshot?.authKey === authKey ? snapshot.features : [];
    return {
      loaded,
      isFeatureEnabled: (id) => isFeatureEnabled(id, features),
    };
  }, [authKey, loaded, snapshot]);

  return <SalesStageFeatureContext.Provider value={value}>{children}</SalesStageFeatureContext.Provider>;
}

export function useSalesStageFeatures(): SalesStageFeatureContextValue {
  return useContext(SalesStageFeatureContext);
}
