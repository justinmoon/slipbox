import { test, expect } from '@playwright/test';
import { authenticate } from './test-utils';

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