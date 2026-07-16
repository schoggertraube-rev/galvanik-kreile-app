import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("legacy owner cockpit truth", () => {
  it("redirects both reachable legacy routes to the measured performance cockpit", () => {
    const cockpit = source("src/app/cockpit/page.tsx");
    const annualPlan = source("src/app/cockpit/jahresplan/page.tsx");
    expect(cockpit).toContain('redirect("/performance")');
    expect(annualPlan).toContain('redirect("/performance")');
    expect(cockpit).not.toContain("CockpitClient");
    expect(annualPlan).not.toContain("JahresplanClient");
  });

  it("routes active navigation directly to performance instead of the mixed legacy surface", () => {
    const activeNavigation = [
      "src/app/page.tsx",
      "src/app/betrieb/BetriebDashboardClient.tsx",
      "src/components/layout/MobileNav.tsx",
      "src/components/layout/RightNav.tsx",
      "src/components/layout/TabletTopFlowNav.tsx",
    ].map(source).join("\n");
    expect(activeNavigation).not.toContain('href="/cockpit"');
    expect(activeNavigation).not.toContain('href: "/cockpit"');
    expect(activeNavigation).toContain("/performance");
  });
});
