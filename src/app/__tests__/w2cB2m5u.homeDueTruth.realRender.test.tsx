import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({ resolve: vi.fn(), redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: boundary.redirect }));
vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization: boundary.resolve }));
vi.mock("@/components/home/RolfHome", () => ({ RolfHome: ({ authorization }: { authorization: { role: string } }) => <div>Rolf:{authorization.role}</div> }));
vi.mock("@/components/home/WerkstattHome", () => ({ WerkstattHome: () => <div>Phillip</div> }));

import RootPage from "@/app/page";

const auth = (role: string) => ({
  ok: true,
  data: { userId: "u", tenantId: "t", displayName: "Test", role, permissions: [], active: true },
});

beforeEach(() => {
  vi.clearAllMocks();
  boundary.redirect.mockImplementation((target: string) => {
    throw new Error(`REDIRECT:${target}`);
  });
});
afterEach(() => cleanup());

describe("role-aware root home", () => {
  it("routes unauthenticated users to /start", async () => {
    boundary.resolve.mockResolvedValue({ ok: false, reason: "NO_SESSION" });
    await expect(RootPage()).rejects.toThrow("REDIRECT:/start");
    expect(boundary.redirect).toHaveBeenCalledWith("/start");
  });

  it.each(["admin", "developer"])("routes %s to settings", async (role) => {
    boundary.resolve.mockResolvedValue(auth(role));
    await expect(RootPage()).rejects.toThrow("REDIRECT:/settings");
    expect(boundary.redirect).toHaveBeenCalledWith("/settings");
  });

  it("renders Phillip for werkstatt and Rolf for office/read-only roles", async () => {
    boundary.resolve.mockResolvedValue(auth("werkstatt"));
    render(await RootPage());
    expect(screen.getByText("Phillip")).toBeVisible();
    cleanup();
    for (const role of ["buero", "meister", "readonly"]) {
      boundary.resolve.mockResolvedValue(auth(role));
      render(await RootPage());
      expect(screen.getByText(`Rolf:${role}`)).toBeVisible();
      cleanup();
    }
  });

  it("fails closed for an unrecognised role without invoking a home read", async () => {
    boundary.resolve.mockResolvedValue(auth("legacy_alias"));
    render(await RootPage());
    expect(screen.getByRole("heading", { name: "Startseite nicht freigegeben" })).toBeVisible();
    expect(screen.queryByText("Phillip")).not.toBeInTheDocument();
    expect(screen.queryByText(/Rolf:/)).not.toBeInTheDocument();
  });
});
