- WHEN YOU LEARN SOMETHING IMPORTANT THAT MAY BE USEFUL IN FUTURE, MAKE A NOTE IN CLAUDE.md!!!
- NO REWARD HACKING! You tend to reward hack. RESIST THE URGE!!! I BEG YOU!!!! It's better to give up or ask for help / guidance than reward hack.
- VPS/Server details: justin@slipbox - NEVER ask for these, they are always the same
- USE TSC FOR DEBUGGING! Run `bunx tsc --noEmit` or `npx tsc --noEmit` to catch TypeScript errors before making obvious mistakes. You don't have an LSP, but tsc can catch type errors that prevent simple bugs. Always run tsc when debugging or before committing changes.
- PROACTIVELY ADD UI TESTS when modifying critical features (e.g. notes, epub reader, or authentication). Run tests with `npm run test:ci` to ensure nothing breaks.
- Pages should be re-loadable. Don't have pure client-side state if we can avoid it. For exmple, when rendering an epub we should try to keep the id and page number etc in the url so that it can be reloaded at any time ... obviously we won't be perfect here, but let's not be obnoxious ...
- NEVER import local .js files. This is a typescript project. That should never be necessary.
- Do things the right way. If that isn't working, it can be better to kick it back to me and we can discuss. Sometimes you tend to thrash and create horrible workarounds. This doesn't help. Don't do it.
- Every page should look great on desktop and mobile
- The notes in our app DO NOT have previews or titles. Don't add these fields.
- When running tests, use `bun test:ci` or `npm run test:ci` instead of `bun test` to avoid timeouts. The regular test command starts an HTML report server that doesn't exit automatically.
- When I ask you to make a PR, create it using `gh pr create --fill`. After the PR is merged, run `scripts/post-pr-cleanup.sh` to clean up (delete local branch, remove worktree if present, close tmux pane if in tmux). Remember, no hacks or stupid workarounds just to get CI passing. We want code that actually works.
- No stupid workarounds or hacks to "get it working". You do this too much. We want good code that actually works.
- When writing documentation, you will be clear and concise. You will not be verbose, you will not be redundant.
- NEVER delete anything from ~/slipbox or ~/slipbox-backup-do-not-delete.
- NEVER run `rm -rf /tmp/slipbox-data-*` -- this can delete the files of other git worktrees. Only delete the specific slipbox data dir your git worktree is using.

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
test("should [action] when [condition]", async ({ page }) => {
  await authenticate(page);
  // Test implementation
});

// Use helpers for common operations
const noteId = await createNote(page);
await typeInEditor(page, "content");
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

## Testing Datastar Apps

### Test Philosophy

- **Test the Result, Not the Mechanism** - Test what users see, not SSE internals
- **UI Tests for Reactivity** - Playwright tests are best for DOM reactivity
- **Test User Workflows** - Full interactions, not individual operations

### Test Patterns for Datastar

```typescript
// Auto-save testing
await page.fill("#editor", "text");
await page.waitForSelector(':text("Saving...")');
await page.waitForSelector(':text("Saved")');

// SSE-triggered updates
await page.click("[data-on-click=\"@get('/api/data')\"]");
await page.waitForSelector('#result:has-text("Updated")');

// Navigation after actions
await page.click("#delete");
await page.waitForURL("/"); // Test the result, not the SSE executeScript
```

### What to Test

✅ DO test:

- User sees correct content after action
- Navigation works after delete/save
- Auto-save actually persists data
- Form submissions update the UI

❌ DON'T test:

- SSE event format or structure
- Datastar signal internals
- The exact mechanism of updates
- Implementation details

### Handling Async Reactivity

- Always wait for DOM changes with `waitForSelector`
- Use `waitForFunction` for complex state checks
- Avoid arbitrary `waitForTimeout` - wait for specific conditions
- Test that changes persist across page reloads

## Datastar Framework

### Core Concepts

- HTML-first reactive framework using `data-*` attributes
- Source: ~/code/datastar/library/src/
- Self-executes on load, no global object
- Three plugin types: Attribute (`data-*`), Action (`@` prefix), Watcher (SSE)

### Expression Syntax

- `$` = signals (reactive state): `$query`, `$count`
- `@` = action plugins: `@get('/api')`, `@post('/save')`
- Modifiers: `data-on-input__debounce.500ms`

### The 5 SSE Operations (Server → Client)

1. **`mergeFragments(html, {selector, mergeMode})`** - Update DOM
   - mergeModes: morph, inner, outer, prepend, append, before, after
2. **`removeFragments(selector)`** - Remove DOM elements
3. **`mergeSignals(data)`** - Update reactive state
4. **`removeSignals(paths)`** - Remove state by path
5. **`executeScript(code)`** - Run JS on client

### Version Compatibility ⚠️

**Client and SDK versions MUST match or SSE breaks!**

- We use: `@starfederation/datastar@1.0.0-beta.11` + matching SDK
- beta.11 uses `mergeFragments()` (NOT `patchElements()` - that's old)
- Check package.json for exact versions

### Common Issues

- **"GenerateExpression" errors** → Action not registered
- **SSE not updating DOM** → Version mismatch between client/SDK
- **Search not working** → Wrong method name (`patchElements` vs `mergeFragments`)
- **Navigation via SSE unreliable** → Use client-side redirect after fetch, not `executeScript`

### SSE Navigation Gotcha

**DON'T use SSE executeScript for navigation** - it's unreliable across environments:

```javascript
// ❌ BAD - Fails in CI, headless browsers, strict CSP
stream.executeScript(`window.location.href = '/';`);

// ✅ GOOD - Client controls navigation after action succeeds
fetch("/api/delete", { method: "DELETE" }).then(() => (window.location.href = "/"));
```

Why SSE navigation fails:

- SSE is for data streaming, not command execution
- Browser security contexts block or delay script execution
- CI/headless environments have stricter policies
- Timing issues with stream buffering and async processing

**Rule: Use SSE for DOM updates, use client-side JS for navigation**

## VPS Deployment (Digital Ocean Droplet)

### Server Details
- Host: slipbox (ssh justin@slipbox)
- User: justin (all services run under this account)
- OS: Ubuntu 25.04 (Linux 6.14.0)

### Deployment Strategy
- Deploy via SCP of binaries (keep it simple)
- All apps stored in: `~/apps/<app-name>`
- Services managed with systemd

### Directory Structure
```
~/apps/
└── slipbox/          # Main application
    ├── slipbox       # Binary
    └── data/         # Application data

~/.local/bin/
└── claude            # Claude Code native binary
```

### Claude Code Installation
Claude Code is installed as a native binary (no Node.js dependency):
```bash
# Install native binary
curl -fsSL https://claude.ai/install.sh | bash

# PATH configuration (added to ~/.bashrc)
export PATH="$HOME/.local/bin:$PATH"
```
- Version: 1.0.98 (as of 2025-08-30)
- Location: ~/.local/bin/claude
- Auto-updates: Built-in
- No runtime dependencies
