import { test, expect } from "@playwright/test";

test("landing page loads and links to the analyzer", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Know it.s a scam/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Run a scan, no account needed/i })).toBeVisible();
});

test("analyze page loads and shows the analyzer tabs", async ({ page }) => {
  await page.goto("/analyze");

  await expect(page.getByRole("heading", { name: "Run a scan" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Message" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Job Offer" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Screenshot" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "URL" })).toBeVisible();
});

test("analyze button is disabled until text is entered", async ({ page }) => {
  await page.goto("/analyze");

  const button = page.getByRole("button", { name: "Analyze Message" });
  await expect(button).toBeDisabled();

  await page.getByPlaceholder(/Paste a suspicious text message/i).fill("Test message");
  await expect(button).toBeEnabled();
});
