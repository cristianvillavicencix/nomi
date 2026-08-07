import { test, expect } from "@playwright/test";
import { hasE2ECredentials, login } from "../fixtures/auth";

test.describe("Leads pipeline", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2ECredentials(), "Set E2E_EMAIL/E2E_PASSWORD in .env.e2e.local");
    await login(page, "/leads");
  });

  test("loads the leads list with table and board views", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible();
    await expect(
      page.getByPlaceholder(/search leads by name, company, or email/i),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "New lead" })).toBeVisible();

    await expect(page.getByRole("button", { name: "List view" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Board view" })).toBeVisible();
  });

  test("switches to the kanban board and shows pipeline columns", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Board view" }).click();

    await expect(page.getByRole("heading", { name: "New", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Contacted" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Talking" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Quoted" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Closing" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Paused" })).toBeVisible();
  });

  test("filters to my leads", async ({ page }) => {
    const myLeadsToggle = page.getByRole("button", { name: /all|my leads/i });
    await expect(myLeadsToggle).toBeVisible();
    await myLeadsToggle.click();
    await expect(page.getByRole("button", { name: "My leads" })).toBeVisible();
  });
});
