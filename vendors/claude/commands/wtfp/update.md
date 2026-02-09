---
name: wtfp:update
description: Check for updates and install newer version
allowed-tools:
  - Read
  - Bash
  - AskUserQuestion
---

<objective>
Check npm registry for newer version, show what changed, offer to update.
</objective>

<context>
No arguments. Checks current installed version against npm registry.
</context>

<process>

## 1. Get Current Version

Try global install first:
```bash
CURRENT=$(node -e "console.log(require('$(npm root -g)/wtf-p/package.json').version)" 2>/dev/null || echo "")
```

If empty, try local:
```bash
CURRENT=$(node -e "console.log(require('./package.json').version)" 2>/dev/null || echo "unknown")
```

If still unknown, notify user:
```
Could not determine current WTF-P version.
```

## 2. Check npm Registry

```bash
LATEST=$(npm view wtf-p version 2>/dev/null || echo "")
```

If empty:
```
Could not reach npm registry. Check your connection.
```
Exit.

## 3. Compare Versions

If CURRENT == LATEST:
```
WTF-P is up to date (v{CURRENT}).
```
Exit.

If CURRENT < LATEST, continue to show update available.

## 4. Fetch Changelog

Attempt to get changelog information:
```bash
npm view wtf-p readme 2>/dev/null | head -80
```

Or read from installed path if available:
```bash
cat $(npm root -g)/wtf-p/CHANGELOG.md 2>/dev/null | head -100
```

Extract relevant changes between current and latest versions.

## 5. Present Update Option

Use AskUserQuestion:
- header: "Update Available"
- question: "WTF-P v{CURRENT} -> v{LATEST}\n\n{changelog excerpt showing new features/fixes}"
- options:
  - "Update now"
  - "Skip for now"
  - "Show full changelog"

## 6. Handle Response

**"Update now":**
```bash
npm install -g wtf-p@latest
```

Confirm:
```
Updated to v{LATEST}. Restart your terminal for changes to take effect.
```

**"Skip for now":**
```
Update skipped. Run /wtfp:update when ready.
```
Exit.

**"Show full changelog":**
Display more changelog content, then ask again (Update now / Skip for now).

</process>

<success_criteria>
- [ ] Current and latest version compared
- [ ] Changelog diff shown when update available
- [ ] User can update or skip
- [ ] npm install -g runs on confirm
- [ ] Restart reminder shown after update
</success_criteria>
