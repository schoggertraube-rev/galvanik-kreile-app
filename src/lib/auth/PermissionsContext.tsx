"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getAuthorizationSnapshotAction } from "@/app/actions/auth.actions";
import { createClient } from "@/lib/supabase/client";
import type { AuthorizationResult } from "@/lib/server/authorization";
import type { AuthBootstrapState } from "@/lib/server/authBootstrap";

type IdentityStatus = "authenticated" | "unauthenticated" | "error";

const LEGACY_IDENTITY_STORAGE_KEYS = [
  "kreile_user_role",
  "kreile_user_initials",
] as const;

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
  status: IdentityStatus;
  error: string | null;
}

type IdentityState = {
  userId: string | null;
  tenantId: string | null;
  role: string | null;
  displayName: string;
  initials: string;
  permissions: string[];
  active: boolean;
  status: IdentityStatus;
  error: string | null;
  loading: boolean;
};

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

function emptyIdentityState(
  status: Exclude<IdentityStatus, "authenticated">,
  error: string | null,
  loading: boolean,
): IdentityState {
  return {
    userId: null,
    tenantId: null,
    role: null,
    displayName: "",
    initials: "",
    permissions: [],
    active: false,
    status,
    error,
    loading,
  };
}

function identityStateFromBootstrap(initialAuthState: AuthBootstrapState): IdentityState {
  if (initialAuthState.status !== "authenticated") {
    return emptyIdentityState(
      initialAuthState.status,
      initialAuthState.status === "error" ? initialAuthState.message : null,
      true,
    );
  }

  const { session } = initialAuthState;
  return {
    userId: session.userId,
    tenantId: session.tenantId,
    role: session.role,
    displayName: session.displayName,
    initials: deriveInitials(session.displayName),
    permissions: [],
    active: true,
    status: "authenticated",
    error: null,
    loading: true,
  };
}

function identityStateFromAuthorization(result: AuthorizationResult): IdentityState {
  if (!result.ok) {
    const status = result.reason === "NO_SESSION" ? "unauthenticated" : "error";
    return emptyIdentityState(status, status === "error" ? result.message : null, false);
  }

  return {
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
  };
}

function bootstrapKey(initialAuthState: AuthBootstrapState): string {
  if (initialAuthState.status !== "authenticated") {
    return initialAuthState.status === "error"
      ? `error:${initialAuthState.message}`
      : initialAuthState.status;
  }

  const { session } = initialAuthState;
  return JSON.stringify([
    session.userId,
    session.tenantId,
    session.role,
    session.displayName,
    session.issuedAt,
    session.expiresAt,
  ]);
}

function bootstrapExpiresAt(initialAuthState: AuthBootstrapState): number | null {
  return initialAuthState.status === "authenticated"
    ? initialAuthState.session.expiresAt
    : null;
}

function clearLegacyIdentityStorage(): void {
  try {
    for (const key of LEGACY_IDENTITY_STORAGE_KEYS) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Storage ist nie eine Autorisierungsquelle und kann deaktiviert sein.
  }
}

/**
 * Der Provider besitzt genau einen atomaren Client-Snapshot der serverseitig
 * aufgeloesten Identitaet. Layouts bleiben bei App-Router-Navigationen erhalten;
 * deshalb wird der Snapshot an jeder Login-Grenze und nach jeder Route erneut
 * vom Resolver gelesen, statt alte React- oder Storage-Werte weiterzuverwenden.
 */
export function PermissionsProvider({
  children,
  initialAuthState,
}: {
  children: React.ReactNode;
  initialAuthState: AuthBootstrapState;
}) {
  const pathname = usePathname();
  const { replace } = useRouter();
  const [identity, setIdentity] = useState<IdentityState>(() =>
    identityStateFromBootstrap(initialAuthState),
  );
  const mountedRef = useRef(false);
  const refreshSequenceRef = useRef(0);
  const previousPathnameRef = useRef<string | null>(null);
  const appliedBootstrapKeyRef = useRef(bootstrapKey(initialAuthState));
  const currentBootstrapKey = bootstrapKey(initialAuthState);
  const sessionExpiresAt = bootstrapExpiresAt(initialAuthState);

  const expireSession = useCallback(() => {
    refreshSequenceRef.current += 1;
    clearLegacyIdentityStorage();
    setIdentity(emptyIdentityState("unauthenticated", null, false));
    replace("/start");
  }, [replace]);

  const refreshPermissions = useCallback(async (): Promise<void> => {
    const refreshSequence = ++refreshSequenceRef.current;

    try {
      const result = await getAuthorizationSnapshotAction();
      if (!mountedRef.current || refreshSequence !== refreshSequenceRef.current) return;

      clearLegacyIdentityStorage();
      setIdentity(identityStateFromAuthorization(result));
    } catch {
      if (!mountedRef.current || refreshSequence !== refreshSequenceRef.current) return;

      clearLegacyIdentityStorage();
      setIdentity(
        emptyIdentityState(
          "error",
          "AUTH_ERROR: Berechtigungen nicht verfügbar",
          false,
        ),
      );
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      refreshSequenceRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (appliedBootstrapKeyRef.current === currentBootstrapKey) return;

    appliedBootstrapKeyRef.current = currentBootstrapKey;
    refreshSequenceRef.current += 1;
    clearLegacyIdentityStorage();
    setIdentity(identityStateFromBootstrap(initialAuthState));
    const refreshFromBootstrap = async () => {
      await refreshPermissions();
    };
    void refreshFromBootstrap();
  }, [currentBootstrapKey, initialAuthState, refreshPermissions]);

  useEffect(() => {
    if (sessionExpiresAt === null) return;

    const remainingMs = sessionExpiresAt - Date.now();
    const expirationTimer = window.setTimeout(
      expireSession,
      Math.max(remainingMs, 0),
    );
    return () => window.clearTimeout(expirationTimer);
  }, [currentBootstrapKey, expireSession, sessionExpiresAt]);

  useEffect(() => {
    const crossesLoginBoundary =
      pathname === "/start" || previousPathnameRef.current === "/start";
    previousPathnameRef.current = pathname;

    if (crossesLoginBoundary) {
      refreshSequenceRef.current += 1;
      clearLegacyIdentityStorage();
      setIdentity(emptyIdentityState("unauthenticated", null, true));
    }

    const refreshForPath = async () => {
      await refreshPermissions();
    };
    void refreshForPath();
  }, [pathname, refreshPermissions]);

  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        void refreshPermissions();
      }
    });

    return () => subscription.unsubscribe();
  }, [refreshPermissions]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshPermissions();
      }
    };

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshPermissions]);

  const hasPermission = useCallback(
    (key: string) => identity.permissions.includes(key),
    [identity.permissions],
  );

  return (
    <PermissionsContext.Provider
      value={{
        userId: identity.userId,
        tenantId: identity.tenantId,
        active: identity.active,
        role: identity.role,
        permissions: identity.permissions,
        name: identity.displayName,
        initials: identity.initials,
        loading: identity.loading,
        hasPermission,
        refreshPermissions,
        status: identity.status,
        error: identity.error,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}
