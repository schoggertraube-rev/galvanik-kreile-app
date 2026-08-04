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

/**
 * Atomic auth state — all identity fields update together.
 * Prevents stale role/name/initials after user switch.
 */
interface AuthState {
  role: string | null;
  permissions: string[];
  name: string;
  initials: string;
  status: "authenticated" | "unauthenticated" | "error";
  error: string | null;
}

interface PermissionsContextType extends AuthState {
  loading: boolean;
  hasPermission: (key: string) => boolean;
  refreshPermissions: () => Promise<void>;
}

function buildInitialAuthState(initial: AuthBootstrapState): AuthState {
  if (initial.status === "authenticated") {
    return {
      role: initial.session.role,
      permissions: [],
      name: initial.session.displayName,
      initials: deriveInitials(initial.session.displayName),
      status: "authenticated",
      error: null,
    };
  }
  return {
    role: null,
    permissions: [],
    name: "",
    initials: "",
    status: initial.status === "error" ? "error" : "unauthenticated",
    error: initial.status === "error" ? initial.message : null,
  };
}

const PermissionsContext = createContext<PermissionsContextType>({
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

export function PermissionsProvider({
  children,
  initialAuthState
}: {
  children: React.ReactNode;
  initialAuthState: AuthBootstrapState;
}) {
  const [authState, setAuthState] = useState<AuthState>(() => buildInitialAuthState(initialAuthState));
  const [loading, setLoading] = useState(true);

  // Sequence guard: discard responses from stale requests
  const refreshSeqRef = useRef(0);

  const refreshPermissions = useCallback(async () => {
    const seq = ++refreshSeqRef.current;
    try {
      const result = await getAuthorizationSnapshotAction();
      // Discard if a newer request was started while this one was in-flight
      if (seq !== refreshSeqRef.current) return;

      if (result.ok) {
        setAuthState({
          role: result.data.role,
          permissions: [...result.data.permissions],
          name: result.data.displayName,
          initials: deriveInitials(result.data.displayName),
          status: "authenticated",
          error: null,
        });
      } else {
        setAuthState({
          role: null,
          permissions: [],
          name: "",
          initials: "",
          status: "error",
          error: result.message,
        });
      }
    } catch (err) {
      console.error("Failed to load permissions", err);
      if (seq !== refreshSeqRef.current) return;
      setAuthState({
        role: null,
        permissions: [],
        name: "",
        initials: "",
        status: "error",
        error: "AUTH_ERROR: Berechtigungen nicht verfügbar",
      });
    } finally {
      if (seq === refreshSeqRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const init = async () => { await refreshPermissions(); };
    init();

    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        refreshPermissions();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshPermissions]);

  const hasPermission = useCallback((key: string) => {
    return authState.permissions.includes(key);
  }, [authState.permissions]);

  const value: PermissionsContextType = {
    ...authState,
    loading,
    hasPermission,
    refreshPermissions,
  };

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}
