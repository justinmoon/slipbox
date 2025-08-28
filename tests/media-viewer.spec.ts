import { test, expect, Page } from "@playwright/test";
import { authenticate } from "./test-utils";
import * as path from "path";
import * as fs from "fs";

const TEST_DATA_DIR = path.join(process.cwd(), "test-data");

async function uploadTestFile(page: Page, filename: string) {
  // Navigate to upload page
  await page.goto("/upload");

  // Upload the file
  const filePath = path.join(TEST_DATA_DIR, filename);
  await page.setInputFiles('input[type="file"]', filePath);
  await page.click('button[type="submit"]');

  // Wait for upload to complete and redirect to media page
  await page.waitForURL("/media");

  // Wait for the file to appear in the media grid
  await page.waitForSelector(`a[href="/${filename}"]`, { timeout: 10000 });
}

test.describe("Media Viewer", () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page);
  });

  test("should display and play video files", async ({ page }) => {
    const filename = "sample-video.mp4";

    // Upload test video
    await uploadTestFile(page, filename);

    // Click on the video to open viewer
    await page.click(`a[href="/${filename}"]`);
    await page.waitForURL(`/${filename}`);

    // Check video player is present
    const video = page.locator("video");
    await expect(video).toBeVisible();

    // Check video has controls
    await expect(video).toHaveAttribute("controls", "");

    // Check video source
    const videoSrc = await video.getAttribute("src");
    expect(videoSrc).toBeTruthy();

    // Check file info is displayed
    await expect(page.locator("h1")).toContainText("sample-video.mp4");
    await expect(page.locator("text=Type:")).toBeVisible();

    // Check back link works
    await page.click('a:has-text("Back to Media Library")');
    await page.waitForURL("/media");
  });

  test("should display image files", async ({ page }) => {
    const filename = "sample-image.svg";

    // Upload test image
    await uploadTestFile(page, filename);

    // Click on the image to open viewer
    await page.click(`a[href="/${filename}"]`);
    await page.waitForURL(`/${filename}`);

    // Check image is displayed
    const img = page.locator("img.viewer-image");
    await expect(img).toBeVisible();

    // Check image source
    const imgSrc = await img.getAttribute("src");
    expect(imgSrc).toBeTruthy();

    // Check file details
    await expect(page.locator("h1")).toContainText("sample-image.svg");
    await expect(page.locator("text=Size:")).toBeVisible();
  });

  test("should display and play audio files", async ({ page }) => {
    const filename = "sample-audio.mp3";

    // Upload test audio
    await uploadTestFile(page, filename);

    // Click on the audio file to open viewer
    await page.click(`a[href="/${filename}"]`);
    await page.waitForURL(`/${filename}`);

    // Check audio player is present
    const audio = page.locator("audio");
    await expect(audio).toBeVisible();

    // Check audio has controls
    await expect(audio).toHaveAttribute("controls", "");

    // Check audio icon is displayed
    await expect(page.locator(".audio-icon")).toBeVisible();
    await expect(page.locator(".audio-icon")).toContainText("🎵");

    // Check file name is displayed
    await expect(page.locator("h1")).toContainText("sample-audio.mp3");
  });

  test("should display PDF files", async ({ page }) => {
    const filename = "sample.pdf";

    // Upload test PDF
    await uploadTestFile(page, filename);

    // Click on the PDF to open viewer
    await page.click(`a[href="/${filename}"]`);
    await page.waitForURL(`/${filename}`);

    // Check PDF viewer iframe is present
    const iframe = page.locator("iframe.viewer-pdf");
    await expect(iframe).toBeVisible();

    // Check download link is present
    const downloadLink = page.locator("a.btn-download");
    await expect(downloadLink).toBeVisible();
    await expect(downloadLink).toContainText("Download PDF");

    // Check file details
    await expect(page.locator("h1")).toContainText("sample.pdf");
  });

  test("should handle EPUB files with reader link", async ({ page }) => {
    const filename = "Alice_in_Wonderland.epub";

    // Upload test EPUB if not already uploaded
    await page.goto("/media");
    const epubLink = page.locator(`a[href="/${filename}"]`);

    if (!(await epubLink.isVisible())) {
      await uploadTestFile(page, filename);
    }

    // Click on the EPUB to open viewer
    await page.click(`a[href="/${filename}"]`);
    await page.waitForURL(`/${filename}`);

    // Check EPUB icon is displayed
    await expect(page.locator(".epub-icon")).toBeVisible();
    await expect(page.locator(".epub-icon")).toContainText("📚");

    // Check "Open in Reader" button is present
    const readerButton = page.locator('a.btn-primary:has-text("Open in Reader")');
    await expect(readerButton).toBeVisible();

    // Check the button links to the correct reader URL
    const href = await readerButton.getAttribute("href");
    expect(href).toMatch(/^\/epub\/[a-f0-9-]+$/);

    // Check file details
    await expect(page.locator("h1")).toContainText("Alice_in_Wonderland.epub");
  });

  test("should navigate between media files", async ({ page }) => {
    // Upload multiple test files
    await uploadTestFile(page, "sample-image.svg");
    await uploadTestFile(page, "sample-video.mp4");

    // Open first file
    await page.click('a[href="/sample-image.svg"]');
    await page.waitForURL("/sample-image.svg");
    await expect(page.locator("img.viewer-image")).toBeVisible();

    // Go back to media library
    await page.click('a:has-text("Back to Media Library")');
    await page.waitForURL("/media");

    // Open second file
    await page.click('a[href="/sample-video.mp4"]');
    await page.waitForURL("/sample-video.mp4");
    await expect(page.locator("video")).toBeVisible();
  });

  test("should show file information correctly", async ({ page }) => {
    const filename = "sample-image.png";

    // Upload test file
    await uploadTestFile(page, filename);

    // Open the file
    await page.click(`a[href="/${filename}"]`);
    await page.waitForURL(`/${filename}`);

    // Check all file detail fields are present
    const detailsList = page.locator(".details-list");
    await expect(detailsList).toBeVisible();

    await expect(page.locator('.detail-row:has-text("Name:")')).toContainText(filename);
    await expect(page.locator('.detail-row:has-text("Size:")')).toBeVisible();
    await expect(page.locator('.detail-row:has-text("Type:")')).toBeVisible();
    await expect(page.locator('.detail-row:has-text("Modified:")')).toBeVisible();
  });

  test("should handle unsupported file types gracefully", async ({ page }) => {
    // Create a test file with unsupported extension
    const unsupportedFile = path.join(TEST_DATA_DIR, "test.xyz");
    fs.writeFileSync(unsupportedFile, "test content");

    try {
      // Upload the unsupported file
      await page.goto("/upload");
      await page.setInputFiles('input[type="file"]', unsupportedFile);
      await page.click('button[type="submit"]');
      await page.waitForURL("/media");

      // Click on the file
      await page.click('a[href="/test.xyz"]');
      await page.waitForURL("/test.xyz");

      // Check fallback UI is shown
      await expect(page.locator(".unsupported-container")).toBeVisible();
      await expect(page.locator("text=Preview not available")).toBeVisible();
      await expect(page.locator('a.btn-download:has-text("Download File")')).toBeVisible();
    } finally {
      // Clean up
      if (fs.existsSync(unsupportedFile)) {
        fs.unlinkSync(unsupportedFile);
      }
    }
  });

  test("should maintain responsive design on mobile", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    const filename = "sample-image.svg";
    await uploadTestFile(page, filename);

    // Open the file
    await page.click(`a[href="/${filename}"]`);
    await page.waitForURL(`/${filename}`);

    // Check that elements are visible and properly sized
    const mediaViewer = page.locator(".media-viewer");
    await expect(mediaViewer).toBeVisible();

    const img = page.locator("img.viewer-image");
    await expect(img).toBeVisible();

    // Check file details are still readable on mobile
    const detailRows = page.locator(".detail-row");
    const count = await detailRows.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      await expect(detailRows.nth(i)).toBeVisible();
    }
  });
});
