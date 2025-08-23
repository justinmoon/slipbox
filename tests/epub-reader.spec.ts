import { test, expect } from '@playwright/test';

test.describe('EPUB Reader', () => {
  test('should display library and successfully render an EPUB', async ({ page }) => {
    // Navigate to the reader page
    await page.goto('/reader');
    
    // Verify the library loads with expected books
    await page.waitForSelector('.book-card');
    const books = await page.locator('.book-card').all();
    expect(books.length).toBeGreaterThan(0);
    
    // Verify expected books are present
    const bookTitles = await page.locator('.book-card h3').allTextContents();
    expect(bookTitles).toContain('Alice_in_Wonderland');
    expect(bookTitles).toContain('Frankenstein');
    expect(bookTitles).toContain('Pride_and_Prejudice');
    
    // Click on the first book
    await page.locator('.book-card').first().click();
    
    // Verify reader is displayed
    await expect(page.locator('#reader')).toBeVisible();
    await expect(page.locator('#library')).toHaveClass(/hidden/);
    
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
    await expect(page.locator('#library')).toBeVisible();
    await expect(page.locator('#reader')).toHaveClass(/hidden/);
  });

  test('should navigate between reader and notes sections', async ({ page }) => {
    // Start at home page
    await page.goto('/');
    
    // Navigate to reader
    await page.click('a[href="/reader"]');
    await expect(page).toHaveURL(/\/reader$/);
    
    // Verify library is displayed
    await expect(page.locator('.library-view')).toBeVisible();
    
    // Navigate back to notes
    await page.click('a[href="/"]');
    await expect(page).toHaveURL(/\/$/);
  });
});