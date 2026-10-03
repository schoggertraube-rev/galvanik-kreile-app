import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

describe("scaled Windows desktop contract", () => {
  it("keeps the fine-pointer shell and compact cards at 1182 CSS pixels", () => {
    const shell = read("src/components/layout/TargetShell.module.css");
    const customers = read("src/modules/customers/ui/customers.module.css");
    const orders = read("src/modules/orders/ui/orders.module.css");

    const corridor =
      "@media (min-width: 1024px) and (max-width: 1299px) and (hover: hover) and (pointer: fine)";
    expect(shell).toContain(corridor);
    expect(customers).toContain(corridor);
    expect(orders).toContain(corridor);

    expect(shell).toMatch(/\.sidebar\s*\{\s*display: block;/);
    expect(shell).toMatch(/\.mobileDock\s*\{\s*display: none;/);
    expect(customers).toContain("width: min(960px, calc(100vw - 64px));");
    expect(customers).toContain("min-height: 44px;");
    expect(orders).toContain("width: min(1020px, calc(100vw - 64px));");
    expect(orders).toContain("min-height: 44px;");
  });

  it("records the scaled desktop in the canonical route acceptance matrix", () => {
    const architecture = read("docs/project/linie/ARCHITEKTUR_MODULE_PATH1.md");

    expect(architecture).toContain("Windows-Desktop mit `125 %` Skalierung");
    expect(architecture).toContain("`1182x720` CSS-Pixeln");
    expect(architecture).toContain("Fine-Pointer-Fall");
  });
});
