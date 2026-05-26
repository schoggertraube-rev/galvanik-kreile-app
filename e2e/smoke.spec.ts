import { test, expect } from "@playwright/test";

test.describe("Kreile Galvanik Visual Overhaul Smoke Tests", () => {
  test("should load Wake Screen, input PIN, login, and verify Home + Warendurchlauf dashboards", async ({ page }) => {
    // Set bypass-auth cookie to bypass Supabase check during testing
    await page.context().addCookies([
      {
        name: "bypass-auth",
        value: "true",
        domain: "localhost",
        path: "/",
      },
    ]);

    // 1. Visit the Wake/Start Screen
    await page.goto("/start");
    await expect(page).toHaveTitle(/Kreile/i);

    // Verify background color token
    const bodyBg = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    // #F5EFE3 is rgb(245, 239, 227)
    expect(bodyBg).toBe("rgb(245, 239, 227)");

    // 2. Tap on Meister Kreile's avatar to trigger PIN sheet
    const meisterButton = page.locator("button:has-text('MK')");
    await expect(meisterButton).toBeVisible();
    await meisterButton.click();

    // Verify PIN dialog popup is visible
    const pinDialog = page.locator("text=Entsperren");
    await expect(pinDialog).toBeVisible();

    // Type valid PIN "1234" using our Numpad buttons
    for (const num of ["1", "2", "3", "4"]) {
      const numBtn = page.locator(`button:has-text('${num}')`).first();
      await numBtn.click();
    }

    // 3. Verify landing on Home/Tagesablauf dashboard (/)
    await page.waitForURL("**/");
    await expect(page.locator("text=Tagesablauf auf einen Blick")).toBeVisible();

    // Verify the 5 KPI Cards are rendered
    await expect(page.locator("text=So läuft's heute")).toBeVisible();
    await expect(page.locator("text=Offene Anfragen")).toBeVisible();

    // 4. Navigate to Warendurchlauf page via Bottom Nav or direct URL
    await page.goto("/warendurchlauf");
    await expect(page.locator("text=Neue Annahme erfassen")).toBeVisible();

    // Verify the Process Visual Hero components
    await expect(page.locator("text=Wareneingang")).toBeVisible();
    await expect(page.locator("text=Galvanik")).toBeVisible();
    await expect(page.locator("text=Warenausgang")).toBeVisible();

    // Verify Tipp-Banner is clickable and opens the 3-step slider instructions modal
    const infoButton = page.locator("button:has-text(\"So funktioniert's\")");
    await expect(infoButton).toBeVisible();
    await infoButton.click();
    await expect(page.locator("text=So funktioniert der OCR-Scan")).toBeVisible();
  });
});
