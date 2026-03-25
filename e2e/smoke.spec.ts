import { test, expect } from "@playwright/test";

test("homepage loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("text=Mindy Hu")).toBeVisible();
});

test("portfolio page loads", async ({ page }) => {
  await page.goto("/portfolio");
  await expect(page.locator("text=Portfolio")).toBeVisible();
});

test("about page loads", async ({ page }) => {
  await page.goto("/about");
  await expect(page.locator("text=About")).toBeVisible();
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
