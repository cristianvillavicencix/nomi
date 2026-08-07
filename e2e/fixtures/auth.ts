import { expect, type Page } from "@playwright/test";

export const getE2ECredentials = () => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  return { email, password };
};

export const hasE2ECredentials = () => {
  const { email, password } = getE2ECredentials();
  return Boolean(email && password);
};

export async function login(page: Page, redirectTo = "/") {
  const { email, password } = getE2ECredentials();
  if (!email || !password) {
    throw new Error(
      "Missing E2E credentials. Copy e2e/.env.example to .env.e2e.local and set E2E_EMAIL / E2E_PASSWORD.",
    );
  }

  await page.goto(`/login?redirect=${encodeURIComponent(redirectTo)}`);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).not.toHaveURL(/\/login(?:\?|$)/, { timeout: 45_000 });
}
