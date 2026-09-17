import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("W4 archive route disposition", () => {
  it("keeps the retired duplicate archive page physically absent", () => {
    expect(existsSync(resolve(process.cwd(), "src/app/archive/page.tsx"))).toBe(false);
  });
});
