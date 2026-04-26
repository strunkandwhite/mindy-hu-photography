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

test("/people loads", async ({ page }) => {
  const response = await page.goto("/people");
  expect(response?.status()).toBe(200);
});

test("/places loads", async ({ page }) => {
  const response = await page.goto("/places");
  expect(response?.status()).toBe(200);
});

test("/prints loads", async ({ page }) => {
  const response = await page.goto("/prints");
  expect(response?.status()).toBe(200);
});

test("contact page loads", async ({ page }) => {
  await page.goto("/contact");
  await expect(page.locator("text=Contact")).toBeVisible();
});

test("admin redirects to login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("login page loads", async ({ page }) => {
  await page.goto("/admin/login");
  await expect(page.locator("text=Admin")).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
});
