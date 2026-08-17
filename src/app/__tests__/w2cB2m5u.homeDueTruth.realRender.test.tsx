import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ redirect }));

import RootPage from "@/app/page";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("F1-R0 root route containment", () => {
  it("redirects to the real operational entry point", () => {
    RootPage();
    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith("/warendurchlauf");
  });

  it("contains no former demo dashboard or client-side business state", () => {
    const source = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");
    expect(source).not.toMatch(/DEMO|HomeDashboard|localStorage|useState|useEffect|getOrdersDb/);
  });
});
