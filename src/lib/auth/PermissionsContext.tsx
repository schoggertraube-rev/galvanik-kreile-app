"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
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
      role: initial.user.role,
      permissions: [],
      name: initial.user.displayName,
      initials: deriveInitials(initial.user.displayName),
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
  const pathname = usePathname();
  const router = useRouter();
  const pathnameRef = useRef(pathname);
  const routerRef = useRef(router);
  // Permanent latch: the document is really gone ("pagehide"). Never set by
  // "beforeunload", because an announced navigation can still be cancelled.
  const pageActiveRef = useRef(true);
  // Transient window: a full-document navigation was announced via
  // "beforeunload". It only covers a request that this navigation tears down
  // immediately, and closes again in the next event-loop task.
  const navigationPendingRef = useRef(false);
  const navigationPendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [authState, setAuthState] = useState<AuthState>(() => buildInitialAuthState(initialAuthState));
  const [loading, setLoading] = useState(true);

  // Sequence guard: discard responses from stale requests
  const refreshSeqRef = useRef(0);

  useEffect(() => {
    pathnameRef.current = pathname;
    routerRef.current = router;
  }, [pathname, router]);

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
      } else if (result.status === "unauthenticated") {
        setAuthState({
          role: null,
          permissions: [],
          name: "",
          initials: "",
          status: "unauthenticated",
          error: null,
        });
        if (pathnameRef.current !== "/start" && pathnameRef.current !== "/login") {
          routerRef.current.replace("/start");
        }
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
      // Silence is allowed only for provably non-product causes:
      // (1) a newer request superseded this one,
      // (2) the document is permanently gone ("pagehide"),
      // (3) an announced navigation tore this request down inside the still
      //     open transient window.
      // No error-string matching and no blanket ignore: any other rejection
      // must stay visible and fail closed.
      const superseded = seq !== refreshSeqRef.current;
      const documentGone = !pageActiveRef.current;
      const torndownByNavigation = navigationPendingRef.current;
      if (superseded || documentGone || torndownByNavigation) return;
      console.error("Failed to load permissions", err);
      setAuthState({
        role: null,
        permissions: [],
        name: "",
        initials: "",
        status: "error",
        error: "AUTH_ERROR: Berechtigungen nicht verfügbar",
      });
    } finally {
      if (seq === refreshSeqRef.current && pageActiveRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    pageActiveRef.current = true;

    const closeNavigationWindow = () => {
      if (navigationPendingTimerRef.current !== null) {
        clearTimeout(navigationPendingTimerRef.current);
        navigationPendingTimerRef.current = null;
      }
      navigationPendingRef.current = false;
    };

    // "pagehide" is the only permanent latch: the document is really leaving,
    // so any pending transient reset is dropped and later work is invalidated.
    const leavePage = () => {
      closeNavigationWindow();
      pageActiveRef.current = false;
      refreshSeqRef.current += 1;
    };

    // "beforeunload" only announces an attempt that the user may still cancel.
    // It must not mark the page inactive and must not invalidate later work; it
    // opens a narrow window that covers the request the navigation tears down
    // synchronously and closes itself in the next event-loop task.
    const announceNavigation = () => {
      closeNavigationWindow();
      navigationPendingRef.current = true;
      navigationPendingTimerRef.current = setTimeout(() => {
        navigationPendingTimerRef.current = null;
        navigationPendingRef.current = false;
      }, 0);
    };

    const restorePage = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      closeNavigationWindow();
      pageActiveRef.current = true;
      void refreshPermissions();
    };

    window.addEventListener("pagehide", leavePage);
    window.addEventListener("beforeunload", announceNavigation);
    window.addEventListener("pageshow", restorePage);
    return () => {
      window.removeEventListener("pagehide", leavePage);
      window.removeEventListener("beforeunload", announceNavigation);
      window.removeEventListener("pageshow", restorePage);
      leavePage();
    };
  }, [refreshPermissions]);

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
