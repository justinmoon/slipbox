import { test, expect } from '@playwright/test';

// Helper function to authenticate
async function authenticate(page: any) {
  // Go to login page
  await page.goto('http://localhost:3003/login');
  
  // Fill in password and submit
  await page.fill('input[type="password"]', 'Golf1234');
  await page.click('button[type="submit"]');
  
  // Wait for redirect to home page
  await page.waitForURL('http://localhost:3003/');
}

test('basic page load', async ({ page }) => {
  // First authenticate
  await authenticate(page);
  
  // Check if page loads
  await expect(page).toHaveTitle(/Slipbox/);
  
  // Basic elements should exist
  await expect(page.locator('header')).toBeVisible();
  
  // Notes grid should exist in the DOM (even if empty)
  const notesGrid = await page.locator('.notes-grid, #notes-grid').count();
  expect(notesGrid).toBeGreaterThan(0);
});