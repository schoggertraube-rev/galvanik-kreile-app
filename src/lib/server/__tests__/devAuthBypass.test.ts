import { describe, expect, it } from "vitest";

import { allowsDevelopmentAuthBypass, resolveProxyAuthEnvironment } from "../devAuthBypass";

describe("development auth bypass", () => {
  it("requires development, an explicit flag and the explicit cookie", () => {
    expect(allowsDevelopmentAuthBypass({
      nodeEnv: "development",
      explicitFlag: "true",
      cookieValue: "true",
    })).toBe(true);
    expect(allowsDevelopmentAuthBypass({
      nodeEnv: "development",
      explicitFlag: undefined,
      cookieValue: "true",
    })).toBe(false);
    expect(allowsDevelopmentAuthBypass({
      nodeEnv: "production",
      explicitFlag: "true",
      cookieValue: "true",
    })).toBe(false);
  });

  it("does not turn missing Supabase variables into an implicit local bypass", () => {
    expect(resolveProxyAuthEnvironment({
      nodeEnv: "development",
      explicitFlag: undefined,
      cookieValue: undefined,
      supabaseUrl: undefined,
      supabaseKey: undefined,
    })).toBe("misconfigured");
    expect(resolveProxyAuthEnvironment({
      nodeEnv: "development",
      explicitFlag: "true",
      cookieValue: "true",
      supabaseUrl: undefined,
      supabaseKey: undefined,
    })).toBe("development_bypass");
  });
});
