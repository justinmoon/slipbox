- PROACTIVELY ADD UI TESTS when modifying critical features like notes, epub reader, or authentication. Run tests with `npm run test:ci` to ensure nothing breaks.
- Pages should be re-loadable. Don't have pure client-side state if we can avoid it. For exmple, when rendering an epub we should try to keep the id and page number etc in the url so that it can be reloaded at any time ... obviously we won't be perfect here, but let's not be obnoxious ...
- NEVER import local .js files. This is a typescript project. That should never be necessary.
- Do things the right way. If that isn't working, it can be better to kick it back to me and we can discuss. Sometimes you tend to thrash and create horrible workarounds. This doesn't help. Don't do it.
- Every page should look great on desktop and mobile
- The notes in our app DO NOT have previews or titles. Don't add these fields.
- When running tests, use `bun test:ci` or `npm run test:ci` instead of `bun test` to avoid timeouts. The regular test command starts an HTML report server that doesn't exit automatically.
- When i ask you to make a PR, you can use `gh` cli tool to create the pr. once the PR is created, recursively wait like 30 seconds to see if it has passed or failed. if it passes it should auto-merge and your job is done. If it fails, look at the logs to see the reason for the failure, attempt to fix and repeat until CI passes or you want my help. Remember, now hacks or stupid workarounds just to get it passing. We want code that actually works. once the pr has been merged: if you are in a git worktree and a tmux session, delete the worktree, git branch and tmux window that claude code is running from.
- No stupid workarounds or hacks to "get it working". You do this too much. We want good code that actually works.
- As you go, take notes in CLAUDE.md about the datastar dependency. You have trouble with this dependency, so please instruct your future self on how to use it by taking excellent notes in CLAUDE.md- As you go, take notes in CLAUDE.md about the datastar dependency. You have trouble with this dependency, so please instruct your future self on how to use it by taking excellent notes in CLAUDE.md.

## UI Testing

### Writing UI Tests
- Use Playwright for all UI tests
- Test files go in `/tests/*.spec.ts`
- Use test utilities from `/tests/test-utils.ts` for common operations
- Always authenticate first using `authenticate(page)`
- Use descriptive test names that explain what is being tested

### Test Patterns
```typescript
// Basic test structure
test('should [action] when [condition]', async ({ page }) => {
  await authenticate(page);
  // Test implementation
});

// Use helpers for common operations
const noteId = await createNote(page);
await typeInEditor(page, 'content');
await waitForAutoSave(page);
```

### Running Tests
- Local: `bun test` or `npm test`
- CI: `bun test:ci` or `npm run test:ci` (avoids HTML server)
- Tests run HEADLESS by default (no browser windows)
- Use `--debug` flag only when debugging (opens browser)
- Use `--headed` to see browser during normal test runs

### Important Test Coverage
YOU MUST proactively add tests when:
- Creating or modifying core features (notes, epub reader, file uploads)
- Changing authentication or navigation flows
- Modifying data persistence logic
- Adding new UI interactions

Always test:
1. Happy path - feature works as expected
2. Edge cases - empty states, errors
3. User workflows - multi-step processes
