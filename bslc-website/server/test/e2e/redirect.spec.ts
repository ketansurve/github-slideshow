/* The hardest constraint: login.html?redirect=<page> must send the user to
   <page> after sign-in, and the archive must bounce signed-out visitors to
   exactly login.html?redirect=document-archive.html. These run in demo mode
   (no API configured), which is what GitHub Pages serves today. */
import { test, expect, Page } from "@playwright/test";

async function demoSignIn(page: Page) {
  await page.fill("#u", "officer@bihar.gov.in");
  await page.fill("#p", "DemoPass123");
  const code = (await page.textContent("#captchaCode"))!.replace(/\s+/g, "");
  await page.fill("#c", code);
  await page.click("#sendOtpBtn");
  await expect(page.locator("#otpBlock")).toBeVisible();
  await page.fill("#otp", "123456");
  await page.click("#signInBtn");
}

test("signed-out archive visit redirects to login with redirect=document-archive.html", async ({ page }) => {
  await page.goto("document-archive.html");
  await page.waitForURL(/login\.html\?redirect=document-archive\.html$/);
  expect(new URL(page.url()).pathname).toBe("/github-slideshow/bslc-website/login.html");
});

test("signing in returns the user to document-archive.html", async ({ page }) => {
  await page.goto("document-archive.html");
  await page.waitForURL(/login\.html\?redirect=document-archive\.html$/);
  await demoSignIn(page);
  await page.waitForURL(/\/github-slideshow\/bslc-website\/document-archive\.html$/);
  await expect(page.locator("#archiveUser")).toHaveText("officer@bihar.gov.in");
  await expect(page.locator("#archiveBody tr").first()).toBeVisible();
});

test("redirect parameter to another site page is honoured", async ({ page }) => {
  await page.goto("login.html?redirect=reports.html");
  await demoSignIn(page);
  await page.waitForURL(/\/github-slideshow\/bslc-website\/reports\.html$/);
});

test("no redirect parameter defaults to document-archive.html", async ({ page }) => {
  await page.goto("login.html");
  await demoSignIn(page);
  await page.waitForURL(/\/github-slideshow\/bslc-website\/document-archive\.html$/);
});

test("Quick Demo button signs in and honours redirect", async ({ page }) => {
  await page.goto("login.html?redirect=document-archive.html");
  await page.click("#quickDemoBtn");
  await page.click("#signInBtn");
  await page.waitForURL(/document-archive\.html$/);
});

/* Added with the redirect hardening: hostile values must never leave the
   site or run script; they fall back to document-archive.html. */
for (const hostile of [
  "javascript:window.__pwned=1",
  "https://example.org/",
  "//example.org/document-archive.html",
  "/\\example.org",
]) {
  test(`hostile redirect ${JSON.stringify(hostile)} falls back to the archive`, async ({ page }) => {
    await page.goto("login.html?redirect=" + encodeURIComponent(hostile));
    await demoSignIn(page);
    await page.waitForURL(/\/github-slideshow\/bslc-website\/document-archive\.html$/);
    expect(await page.evaluate(() => (window as any).__pwned)).toBeUndefined();
  });
}
