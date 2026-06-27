"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { getAuthorizationSnapshotAction } from "@/app/actions/auth.actions";
import { createClient } from "@/lib/supabase/client";
import type { AuthBootstrapState } from "@/lib/server/authBootstrap";

export function deriveInitials(displayName: string): string {
  if (!displayName || displayName === "Unknown" || displayName === "User") return "";
  const parts = displayName.split(" ").filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface PermissionsContextType {
  userId: string | null;
  tenantId: string | null;
  active: boolean;
  role: string | null;
  permissions: string[];
  name: string;
  initials: string;
  loading: boolean;
  hasPermission: (key: string) => boolean;
  refreshPermissions: () => Promise<void>;
  status: "authenticated" | "unauthenticated" | "error";
  error: string | null;
}

const PermissionsContext = createContext<PermissionsContextType>({
  userId: null,
  tenantId: null,
  active: false,
  role: null,
  permissions: [],
  name: "",
  initials: "",
  loading: true,
  hasPermission: () => false,
  refreshPermissions: async () => {},
  status: "unauthenticated",
  error: null,
});

export const usePermissions = () => useContext(PermissionsContext);

/**
 * Kanonischer Identity-Provider.
 *
 * Vertrag: Eine erfolgreiche Session liefert gemeinsam:
 * userId, tenantId, role, displayName, initials, permissions, active.
 * Dieser Snapshot wird atomar übernommen.
 * Bei ungültiger Session wird alles vollständig geleert.
 */
type AuthState = {
  userId: string | null;
  tenantId: string | null;
  role: string | null;
  displayName: string;
  initials: string;
  permissions: string[];
  active: boolean;
  status: "authenticated" | "unauthenticated" | "error";
  error: string | null;
  loading: boolean;
};

export function PermissionsProvider({ 
  children,
  initialAuthState
}: { 
  children: React.ReactNode;
  initialAuthState: AuthBootstrapState;
}) {
  const [authState, setAuthState] = useState<AuthState>(() => {
    const isAuth = initialAuthState.status === "authenticated";
    return {
      userId: isAuth ? initialAuthState.session.userId : null,
      tenantId: isAuth ? initialAuthState.session.tenantId : null,
      role: isAuth ? initialAuthState.session.role : null,
      displayName: isAuth ? initialAuthState.session.displayName : "",
      initials: isAuth ? deriveInitials(initialAuthState.session.displayName) : "",
      permissions: [],
      active: isAuth ? true : false,
      status: initialAuthState.status,
      error: initialAuthState.status === "error" ? initialAuthState.message : null,
      loading: true,
    };
  });

  // Guard gegen Refresh-Races bei schnellem Benutzerwechsel
  const refreshSeqRef = useRef(0);

  const refreshPermissions = useCallback(async () => {
    const seq = ++refreshSeqRef.current;
    try {
      const result = await getAuthorizationSnapshotAction();

      // Veraltete Antwort verwerfen
      if (seq !== refreshSeqRef.current) return;

      if (result.ok) {
        // Atomarer Snapshot: alle Identitätsfelder gemeinsam setzen
        setAuthState({
          userId: result.data.userId,
          tenantId: result.data.tenantId,
          role: result.data.role,
          displayName: result.data.displayName,
          initials: deriveInitials(result.data.displayName),
          permissions: [...result.data.permissions],
          active: result.data.active,
          status: "authenticated",
          error: null,
          loading: false,
        });
      } else {
        // Ungültige Session: alles leeren
        setAuthState({
          userId: null,
          tenantId: null,
          role: null,
          displayName: "",
          initials: "",
          permissions: [],
          active: false,
          status: "error",
          error: result.message,
          loading: false,
        });
      }
    } catch (err) {
      if (seq !== refreshSeqRef.current) return;
      console.error("Failed to load permissions", err);
      setAuthState({
        userId: null,
        tenantId: null,
        role: null,
        displayName: "",
        initials: "",
        permissions: [],
        active: false,
        status: "error",
        error: "AUTH_ERROR: Berechtigungen nicht verfügbar",
        loading: false,
      });
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      await refreshPermissions();
    };
    init();

    // Supabase-Auth-Zustandswechsel reagieren auf echte Session-Ereignisse.
    // Kein künstlicher StorageEvent als Production-Trigger.
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if ((event === 'SIGNED_IN' || event === 'SIGNED_OUT') && isMounted) {
        refreshPermissions();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [refreshPermissions]);

  const hasPermission = (key: string) => {
    return authState.permissions.includes(key);
  };

  const contextValue: PermissionsContextType = {
    userId: authState.userId,
    tenantId: authState.tenantId,
    active: authState.active,
    role: authState.role,
    permissions: authState.permissions,
    name: authState.displayName,
    initials: authState.initials,
    loading: authState.loading,
    hasPermission,
    refreshPermissions,
    status: authState.status,
    error: authState.error,
  };

  return (
    <PermissionsContext.Provider value={contextValue}>
      {children}
    </PermissionsContext.Provider>
  );
}
