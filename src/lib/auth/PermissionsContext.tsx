"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
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
  // Snapshot-Seeding: Rolle und Initialen kommen synchron aus der signierten
  // Server-Session (initialAuthState). Kein localStorage, kein Flackern.
  const initialAuthed = initialAuthState.status === "authenticated";
  const [status, setStatus] = useState<"authenticated" | "unauthenticated" | "error">(initialAuthState.status);
  const [error, setError] = useState<string | null>(
    initialAuthState.status === "error" ? initialAuthState.message : null
  );
  const [role, setRole] = useState<string | null>(
    initialAuthed ? initialAuthState.session.role : null
  );
  const [permissions, setPermissions] = useState<string[]>([]);
  const [name, setName] = useState<string>("");
  const [initials, setInitials] = useState<string>(
    initialAuthed ? initialAuthState.session.initials : ""
  );
  const [loading, setLoading] = useState(initialAuthed);
  const pathname = usePathname();

  const refreshPermissions = useCallback(async () => {
    try {
      const result = await getAuthorizationSnapshotAction();

      if (result.ok) {
        setPermissions([...result.data.permissions]);
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
      setError("AUTH_ERROR: Berechtigungen nicht verfügbar");
      setPermissions([]);
      setRole(null);
      setName("");
      setInitials("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Mount-Verifikation gegen die DB (Permissions/Name). refreshPermissions ist
    // async und ruft setState erst nach `await` auf – kein synchroner Render-Cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshPermissions();

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

  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    refreshPermissions();
  }, [pathname, refreshPermissions]);

  const hasPermission = (key: string) => {
    return permissions.includes(key);
  };

  return (
    <PermissionsContext.Provider value={{ role, permissions, name, initials, loading, hasPermission, refreshPermissions, status, error }}>
      {children}
    </PermissionsContext.Provider>
  );
}
