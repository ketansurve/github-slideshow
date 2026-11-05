/* End-to-end in API mode: the same pages, with BSLC_API_BASE set, against
   the seeded test API. Checks that the login redirect contract still holds
   with real server sign-in, and that what each role sees is what the
   server allows. */
import { test, expect, Page } from "@playwright/test";
import { E2E_PASSWORD, E2E_USERS } from "./e2e-data";

async function signIn(page: Page, userId: string, password = E2E_PASSWORD) {
  await expect(page.locator("#quickDemoBtn")).toBeHidden();
  await page.fill("#u", userId);
  await page.fill("#p", password);
  const code = (await page.textContent("#captchaCode"))!.replace(/\s+/g, "");
  await page.fill("#c", code);
  const loginResp = page.waitForResponse((r) => r.url().endsWith("/auth/login"));
  await page.click("#sendOtpBtn");
  const body = await (await loginResp).json();
  expect(body.testOtp, JSON.stringify(body)).toMatch(/^\d{6}$/);
  await expect(page.locator("#otpBlock")).toBeVisible();
  await expect(page.locator("#otpSentTo")).toContainText("XXXXXX2345");
  await page.fill("#otp", body.testOtp);
  await page.click("#signInBtn");
}

test("archive → login.html?redirect=document-archive.html → back to archive after real sign-in", async ({ page }) => {
  await page.goto("document-archive.html");
  await page.waitForURL(/login\.html\?redirect=document-archive\.html$/);
  await signIn(page, E2E_USERS.officer);
  await page.waitForURL(/\/github-slideshow\/bslc-website\/document-archive\.html$/);
  await expect(page.locator("#archiveUser")).toHaveText(E2E_USERS.officer);
  const rows = page.locator("#archiveBody tr");
  await expect(rows.filter({ hasText: "E2E Restricted minutes" })).toHaveCount(1);
  await expect(rows.filter({ hasText: "E2E Public report" })).toHaveCount(1);
  // Confidential document without a grant is not even listed for this officer.
  await expect(rows.filter({ hasText: "E2E Confidential draft" })).toHaveCount(0);
  await expect(page.locator("#adminLink")).toHaveCount(0);
});

test("wrong password shows the server's error and stays on the login page", async ({ page }) => {
  await page.goto("login.html?redirect=document-archive.html");
  await page.fill("#u", E2E_USERS.citizen);
  await page.fill("#p", "not-the-password-1");
  await page.fill("#c", (await page.textContent("#captchaCode"))!.replace(/\s+/g, ""));
  await page.click("#sendOtpBtn");
  await expect(page.locator("#loginMsg")).toContainText("Invalid user ID or password");
  await expect(page.locator("#otpBlock")).toBeHidden();
  expect(page.url()).toMatch(/login\.html\?redirect=document-archive\.html$/);
});

test("a forged client-side flag does not unlock the archive", async ({ page }) => {
  await page.goto("index.html");
  await page.evaluate(() => { sessionStorage.setItem("bslc_auth", "1"); sessionStorage.setItem("bslc_token", "forged.token.value"); });
  await page.goto("document-archive.html");
  await page.waitForURL(/login\.html\?redirect=document-archive\.html$/);
});

test("hostile redirect falls back to the archive in API mode too", async ({ page }) => {
  await page.goto("login.html?redirect=" + encodeURIComponent("javascript:window.__pwned=1"));
  await signIn(page, E2E_USERS.citizen);
  await page.waitForURL(/\/github-slideshow\/bslc-website\/document-archive\.html$/);
  expect(await page.evaluate(() => (window as any).__pwned)).toBeUndefined();
});

test("admin.html → login.html?redirect=admin.html; editor uploads a document", async ({ page }) => {
  await page.goto("admin.html");
  await page.waitForURL(/login\.html\?redirect=admin\.html$/);
  await signIn(page, E2E_USERS.editor);
  await page.waitForURL(/\/github-slideshow\/bslc-website\/admin\.html$/);
  await expect(page.locator("#admUser")).toHaveText(E2E_USERS.editor);
  // Editors do not get the admin-only tabs (and the server would refuse them anyway).
  await expect(page.locator('#admNav [data-tab="users"]')).toBeHidden();

  await page.click('#admNav [data-tab="documents"]');
  await page.setInputFiles("#dFile", {
    name: "report-77.pdf", mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n"),
  });
  await page.fill("#dTitle", "Report No. 77 — uploaded in e2e");
  await page.fill("#dDate", "2026-11-01");
  await page.selectOption("#dAcc", "PUB");
  await page.click("#fUpload button");
  await expect(page.locator("#admMsg")).toContainText("Uploaded");
  await expect(page.locator("#docTable")).toContainText("Report No. 77 — uploaded in e2e");
  await expect(page.locator("#docTable")).toContainText("PENDING");

  // Disguised executable is refused by the server, and the message is shown.
  await page.setInputFiles("#dFile", { name: "invoice.pdf", mimeType: "application/pdf", buffer: Buffer.concat([Buffer.from("MZ"), Buffer.alloc(200, 0x90)]) });
  await page.fill("#dTitle", "Disguised executable");
  await page.fill("#dDate", "2026-11-01");
  await page.click("#fUpload button");
  await expect(page.locator("#admMsg")).toContainText("does not match its extension");
});

test("an OFFICIAL opening admin.html is told they have no management access", async ({ page }) => {
  await page.goto("login.html?redirect=admin.html");
  await signIn(page, E2E_USERS.officer);
  await page.waitForURL(/admin\.html$/);
  await expect(page.locator("#admRoot")).toContainText("does not have site management access");
});

test("the admin can publish a circular, and the public Notification page shows it", async ({ page }) => {
  await page.goto("login.html?redirect=admin.html");
  await signIn(page, E2E_USERS.admin);
  await page.waitForURL(/admin\.html$/);
  await page.selectOption("#cKind", "NOTIFICATION");
  await page.fill("#cRef", "Notification No. 5001");
  await page.fill("#cDate", "2026-11-04");
  await page.fill("#cTitle", "E2E Notification — new sitting calendar");
  await page.selectOption("#cStatus", "PUBLISHED");
  await page.click("#fContent button");
  await expect(page.locator("#contentTable")).toContainText("E2E Notification — new sitting calendar");

  await page.goto("notification-circular.html");
  await expect(page.locator("#contentList")).toBeVisible();
  await expect(page.locator("#contentList")).toContainText("E2E Notification — new sitting calendar");
  await expect(page.locator("#contentList")).toContainText("E2E Circular — Office timings");
  await expect(page.locator("#staticList")).toBeHidden();
});

test("public consultation: signed-out visitors are invited to sign in; the authorised officer can comment", async ({ page }) => {
  await page.goto("public-consultation.html");
  const card = page.locator(".ccard").filter({ hasText: "E2E Consultation Paper" });
  await expect(card).toContainText("Sign in to take part");
  await card.getByRole("link", { name: "Sign in to take part" }).click();
  await page.waitForURL(/login\.html\?redirect=public-consultation\.html$/);
  await signIn(page, E2E_USERS.officer);
  await page.waitForURL(/public-consultation\.html$/);
  const form = page.locator(".ccard").filter({ hasText: "E2E Consultation Paper" }).locator("form.cform");
  await form.locator("textarea").fill("Clause 3 should allow e-filing.");
  await form.locator("button").click();
  await expect(page.locator(".cthread")).toContainText("Clause 3 should allow e-filing.");
});

test("public consultation: a signed-in non-participant cannot comment", async ({ page }) => {
  await page.goto("login.html?redirect=public-consultation.html");
  await signIn(page, E2E_USERS.citizen);
  await page.waitForURL(/public-consultation\.html$/);
  const card = page.locator(".ccard").filter({ hasText: "E2E Consultation Paper" });
  await expect(card).toContainText("not on the list of authorised participants");
  await expect(card.locator("form")).toHaveCount(0);
});

test("sign-out revokes the server session", async ({ page }) => {
  await page.goto("login.html?redirect=document-archive.html");
  await signIn(page, E2E_USERS.officer);
  await page.waitForURL(/document-archive\.html$/);
  const token = await page.evaluate(() => sessionStorage.getItem("bslc_token"));
  await page.click("[data-signout]");
  await page.waitForURL(/index\.html$/);
  await expect.poll(async () => {
    const r = await page.request.get("http://localhost:8090/auth/me", { headers: { Authorization: `Bearer ${token}` } });
    return r.status();
  }).toBe(401);
});
