import { test, expect } from '@playwright/test';

test('basic page load', async ({ page }) => {
  const response = await page.goto('http://localhost:3003');
  console.log('Response status:', response?.status());
  
  // Check if page loads
  await expect(page).toHaveTitle(/Slipbox/);
  
  // Basic elements should exist
  await expect(page.locator('header')).toBeVisible();
  
  // Notes grid should exist in the DOM (even if empty)
  const notesGrid = await page.locator('.notes-grid, #notes-grid').count();
  expect(notesGrid).toBeGreaterThan(0);
});