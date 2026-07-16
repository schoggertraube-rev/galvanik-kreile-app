import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.KREILE_SESSION_SECRET = "selector-test-secret-never-production";
});

describe("PIN login selector", () => {
  it("is signed, short-lived, and resolves only to the selected user", async () => {
    const { createPinLoginSelector, verifyPinLoginSelector } = await import(
      "@/lib/server/pinLoginSelector"
    );
    const now = Date.now();
    const selector = await createPinLoginSelector("user-123", now);
    expect(selector).not.toContain("user-123");
    for (const part of selector.split(".")) {
      const decoded = Buffer.from(part, "base64url").toString("utf8");
      expect(decoded).not.toContain("user-123");
      expect(decoded).not.toContain('"uid"');
    }
    await expect(verifyPinLoginSelector(selector, now + 1_000))
      .resolves.toEqual({ ok: true, userId: "user-123" });
    await expect(verifyPinLoginSelector(selector, now + 6 * 60_000))
      .resolves.toEqual({ ok: false });
  });

  it("rejects tampering", async () => {
    const { createPinLoginSelector, verifyPinLoginSelector } = await import(
      "@/lib/server/pinLoginSelector"
    );
    const selector = await createPinLoginSelector("user-123");
    await expect(verifyPinLoginSelector(`${selector}x`)).resolves.toEqual({ ok: false });
  });
});
