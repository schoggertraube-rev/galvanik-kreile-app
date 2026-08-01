import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { StartUserDto } from "@/lib/auth/userDtos";

const mockWhere = vi.fn();
const mockEq = vi.fn();
const mockInArray = vi.fn();
const mockIsNotNull = vi.fn();
const capturedUsers: StartUserDto[][] = [];

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
    tenantId: "tenant_id",
    pinHash: "pin_hash",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...conditions: unknown[]) => conditions),
  eq: mockEq,
  inArray: mockInArray,
  isNotNull: mockIsNotNull,
}));

vi.mock("@/components/start/StartScreenClient", () => ({
  StartScreenClient: ({ users }: { users: StartUserDto[] }) => {
    capturedUsers.push(users);
    return React.createElement("div", {
      "data-users": JSON.stringify(users),
    });
  },
}));

describe("StartPage payload sanitization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedUsers.length = 0;
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
    ]);

    const { default: StartPage } = await import("@/app/start/page");
    const element = await StartPage();
    const html = renderToStaticMarkup(element);
    const payload = JSON.stringify(capturedUsers.at(-1));

    expect(capturedUsers[0]).toEqual([
      {
        id: "user-1",
        fullName: "Max Mustermann",
        role: "werkstatt",
        initials: "MM",
      },
    ]);

    expect(payload).not.toContain("pinHash");
    expect(payload).not.toContain("1234");
    expect(payload).not.toContain("9999");
    expect(payload).not.toContain("password");
    expect(payload).not.toContain("authSecret");
    expect(payload).not.toContain("service-role-secret");

    expect(html).not.toContain("pinHash");
    expect(html).not.toContain("1234");
    expect(html).not.toContain("9999");
    expect(html).not.toContain("service-role-secret");

    expect(mockEq).toHaveBeenCalledWith("tenant_id", "galvanik-kreile");
    expect(mockEq).toHaveBeenCalledWith("active", true);
    expect(mockInArray).toHaveBeenCalledWith(
      "role",
      ["meister", "buero", "werkstatt", "readonly"],
    );
    expect(mockIsNotNull).toHaveBeenCalledWith("pin_hash");
  });
});
