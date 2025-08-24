import { test, expect } from '@playwright/test';

test.describe('Search functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3002');
  });

  test('should display notes on homepage', async ({ page }) => {
    // Check that notes are visible
    const notesGrid = page.locator('.notes-grid');
    await expect(notesGrid).toBeVisible();
    
    // Check that at least one note is displayed
    const noteCards = page.locator('.notes-grid article');
    const count = await noteCards.count();
    expect(count).toBeGreaterThan(0);
    
    // Check that note content is visible (not just dates)
    const firstNoteContent = noteCards.first().locator('p');
    const content = await firstNoteContent.textContent();
    console.log('First note content:', content);
    expect(content).toBeTruthy();
    expect(content?.length).toBeGreaterThan(0);
  });

  test('should have working search input', async ({ page }) => {
    // Find search input
    const searchInput = page.locator('input[placeholder="Search notes..."]');
    await expect(searchInput).toBeVisible();
    
    // Check if datastar attributes are present
    const dataBind = await searchInput.getAttribute('data-bind');
    const dataOnInput = await searchInput.getAttribute('data-on-input.debounce_500ms');
    
    console.log('data-bind:', dataBind);
    console.log('data-on-input:', dataOnInput);
    
    expect(dataBind).toBe('query');
    expect(dataOnInput).toContain('@get');
  });

  test('should update results when searching', async ({ page }) => {
    // Initial note count
    const initialNotes = await page.locator('.notes-grid article').count();
    console.log('Initial notes count:', initialNotes);
    
    // Type in search
    const searchInput = page.locator('input[placeholder="Search notes..."]');
    await searchInput.fill('rome');
    
    // Wait for potential network request
    await page.waitForTimeout(1000);
    
    // Check if SSE endpoint was called
    const responses: any[] = [];
    page.on('response', response => {
      if (response.url().includes('/search')) {
        responses.push({
          url: response.url(),
          status: response.status(),
          headers: response.headers()
        });
      }
    });
    
    // Clear and search again to trigger request
    await searchInput.fill('');
    await page.waitForTimeout(600);
    await searchInput.fill('rome');
    await page.waitForTimeout(1000);
    
    console.log('Search responses:', responses);
    
    // Check if notes changed
    const searchNotes = await page.locator('.notes-grid article').count();
    console.log('Notes after search:', searchNotes);
    
    // Check if any note contains "rome"
    const noteContents = await page.locator('.notes-grid article p').allTextContents();
    console.log('Note contents:', noteContents);
    
    const hasRomeContent = noteContents.some(content => 
      content.toLowerCase().includes('rome')
    );
    
    if (searchNotes > 0) {
      expect(hasRomeContent).toBeTruthy();
    }
  });

  test('should check if datastar is loaded', async ({ page }) => {
    // Check if datastar script is loaded
    const datastarLoaded = await page.evaluate(() => {
      return typeof (window as any).datastar !== 'undefined';
    });
    
    console.log('Datastar loaded:', datastarLoaded);
    
    // Check for datastar on page
    const scripts = await page.locator('script[src*="datastar"]').count();
    console.log('Datastar script tags:', scripts);
    expect(scripts).toBeGreaterThan(0);
  });

  test('should intercept and log network requests', async ({ page }) => {
    const requests: any[] = [];
    
    page.on('request', request => {
      if (request.url().includes('/search')) {
        requests.push({
          url: request.url(),
          method: request.method(),
          headers: request.headers()
        });
      }
    });
    
    page.on('response', async response => {
      if (response.url().includes('/search')) {
        const body = await response.text().catch(() => 'Could not get body');
        console.log('Search response:', {
          url: response.url(),
          status: response.status(),
          contentType: response.headers()['content-type'],
          bodyPreview: body.substring(0, 500)
        });
      }
    });
    
    // Go to page and search
    await page.goto('http://localhost:3002');
    const searchInput = page.locator('input[placeholder="Search notes..."]');
    await searchInput.fill('rome');
    await page.waitForTimeout(1000);
    
    console.log('Search requests made:', requests);
  });
});