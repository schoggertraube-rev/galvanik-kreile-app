import { describe, expect, it, vi } from "vitest";
import { runWithExpectedRed } from "../../e2e/generated/_expectedRed";

describe("generated flow expected failures", () => {
  const red = { paket: "AP-TEST", grund: "isolierter Test" };

  it("reports an expected failure without failing the suite", async () => {
    const warn = vi.fn();
    await runWithExpectedRed("T01", red, async () => { throw new Error("expected"); }, warn);
    expect(warn).toHaveBeenCalledWith("EXPECTED_RED", "T01", red.paket, red.grund, expect.any(Error));
  });

  it("reports an unexpected pass without failing the suite", async () => {
    const warn = vi.fn();
    await runWithExpectedRed("T02", red, async () => {}, warn);
    expect(warn).toHaveBeenCalledWith("XPASS: Rot-Liste bereinigen", "T02", red.paket, red.grund);
  });

  it("does not suppress a failure outside the expected-red list", async () => {
    const warn = vi.fn();
    await expect(runWithExpectedRed("T03", undefined, async () => { throw new Error("must fail"); }, warn))
      .rejects.toThrow("must fail");
    expect(warn).not.toHaveBeenCalled();
  });
});
