import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/app/api/operator/control/route.ts"), "utf8");

describe("operator control ingress boundary", () => {
  it("authenticates before reading a bounded strict body", () => {
    expect(source.indexOf("authenticateIngress(request)")).toBeGreaterThan(-1);
    expect(source.indexOf("readUtf8BodyWithinLimit(request")).toBeGreaterThan(source.indexOf("authenticateIngress(request)"));
    expect(source).not.toContain("request.text()");
    expect(source).toContain("timingSafeEqual");
    expect(source).toContain("16 * 1024");
    expect(source).toContain("parseOperatorControlEnvelope");
  });

  it("requires a valid signature and never implements covert slowdown or remote code", () => {
    expect(source).toContain("verifyOperatorControlSignature");
    expect(source).not.toMatch(/setTimeout|sleep|eval\(|new Function|child_process|shell/i);
    expect(source).not.toMatch(/mode\s*===?\s*["']slow/i);
  });

  it("serializes versions and writes an append-only audit event before current state", () => {
    expect(source).toContain("pg_advisory_xact_lock");
    expect(source).toContain("STALE_POLICY_VERSION");
    expect(source).toContain("POLICY_VERSION_CONFLICT");
    expect(source.indexOf("tx.insert(operatorControlEvents)")).toBeLessThan(source.indexOf("tx.update(tenantOperatorControls)"));
    expect(source).toContain("OPERATOR_CONTROL_AUDIT_RECEIPT_MISSING");
    expect(source).toContain("OPERATOR_CONTROL_UPDATE_RECEIPT_MISSING");
  });
});
