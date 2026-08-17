import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const denial = {
  ok: false,
  error: "NOT_AVAILABLE",
  message: "NOT_AVAILABLE: UI-Tracking benötigt den W3-Command-Vertrag.",
} as const;
const EXACT_DENIAL_MESSAGE_HEX = "4e4f545f415641494c41424c453a2055492d547261636b696e672062656ec3b6746967742064656e2057332d436f6d6d616e642d566572747261672e";

describe("W2C-B2M5I client tracking boundary fail-closed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("returns synchronously without touching browser, random, logging, or writer ports", async () => {
    const consoleSpies = [vi.spyOn(console, "log"), vi.spyOn(console, "debug"), vi.spyOn(console, "error")];
    const randomSpy = vi.spyOn(Math, "random");
    const dateSpy = vi.spyOn(globalThis, "Date");
    const { trackUiEvent } = await import("@/lib/tracking/tracking");
    const result = trackUiEvent("page_view", { route: "/adversarial" });
    expect(result).toEqual(denial);
    expect(result).not.toBeInstanceOf(Promise);
    for (const spy of [...consoleSpies, randomSpy, dateSpy]) expect(spy).not.toHaveBeenCalled();
  });

  it("keeps the function body as an inert, import-free client boundary", async () => {
    const expectedMessageBytes = Buffer.from(EXACT_DENIAL_MESSAGE_HEX, "hex");
    expect(expectedMessageBytes.toString("utf8")).toBe(denial.message);

    const sourceBytes = await readFile("src/lib/tracking/tracking.ts");
    expect(sourceBytes.includes(expectedMessageBytes)).toBe(true);

    const source = await readFile("src/lib/tracking/tracking.ts", "utf8");
    const body = source.match(/export function trackUiEvent[\s\S]*$/)?.[0] ?? "";
    expect(body).toContain("void eventName;");
    expect(body).toContain("void payload;");
    expect(body).not.toMatch(/logUiEvent|OfflineManager|console|window|crypto|Math|Date|localStorage|catch|\bEvent\b|queue/);
    expect(source).not.toMatch(/^\s*import\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["'][^"']+["']/m);
    expect(source).not.toMatch(/\brequire\s*\(/);
    expect(source).not.toMatch(/\bimport\s*\(/);
    expect(source).not.toMatch(/from\s+["']@\/app\/actions\/tracking\.actions["']/);
    expect(source).not.toMatch(/from\s+["']@\/lib\/offline\/OfflineManager["']/);
  });
});
