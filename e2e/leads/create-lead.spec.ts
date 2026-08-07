import { test, expect } from "@playwright/test";
import { hasE2ECredentials, login } from "../fixtures/auth";

test.describe("Create lead", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2ECredentials(), "Set E2E_EMAIL/E2E_PASSWORD in .env.e2e.local");
    await login(page, "/leads");
  });

  test("opens the new lead dialog from the toolbar", async ({ page }) => {
    await page.getByRole("button", { name: "New lead" }).click();

    await expect(page.getByRole("heading", { name: "New lead" })).toBeVisible();
    await expect(
      page.getByText(/new prospect for the pipeline/i),
    ).toBeVisible();
    await expect(page.getByLabel("First name")).toBeVisible();
  });

  test("creates a lead and navigates to the detail view", async ({ page }) => {
    const stamp = Date.now();
    const firstName = `E2E Lead ${stamp}`;
    const lastName = "Playwright";

    await page.getByRole("button", { name: "New lead" }).click();
    await page.getByLabel("First name").fill(firstName);
    await page.getByLabel("Last name").fill(lastName);
    await page.getByRole("button", { name: "Create lead" }).click();

    await expect(page).toHaveURL(/\/leads\/\d+\/show/, { timeout: 30_000 });
    await expect(page.getByText(firstName)).toBeVisible({ timeout: 15_000 });
  });
});
