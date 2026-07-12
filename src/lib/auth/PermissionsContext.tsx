"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getAuthorizationSnapshotAction } from "@/app/actions/auth.actions";
import { createClient } from "@/lib/supabase/client";
import type { AuthBootstrapState } from "@/lib/server/authBootstrap";
import {
  getPermissionsForRole,
  isAppRole,
  type PermissionKey,
} from "@/lib/auth/authorizationContract";

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
  initialAuthState,
}: {
  children: React.ReactNode;
  initialAuthState: AuthBootstrapState;
}) {
  const initialAuthed = initialAuthState.status === "authenticated";
  const initialRole = initialAuthed ? initialAuthState.session.role : null;
  const initialPermissions: string[] =
    initialAuthed && isAppRole(initialAuthState.session.role)
      ? [...getPermissionsForRole(initialAuthState.session.role)]
      : [];

  const [status, setStatus] = useState<"authenticated" | "unauthenticated" | "error">(initialAuthState.status);
  const [error, setError] = useState<string | null>(
    initialAuthState.status === "error" ? initialAuthState.message : null
  );
  const [role, setRole] = useState<string | null>(initialRole);
  const [permissions, setPermissions] = useState<string[]>(initialPermissions);
  const [name, setName] = useState<string>(
    initialAuthed ? initialAuthState.session.displayName : ""
  );
  const [initials, setInitials] = useState<string>(
    initialAuthed ? initialAuthState.session.initials : ""
  );
  const [loading, setLoading] = useState(false);

  const refreshPermissions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAuthorizationSnapshotAction();

      if (result.ok) {
        setPermissions([...result.data.permissions] as PermissionKey[]);
        setRole(result.data.role);
        setName(result.data.displayName);
        setInitials(deriveInitials(result.data.displayName));
        setStatus("authenticated");
        setError(null);
      } else if (result.reason === "NO_SESSION") {
        setStatus("unauthenticated");
        setError(null);
        setPermissions([]);
        setRole(null);
        setName("");
        setInitials("");
      } else {
        setStatus("error");
        setError(result.message);
        setPermissions([]);
        setRole(null);
        setName("");
        setInitials("");
      }
    } catch (err) {
      console.error("Failed to load permissions", err);
      setStatus("error");
      setError("AUTH_ERROR: Berechtigungen nicht verfuegbar");
      setPermissions([]);
      setRole(null);
      setName("");
      setInitials("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        refreshPermissions();
      }
    });

    return () => {
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
