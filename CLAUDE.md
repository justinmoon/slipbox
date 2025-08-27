- Pages should be re-loadable. Don't have pure client-side state if we can avoid it. For exmple, when rendering an epub we should try to keep the id and page number etc in the url so that it can be reloaded at any time ... obviously we won't be perfect here, but let's not be obnoxious ...
- NEVER import local .js files. This is a typescript project. That should never be necessary.
- Do things the right way. If that isn't working, it can be better to kick it back to me and we can discuss. Sometimes you tend to thrash and create horrible workarounds. This doesn't help. Don't do it.
- Every page should look great on desktop and mobile
- The notes in our app DO NOT have previews or titles. Don't add these fields.
- When running tests, use `bun test:ci` or `npm run test:ci` instead of `bun test` to avoid timeouts. The regular test command starts an HTML report server that doesn't exit automatically.
- When i ask you to make a PR, you can use `gh` cli tool to create the pr. once the PR is created, recursively wait like 30 seconds to see if it has passed or failed. if it passes it should auto-merge and your job is done. If it fails, look at the logs to see the reason for the failure, attempt to fix and repeat until CI passes or you want my help. Remember, now hacks or stupid workarounds just to get it passing. We want code that actually works.
- No stupid workarounds or hacks to "get it working". You do this too much. We want good code that actually works.

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
