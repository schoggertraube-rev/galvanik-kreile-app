import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  redirect: vi.fn(),
  resolveAuthorization: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: ports.redirect }));
vi.mock("@/lib/server/authorization", () => ({
  resolveAuthorization: ports.resolveAuthorization,
}));
vi.mock("@/components/home/RolfHome", () => ({
  RolfHome: ({ authorization }: { authorization: { role: string } }) => (
    <div data-testid="rolf-home">{authorization.role}</div>
  ),
}));
vi.mock("@/components/home/WerkstattHome", () => ({
  WerkstattHome: ({ authorization }: { authorization: { role: string } }) => (
    <div data-testid="werkstatt-home">{authorization.role}</div>
  ),
}));

import RootPage from "@/app/page";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => cleanup());

const authorization = (role: string) => ({
  ok: true as const,
  data: {
    userId: `user-${role}`,
    tenantId: "tenant-a",
    displayName: role,
    role,
    permissions: ["perm_view_leitstand"],
    active: true as const,
  },
});

describe("F1-R0 root route containment", () => {
  it.each(["buero", "meister", "readonly"])("renders the Rolf home for %s", async (role) => {
    ports.resolveAuthorization.mockResolvedValueOnce(authorization(role));
    render(await RootPage());
    expect(screen.getByTestId("rolf-home")).toHaveTextContent(role);
    expect(ports.redirect).not.toHaveBeenCalled();
  });

  it("renders the Phillip home for werkstatt", async () => {
    ports.resolveAuthorization.mockResolvedValueOnce(authorization("werkstatt"));
    render(await RootPage());
    expect(screen.getByTestId("werkstatt-home")).toHaveTextContent("werkstatt");
    expect(ports.redirect).not.toHaveBeenCalled();
  });

  it.each(["admin", "developer"])("redirects %s to settings", async (role) => {
    ports.resolveAuthorization.mockResolvedValueOnce(authorization(role));
    await RootPage();
    expect(ports.redirect).toHaveBeenCalledWith("/settings");
  });

  it("redirects an unauthenticated request to start", async () => {
    ports.resolveAuthorization.mockResolvedValueOnce({ ok: false, reason: "UNAUTHENTICATED" });
    ports.redirect.mockImplementationOnce(() => {
      throw new Error("NEXT_REDIRECT");
    });
    await expect(RootPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(ports.redirect).toHaveBeenCalledWith("/start");
  });

  it("contains no former demo dashboard or client-side business state", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");
    expect(source).not.toMatch(/DEMO|HomeDashboard|localStorage|useState|useEffect|getOrdersDb|\/warendurchlauf["']/);
    expect(source).toContain("resolveAuthorization");
    expect(source).toContain("<WerkstattHome");
    expect(source).toContain("<RolfHome");
  });
});
