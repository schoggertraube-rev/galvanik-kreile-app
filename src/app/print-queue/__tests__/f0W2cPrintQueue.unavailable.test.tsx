import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("F0 W2C print queue route containment", () => {
  it("keeps the retired print queue page physically absent", () => {
    expect(
      existsSync(resolve(process.cwd(), "src/app/print-queue/page.tsx")),
    ).toBe(false);
  });
});
