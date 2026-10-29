import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  resolveAuthorization: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: ports.redirect }));
vi.mock("@/lib/server/authorization", () => ({
  resolveAuthorization: ports.resolveAuthorization,
  hasAuthorizationArea: (authorization: { areas?: readonly string[] }, area: string) =>
    authorization.areas?.includes(area) === true,
}));
vi.mock("@/app/HomeAppAdapter", () => ({
  HomeAppAdapter: ({ authorization }: { authorization: { role: string } }) => (
    <div data-testid="today-home">{authorization.role}</div>
  ),
}));

import RootPage from "@/app/page";

type ActorKey = "rolf" | "phillip" | "gregor";

function authorizationFor(key: ActorKey, gregorRole: "admin" | "developer" = "admin") {
  const role = key === "rolf" ? "meister" : key === "phillip" ? "werkstatt" : gregorRole;
  const displayName = key === "rolf" ? "Rolf" : key === "phillip" ? "Phillip" : "Gregor";

  return {
    ok: true as const,
    data: {
      userId: `synthetic-${key}`,
      tenantId: "synthetic-tenant",
      displayName,
      role,
    areas: role === "admin" || role === "developer" ? ["wartung"] : ["auftraege"],
    permissions: ["perm_view_leitstand"],
      active: true as const,
    },
  };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("F1-R0 root route containment", () => {
  it("renders Rolf through the shared actor authorization choke point", async () => {
    ports.resolveAuthorization.mockResolvedValue(authorizationFor("rolf"));
    render(await RootPage());
    expect(screen.getByTestId("today-home")).toHaveTextContent("meister");
  });

  it("renders Phillip through the same choke point", async () => {
    ports.resolveAuthorization.mockResolvedValue(authorizationFor("phillip"));
    render(await RootPage());
    expect(screen.getByTestId("today-home")).toHaveTextContent("werkstatt");
  });

  it("keeps a legacy admin session in settings", async () => {
    ports.resolveAuthorization.mockResolvedValue(authorizationFor("gregor", "admin"));
    await expect(RootPage()).rejects.toThrow("REDIRECT:/settings");
  });

  it("keeps a developer session in settings through the granted maintenance area", async () => {
    ports.resolveAuthorization.mockResolvedValue(authorizationFor("gregor", "developer"));
    await expect(RootPage()).rejects.toThrow("REDIRECT:/settings");
  });

  it("redirects a missing session to start", async () => {
    ports.resolveAuthorization.mockResolvedValue({
      ok: false,
      reason: "NO_SESSION",
      message: "not signed in",
    });
    await expect(RootPage()).rejects.toThrow("REDIRECT:/start");
  });

  it("does not start-bounce a valid session when readiness fails", async () => {
    ports.resolveAuthorization.mockResolvedValue({
      ok: false,
      reason: "ACTOR_READINESS_UNAVAILABLE",
      message: "technical detail",
      supportReference: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    render(await RootPage());
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Produktzugang momentan nicht verfügbar",
    );
    expect(ports.redirect).not.toHaveBeenCalled();
  });

  it("contains no fallback identity or client-side business state", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");
    const adapter = readFileSync(resolve(process.cwd(), "src/app/HomeAppAdapter.tsx"), "utf8");
    expect(source).not.toMatch(/DEMO|localStorage|useState|useEffect|getProductIdentity\(/);
    expect(source).toContain("resolveAuthorization");
    expect(source).toContain("<HomeAppAdapter");
    expect(adapter).toContain("@/modules/orders/public");
    expect(adapter).toContain("<OfficeHome");
    const home = readFileSync(resolve(process.cwd(), "src/components/home/OfficeHome.tsx"), "utf8");
    expect(home).toContain("hasAnyAuthorizationArea(authorization)");
    expect(home).toContain('hasAuthorizationArea(authorization, "auftraege")');
    expect(home).not.toContain('authorization.role !== "developer"');
  });
});
