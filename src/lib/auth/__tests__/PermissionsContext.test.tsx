import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React, { useEffect } from "react";
import { PermissionsProvider, usePermissions, deriveInitials } from "../PermissionsContext";
import type { AuthBootstrapState } from "@/lib/server/authBootstrap";

// Mock Supabase client to avoid real network
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: vi.fn() } }
      })
    }
  })
}));

// Mock Server Actions to avoid real requests
vi.mock("@/app/actions/auth.actions", () => ({
  getRoleAction: vi.fn().mockResolvedValue("office"),
  getMyPermissionsAction: vi.fn().mockResolvedValue({
    permissions: ["test-perm"],
    name: "Hans Meister",
    initials: "HM",
  })
}));

describe("deriveInitials()", () => {
  it("5. Initialen werden stabil aus displayName erzeugt", () => {
    expect(deriveInitials("Hans Meister")).toBe("HM");
    expect(deriveInitials("Max Karl Kreile")).toBe("MK");
    expect(deriveInitials("Christian")).toBe("C");
    expect(deriveInitials("User")).toBe("");
    expect(deriveInitials("Unknown")).toBe("");
    expect(deriveInitials("")).toBe("");
  });
});

describe("PermissionsProvider Bootstrap", () => {
  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const TestComponent = () => {
    const { status, initials, name, role } = usePermissions();
    
    // Simulate checking localStorage - should never be called internally by Provider anymore
    useEffect(() => {
      localStorage.setItem("kreile_user_initials", "XX");
    }, []);

    return (
      <div>
        <span data-testid="status">{status}</span>
        <span data-testid="initials">{initials}</span>
        <span data-testid="name">{name}</span>
        <span data-testid="role">{role}</span>
      </div>
    );
  };

  it("4. Provider übernimmt initialAuthState ohne nachträgliches Local-Storage-Überschreiben", () => {
    const initialState: AuthBootstrapState = {
      status: "authenticated",
      session: {
        userId: "1",
        tenantId: "t1",
        role: "admin",
        displayName: "Peter Pan",
        issuedAt: 0,
        expiresAt: 0,
      }
    };

    render(
      <PermissionsProvider initialAuthState={initialState}>
        <TestComponent />
      </PermissionsProvider>
    );

    // Should immediately render initial state without waiting for hydration
    expect(screen.getByTestId("status").textContent).toBe("authenticated");
    expect(screen.getByTestId("name").textContent).toBe("Peter Pan");
    expect(screen.getByTestId("initials").textContent).toBe("PP");
    expect(screen.getByTestId("role").textContent).toBe("admin");

    // 6. es existiert kein "?"-Fallback mehr im Auth-/Header-Pfad
    expect(screen.getByTestId("initials").textContent).not.toBe("?");
    expect(screen.getByTestId("initials").textContent).not.toBe("XX");
  });

  it("Provider verarbeitet unauthenticated korrekt", () => {
    const initialState: AuthBootstrapState = {
      status: "unauthenticated"
    };

    render(
      <PermissionsProvider initialAuthState={initialState}>
        <TestComponent />
      </PermissionsProvider>
    );

    expect(screen.getByTestId("status").textContent).toBe("unauthenticated");
    expect(screen.getByTestId("name").textContent).toBe("");
    expect(screen.getByTestId("initials").textContent).toBe("");
    expect(screen.getByTestId("role").textContent).toBe("");
  });
});
