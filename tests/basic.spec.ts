import { test, expect } from '@playwright/test';

test('basic page load', async ({ page }) => {
  const response = await page.goto('http://localhost:3003');
  console.log('Response status:', response?.status());
  
  // Check if page loads
  await expect(page).toHaveTitle(/Slipbox/);
  
  // Basic elements should exist
  await expect(page.locator('header')).toBeVisible();
  await expect(page.locator('.notes-grid')).toBeVisible();
});