import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { StartUserDto } from "@/lib/auth/userDtos";

const mockWhere = vi.fn();
const capturedUsers: StartUserDto[][] = [];
const capturedAvailability: boolean[] = [];

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: mockWhere,
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  appUsers: {
    id: "id",
    fullName: "full_name",
    role: "role",
    active: "active",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

vi.mock("@/lib/server/pinLoginHandle", () => ({
  createPinLoginHandle: vi.fn(() => "a".repeat(43)),
}));

vi.mock("@/components/start/StartScreenClient", () => ({
  StartScreenClient: ({
    users,
    loginUnavailable,
  }: {
    users: StartUserDto[];
    loginUnavailable: boolean;
  }) => {
    capturedUsers.push(users);
    capturedAvailability.push(loginUnavailable);
    return React.createElement("div", {
      "data-users": JSON.stringify(users),
      "data-login-unavailable": String(loginUnavailable),
    });
  },
}));

describe("StartPage payload sanitization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedUsers.length = 0;
    capturedAvailability.length = 0;
  });

  it("keeps pinHash, PIN values, and auth secrets out of the anonymous start payload", async () => {
    mockWhere.mockResolvedValue([
      {
        id: "user-1",
        fullName: "Max Mustermann",
        role: "werkstatt",
        pinHash: "1234",
        password: "topsecret",
        authSecret: "service-role-secret",
      },
      {
        id: "user-2",
        fullName: "Dev Hidden",
        role: "developer",
        pinHash: "9999",
      },
    ]);

    const { default: StartPage } = await import("@/app/start/page");
    const element = await StartPage();
    const html = renderToStaticMarkup(element);
    const payload = JSON.stringify(capturedUsers.at(-1));

    expect(capturedUsers[0]).toEqual([
      {
        loginHandle: "a".repeat(43),
        initials: "MM",
        tileKind: "workshop",
      },
    ]);
    expect(capturedAvailability[0]).toBe(false);

    expect(payload).not.toContain("pinHash");
    expect(payload).not.toContain("1234");
    expect(payload).not.toContain("9999");
    expect(payload).not.toContain("password");
    expect(payload).not.toContain("authSecret");
    expect(payload).not.toContain("service-role-secret");
    expect(payload).not.toContain("user-1");
    expect(payload).not.toContain("Max Mustermann");
    expect(payload).not.toContain("werkstatt");
    expect(payload).not.toContain("fullName");
    expect(payload).not.toContain("role");
    expect(payload).not.toContain('"id"');

    expect(html).not.toContain("pinHash");
    expect(html).not.toContain("1234");
    expect(html).not.toContain("9999");
    expect(html).not.toContain("service-role-secret");
    expect(html).not.toContain("user-1");
    expect(html).not.toContain("Max Mustermann");
  });

  it("fails closed without inventing an anonymous fallback identity", async () => {
    mockWhere.mockRejectedValue(new Error("database unavailable"));

    const { default: StartPage } = await import("@/app/start/page");
    const element = await StartPage();
    const html = renderToStaticMarkup(element);

    expect(capturedUsers.at(-1)).toEqual([]);
    expect(capturedAvailability.at(-1)).toBe(true);
    expect(html).not.toContain("Fallback Admin");
  });
});
