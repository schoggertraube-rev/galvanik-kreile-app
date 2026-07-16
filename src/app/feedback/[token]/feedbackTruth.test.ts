import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/app/feedback/[token]/page.tsx"), "utf8");

describe("public feedback truth boundary", () => {
  it("uses the Next 16 async route contract", () => {
    expect(source).toContain("params: Promise<{ token: string }>");
    expect(source).toContain("await params");
  });

  it("does not pretend to persist or track an unimplemented public feedback flow", () => {
    expect(source).toContain("Es wurde nichts gespeichert oder übermittelt");
    expect(source).not.toMatch(/erfolgreich übermittelt|setStep|handleSubmit|g\.page|googleClicked|textarea/i);
  });
});
