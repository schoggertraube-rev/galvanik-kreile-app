import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const authorization = readFileSync(resolve(process.cwd(), "src/lib/server/authorization.ts"), "utf8");
const layout = readFileSync(resolve(process.cwd(), "src/app/layout.tsx"), "utf8");
const resolver = readFileSync(resolve(process.cwd(), "src/lib/server/operatorControl.ts"), "utf8");
const notice = readFileSync(resolve(process.cwd(), "src/components/layout/OperatorControlNotice.tsx"), "utf8");
const developerAnalytics = readFileSync(resolve(process.cwd(), "src/app/actions/developerAnalytics.actions.ts"), "utf8");

describe("operator control integration", () => {
  it("enforces only verified current restrictions and preserves developer recovery access", () => {
    expect(authorization).toContain("operatorControl.enforced && operatorControl.accessRestricted");
    expect(authorization).toContain('dbRole !== "developer"');
    expect(authorization).toContain('"TENANT_SUSPENDED"');
    expect(authorization).toContain('"TENANT_MAINTENANCE"');
  });

  it("fails open for absent, invalid, scheduled, expired or unavailable control state", () => {
    expect(resolver).toContain('fallbackStatus("unavailable")');
    expect(resolver).toContain('fallbackStatus("invalid_signature"');
    expect(resolver).toContain('fallbackStatus("scheduled"');
    expect(resolver).toContain('fallbackStatus("expired"');
    expect(resolver).toContain("accessRestricted: false");
  });

  it("applies the signed plan and shows an explicit restriction instead of slowing the app", () => {
    expect(layout).toContain("<LicenseProvider plan={operatorControl?.plan}>");
    expect(layout).toContain("<OperatorRestrictedAccess status={operatorControl} />");
    expect(notice).toContain("Es wird keine künstliche Verlangsamung eingesetzt");
    expect(notice).not.toMatch(/setTimeout|sleep|spinner/i);
  });

  it("exposes only sanitized operator status in developer diagnostics", () => {
    expect(developerAnalytics).toContain("operatorControlOverview");
    expect(developerAnalytics).not.toMatch(/canonicalPayload|signature|requestDigest/);
  });
});
