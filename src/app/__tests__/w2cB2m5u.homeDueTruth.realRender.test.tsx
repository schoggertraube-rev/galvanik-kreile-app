import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  resolveProductActorAuthorization: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: ports.redirect }));
vi.mock("@/lib/server/productActorReadiness", () => ({
  resolveProductActorAuthorization: ports.resolveProductActorAuthorization,
}));
vi.mock("@/components/home/RolfHome", () => ({
  RolfHome: ({ authorization }: { authorization: { role: string } }) => (
    <div data-testid="rolf-home">{authorization.role}</div>
  ),
}));
vi.mock("@/components/home/WerkstattHome", () => ({
  loadWerkstattHome: vi.fn(async (authorization: { role: string }) => ({
    kind: "data" as const,
    role: authorization.role,
  })),
}));
vi.mock("@/app/warendurchlauf/WerkstattAppAdapter", () => ({
  WerkstattAppAdapter: ({ view }: { view: { role: string } }) => (
    <div data-testid="werkstatt-home">{view.role}</div>
  ),
}));

import RootPage from "@/app/page";

type ActorKey = "rolf" | "phillip" | "gregor";

function authorizationFor(key: ActorKey, gregorRole: "admin" | "developer" = "admin") {
  const role = key === "rolf" ? "meister" : key === "phillip" ? "werkstatt" : gregorRole;
  const identity = key === "rolf"
    ? { name: "Rolf" as const, responsibility: "Meister" as const, initials: "R" as const }
    : key === "phillip"
      ? { name: "Phillip" as const, responsibility: "Werkstatt" as const, initials: "P" as const }
      : { name: "Gregor" as const, responsibility: "Systemadministrator" as const, initials: "G" as const };

  return {
    ok: true as const,
    data: {
      authorization: {
        userId: `synthetic-${key}`,
        tenantId: "synthetic-tenant",
        displayName: identity.name,
        role,
        permissions: ["perm_view_leitstand"],
        active: true as const,
      },
      actor: {
        key,
        actorId: `synthetic-${key}`,
        tenantId: "synthetic-tenant",
        role,
        identity,
        login: key === "gregor" ? ("email" as const) : ("pin" as const),
      },
    },
  };
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("F1-R0 root route containment", () => {
  it("renders Rolf through the shared actor authorization choke point", async () => {
    ports.resolveProductActorAuthorization.mockResolvedValue(authorizationFor("rolf"));
    render(await RootPage());
    expect(screen.getByTestId("rolf-home")).toHaveTextContent("meister");
  });

  it("renders Phillip through the same choke point", async () => {
    ports.resolveProductActorAuthorization.mockResolvedValue(authorizationFor("phillip"));
    render(await RootPage());
    expect(screen.getByTestId("werkstatt-home")).toHaveTextContent("werkstatt");
  });

  it.each(["admin", "developer"] as const)(
    "routes the validated Gregor %s session to settings",
    async (role) => {
      ports.resolveProductActorAuthorization.mockResolvedValue(
        authorizationFor("gregor", role),
      );
      await expect(RootPage()).rejects.toThrow("REDIRECT:/settings");
    },
  );

  it("redirects a missing session to start", async () => {
    ports.resolveProductActorAuthorization.mockResolvedValue({
      ok: false,
      reason: "NO_SESSION",
      message: "not signed in",
    });
    await expect(RootPage()).rejects.toThrow("REDIRECT:/start");
  });

  it("does not start-bounce a valid session when readiness fails", async () => {
    ports.resolveProductActorAuthorization.mockResolvedValue({
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
    expect(source).not.toMatch(/DEMO|localStorage|useState|useEffect|getProductIdentity\(/);
    expect(source).toContain("resolveProductActorAuthorization");
    expect(source).toContain("loadWerkstattHome");
    expect(source).toContain("<WerkstattAppAdapter");
    expect(source).toContain("<RolfHome");
  });
});
