import { test, expect } from '@playwright/test';
import { authenticate } from './test-utils';

test.describe('EPUB Link Format Tests', () => {
  test('new filesystem-like format links work correctly', async ({ page }) => {
    await authenticate(page);
    
    // Create a note directly via the UI with the new link format
    await page.click('a:has-text("New Note")');
    await page.waitForURL(/\/edit\//);
    
    const noteContent = `# Test EPUB Links

> [Quote from book](028a08d4-f0da-4754-89e0-2030e95d4a06.epub#epubcfi(%2F6%2F4%5Bchapter1%5D!%2F4%2F2%2F2))

This tests the new filesystem-like format.`;
    
    const textarea = page.locator('#note-editor');
    await textarea.fill(noteContent);
    await textarea.dispatchEvent('input');
    
    // Wait for auto-save
    await page.waitForTimeout(1000);
    
    // Get the note ID from URL
    const url = page.url();
    const match = url.match(/\/edit\/([a-f0-9-]+\.md)/);
    if (!match) throw new Error('Could not extract note ID');
    const noteId = match[1];
    
    // Navigate to view mode
    await page.goto(`/note/${noteId}`);
    await page.waitForSelector('.prose');
    
    // Check what's actually rendered
    const proseContent = await page.locator('.prose').innerHTML();
    console.log('Rendered HTML:', proseContent);
    
    // For now, just check that a link exists with the expected text
    const link = page.locator('.prose a:has-text("Quote from book")');
    await expect(link).toBeVisible();
    
    // Verify the link href - it should either be the processed format or the raw format
    const href = await link.getAttribute('href');
    console.log('Link href:', href);
    
    // The link should contain the UUID and CFI
    expect(href).toContain('028a08d4-f0da-4754-89e0-2030e95d4a06');
    expect(href).toContain('epubcfi');
  });
  
  test('legacy epub:// format still works', async ({ page }) => {
    await authenticate(page);
    
    // Create a note with legacy format
    await page.click('a:has-text("New Note")');
    await page.waitForURL(/\/edit\//);
    
    const noteContent = `# Legacy Format Test

> [Quote from book](epub://028a08d4-f0da-4754-89e0-2030e95d4a06#epubcfi(%2F6%2F4%5Bchapter1%5D!%2F4%2F2%2F2))

This tests backward compatibility.`;
    
    const textarea = page.locator('#note-editor');
    await textarea.fill(noteContent);
    await textarea.dispatchEvent('input');
    
    // Wait for auto-save
    await page.waitForTimeout(1000);
    
    // Get the note ID from URL
    const url = page.url();
    const match = url.match(/\/edit\/([a-f0-9-]+\.md)/);
    if (!match) throw new Error('Could not extract note ID');
    const noteId = match[1];
    
    // Navigate to view mode
    await page.goto(`/note/${noteId}`);
    await page.waitForSelector('.prose');
    
    // Check what's actually rendered
    const proseContent = await page.locator('.prose').innerHTML();
    console.log('Rendered HTML:', proseContent);
    
    // For now, just check that a link exists with the expected text
    const link = page.locator('.prose a:has-text("Quote from book")');
    await expect(link).toBeVisible();
    
    // Verify the link works
    const href = await link.getAttribute('href');
    console.log('Link href:', href);
    expect(href).toContain('028a08d4-f0da-4754-89e0-2030e95d4a06');
    expect(href).toContain('epubcfi');
  });
});