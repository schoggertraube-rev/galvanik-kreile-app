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

  it("matches the V5 tablet and phone geometry for dock and create trigger", () => {
    const css = readFileSync(
      join(process.cwd(), "src/components/layout/TargetShell.module.css"),
      "utf8",
    );

    expect(css).toContain(".mobileDock{position:fixed;z-index:70;left:0;right:0;bottom:0;min-height:66px");
    expect(css).toContain(".globalCreateButton{position:fixed;z-index:76;right:16px;bottom:86px;height:38px;min-height:38px;padding:0 18px");
    expect(css).toContain("@media(max-width:1299px){.globalCreateButton{right:16px;bottom:86px}");
    expect(css).toContain(".globalCreateButton{right:12px;bottom:80px}");
  });
});
