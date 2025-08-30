import { expect, test } from "@playwright/test";
import { authenticate, createNote, typeInEditor, waitForAutoSave } from "./test-utils";

test.describe("Note Management", () => {
  test.beforeEach(async ({ page }) => {
    await authenticate(page);
  });

  test("should create a new note and redirect to edit page", async ({ page }) => {
    // Click New Note
    await page.click('a:has-text("New Note")');

    // Should redirect to edit page with a new note ID
    await page.waitForURL(/\/edit\/[a-f0-9-]+\.md$/);

    // Editor should be visible and focused
    const textarea = page.locator("#note-editor");
    await expect(textarea).toBeVisible();
    await expect(textarea).toBeFocused();

    // View Note button should be visible
    await expect(page.locator('a:has-text("View Note")')).toBeVisible();
  });

  test("should auto-save note content while editing", async ({ page }) => {
    // Create a new note
    const _noteId = await createNote(page);

    // Type some content
    const testContent = "This is my test note content";
    await typeInEditor(page, testContent);

    // Wait for auto-save
    await waitForAutoSave(page);

    // Navigate to view mode
    await page.click('a:has-text("View Note")');

    // Verify content was saved
    await expect(page.locator(".prose")).toContainText(testContent);
  });

  test("should handle multiple auto-saves correctly", async ({ page }) => {
    // Create a new note
    const _noteId = await createNote(page);

    // Type initial content
    await typeInEditor(page, "First version");
    await waitForAutoSave(page);

    // Update content
    await typeInEditor(page, "Second version with more text");
    await waitForAutoSave(page);

    // Final update
    await typeInEditor(page, "Final version of the note");
    await waitForAutoSave(page);

    // Navigate to view mode and verify final content
    await page.click('a:has-text("View Note")');
    await expect(page.locator(".prose")).toContainText("Final version of the note");
  });

  test("should allow editing existing notes", async ({ page }) => {
    // Create a note with initial content
    const noteId = await createNote(page);
    await typeInEditor(page, "Initial content");
    await waitForAutoSave(page);

    // Go to view mode
    await page.click('a:has-text("View Note")');

    // Click Edit button
    await page.click('a:has-text("Edit")');

    // Should be back in edit mode with existing content
    await page.waitForURL(`/edit/${noteId}`);
    const textarea = page.locator("#note-editor");
    await expect(textarea).toHaveValue("Initial content");

    // Update the content
    await textarea.fill("Updated content for the note");
    await textarea.dispatchEvent("input");
    await waitForAutoSave(page);

    // Verify update
    await page.click('a:has-text("View Note")');
    await expect(page.locator(".prose")).toContainText("Updated content for the note");
  });

  test("should delete notes successfully", async ({ page }) => {
    // Create a note
    const noteId = await createNote(page);
    await typeInEditor(page, "Note to be deleted");
    await waitForAutoSave(page);

    // Go to view mode
    await page.click('a:has-text("View Note")');

    // Set up dialog handler before clicking delete
    page.once("dialog", (dialog) => {
      expect(dialog.type()).toBe("confirm");
      dialog.accept();
    });

    // Click delete button
    await page.click('button:has-text("Delete")');

    // Should redirect to home via meta refresh
    await page.waitForURL("/", { timeout: 5000 });

    // Note should not exist anymore - trying to access it should 404
    await page.goto(`/note/${noteId}`);
    const body = await page.textContent("body");
    expect(body).toContain("Not found");
  });

  test("should show saving indicator during auto-save", async ({ page }) => {
    const _noteId = await createNote(page);

    // Type content and immediately check for saving indicator
    const textarea = page.locator("#note-editor");
    await textarea.fill("Testing save indicator");
    await textarea.dispatchEvent("input");

    // Should show "Saving..." briefly
    const savingIndicator = page.locator('#save-status:has-text("Saving...")');
    await expect(savingIndicator).toBeVisible({ timeout: 2000 });

    // Then show "Saved"
    const savedIndicator = page.locator('#save-status:has-text("Saved")');
    await expect(savedIndicator).toBeVisible({ timeout: 3000 });
  });

  test("should navigate between view and edit modes", async ({ page }) => {
    const noteId = await createNote(page);
    await typeInEditor(page, "Navigation test content");
    await waitForAutoSave(page);

    // Go to view mode
    await page.click('a:has-text("View Note")');
    await page.waitForURL(`/note/${noteId}`);
    await expect(page.locator(".prose")).toBeVisible();

    // Back to edit mode
    await page.click('a:has-text("Edit")');
    await page.waitForURL(`/edit/${noteId}`);
    await expect(page.locator("#note-editor")).toBeVisible();

    // Back to view mode again
    await page.click('a:has-text("View Note")');
    await page.waitForURL(`/note/${noteId}`);
    await expect(page.locator(".prose")).toBeVisible();
  });

  test("should handle empty notes correctly", async ({ page }) => {
    // Create a new note but don't add content
    const noteId = await createNote(page);

    // Go directly to view mode
    await page.click('a:has-text("View Note")');

    // Should show the note page (even if empty)
    await page.waitForURL(`/note/${noteId}`);
    await expect(page.locator("header")).toBeVisible();

    // Edit button should still work
    await page.click('a:has-text("Edit")');
    await page.waitForURL(`/edit/${noteId}`);
  });
});
