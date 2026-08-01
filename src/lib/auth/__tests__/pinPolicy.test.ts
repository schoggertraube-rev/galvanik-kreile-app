import { describe, expect, it } from "vitest";
import {
  isLoginPin,
  isPinLoginRole,
  POSTGRES_BCRYPT_PATTERN,
  validateNewPin,
} from "@/lib/auth/pinPolicy";

describe("PIN policy", () => {
  it("accepts exactly four numeric digits for login transport", () => {
    expect(isLoginPin("6147")).toBe(true);
    expect(isLoginPin("61470")).toBe(false);
    expect(isLoginPin("61a7")).toBe(false);
    expect(isLoginPin(6147)).toBe(false);
  });

  it("rejects the former default and common repeated or sequential PINs", () => {
    for (const pin of ["1234", "0000", "7777", "4321", "2580"]) {
      expect(validateNewPin(pin).ok).toBe(false);
    }
  });

  it("accepts a non-trivial four-digit PIN", () => {
    expect(validateNewPin("6147")).toEqual({ ok: true, pin: "6147" });
  });

  it("allows PIN login only for operational roles", () => {
    expect(isPinLoginRole("meister")).toBe(true);
    expect(isPinLoginRole("buero")).toBe(true);
    expect(isPinLoginRole("werkstatt")).toBe(true);
    expect(isPinLoginRole("readonly")).toBe(true);
    expect(isPinLoginRole("admin")).toBe(false);
    expect(isPinLoginRole("developer")).toBe(false);
  });

  it("accepts only the PostgreSQL-generated bcrypt 2a cost-12 shape", () => {
    const pattern = new RegExp(POSTGRES_BCRYPT_PATTERN);
    const body = "A".repeat(53);

    expect(pattern.test(`$2a$12$${body}`)).toBe(true);
    expect(pattern.test(`$2b$12$${body}`)).toBe(false);
    expect(pattern.test(`$2y$12$${body}`)).toBe(false);
    expect(pattern.test(`$2a$10$${body}`)).toBe(false);
  });
});
