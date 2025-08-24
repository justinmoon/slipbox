import { test, expect } from '@playwright/test';

test.describe('Search functionality', () => {
  test('search should work correctly', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    const searchInput = page.locator('input[placeholder="Search notes..."]');
    const notesGrid = page.locator('.notes-grid');
    
    // Search input should be visible and auto-focused
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toBeFocused();
    
    // Get initial notes
    const initialFirstNote = await notesGrid.locator('.note-card-link').first().textContent();
    const initialNoteCount = await notesGrid.locator('.note-card-link').count();
    expect(initialNoteCount).toBeGreaterThan(0);
    
    // Type in search - should trigger request and update grid
    const searchRequests: string[] = [];
    page.on('request', request => {
      if (request.url().includes('/search?q=')) {
        searchRequests.push(request.url());
      }
    });
    
    await searchInput.fill('test');
    await page.waitForTimeout(500);
    
    // Should have made a search request
    expect(searchRequests.length).toBeGreaterThan(0);
    expect(searchRequests[0]).toContain('/search?q=test');
    
    // Notes grid should be updated with search results
    const searchResultCount = await notesGrid.locator('.note-card-link').count();
    const searchFirstNote = await notesGrid.locator('.note-card-link').first().textContent();
    
    // Results should be different from initial notes
    expect(searchFirstNote).not.toBe(initialFirstNote);
    
    // Clear search should restore original notes
    await searchInput.clear();
    await page.waitForTimeout(500);
    
    const restoredFirstNote = await notesGrid.locator('.note-card-link').first().textContent();
    const restoredNoteCount = await notesGrid.locator('.note-card-link').count();
    
    expect(restoredFirstNote).toBe(initialFirstNote);
    expect(restoredNoteCount).toBe(initialNoteCount);
    
    // Test no results case
    await searchInput.fill('xyznonexistentquery123');
    await page.waitForTimeout(500);
    
    const noResultsMessage = await notesGrid.textContent();
    expect(noResultsMessage).toContain('No notes found');
  });
});