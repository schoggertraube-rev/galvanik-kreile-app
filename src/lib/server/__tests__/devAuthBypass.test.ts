import { describe, expect, it } from "vitest";

import { allowsDevelopmentAuthBypass } from "../devAuthBypass";

describe("allowsDevelopmentAuthBypass", () => {
  it.each(["production", "test", undefined])("rejects the bypass outside an explicit development process (%s)", (nodeEnv) => {
    expect(allowsDevelopmentAuthBypass({ nodeEnv, explicitFlag: "true", cookieValue: "true" })).toBe(false);
  });

  it("requires the explicit local flag as well as the cookie", () => {
    expect(allowsDevelopmentAuthBypass({ nodeEnv: "development", explicitFlag: undefined, cookieValue: "true" })).toBe(false);
    expect(allowsDevelopmentAuthBypass({ nodeEnv: "development", explicitFlag: "true", cookieValue: undefined })).toBe(false);
  });

  it("allows only the explicit local-development test case", () => {
    expect(allowsDevelopmentAuthBypass({ nodeEnv: "development", explicitFlag: "true", cookieValue: "true" })).toBe(true);
  });
});
