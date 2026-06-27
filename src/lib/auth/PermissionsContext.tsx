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

/**
 * Kanonischer Identity-Provider.
 *
 * Vertrag: Eine erfolgreiche Session liefert gemeinsam:
 * userId, tenantId, role, displayName, initials, permissions, active.
 * Dieser Snapshot wird atomar übernommen.
 * Bei ungültiger Session wird alles vollständig geleert.
 */
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
        setRole(result.data.role);
        setName(result.data.displayName);
        setInitials(deriveInitials(result.data.displayName));
        setPermissions([...result.data.permissions]);
        setStatus("authenticated");
        setError(null);
      } else {
        // Ungültige Session: alles leeren
        setRole(null);
        setName("");
        setInitials("");
        setPermissions([]);
        setStatus("error");
        setError(result.message);
      }
    } catch (err) {
      if (seq !== refreshSeqRef.current) return;
      console.error("Failed to load permissions", err);
      setRole(null);
      setName("");
      setInitials("");
      setPermissions([]);
      setStatus("error");
      setError("AUTH_ERROR: Berechtigungen nicht verfügbar");
    } finally {
      if (seq === refreshSeqRef.current) {
        setLoading(false);
      }
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
    return permissions.includes(key);
  };

  return (
    <PermissionsContext.Provider value={{ role, permissions, name, initials, loading, hasPermission, refreshPermissions, status, error }}>
      {children}
    </PermissionsContext.Provider>
  );
}
