"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getMyPermissionsAction, getRoleAction } from "@/app/actions/auth.actions";
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
  const [role, setRole] = useState<string | null>(
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
      const [newRole, permData] = await Promise.all([
        getRoleAction(),
        getMyPermissionsAction()
      ]);

      if (initialAuthState.status === "authenticated") {
        const sessionRoleNorm = initialAuthState.session.role.trim().toLowerCase();
        const newRoleNorm = newRole ? newRole.trim().toLowerCase() : "";

        if (sessionRoleNorm === newRoleNorm) {
          setRole(initialAuthState.session.role);
          setPermissions(permData.permissions);
          setStatus("authenticated");
          setError(null);
        } else {
          setStatus("error");
          setError("AUTH_ERROR: Rollenwiderspruch");
        }
      } else {
        if (newRole) {
          setRole(newRole);
          setPermissions(permData.permissions);
          setStatus("authenticated");
          setError(null);
        } else {
          setStatus("unauthenticated");
          setError(null);
        }
      }
    } catch (err) {
      console.error("Failed to load permissions", err);
      setStatus("error");
      setError("AUTH_ERROR: Abfrage fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }, [initialAuthState]);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      await refreshPermissions();
    };
    init();
    
    // Listen for cross-tab or explicit re-login events
    const handleStorage = () => { if(isMounted) refreshPermissions(); };
    window.addEventListener("storage", handleStorage);
    
    // Listen to Supabase auth state changes
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
