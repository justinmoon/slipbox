import { Page } from '@playwright/test';
import { mkdtemp, rm, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// Authentication helper
export async function authenticate(page: Page) {
  // For tests, we have two options:
  // 1. Try auto-login route (works in dev but may have issues in CI)
  try {
    await page.goto('/auto-login', { waitUntil: 'networkidle' });
    // Check if we're on home page (successful login)
    if (page.url().endsWith('/')) {
      return;
    }
  } catch (e) {
    // Auto-login failed, fall back to password login
  }
  
  // 2. Fall back to password-based login
  await page.goto('/login');
  await page.fill('input[type="password"]', 'Golf1234');
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
}

// Create test environment with temp data directory
export async function createTestEnvironment() {
  const tempDir = await mkdtemp(join(tmpdir(), 'slipbox-test-'));
  const notesDir = join(tempDir, 'notes');
  await mkdir(notesDir, { recursive: true });
  
  return {
    dataDir: tempDir,
    notesDir,
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true });
    }
  };
}

// Wait for auto-save to complete
export async function waitForAutoSave(page: Page) {
  // Wait for "Saving..." to appear
  await page.waitForSelector('#save-status:has-text("Saving...")', { state: 'visible', timeout: 5000 }).catch(() => {});
  // Then wait for "Saved" or for status to clear
  await page.waitForFunction(() => {
    const status = document.getElementById('save-status');
    return status && (status.textContent === 'Saved' || status.textContent === '');
  }, { timeout: 5000 });
}

// Helper to create a note and navigate to it
export async function createNote(page: Page): Promise<string> {
  // Click New Note in nav
  await page.click('a:has-text("New Note")');
  
  // Should redirect to edit page
  await page.waitForURL(/\/edit\//);
  
  // Extract note ID from URL
  const url = page.url();
  const match = url.match(/\/edit\/([a-f0-9-]+\.md)/);
  if (!match) throw new Error('Could not extract note ID from URL');
  
  return match[1];
}

// Helper to type in the editor with proper waits
export async function typeInEditor(page: Page, text: string) {
  const textarea = page.locator('#note-editor');
  await textarea.click();
  await textarea.fill(text);
  // Trigger input event for auto-save
  await textarea.dispatchEvent('input');
}

// Helper to delete a note
export async function deleteNote(page: Page, noteId: string) {
  // Navigate to note view
  await page.goto(`/note/${noteId}`);
  
  // Click delete button
  await page.click('button:has-text("Delete")');
  
  // Confirm deletion in dialog (if present)
  page.on('dialog', dialog => dialog.accept());
  
  // Should redirect to home
  await page.waitForURL('/');
}

// Helper to verify note content
export async function verifyNoteContent(page: Page, noteId: string, expectedContent: string) {
  await page.goto(`/note/${noteId}`);
  await page.waitForSelector('.prose');
  const content = await page.textContent('.prose');
  return content?.includes(expectedContent) ?? false;
}

// Helper to upload an EPUB file
export async function uploadEpubFile(page: Page, fileName: string): Promise<string> {
  // Navigate to upload page
  await page.goto('/upload');
  
  // Create a test EPUB file buffer (minimal valid EPUB structure)
  const testEpubContent = Buffer.from([
    0x50, 0x4B, 0x03, 0x04, // ZIP header
    // ... minimal EPUB content would go here
    // For testing purposes, we'll use the file upload with a mock file
  ]);
  
  // Set up the file input
  const fileInput = page.locator('input[type="file"]');
  
  // Create a test file path or use setInputFiles with a buffer
  // For now, we'll return a mock ID since actual EPUB upload would require a real file
  // In a real test, you'd have test EPUB files in a fixtures directory
  
  // Mock implementation - in real tests you'd upload an actual test EPUB
  // await fileInput.setInputFiles('./tests/fixtures/test.epub');
  // await page.click('button:has-text("Upload")');
  // await page.waitForURL('/reader');
  
  // Return a mock file ID for testing
  // In real implementation, you'd extract this from the response or page
  return 'test-epub-file-id';
}