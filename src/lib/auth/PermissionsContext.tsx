"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { getMyPermissionsAction, getRoleAction } from "@/app/actions/auth.actions";
import { createClient } from "@/lib/supabase/client";

interface PermissionsContextType {
  role: string | null;
  permissions: string[];
  name: string;
  initials: string;
  loading: boolean;
  hasPermission: (key: string) => boolean;
  refreshPermissions: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType>({
  role: null,
  permissions: [],
  name: "Unknown",
  initials: "?",
  loading: true,
  hasPermission: () => false,
  refreshPermissions: async () => {},
});

export const usePermissions = () => useContext(PermissionsContext);

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [name, setName] = useState<string>("Unknown");
  const [initials, setInitials] = useState<string>("?");
  const [loading, setLoading] = useState(true);

  const refreshPermissions = async () => {
    try {
      const [newRole, permData] = await Promise.all([
        getRoleAction(),
        getMyPermissionsAction()
      ]);
      setRole(newRole);
      setPermissions(permData.permissions);
      setName(permData.name);
      
      let finalInitials = permData.initials;
      if (finalInitials === "?") {
        try {
          const localInitials = localStorage.getItem("kreile_user_initials");
          if (localInitials) finalInitials = localInitials;
        } catch { /* ignore */ }
      }
      setInitials(finalInitials);
    } catch (err) {
      console.error("Failed to load permissions", err);
    } finally {
      setLoading(false);
    }
  };

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, _session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        refreshPermissions();
      }
    });

    return () => {
      isMounted = false;
      window.removeEventListener("storage", handleStorage);
      subscription.unsubscribe();
    };
  }, []);

  const hasPermission = (key: string) => {
    return permissions.includes(key);
  };

  return (
    <PermissionsContext.Provider value={{ role, permissions, name, initials, loading, hasPermission, refreshPermissions }}>
      {children}
    </PermissionsContext.Provider>
  );
}
