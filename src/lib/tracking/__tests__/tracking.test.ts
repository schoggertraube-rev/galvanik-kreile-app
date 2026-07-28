import { describe, expect, it, vi } from "vitest";

import { trackUiEvent } from "../tracking";

describe("tracking unavailable adapter", () => {
  it("does not persist or transmit the supplied payload", () => {
    const setItem = vi.fn();
    const originalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { setItem } });

    expect(() => trackUiEvent("page_view", { route: "/orders" })).not.toThrow();
    expect(setItem).not.toHaveBeenCalled();

    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: originalStorage });
  });
});
