import { test, expect } from "@playwright/test";

test.describe("Kreile auth boundary", () => {
  test("redirects anonymous access and keeps the legitimate login surface", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/start$/);
    await expect(page).toHaveTitle(/Kreile/i);
    await expect(
      page.getByRole("button", { name: "Administrator / E-Mail Login" }),
    ).toBeVisible();
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
});
