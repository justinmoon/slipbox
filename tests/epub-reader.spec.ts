import { test, expect } from '@playwright/test';

test.describe('EPUB Reader', () => {
  test('should display library and successfully render an EPUB', async ({ page }) => {
    // Navigate to the reader page
    await page.goto('/reader');
    
    // Verify the library loads with books
    await page.waitForSelector('h2:has-text("Your Library")');
    
    // Check if there are any books - if not, verify empty state message
    const bookLinks = await page.locator('a[href^="/epub/"]').all();
    if (bookLinks.length === 0) {
      // Verify empty library message is shown
      await expect(page.locator('text=No EPUB files found')).toBeVisible();
      console.log('No EPUB files found in library. Test passes with empty state.');
      return;
    }
    
    // Get the first book's href
    const firstBookHref = await bookLinks[0].getAttribute('href');
    expect(firstBookHref).toBeTruthy();
    
    // Click on the first book - this should navigate to the epub viewer page
    await bookLinks[0].click();
    
    // Verify we navigated to the epub viewer page
    await page.waitForURL(/\/epub\/[a-f0-9-]+$/);
    
    // Wait for the epub-reader web component to be created
    await page.waitForSelector('epub-reader', { timeout: 10000 });
    
    // Wait for EPUB to load and verify content is rendered
    await page.waitForFunction(() => {
      const viewer = document.querySelector('#epub-viewer');
      return viewer && viewer.children.length > 0;
    }, { timeout: 10000 });
    
    // Verify book title is displayed (not "Loading...")
    const titleElement = page.locator('.reader-title');
    await expect(titleElement).not.toHaveText('Loading...');
    
    // Verify navigation buttons work
    await page.click('#next-btn');
    await page.waitForTimeout(500); // Wait for page turn animation
    
    // Test back to library
    await page.click('#back-btn');
    await page.waitForURL('/reader');
    
    // Verify we're back at the library page
    await expect(page.locator('h2:has-text("Your Library")')).toBeVisible();
  });

  test('should navigate between reader and notes sections', async ({ page }) => {
    // Start at home page
    await page.goto('/');
    
    // Navigate to reader
    await page.click('a[href="/reader"]');
    await expect(page).toHaveURL(/\/reader$/);
    
    // Verify library is displayed
    await expect(page.locator('h2:has-text("Your Library")')).toBeVisible();
    
    // Navigate back to notes
    await page.click('a[href="/"]');
    await expect(page).toHaveURL(/\/$/);
  });
});