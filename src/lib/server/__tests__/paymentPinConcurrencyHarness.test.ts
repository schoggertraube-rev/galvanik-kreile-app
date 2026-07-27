import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const harness = readFileSync(
  resolve(
    process.cwd(),
    "scripts/validation/payment_pin_concurrency.local.mjs",
  ),
  "utf8",
);

describe("payment and PIN local concurrency harness", () => {
  it("fails closed outside an explicit disposable loopback database", () => {
    expect(harness).toContain('KREILE_LOCAL_VALIDATION !== "1"');
    expect(harness).toContain('["127.0.0.1", "localhost", "::1"]');
    expect(harness).toContain(
      "/^kreile_payment_concurrency_[a-z0-9_]+$/",
    );
    expect(harness).toContain("ssl: false");
    expect(harness).toContain('KREILE_VALIDATION_SCOPE ?? "all"');
    expect(harness).toContain('["all", "rate-limit"]');
  });

  it("covers both quote-lock orderings and exact finalization replay", () => {
    expect(harness).toContain("verifyReservationRace");
    expect(harness).toContain("verifyPriceMutationStartsFirst");
    expect(harness).toContain("verifyReservationStartsFirst");
    expect(harness).toContain("verifyParallelFinalize");
    expect(harness).toContain("pg_blocking_pids");
    expect(harness).toContain("invoice_count");
    expect(harness).toContain("event_count");
    expect(harness).toContain("ausgangsrechnung_nummer_seq");
  });

  it("covers atomic PIN consumption, lockout and reset orderings", () => {
    expect(harness).toContain("verifyPinCounterConcurrency");
    expect(harness).toContain("consume_security_rate_limit");
    expect(harness).toContain("reset_security_rate_limit");
    expect(harness).toContain("denied PIN attempts must not overrun");
    expect(harness).toContain("PIN consume before successful-login reset");
    expect(harness).toContain("successful-login reset before PIN consume");
  });
});
