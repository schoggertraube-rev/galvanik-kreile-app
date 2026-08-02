import { createHmac } from "node:crypto";
import { test, expect } from "@playwright/test";

function signedAppSessionCookie(expiresAt: number): string {
  const payload = JSON.stringify({
    userId: "expired-user",
    tenantId: "galvanik-kreile",
    role: "werkstatt",
    displayName: "Abgelaufener Benutzer",
    issuedAt: expiresAt - 60_000,
    expiresAt,
  });
  const signature = createHmac(
    "sha256",
    process.env.APP_SESSION_SECRET ?? "playwright-session-secret",
  )
    .update(payload)
    .digest("hex");

  return `${Buffer.from(payload).toString("base64")}.${signature}`;
}

test.describe("Kreile auth boundary", () => {
  test("redirects anonymous access and keeps the legitimate login surface", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/start$/);
    await expect(page).toHaveTitle(/Kreile/i);
    await expect(
      page.getByRole("button", { name: "Administrator / E-Mail Login" }),
    ).toBeVisible();
    await expect(
      page.getByText("Tagesplan nach dem Einloggen prüfen."),
    ).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/Auftrag\s+[A-Z]-?\d+/i);
    await expect(
      page.getByRole("button", { name: "Tablet Test-Login (Werkstatt)" }),
    ).toHaveCount(0);
    await expect(page.getByTitle("Testanalyse aktivieren")).toHaveCount(0);
  });

  test("rejects forged legacy and app-session cookies and expires them", async ({
    context,
    page,
  }) => {
    await context.addCookies([
      {
        name: "bypass-auth",
        value: "true",
        domain: "localhost",
        path: "/",
      },
      {
        name: "kreile_role",
        value: "werkstatt",
        domain: "localhost",
        path: "/",
      },
      {
        name: "kreile_app_session",
        value: "forged",
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.goto("/");

    await expect(page).toHaveURL(/\/start$/);
    const remainingCookieNames = (await context.cookies()).map(
      (cookie) => cookie.name,
    );
    expect(remainingCookieNames).not.toContain("bypass-auth");
    expect(remainingCookieNames).not.toContain("kreile_role");
    expect(remainingCookieNames).not.toContain("kreile_app_session");

    for (const apiPath of [
      "/api/erfassung/customer-search?q=kr",
      "/api/erfassung/scan-status/forged.json",
    ]) {
      const apiResponse = await context.request.get(apiPath);
      expect(apiResponse.status()).toBe(401);
      await expect(apiResponse.json()).resolves.toEqual({
        error: "UNAUTHORIZED",
      });
    }
  });

  test("redirects a validly signed but expired session and clears legacy identity storage", async ({
    context,
    page,
  }) => {
    await page.goto("/start");
    await page.evaluate(() => {
      localStorage.setItem("kreile_user_role", "werkstatt");
      localStorage.setItem("kreile_user_initials", "MK");
    });

    await context.addCookies([
      {
        name: "kreile_app_session",
        value: signedAppSessionCookie(Date.now() - 1_000),
        domain: "localhost",
        path: "/",
        expires: Math.floor(Date.now() / 1_000) + 3_600,
      },
    ]);

    await page.goto("/");

    await expect(page).toHaveURL(/\/start$/);
    await expect.poll(async () => page.evaluate(() => [
      localStorage.getItem("kreile_user_role"),
      localStorage.getItem("kreile_user_initials"),
    ])).toEqual([null, null]);

    const remainingCookieNames = (await context.cookies()).map(
      (cookie) => cookie.name,
    );
    expect(remainingCookieNames).not.toContain("kreile_app_session");
  });
});
