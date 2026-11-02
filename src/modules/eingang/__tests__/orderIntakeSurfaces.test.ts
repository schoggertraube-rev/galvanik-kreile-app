import { describe, expect, it } from "vitest";

import { orderIntakeSurfaceKey, orderIntakeSurfaceLabel } from "../orderIntakeSurfaces";

describe("order intake surface contract", () => {
  it.each([
    ["Verchromen", "verchromen"],
    ["Vernickeln", "vernickeln"],
    ["Verzinken", "verzinken"],
    ["Entchromen / prÃ¼fen", "entchromen_pruefen"],
    ["noch zu klÃ¤ren", "offen"],
  ])("stores %s as %s and renders the label again", (label, key) => {
    expect(orderIntakeSurfaceKey(label)).toBe(key);
    expect(orderIntakeSurfaceLabel(key)).toBe(label);
  });

  it("preserves a catalog surface outside the fixed intake options", () => {
    expect(orderIntakeSurfaceKey("Glanzverchromen")).toBe("Glanzverchromen");
    expect(orderIntakeSurfaceLabel("Glanzverchromen")).toBe("Glanzverchromen");
  });
});
