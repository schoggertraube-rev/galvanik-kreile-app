"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { getAuthorizationSnapshotAction } from "@/app/actions/auth.actions";
import type { AuthBootstrapState } from "@/lib/server/authBootstrap";

export function deriveInitials(displayName: string): string {
  if (!displayName || displayName === "Unknown" || displayName === "User") return "";
  const parts = displayName.split(" ").filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface PermissionsContextType {
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
  const [status, setStatus] = useState<"authenticated" | "unauthenticated" | "error">(initialAuthState.status);
  const [error, setError] = useState<string | null>(
    initialAuthState.status === "error" ? initialAuthState.message : null
  );
  const [role, setRole] = useState<string | null>(
    initialAuthState.status === "authenticated" ? initialAuthState.session.role : null
  );
  const [permissions, setPermissions] = useState<string[]>([]);
  const [name, setName] = useState<string>(
    initialAuthState.status === "authenticated" ? initialAuthState.session.displayName : ""
  );
  const [initials, setInitials] = useState<string>(
    initialAuthState.status === "authenticated" ? deriveInitials(initialAuthState.session.displayName) : ""
  );
  const [loading, setLoading] = useState(true);
  const refreshInFlight = useRef<Promise<void> | null>(null);

  const refreshPermissions = useCallback(async () => {
    if (refreshInFlight.current) return refreshInFlight.current;
    const refresh = (async () => {
      try {
        const result = await getAuthorizationSnapshotAction();

        if (result.ok) {
          setPermissions([...result.data.permissions]);
          setRole(result.data.role);
          setName(result.data.displayName);
          setInitials(deriveInitials(result.data.displayName));
          setStatus("authenticated");
          setError(null);
        } else {
          setPermissions([]);
          if (result.reason === "NO_SESSION") {
            setRole(null);
            setName("");
            setInitials("");
            setStatus("unauthenticated");
            setError(null);
          } else {
            setStatus("error");
            setError(result.message);
          }
        }
      } catch (err) {
        console.error("Failed to load permissions", err);
        setStatus("error");
        setError("AUTH_ERROR: Berechtigungen nicht verfügbar");
        setPermissions([]);
      } finally {
        setLoading(false);
      }
    })();
    refreshInFlight.current = refresh;
    try {
      await refresh;
    } finally {
      if (refreshInFlight.current === refresh) refreshInFlight.current = null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = () => { if (active) void refreshPermissions(); };
    const handleVisibility = () => { if (document.visibilityState === "visible") refresh(); };

    void Promise.resolve().then(refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("kreile:auth-changed", refresh);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      active = false;
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("kreile:auth-changed", refresh);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refreshPermissions]);

  const hasPermission = (key: string) => {
    return permissions.includes(key);
  };

  return (
    <PermissionsContext.Provider value={{ role, permissions, name, initials, loading, hasPermission, refreshPermissions, status, error }}>
      {children}
    </PermissionsContext.Provider>
  );
}
