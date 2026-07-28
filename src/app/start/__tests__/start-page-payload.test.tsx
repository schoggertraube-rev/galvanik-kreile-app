import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { StartUserDto } from "@/lib/auth/userDtos";

const mockWhere = vi.fn();
const mockCreatePinLoginSelector = vi.fn();
const capturedUsers: StartUserDto[][] = [];
const capturedErrors: Array<string | null> = [];

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
    tenantId: "tenant_id",
    active: "active",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  eq: vi.fn(),
}));

vi.mock("@/lib/server/pinLoginSelector", () => ({
  createPinLoginSelector: mockCreatePinLoginSelector,
}));

vi.mock("@/components/start/StartScreenClient", () => ({
  StartScreenClient: ({ users, usersLoadError }: { users: StartUserDto[]; usersLoadError: string | null }) => {
    capturedUsers.push(users);
    capturedErrors.push(usersLoadError);
    return React.createElement("div", {
      "data-users": JSON.stringify(users),
      "data-error": usersLoadError ?? "",
    });
  },
}));

describe("StartPage payload sanitization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedUsers.length = 0;
    capturedErrors.length = 0;
    mockCreatePinLoginSelector.mockImplementation((id: string) => `opaque-selector-${id === "user-1" ? "one" : "two"}`);
  });

  it("keeps identifiers, names, PIN values, and auth secrets out of the anonymous start payload", async () => {
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
        loginSelector: "opaque-selector-one",
        initials: "MM",
        loginKind: "workshop",
      },
    ]);
    expect(capturedErrors).toEqual([null]);

    for (const forbidden of ["user-1", "Max Mustermann", "pinHash", "1234", "9999", "password", "authSecret", "service-role-secret"]) {
      expect(payload).not.toContain(forbidden);
      expect(html).not.toContain(forbidden);
    }
  });

  it("does not invent a fallback administrator when the user source is unavailable", async () => {
    mockWhere.mockRejectedValue(new Error("source unavailable"));

    const { default: StartPage } = await import("@/app/start/page");
    renderToStaticMarkup(await StartPage());

    expect(capturedUsers.at(-1)).toEqual([]);
    expect(capturedErrors.at(-1)).toMatch(/nicht geladen/i);
  });
});
