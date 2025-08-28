import { test, expect } from '@playwright/test';

test('debug specific EPUB link rendering issue', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('input[type="password"]', 'Golf1234');
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
  
  // Create a note with the exact content that's causing issues
  await page.click('a:has-text("New Note")');
  await page.waitForURL(/\/edit\//);
  
  const noteContent = `is it there?

> [Units of measure: The units reported in this book are the units used in the primary source material.](f3e9ec9b-1dec-4c2a-a96a-00915731eb23.epub#epubcfi(%2F6%2F16!%2F4%2F2%2F58au_note%5D%2C%2F6%2F2%2F2%2F1%3A0%2C%2F8%2F1%3A0))`;
  
  console.log('=== CREATING NOTE WITH CONTENT ===');
  console.log(noteContent);
  console.log('=== END CONTENT ===');
  
  const textarea = page.locator('#note-editor');
  await textarea.fill(noteContent);
  await textarea.dispatchEvent('input');
  
  // Wait for auto-save
  await page.waitForTimeout(2000);
  
  // Get the note ID
  const url = page.url();
  const match = url.match(/\/edit\/([a-f0-9-]+\.md)/);
  if (!match) throw new Error('Could not extract note ID');
  const noteId = match[1];
  console.log('Created note ID:', noteId);
  
  // Navigate to view mode
  console.log('Navigating to view mode...');
  await page.goto(`/note/${noteId}`);
  await page.waitForSelector('.prose', { state: 'attached' }); // Don't wait for visible, just attached
  
  // Wait a bit for rendering
  await page.waitForTimeout(1000);
  
  // Check what's rendered
  const proseHTML = await page.locator('.prose').innerHTML();
  console.log('=== RENDERED HTML ===');
  console.log(proseHTML);
  console.log('=== END HTML ===');
  
  // Check for blockquote
  const blockquoteExists = await page.locator('.prose blockquote').isVisible();
  console.log('Blockquote visible:', blockquoteExists);
  
  if (blockquoteExists) {
    const blockquoteHTML = await page.locator('.prose blockquote').innerHTML();
    console.log('Blockquote content:', blockquoteHTML);
    
    // Check if link exists inside blockquote
    const linkInBlockquote = await page.locator('.prose blockquote a').count();
    console.log('Links in blockquote:', linkInBlockquote);
    
    if (linkInBlockquote > 0) {
      const linkHref = await page.locator('.prose blockquote a').first().getAttribute('href');
      const linkText = await page.locator('.prose blockquote a').first().textContent();
      console.log('Link href:', linkHref);
      console.log('Link text:', linkText);
      
      // Check if it's been processed correctly
      if (linkHref?.startsWith('/epub/')) {
        console.log('✅ Link was processed by custom renderer');
      } else if (linkHref?.endsWith('.epub#epubcfi')) {
        console.log('❌ Link was NOT processed - still raw format');
      }
      
      // Check for epub-link class
      const hasEpubClass = await page.locator('.prose blockquote a.epub-link').count() > 0;
      console.log('Has epub-link class:', hasEpubClass);
    }
  }
  
  // Verify something is visible
  const visibleText = await page.locator('.prose').textContent();
  expect(visibleText).toContain('Units of measure');
});