import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.UI_BASE_URL ?? "http://127.0.0.1:5555";
const brokenPatterns = ["\uFFFD", "??", "횄", "횂", "횖", "횗", "횠", "횧", "횩", "챨", "첸"];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function joinUrl(route) {
  return new URL(route, `${baseUrl}/`).toString();
}

async function assertCleanBody(page, route, expectedText) {
  await page.goto(joinUrl(route), { waitUntil: "networkidle" });
  const text = await page.locator("body").innerText();

  for (const pattern of brokenPatterns) {
    assert(!text.includes(pattern), `Broken text pattern "${pattern}" found on ${route}`);
  }

  assert(!text.includes("Something went wrong"), `Error banner found on ${route}`);
  assert(!text.includes("Item not found"), `Not found banner found on ${route}`);

  if (expectedText) {
    assert(text.includes(expectedText), `Expected text "${expectedText}" missing on ${route}`);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const consoleIssues = [];
  const pageErrors = [];

  const watchPage = (page, label) => {
    page.on("console", (message) => {
      const type = message.type();
      if (type === "warning" || type === "error") {
        consoleIssues.push(`${label}:${type}:${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      pageErrors.push(`${label}:${error.message}`);
    });
  };

  try {
    const anonymousContext = await browser.newContext();
    const anonymousPage = await anonymousContext.newPage();
    watchPage(anonymousPage, "anonymous");
    await anonymousPage.goto(joinUrl("/files"), { waitUntil: "networkidle" });
    await anonymousPage.waitForURL(/\/login(\?|$)/, { timeout: 5000 });
    await anonymousContext.close();

    const context = await browser.newContext();
    await context.addInitScript(() => {
      window.localStorage.setItem("ui.appearance.locale", "en-US");
      window.localStorage.setItem("ui.appearance.theme", "dark");
    });

    const page = await context.newPage();
    watchPage(page, "fixture");

    const fixtureRoutes = [
      ["/login?visualFixtures=1", null],
      ["/setup?visualFixtures=1", null],
      ["/search?visualFixtures=1", null],
      ["/files?visualFixtures=1", null],
      ["/media?visualFixtures=1", null],
      ["/trash?visualFixtures=1", null],
      ["/admin?visualFixtures=1", null],
      ["/admin/storage?visualFixtures=1", null],
      ["/admin/users?visualFixtures=1", null],
      ["/admin/security?visualFixtures=1", null],
      ["/admin/performance?visualFixtures=1", null],
      ["/admin/appearance?visualFixtures=1", null],
      ["/admin/migration?visualFixtures=1", null],
    ];

    for (const [route, expectedText] of fixtureRoutes) {
      await assertCleanBody(page, route, expectedText);
    }

    await page.goto(joinUrl("/files?visualFixtures=1"), { waitUntil: "networkidle" });
    await page.getByRole("banner").getByRole("button", { name: /^New folder$/i }).click();
    const folderNameInput = page.locator("#create-folder-form").getByLabel("Name");
    await folderNameInput.fill("");
    await folderNameInput.type("Focus Stable Folder", { delay: 35 });
    await expectStableValue(folderNameInput, "Focus Stable Folder");
    await page.locator(".nd-dialog__actions").getByRole("button", { name: /^New folder$/i }).click();
    await page.waitForTimeout(400);
    assert((await page.locator("body").innerText()).includes("Focus Stable Folder"), "Created folder missing after submit");

    await page.locator("tr", { hasText: "Design Library" }).locator(".files-page__open-trigger").click();
    await page.waitForURL(/\/files\/11111111-1111-1111-1111-111111111111/);
    await page.locator(".app-shell__breadcrumbs").filter({ hasText: "Design Library" }).waitFor({ timeout: 5000 });
    const breadcrumbText = await page.locator(".app-shell__breadcrumbs").innerText();
    assert(breadcrumbText.includes("Design Library"), "Breadcrumb did not reflect the opened folder");
    await page.locator(".breadcrumbs__link").first().click();
    await page.waitForURL(/\/files(\?|$)/);

    const tempDir = await mkdtemp(path.join(os.tmpdir(), "bento-upload-"));
    const uploadPath = path.join(tempDir, "bento-upload-check.txt");
    await writeFile(uploadPath, "fixture upload verification", "utf8");

    try {
      await page.locator('input[type="file"]').setInputFiles(uploadPath);
      await page.waitForFunction(
        (filename) => document.body.innerText.includes(filename),
        "bento-upload-check.txt",
        { timeout: 8000 },
      );
      const filesText = await page.locator("body").innerText();
      assert(filesText.includes("bento-upload-check.txt"), "Uploaded file did not appear in files page");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }

    assert((await page.locator(".app-shell__inspector").count()) === 0, "Inspector should be hidden before selection");
    await page.locator(".files-page__row-button", { hasText: "Brand-Demo.mp4" }).first().click();
    await page.locator(".app-shell__inspector").waitFor({ timeout: 5000 });

    await page.goto(joinUrl("/media?visualFixtures=1"), { waitUntil: "networkidle" });
    const mediaText = await page.locator("body").innerText();
    assert(!mediaText.includes("Weekly-Report.pdf"), "Media page should exclude non-media files");
    await page.locator(".media-page__card-button", { hasText: "Brand-Demo.mp4" }).first().click();
    await page.locator(".media-page__preview-title").waitFor({ timeout: 5000 });
    await page.locator(".media-page__preview-media").waitFor({ timeout: 5000 });
    const previewTitle = await page.locator(".media-page__preview-title").innerText();
    assert(previewTitle.includes("Brand-Demo.mp4"), "Video preview title did not load");
    assert((await page.locator(".media-page__preview-media").count()) > 0, "Video preview media element missing");

    await page.goto(joinUrl("/admin/appearance?visualFixtures=1"), { waitUntil: "networkidle" });
    const darkBefore = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    assert(darkBefore, "Theme should start in dark mode");
    const themeOptions = page.locator(".admin-appearance__segmented").nth(1);
    await themeOptions.locator("button").nth(1).click();
    await page.waitForTimeout(200);
    const darkAfter = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    assert(!darkAfter, "Theme preview did not apply immediately");
    await themeOptions.locator("button").nth(2).click();
    await page.waitForTimeout(200);
    const darkRestored = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    assert(darkRestored, "Dark theme did not restore immediately");

    await page.goto(joinUrl("/admin/storage?visualFixtures=1"), { waitUntil: "networkidle" });
    await page.locator('input[placeholder="/mnt/storage"]').first().fill("/mnt/new-volume");
    await page.getByRole("button", { name: /Validate path/i }).first().click();
    await page.waitForTimeout(500);
    await page.locator('input[placeholder="Main"]').fill("backup-volume");
    await page.locator('input[placeholder="/mnt/storage"]').nth(1).fill("/mnt/bento-backup");
    await page.getByRole("button", { name: /Create volume/i }).first().click();
    await page.waitForTimeout(700);
    await page.getByRole("button", { name: /Main volume/i }).first().click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /Deactivate/i }).first().click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /backup-volume/i }).first().click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /Activate volume/i }).first().click();
    await page.waitForTimeout(500);

    const storageText = await page.locator("body").innerText();
    assert(storageText.includes("1.0 TB"), "Storage page does not show 1.0 TB");
    assert(!storageText.includes("2.0 TB"), "Storage page still shows incorrect 2.0 TB");
    assert(storageText.includes("Volume created."), "Storage create success copy missing");

    await page.goto(joinUrl("/files"), { waitUntil: "networkidle" });
    await page.waitForURL(/\/login(\?|$)/, { timeout: 5000 });

    assert(pageErrors.length === 0, `Unhandled page errors found:\n${pageErrors.join("\n")}`);
    assert(consoleIssues.length === 0, `Unexpected console issues found:\n${consoleIssues.join("\n")}`);

    console.log("ok: runtime-browser-audit");
    await context.close();
  } finally {
    await browser.close();
  }
}

async function expectStableValue(locator, expectedValue) {
  const value = await locator.inputValue();
  assert(value === expectedValue, `Input value mismatch. Expected "${expectedValue}", got "${value}"`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
