import { test, expect } from "@playwright/test";

// Helper function to authenticate
async function authenticate(page: any) {
  // Go to login page
  await page.goto("http://localhost:3003/login");

  // Fill in password and submit
  await page.fill('input[type="password"]', "Golf1234");
  await page.click('button[type="submit"]');

  // Wait for redirect to home page
  await page.waitForURL("http://localhost:3003/");
}

test.describe("EPUB Reader", () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate before each test
    await authenticate(page);
  });

  test("reader page loads and displays library", async ({ page }) => {
    await page.goto("http://localhost:3003/reader");

    // Wait for page to load
    await page.waitForLoadState("networkidle");

    // Library section should be visible
    const library = page.locator("#library");
    await expect(library).toBeVisible();

    // Should have a heading
    const heading = page.locator('h2:has-text("Your Library")');
    await expect(heading).toBeVisible();

    // Check for book links
    const bookLinks = await page.locator('a[href^="/epub/"]').all();
    
    // The test environment has persistent EPUB files (86 books)
    // Assert that we have books and they display correctly
    expect(bookLinks.length).toBeGreaterThan(0);
    
    // Verify first book has expected structure
    if (bookLinks.length > 0) {
      const firstBook = bookLinks[0];
      const bookTitle = await firstBook.locator("h3").textContent();
      expect(bookTitle).toBeTruthy();
    }
  });

  test("navigation between notes and reader works", async ({ page }) => {
    // Start at home page (already authenticated in beforeEach)
    await page.goto("http://localhost:3003/");
    await page.waitForLoadState("networkidle");

    // Should have navigation
    const nav = page.locator("nav").first();
    await expect(nav).toBeVisible();

    // Navigate to reader
    const readerLink = page.locator('a[href="/reader"]');
    await expect(readerLink).toBeVisible();
    await readerLink.click();

    // Should be on reader page
    await page.waitForURL("**/reader");
    await expect(page).toHaveURL(/\/reader$/);

    // Library should be displayed
    const library = page.locator("#library");
    await expect(library).toBeVisible();

    // Navigate back to notes (use the first link which is the logo)
    const homeLink = page.locator('a[href="/"]').first();
    await expect(homeLink).toBeVisible();
    await homeLink.click();

    // Should be back on home page
    await page.waitForURL("**/");
    const searchInput = page.locator('input[placeholder="Search notes..."]');
    await expect(searchInput).toBeVisible();
  });

  test("epub viewer page loads when clicking a book", async ({ page }) => {
    await page.goto("http://localhost:3003/reader");
    await page.waitForLoadState("networkidle");

    // Get the first book link
    const bookLinks = await page.locator('a[href^="/epub/"]').all();
    expect(bookLinks.length).toBeGreaterThan(0);

    const firstBookHref = await bookLinks[0].getAttribute("href");
    expect(firstBookHref).toBeTruthy();

    // Click on the first book
    await bookLinks[0].click();

    // Should navigate to the epub viewer page
    await page.waitForURL(/\/epub\/[a-f0-9-]+$/);

    // Wait for the epub-reader container to exist
    const container = page.locator("#epub-reader-container");
    await expect(container).toBeVisible({ timeout: 5000 });

    // Wait for the epub-reader web component to be created and visible
    await page.waitForSelector("epub-reader", { state: "attached", timeout: 10000 });

    // Verify the epub-reader element exists
    const epubReaderExists = await page.locator("epub-reader").count();
    expect(epubReaderExists).toBeGreaterThan(0);
  });
});
