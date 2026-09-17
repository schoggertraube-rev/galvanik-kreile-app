import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("W2C-B2M6 feedback route denial", () => {
  it("keeps the retired public feedback page physically absent", () => {
    expect(
      existsSync(resolve(process.cwd(), "src/app/feedback/[token]/page.tsx")),
    ).toBe(false);
  });
});
