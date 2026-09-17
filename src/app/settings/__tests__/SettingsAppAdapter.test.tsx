import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  resolveProductActorAuthorization: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/productActorReadiness", () => ({
  resolveProductActorAuthorization: ports.resolveProductActorAuthorization,
}));
vi.mock("next/navigation", () => ({ redirect: ports.redirect }));

import { SettingsAppAdapter } from "../SettingsAppAdapter";

function authorizationFor(key: "rolf" | "gregor") {
  const gregor = key === "gregor";
  return {
    ok: true as const,
    data: {
      authorization: {
        userId: gregor ? "synthetic-gregor" : "synthetic-rolf",
        tenantId: "synthetic-tenant",
        displayName: gregor ? "Gregor" : "Rolf",
        role: gregor ? ("admin" as const) : ("meister" as const),
        permissions: gregor ? ["perm_sys_diag"] : ["perm_view_leitstand"],
        active: true as const,
      },
      actor: {
        key,
        actorId: gregor ? "synthetic-gregor" : "synthetic-rolf",
        tenantId: "synthetic-tenant",
        role: gregor ? ("admin" as const) : ("meister" as const),
        identity: gregor
          ? {
              name: "Gregor" as const,
              responsibility: "Systemadministrator" as const,
              initials: "G" as const,
            }
          : {
              name: "Rolf" as const,
              responsibility: "Meister" as const,
              initials: "R" as const,
            },
        login: gregor ? ("email" as const) : ("pin" as const),
      },
    },
  };
}

describe("Gregor system administration composition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ports.resolveProductActorAuthorization.mockResolvedValue(
      authorizationFor("gregor"),
    );
  });

  it("renders only the validated Gregor product actor", async () => {
    render(await SettingsAppAdapter());
    expect(screen.getByTestId("gregor-system-admin")).toHaveTextContent(
      "Angemeldet als Gregor · Systemadministrator",
    );
    expect(screen.getByText("Sitzung serverseitig bestätigt")).toBeInTheDocument();
  });

  it("redirects only missing or invalid sessions to start", async () => {
    ports.resolveProductActorAuthorization.mockResolvedValue({
      ok: false,
      reason: "NO_SESSION",
      message: "not signed in",
    });
    await expect(SettingsAppAdapter()).rejects.toThrow("REDIRECT:/start");
  });

  it("redirects a valid non-Gregor actor to the role-aware root", async () => {
    ports.resolveProductActorAuthorization.mockResolvedValue(
      authorizationFor("rolf"),
    );
    await expect(SettingsAppAdapter()).rejects.toThrow("REDIRECT:/");
  });

  it("renders a stable fail-closed state instead of bouncing on readiness failure", async () => {
    ports.resolveProductActorAuthorization.mockResolvedValue({
      ok: false,
      reason: "ACTOR_READINESS_UNAVAILABLE",
      message: "technical detail",
      supportReference: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });

    render(await SettingsAppAdapter());
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Produktzugang momentan nicht verfügbar",
    );
    expect(screen.getByText(/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/)).toBeInTheDocument();
    expect(ports.redirect).not.toHaveBeenCalled();
  });
});
