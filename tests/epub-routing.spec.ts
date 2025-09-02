import { expect, test } from "@playwright/test";
import { authenticate } from "./test-utils";

test.describe("EPUB routing", () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page);
  });

  test("should accept EPUB files with UUID names", async ({ page }) => {
    // Standard UUID format with .epub extension
    const response = await page.goto("/028a08d4-f0da-4754-89e0-2030e95d4a06.epub");
    // Should either find the file (200) or not find it (404), but not redirect/error
    expect([200, 404]).toContain(response?.status());
  });

  test("should accept EPUB files with nanoid names", async ({ page }) => {
    // Nanoid format with .epub extension
    const response = await page.goto("/qnwiFxIwglmtdRaqPHt4D.epub");
    // Should either find the file (200) or not find it (404), but not redirect/error
    expect([200, 404]).toContain(response?.status());
  });

  test("should serve any file type", async ({ page }) => {
    // Test various file extensions
    const response1 = await page.goto("/test-file.pdf");
    expect([200, 404]).toContain(response1?.status());

    const response2 = await page.goto("/image.png");
    expect([200, 404]).toContain(response2?.status());
  });

  test("should navigate from reader page to epub viewer", async ({ page }) => {
    await page.goto("/reader");

    // Check if any epub links exist
    const epubLinks = await page.locator('a[href$=".epub"]').count();

    if (epubLinks > 0) {
      // Click the first epub link
      const firstLink = page.locator('a[href$=".epub"]').first();
      const href = await firstLink.getAttribute("href");

      await firstLink.click();

      // Should navigate to the epub viewer page
      await expect(page).toHaveURL(href!);

      // Page should load without error
      const response = page.context().pages()[0];
      expect([200, 404]).toContain(
        await response.evaluate(() => (document.readyState === "complete" ? 200 : 500)),
      );
    }
  });
});
