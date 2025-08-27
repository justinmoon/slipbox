import { test, expect } from '@playwright/test';
import { authenticate, createNote, waitForAutoSave } from './test-utils';
import { join } from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { mkdtemp, rm } from 'fs/promises';

test.describe('File Upload Feature', () => {
  let testDir: string;
  let testFile: string;
  let epubFile: string;
  let pdfFile: string;

  test.beforeAll(async () => {
    // Create temp directory for test files
    testDir = await mkdtemp(join(tmpdir(), 'upload-test-'));
    
    // Create test files
    testFile = join(testDir, 'test-document.txt');
    await writeFile(testFile, 'This is a test document for upload testing');
    
    epubFile = join(testDir, 'test-book.epub');
    // Create a minimal valid EPUB structure (ZIP with mimetype)
    const epubContent = Buffer.from([
      0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, // ZIP header
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x08, 0x00, 0x00, 0x00, 0x6D, 0x69,
      0x6D, 0x65, 0x74, 0x79, 0x70, 0x65, 0x61, 0x70, // "mimetype" + content
      0x70, 0x6C, 0x69, 0x63, 0x61, 0x74, 0x69, 0x6F,
      0x6E, 0x2F, 0x65, 0x70, 0x75, 0x62, 0x2B, 0x7A,
      0x69, 0x70, 0x50, 0x4B, 0x01, 0x02, 0x14, 0x00, // Central directory
      0x14, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x6D, 0x69, 0x6D, 0x65, 0x74, 0x79, 0x70, 0x65,
      0x50, 0x4B, 0x05, 0x06, 0x00, 0x00, 0x00, 0x00, // End of central directory
      0x01, 0x00, 0x01, 0x00, 0x36, 0x00, 0x00, 0x00,
      0x2E, 0x00, 0x00, 0x00, 0x00, 0x00
    ]);
    await writeFile(epubFile, epubContent);
    
    pdfFile = join(testDir, 'test-document.pdf');
    // Create a minimal PDF
    const pdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n2 0 obj\n<</Type/Pages/Count 0/Kids[]>>\nendobj\nxref\n0 3\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\ntrailer\n<</Size 3/Root 1 0 R>>\nstartxref\n108\n%%EOF');
    await writeFile(pdfFile, pdfContent);
  });

  test.afterAll(async () => {
    // Clean up test files
    await rm(testDir, { recursive: true, force: true });
  });

  test.beforeEach(async ({ page }) => {
    await authenticate(page);
  });

  test('should navigate to upload page from nav', async ({ page }) => {
    await page.goto('/');
    await page.click('a:has-text("Upload")');
    await page.waitForURL('/upload');
    
    // Verify upload form is visible
    await expect(page.locator('h2:has-text("Upload File")')).toBeVisible();
    await expect(page.locator('input[type="file"]')).toBeVisible();
    await expect(page.locator('button:has-text("Upload File")')).toBeVisible();
  });

  test('should upload a text file without note ID', async ({ page }) => {
    await page.goto('/upload');
    
    // Select file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testFile);
    
    // Submit form
    await page.click('button:has-text("Upload File")');
    
    // Check for success response (should return JSON with file info)
    await page.waitForResponse(response => 
      response.url().includes('/api/files/upload') && 
      response.status() === 200
    );
    
    // Verify we got a response (page might show the JSON or redirect)
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
  });

  test('should upload a file with note ID', async ({ page }) => {
    // First create a note to associate with
    const noteId = await createNote(page);
    
    // Navigate to upload page
    await page.goto('/upload');
    
    // Fill in the form
    await page.locator('input[type="file"]').setInputFiles(testFile);
    await page.fill('input#noteId', noteId);
    
    // Submit
    await page.click('button:has-text("Upload File")');
    
    // Wait for successful upload
    await page.waitForResponse(response => 
      response.url().includes('/api/files/upload') && 
      response.status() === 200
    );
  });

  test('should upload an EPUB file and make it available in reader', async ({ page }) => {
    // Upload EPUB file
    await page.goto('/upload');
    await page.locator('input[type="file"]').setInputFiles(epubFile);
    await page.click('button:has-text("Upload File")');
    
    // Wait for upload to complete
    const uploadResponse = await page.waitForResponse(response => 
      response.url().includes('/api/files/upload') && 
      response.status() === 200
    );
    
    const uploadData = await uploadResponse.json();
    expect(uploadData.id).toBeTruthy();
    
    // Navigate to reader page
    await page.goto('/reader');
    
    // Check if our uploaded EPUB appears in the list
    await expect(page.locator('text=test-book')).toBeVisible({ timeout: 10000 });
  });

  test('should handle upload without selecting a file', async ({ page }) => {
    await page.goto('/upload');
    
    // Try to submit without selecting a file
    await page.click('button:has-text("Upload File")');
    
    // HTML5 validation should prevent submission
    // Check that we're still on upload page
    await expect(page).toHaveURL('/upload');
    
    // The file input should show validation message (browser-specific)
    const fileInput = page.locator('input[type="file"]');
    const validationMessage = await fileInput.evaluate((el: HTMLInputElement) => el.validationMessage);
    expect(validationMessage).toBeTruthy();
  });

  test('should upload multiple file types', async ({ page }) => {
    // Test uploading PDF
    await page.goto('/upload');
    await page.locator('input[type="file"]').setInputFiles(pdfFile);
    await page.click('button:has-text("Upload File")');
    
    const pdfResponse = await page.waitForResponse(response => 
      response.url().includes('/api/files/upload') && 
      response.status() === 200
    );
    
    const pdfData = await pdfResponse.json();
    expect(pdfData.originalName).toBe('test-document.pdf');
    expect(pdfData.mimeType).toContain('pdf');
  });

  test('should handle large file names correctly', async ({ page }) => {
    // Create a file with a long name
    const longNameFile = join(testDir, 'this-is-a-very-long-file-name-that-tests-how-the-system-handles-extremely-long-filenames-in-uploads.txt');
    await writeFile(longNameFile, 'Test content');
    
    await page.goto('/upload');
    await page.locator('input[type="file"]').setInputFiles(longNameFile);
    await page.click('button:has-text("Upload File")');
    
    const response = await page.waitForResponse(response => 
      response.url().includes('/api/files/upload') && 
      response.status() === 200
    );
    
    const data = await response.json();
    expect(data.originalName).toContain('this-is-a-very-long-file-name');
  });

  test('should preserve original file extension', async ({ page }) => {
    // Create files with different extensions
    const mdFile = join(testDir, 'notes.md');
    await writeFile(mdFile, '# Test Markdown');
    
    const jsonFile = join(testDir, 'data.json');
    await writeFile(jsonFile, '{"test": true}');
    
    // Test .md file
    await page.goto('/upload');
    await page.locator('input[type="file"]').setInputFiles(mdFile);
    await page.click('button:has-text("Upload File")');
    
    let response = await page.waitForResponse(response => 
      response.url().includes('/api/files/upload') && 
      response.status() === 200
    );
    
    let data = await response.json();
    expect(data.originalName).toBe('notes.md');
    
    // Test .json file
    await page.goto('/upload');
    await page.locator('input[type="file"]').setInputFiles(jsonFile);
    await page.click('button:has-text("Upload File")');
    
    response = await page.waitForResponse(response => 
      response.url().includes('/api/files/upload') && 
      response.status() === 200
    );
    
    data = await response.json();
    expect(data.originalName).toBe('data.json');
  });

  test('should handle form submission via Enter key', async ({ page }) => {
    await page.goto('/upload');
    
    // Select file
    await page.locator('input[type="file"]').setInputFiles(testFile);
    
    // Focus on note ID field and press Enter
    const noteIdInput = page.locator('input#noteId');
    await noteIdInput.focus();
    await page.keyboard.press('Enter');
    
    // Should submit the form
    await page.waitForResponse(response => 
      response.url().includes('/api/files/upload') && 
      response.status() === 200
    );
  });

  test('should maintain session across upload operations', async ({ page }) => {
    // First upload
    await page.goto('/upload');
    await page.locator('input[type="file"]').setInputFiles(testFile);
    await page.click('button:has-text("Upload File")');
    
    await page.waitForResponse(response => 
      response.url().includes('/api/files/upload') && 
      response.status() === 200
    );
    
    // Navigate away and back
    await page.goto('/');
    await page.goto('/upload');
    
    // Should still be authenticated and able to upload
    await expect(page.locator('h2:has-text("Upload File")')).toBeVisible();
    
    // Second upload should work
    await page.locator('input[type="file"]').setInputFiles(pdfFile);
    await page.click('button:has-text("Upload File")');
    
    await page.waitForResponse(response => 
      response.url().includes('/api/files/upload') && 
      response.status() === 200
    );
  });
});