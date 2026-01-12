# WTF-P Build & Release Methodology

## Architecture Overview

This is a **zero-build** Node.js package. No compilation, bundling, or transpilation is needed.

```
Source Files → NPM Pack → Publish → Install
    ↓              ↓          ↓        ↓
  Ready-to-use   Tarball   Registry  Claude Config
```

---

## Build System

### No Build Required
- Pure JavaScript/Markdown package
- No TypeScript, Babel, Webpack, etc.
- Source files = Distributed files

### Why This Works
```json
{
  "files": ["bin", "commands", "write-the-f-paper"],
  "bin": {
    "wtfp": "bin/install.js"
  }
}
```
NPM directly packages the source files listed in `files` array and creates symlinks for `bin` entries.

---

## Scripts Hierarchy

### 1. `npm test` → **sanity.js**
**Purpose:** Fast validation during development

**What it checks:**
- File existence (bin, commands, templates)
- Package.json structure
- Valid JavaScript in binaries
- File counts (commands, workflows)

**When to run:**
- Before committing changes
- In CI/CD on every push/PR
- Takes: ~0.5 seconds

**Output:**
```
✓ bin/install.js exists
✓ bin/uninstall.js exists
✓ 21 commands found
✓ 24 workflows found
```

### 2. `npm run preflight` → **preflight.js**
**Purpose:** Comprehensive check before publishing

**What it checks:**
- ✅ All `npm test` checks
- Executable permissions (755 on bin files)
- Git tag alignment (tag matches HEAD)
- NPM authentication status
- `npm pack --dry-run` validation
- Secret scanning in bin files and templates
- Package.json completeness
- Documentation files exist

**When to run:**
- Before `npm publish`
- After changing version
- Takes: ~5 seconds

**Output:**
```
WTF-P Preflight Check

Checking file permissions...
  ✓ bin/install.js is executable (755)

Checking git tag alignment...
  ✓ Tag v0.1.0 matches HEAD commit

Checking NPM authentication...
  ✓ Logged in as akougkas

Running npm test...
  ✓ npm test passed

========================================
✓ All checks passed! Ready to publish.

  Run: npm publish
```

### 3. `npm run release [patch|minor|major]` → **release.js**
**Purpose:** Automated version bump, tag, and push

**What it does:**
1. **Pre-flight:** Runs `preflight.js`
2. **Version bump:** Updates `package.json` and `CHANGELOG.md`
3. **Git commit:** Creates commit `chore(release): bump version to X.Y.Z`
4. **Git tag:** Creates annotated tag `vX.Y.Z`
5. **Git push:** Pushes to `origin/main` and pushes tag
6. **Instructions:** Shows next steps for publishing

**When to run:**
- After development is complete
- Ready for new release version
- Takes: ~30 seconds

**Output:**
```
==================================================
WTF-P Release Process
==================================================

==================================================
Pre-Flight Checks
==================================================

  ✓ Working tree is clean
  ✓ On main branch (main)
  ✓ Preflight checks passed

==================================================
Version Bump
==================================================

Current version: 0.1.0
New version: 0.2.0 (minor)

==================================================
Update Version
==================================================

  ✓ Updated package.json to 0.2.0
  ✓ Updated CHANGELOG.md

==================================================
Git Operations
==================================================

  ✓ Created commit: chore(release): bump version to 0.2.0
  ✓ Created tag: v0.2.0

==================================================
Push to Remote
==================================================

This will push to origin/main and push tag v0.2.0
Push to remote? [y/N]: y
  ✓ Pushed to origin/main and tag v0.2.0

==================================================
Release Complete
==================================================

  ✓ Version 0.2.0 tagged and pushed!

Next steps:

Manual publish:
  npm publish

Automated publish (GitHub Actions):
  CI/CD will automatically publish in ~2 minutes
  Monitor: https://github.com/akougkas/wtf-p/actions

To verify:
  npm view wtf-p
  npm install -g wtf-p@0.2.0
```

---

## Why We Need All Three Scripts

### sanity.js (Development)
- **Fast**: 0.5s
- **Low overhead**: No git/npm commands
- **Frequent use**: Before every commit
- **CI**: Runs on every push

### preflight.js (Pre-Publish)
- **Comprehensive**: All checks + git + auth
- **Slower**: 5s
- **Publish validation**: Before `npm publish`
- **CI**: Runs on tag push

### release.js (Release Automation)
- **Workflow automation**: Bump → Tag → Push
- **User interaction**: Confirms each step
- **One command**: Does everything needed for release
- **Dry-run mode**: Preview without executing

**They work together:**
```
release.js → calls preflight.js → calls sanity.js
```

---

## Release Workflow

### Automated (Recommended)

```bash
# Development complete
git add .
git commit -m "feat(commands): add new citation-check command"
git push

# Release
npm run release minor    # Bumps 0.1.0 → 0.2.0
# Script does everything automatically
# CI/CD publishes automatically

# Done!
```

### Manual (Step-by-Step)

```bash
# 1. Ensure clean state
git status    # Must be clean
npm run test

# 2. Update version
npm version minor    # 0.1.0 → 0.2.0
# Edit CHANGELOG.md

# 3. Commit and tag
git add package.json CHANGELOG.md
git commit -m "chore(release): bump version to 0.2.0"
git tag v0.2.0

# 4. Push
git push origin main
git push origin v0.2.0

# 5. Publish (CI/CD or manual)
npm publish    # OR let GitHub Actions do it
```

---

## Git Strategy

### Branching Model
```
main (default branch)
├── v0.1.0 (tag)
├── v0.2.0 (tag) ← HEAD
└── ...
```

**No release branches needed** - all releases go through `main`.

### Tag Format
- **Semantic versioning**: `vX.Y.Z`
- **Annotated tags**: `git tag -a v0.1.0 -m "Release v0.1.0"`
- **Push tags**: `git push origin v0.1.0`

### Commit Types (Conventional Commits)
```
feat(commands): new command
fix(cli): fix permission bug
docs(readme): update examples
test(e2e): add new test
chore(release): bump version to 0.2.0
```

---

## CI/CD Pipeline

### Triggers
```yaml
on:
  push:
    branches: [main]          # Every push → test
    tags: ['v*']             # Version tags → test + publish
  pull_request:
    branches: [main]          # PRs → test
```

### Jobs
```yaml
test:         # Runs on: main push, PR, tag
  - npm test

publish:      # Runs on: tag push only
  needs: test
  - npm publish (with NPM_TOKEN)
```

### Setup Required
1. **NPM Token**: https://www.npmjs.com/settings/akougkas/tokens
2. **GitHub Secret**: Settings → Secrets → NPM_TOKEN
3. **Token type**: Automation (not read-only, not 2FA)

---

## Versioning Strategy

### Semantic Versioning (SemVer)
```
X.Y.Z
│ └─ Patch: Bug fixes, documentation
│ └─── Minor: New features, non-breaking
└───── Major: Breaking changes
```

### Current State
```
Version: 0.1.0
Status:  Pre-release (major < 1)
Meaning: Breaking changes allowed
```

### When to Bump
| Change Type | Bump | Example |
|-------------|------|---------|
| Bug fix | patch | 0.1.0 → 0.1.1 |
| New command | minor | 0.1.0 → 0.2.0 |
| Breaking API change | major | 0.1.0 → 1.0.0 |

---

## Package Structure Verification

### What Gets Packaged
```bash
npm pack --dry-run
```

Shows all 92 files:
- LICENSE, README.md, package.json
- bin/install.js, bin/uninstall.js
- commands/wtfp/*.md (21 files)
- write-the-f-paper/**/*.md (67 files)
- write-the-f-paper/venues/*.yaml (5 files)
- write-the-f-paper/templates/config.json

**Total:** 156 KB compressed, 518 KB unpacked

### File Permissions in Tarball
```
package/bin/install.js    (755) ✓
package/bin/uninstall.js  (755) ✓
```

Permissions are preserved in tarball and applied on install.

---

## Pre-Release Checklist

### Before Release
- [ ] All tests pass: `npm test`
- [ ] Preflight passes: `npm run preflight`
- [ ] No secrets in package (preflight checks)
- [ ] CHANGELOG.md updated
- [ ] On `main` branch
- [ ] Clean working tree (`git status`)

### After Release
- [ ] Tag created and pushed
- [ ] CI/CD published to NPM
- [ ] Verify on NPM: `npm view wtf-p`
- [ ] Test install: `npm install -g wtf-p@X.Y.Z`
- [ ] Test commands: `wtfp --help`

---

## Troubleshooting

### "Tag doesn't match HEAD commit"
**Problem:** Tag points to old commit, new commits exist.

**Solution:**
```bash
# Option 1: Recreate tag
git tag -d v0.1.0
git push origin :refs/tags/v0.1.0
git tag v0.1.0
git push origin v0.1.0

# Option 2: Create new version (recommended)
npm run release patch
```

### "npm publish 401 Unauthorized"
**Problem:** Not logged in or invalid token.

**Solution:**
```bash
npm login    # Interactive
# OR
npm config set //registry.npmjs.org/:_authToken YOUR_TOKEN
```

### "Files not executable after install"
**Problem:** `bin/*.js` not 755 before packaging.

**Solution:**
```bash
chmod +x bin/*.js
git add bin/*.js
git commit -m "fix: make bin scripts executable"
```

### "npm pack includes .git files"
**Problem:** No `.npmignore` file.

**Solution:**
```bash
# Create .npmignore
cat > .npmignore << EOF
.git/
.gitignore
.planning/
.research/
node_modules/
package-lock.json
.DS_Store
EOF
```

---

## Quick Reference

### Development Commands
```bash
npm test              # Quick sanity check
npm run preflight     # Comprehensive check
npm run release patch  # Release patch version
```

### Manual Commands
```bash
npm version patch     # Bump version
git tag v0.1.0       # Create tag
git push origin v0.1.0 # Push tag
npm publish           # Publish to NPM
```

### Inspection Commands
```bash
npm pack             # Create tarball
tar -tzf *.tgz       # List tarball contents
npm view wtf-p        # View package info
npm ls wtf-p -g       # Check installed version
```

---

## Best Practices

1. **Always run `npm test` before committing**
2. **Always run `npm run preflight` before publishing**
3. **Use `npm run release` for automated version bumps**
4. **Keep CHANGELOG.md updated with each release**
5. **Monitor CI/CD on GitHub after pushing tags**
6. **Test the published version with fresh install**
7. **Use dry-run mode for preview**: `npm run release minor --dry-run`

---

## Next Steps

### For This Release (v0.1.0 → v0.2.0)
```bash
# 1. Fix current issues (tag mismatch)
# Choose one:

# Option A: Recreate v0.1.0 tag
git tag -d v0.1.0
git push origin :refs/tags/v0.1.0
git tag v0.1.0 HEAD
git push origin v0.1.0

# Option B: Bump to v0.1.1 (recommended)
npm run release patch

# Option C: Bump to v0.2.0 (since you added new features)
npm run release minor

# 2. Setup NPM token for CI/CD
# Create token at https://www.npmjs.com/settings/akougkas/tokens
# Add to GitHub: https://github.com/akougkas/wtf-p/settings/secrets/actions

# 3. Verify publish
npm view wtf-p
npm install -g wtf-p
```

### For Future Releases
```bash
# Development workflow
git add .
git commit -m "feat(commands): add new feature"
git push

# Release when ready
npm run release minor
# CI/CD handles the rest automatically
```
