import { describe, expect, it } from "vitest";

import { canUsePinLoginRole } from "@/lib/auth/authorizationContract";

describe("canUsePinLoginRole", () => {
  it("returns false for developer", () => {
    expect(canUsePinLoginRole("developer")).toBe(false);
  });

  it("returns true for a PIN-login-capable role", () => {
    expect(canUsePinLoginRole("werkstatt")).toBe(true);
  });
});
