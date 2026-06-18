"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
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
  const [role] = useState<string | null>(
    initialAuthState.status === "authenticated" ? initialAuthState.session.role : null
  );
  const [permissions, setPermissions] = useState<string[]>([]);
  const [name] = useState<string>(
    initialAuthState.status === "authenticated" ? initialAuthState.session.displayName : ""
  );
  const [initials] = useState<string>(
    initialAuthState.status === "authenticated" ? deriveInitials(initialAuthState.session.displayName) : ""
  );
  const [loading, setLoading] = useState(true);

  const refreshPermissions = useCallback(async () => {
    try {
      const result = await getAuthorizationSnapshotAction();

      if (result.ok) {
        setPermissions([...result.data.permissions]);
        setStatus("authenticated");
        setError(null);
      } else {
        setStatus("error");
        setError(result.message);
        setPermissions([]);
      }
    } catch (err) {
      console.error("Failed to load permissions", err);
      setStatus("error");
      setError("AUTH_ERROR: Berechtigungen nicht verfügbar");
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      await refreshPermissions();
    };
    init();
    
    const handleStorage = () => { if(isMounted) refreshPermissions(); };
    window.addEventListener("storage", handleStorage);
    
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        refreshPermissions();
      }
    });

    return () => {
      isMounted = false;
      window.removeEventListener("storage", handleStorage);
      subscription.unsubscribe();
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
