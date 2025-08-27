import { expect } from '@playwright/test';
import { test } from './helpers/setup';

test.describe('Search Verification Test', () => {
  test('creates 10 notes and verifies search returns exactly 1 match', async ({ page, testContext }) => {
    console.log(`Test server running at: ${testContext.serverUrl}`);
    console.log(`Using temp directory: ${testContext.tmpDir}`);
    
    // Define 10 distinct notes - only ONE should match "unicorn"
    const testNotes = [
      { content: 'The magical unicorn galloped through the enchanted forest at dawn.', shouldMatch: true },
      { content: 'JavaScript is a versatile programming language used for web development.' },
      { content: 'The Roman Empire was one of the most powerful civilizations in ancient history.' },
      { content: 'Bitcoin uses blockchain technology to enable decentralized transactions.' },
      { content: 'Machine learning algorithms can identify patterns in large datasets.' },
      { content: 'The Pacific Ocean is the largest and deepest ocean on Earth.' },
      { content: 'Photosynthesis converts light energy into chemical energy in plants.' },
      { content: 'Jazz music originated in the African-American communities of New Orleans.' },
      { content: 'The Great Wall of China stretches over 13,000 miles across northern China.' },
      { content: 'Quantum computing uses quantum mechanics principles for computation.' }
    ];
    
    // Step 1: Create all 10 notes
    console.log('\n=== Creating 10 test notes ===');
    for (let i = 0; i < testNotes.length; i++) {
      const note = testNotes[i];
      console.log(`Creating note ${i + 1}/10: "${note.content.substring(0, 50)}..."`);
      
      // Navigate to new note page (now creates empty note and redirects to edit)
      await page.goto(`${testContext.serverUrl}/new`);
      
      // Should redirect to edit page
      await page.waitForURL(/\/edit\/[a-f0-9-]+\.md$/);
      
      // Wait for the textarea to be ready
      const textarea = page.locator('#note-editor');
      await textarea.waitFor({ state: 'visible', timeout: 5000 });
      
      // Fill in the note content
      await textarea.fill(note.content);
      
      // Trigger auto-save
      await textarea.dispatchEvent('input');
      
      // Wait for auto-save to complete
      await page.waitForTimeout(1500);
    }
    
    console.log('✅ All 10 notes created successfully\n');
    
    // Step 2: Navigate to home page
    await page.goto(testContext.serverUrl);
    await page.waitForTimeout(1000); // Let page fully load
    
    // Step 3: Verify initial state - should show notes (paginated or all)
    console.log('=== Verifying initial state ===');
    let noteCards = page.locator('#notes-grid article');
    const initialCount = await noteCards.count();
    console.log(`Initial notes displayed: ${initialCount}`);
    expect(initialCount).toBeGreaterThan(0); // Should show some notes initially
    
    // Step 4: Search for "unicorn" - should match exactly 1 note
    console.log('\n=== Testing search for "unicorn" ===');
    const searchInput = page.locator('input[placeholder="Search notes..."]');
    await searchInput.waitFor({ state: 'visible' });
    
    // Clear any existing value and type search query
    await searchInput.clear();
    await searchInput.fill('unicorn');
    console.log('Typed "unicorn" in search box');
    
    // Wait for debounce (500ms) + network request + DOM update
    // Better: wait for the DOM to actually change
    await page.waitForFunction(
      (expectedCount) => {
        const articles = document.querySelectorAll('#notes-grid article');
        // Either we get 1 result, or we get a "No notes found" message
        const noResultsMsg = document.querySelector('#notes-grid p')?.textContent?.includes('No notes found');
        return articles.length === expectedCount || noResultsMsg;
      },
      1, // expected count
      { timeout: 5000 }
    ).catch(() => {
      // If wait fails, continue to get diagnostic info
      console.log('Note: waitForFunction timed out, continuing with diagnostics');
    });
    
    // Step 5: Count search results
    noteCards = page.locator('#notes-grid article');
    const searchResultCount = await noteCards.count();
    console.log(`\n🔍 Search results found: ${searchResultCount}`);
    
    // Step 6: Verify exactly 1 result
    if (searchResultCount === 0) {
      // Check if "No notes found" message is displayed
      const gridContent = await page.locator('#notes-grid').textContent();
      console.log('Grid content:', gridContent);
      
      if (gridContent?.includes('No notes found')) {
        console.log('❌ FAIL: Search returned "No notes found" but should have found 1 match');
      } else {
        console.log('❌ FAIL: No results displayed and no error message');
      }
    } else if (searchResultCount === 1) {
      // Verify the correct note is displayed
      const noteText = await noteCards.first().locator('p').first().textContent();
      console.log(`✅ SUCCESS: Found exactly 1 note`);
      console.log(`   Content: "${noteText?.substring(0, 60)}..."`);
      
      // Verify it contains "unicorn"
      expect(noteText?.toLowerCase()).toContain('unicorn');
      console.log('   ✓ Confirmed: Result contains "unicorn"');
    } else {
      // More than 1 result - this is wrong!
      console.log(`❌ FAIL: Expected 1 result but found ${searchResultCount}`);
      
      // Log all results for debugging
      for (let i = 0; i < searchResultCount; i++) {
        const noteText = await noteCards.nth(i).locator('p').first().textContent();
        const containsUnicorn = noteText?.toLowerCase().includes('unicorn');
        console.log(`   Note ${i + 1}: "${noteText?.substring(0, 50)}..." ${containsUnicorn ? '(contains unicorn)' : '(NO unicorn!)'}`);
      }
    }
    
    // Step 7: Additional verification - search for non-existent term
    console.log('\n=== Testing search for non-existent term ===');
    await searchInput.clear();
    await searchInput.fill('xyznonexistent123');
    await page.waitForTimeout(2000);
    
    noteCards = page.locator('#notes-grid article');
    const noResultCount = await noteCards.count();
    const noResultGrid = await page.locator('#notes-grid').textContent();
    
    console.log(`Results for "xyznonexistent123": ${noResultCount}`);
    if (noResultCount === 0 && noResultGrid?.includes('No notes found')) {
      console.log('✅ Correctly shows "No notes found" for non-existent term');
    } else {
      console.log(`⚠️  Unexpected: ${noResultCount} results for non-existent term`);
    }
    
    // Step 8: Clear search and verify notes return
    console.log('\n=== Testing clear search ===');
    await searchInput.clear();
    await page.waitForTimeout(2000);
    
    noteCards = page.locator('#notes-grid article');
    const clearedCount = await noteCards.count();
    console.log(`Notes after clearing search: ${clearedCount}`);
    expect(clearedCount).toBeGreaterThan(0);
    
    // Final assertion for the main test
    expect(searchResultCount).toBe(1);
    console.log('\n✅ TEST PASSED: Search for "unicorn" returned exactly 1 result as expected');
  });
});