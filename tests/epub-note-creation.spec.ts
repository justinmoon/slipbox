import { test, expect } from '@playwright/test';
import { authenticate } from './test-utils';

test.describe('EPUB Note Creation from Selection', () => {
  test('complete feature test - selection, creation, and rendering', async ({ page }) => {
    // Set up console logging for debugging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`[Browser error]:`, msg.text());
      }
    });
    
    await authenticate(page);
    
    // Test 1: Direct API call works
    // Use page.request instead of fetch inside evaluate to ensure cookies are included
    const response = await page.request.post('/api/note', {
      data: { content: 'Test note from API' }
    });
    const apiResponse = {
      ok: response.ok(),
      status: response.status(),
      data: await response.json()
    };
    
    if (!apiResponse.ok) {
      console.log('API Response failed:', apiResponse);
    }
    expect(apiResponse.ok).toBe(true);
    expect(apiResponse.data.id).toBeTruthy();
    
    // Test 2: Create note from EPUB selection
    const epubId = '028a08d4-f0da-4754-89e0-2030e95d4a06';
    await page.goto(`/epub/${epubId}`);
    
    // Wait for EPUB viewer to load
    await page.waitForSelector('#epub-viewer', { timeout: 15000 });
    await page.waitForTimeout(3000); // Let content render
    
    // Programmatically set selection and open modal
    const modalOpened = await page.evaluate(() => {
      const reader = document.querySelector('epub-reader') as any;
      if (!reader) return false;
      
      reader.selectedText = 'Test selected text from EPUB';
      reader.selectedCfi = 'epubcfi(/6/4[chapter1]!/4/2/2)';
      
      if (typeof reader.openNoteModal === 'function') {
        reader.openNoteModal();
        return true;
      }
      return false;
    });
    
    expect(modalOpened).toBe(true);
    
    // Wait for modal and verify content
    await page.waitForSelector('#note-modal', { state: 'visible' });
    const noteContent = await page.locator('#note-content').inputValue();
    expect(noteContent).toContain('> [Test selected text from EPUB]');
    expect(noteContent).toContain(`${epubId}.epub#`);
    
    // Save the note
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/api/note') && response.request().method() === 'POST'
    );
    
    await page.locator('#save-note-btn').click();
    const saveResponse = await responsePromise;
    expect(saveResponse.ok()).toBe(true);
    
    const responseData = await saveResponse.json();
    const noteId = responseData.id;
    
    // Verify modal closed and success message appeared
    await page.waitForTimeout(1000);
    const modalVisible = await page.locator('#note-modal').isVisible();
    expect(modalVisible).toBe(false);
    
    // Success message should be clickable
    const successMsg = page.locator('a:has-text("Note created successfully")');
    const successVisible = await successMsg.isVisible();
    expect(successVisible).toBe(true);
    
    const href = await successMsg.getAttribute('href');
    expect(href).toBe(`/note/${noteId}`);
    
    // Verify we stayed on EPUB page
    expect(page.url()).toContain(`/epub/${epubId}`);
    
    // Test 3: Verify the note renders without errors
    await page.goto(`/note/${noteId}`);
    await page.waitForSelector('.prose', { timeout: 5000 });
    
    // Check for rendering errors
    const errorCount = await page.locator('text="TypeError"').count();
    expect(errorCount).toBe(0);
    
    // Verify content rendered
    const blockquote = page.locator('blockquote');
    await expect(blockquote).toBeVisible();
    
    const bodyText = await page.locator('.prose').textContent();
    expect(bodyText).toBeTruthy();
  });
  
  test('keyboard shortcut (Ctrl+K) opens modal', async ({ page }) => {
    await authenticate(page);
    
    const epubId = '028a08d4-f0da-4754-89e0-2030e95d4a06';
    await page.goto(`/epub/${epubId}`);
    
    await page.waitForSelector('#epub-viewer', { timeout: 15000 });
    await page.waitForTimeout(3000);
    
    // Set up selection
    await page.evaluate(() => {
      const reader = document.querySelector('epub-reader') as any;
      if (reader) {
        reader.selectedText = 'Keyboard shortcut test';
        reader.selectedCfi = 'epubcfi(/6/4[chapter1]!/4/2/2)';
      }
    });
    
    // Press keyboard shortcut
    await page.keyboard.press('Control+K');
    await page.waitForTimeout(500);
    
    // Verify modal opened
    const modalVisible = await page.locator('#note-modal').isVisible();
    expect(modalVisible).toBe(true);
    
    // Cancel to close
    await page.locator('#cancel-note-btn').click();
    const modalHidden = await page.locator('#note-modal').isHidden();
    expect(modalHidden).toBe(true);
  });
  
  test('epub links in notes render correctly', async ({ page }) => {
    await authenticate(page);
    
    // Test both legacy epub:// format and new filesystem-like format
    const noteContent = `> [Quote from book (legacy)](epub://test-file-id#epubcfi(%2F6%2F4%5Bchapter1%5D!%2F4%2F2%2F2))

> [Quote from book (new)](028a08d4-f0da-4754-89e0-2030e95d4a06.epub#epubcfi(%2F6%2F4%5Bchapter1%5D!%2F4%2F2%2F2))

My thoughts about these quotes.`;
    
    const res = await page.request.post('/api/note', {
      data: { content: noteContent }
    });
    const response = {
      ok: res.ok(),
      data: await res.json()
    };
    
    expect(response.ok).toBe(true);
    
    // Navigate to the note and verify it renders
    await page.goto(`/note/${response.data.id}`);
    await page.waitForSelector('.prose');
    
    // No errors should appear
    const errorCount = await page.locator('text="TypeError"').count();
    expect(errorCount).toBe(0);
    
    // Content should be visible
    const blockquote = page.locator('blockquote');
    await expect(blockquote).toBeVisible();
    
    const text = await page.locator('.prose').textContent();
    expect(text).toContain('My thoughts about these quotes');
    
    // Verify both link formats rendered as proper links
    const links = page.locator('.prose a.epub-link');
    const linkCount = await links.count();
    expect(linkCount).toBe(2);
  });
});