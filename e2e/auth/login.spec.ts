import { test, expect } from "@playwright/test";
import { hasE2ECredentials, login } from "../fixtures/auth";

test.describe("Authentication", () => {
  test("shows the sign-in page for unauthenticated users", async ({ page }) => {
    await page.goto("/leads");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("rejects invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("not-a-real-user@example.com");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/login/);
  });

  test("signs in with valid credentials", async ({ page }) => {
    test.skip(!hasE2ECredentials(), "Set E2E_EMAIL/E2E_PASSWORD in .env.e2e.local");

    await login(page, "/");
    await expect(page.getByRole("navigation")).toBeVisible({ timeout: 15_000 });
  });
});
