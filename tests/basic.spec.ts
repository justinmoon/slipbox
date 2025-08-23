import { test, expect } from '@playwright/test';

test('basic page load', async ({ page }) => {
  const response = await page.goto('http://localhost:3000');
  console.log('Response status:', response?.status());
  
  // Check if page loads
  await expect(page).toHaveTitle(/Slipbox/);
  
  // Check if search button exists
  const searchButton = page.locator('#search-button');
  await expect(searchButton).toBeVisible();
  
  // Check if search container exists
  const searchContainer = page.locator('#search-container');
  const exists = await searchContainer.count() > 0;
  console.log('Search container exists:', exists);
  
  // Check initial state
  const isVisible = await searchContainer.isVisible();
  console.log('Search container initially visible:', isVisible);
});