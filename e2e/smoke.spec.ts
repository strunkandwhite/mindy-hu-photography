import { test, expect } from "@playwright/test";

test("homepage loads with MINDY HU nav", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.locator("nav").getByText("MINDY HU")).toBeVisible();
});

test("/portfolio redirects to homepage", async ({ page }) => {
  await page.goto("/portfolio");
  await expect(page).toHaveURL(/\/$/);
});

test("/galleries loads", async ({ page }) => {
  const response = await page.goto("/galleries");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("contact page loads", async ({ page }) => {
  await page.goto("/contact");
  await expect(page.getByRole("heading", { name: /get in touch|contact/i })).toBeVisible();
});

test("admin redirects to login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("login page loads", async ({ page }) => {
  await page.goto("/admin/login");
  await expect(page.getByRole("heading", { name: "Admin Login" })).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
});
