import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("TargetShell mobile scroll contract", () => {
  it("keeps long role pages vertically reachable above the fixed mobile controls", () => {
    const css = readFileSync(
      join(process.cwd(), "src/components/layout/TargetShell.module.css"),
      "utf8",
    );

    expect(css).toMatch(/\.content\{overflow-x:hidden;overflow-y:auto\}/);
    expect(css).toMatch(
      /@media\(max-width:1023px\)\{\.content\{[^}]*scroll-padding-bottom:calc\(126px \+ env\(safe-area-inset-bottom\)\)[^}]*touch-action:pan-y[^}]*-webkit-overflow-scrolling:touch[^}]*\}\.page\{padding-bottom:calc\(126px \+ env\(safe-area-inset-bottom\)\)\}/,
    );
    expect(css).toContain(".workshop .page{padding-bottom:0}");
  });
});
