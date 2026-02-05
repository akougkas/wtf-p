WTF-P v0.5.0 Release Quality Test Plan

  Critical Question: Did I Test npm Install?

  No. I verified:
  - ✓ Code exists and is wired correctly
  - ✓ 646 tests pass
  - ✓ install.js has the logic

  I did NOT verify:
  - ✗ npm install -g wtf-p actually works
  - ✗ Upgrading from v0.4.0 works
  - ✗ Uninstall cleans up properly
  - ✗ Multi-runtime flags work end-to-end

  This is a gap. Here's how to close it:

  ---
  Test Suite 1: Fresh Installation (No Previous WTF-P)

  Test 1A: Basic Claude Code Installation

  # Clean slate
  rm -rf ~/.claude/write-the-f-paper ~/.claude/commands/wtfp ~/.claude/agents/wtfp

  # Install v0.5.0
  npm install -g wtf-p

  # Verify installation
  npx wtf-p doctor

  # Expected output:
  # ✓ 38+ commands installed
  # ✓ 12 agents installed (including outliner, coherence-checker)
  # ✓ 20+ workflow files
  # ✓ 6 reference docs (ui-brand, checkpoints, deviation-rules, etc.)

  Pass criteria:
  - Doctor reports "Installation healthy"
  - All v0.5.0 components present
  - No missing files or warnings

  Test 1B: Multi-Runtime Installation (Gemini)

  # Clean slate
  rm -rf ~/.config/gemini/write-the-f-paper ~/.config/gemini/commands/wtfp

  # Install to Gemini CLI
  npx wtf-p --gemini

  # Verify
  ls -la ~/.config/gemini/commands/wtfp/
  ls -la ~/.config/gemini/write-the-f-paper/

  # Expected:
  # 5 commands in commands/wtfp/: new-paper, plan-section, write-section, review-section, progress
  # Workflow files in write-the-f-paper/

  Pass criteria:
  - Files land in ~/.config/gemini/ (not ~/.claude/)
  - All path references in files use ~/.config/gemini/
  - 5 core commands present

  Test 1C: Multi-Runtime Installation (OpenCode)

  # Clean slate
  rm -rf ~/.opencode/write-the-f-paper ~/.opencode/commands/wtfp

  # Install to OpenCode
  npx wtf-p --opencode

  # Verify
  ls -la ~/.opencode/commands/wtfp/
  ls -la ~/.opencode/write-the-f-paper/

  # Expected:
  # 5 commands in commands/wtfp/
  # Workflow files in write-the-f-paper/

  Pass criteria:
  - Files land in ~/.opencode/ (not ~/.claude/)
  - All path references use ~/.opencode/
  - 5 core commands present

  Test 1D: Install --all Flag

  # Clean slate
  rm -rf ~/.claude/write-the-f-paper ~/.config/gemini/write-the-f-paper ~/.opencode/write-the-f-paper

  # Install to all runtimes
  npx wtf-p --all

  # Verify all three
  ls ~/.claude/commands/wtfp/ | wc -l        # Should be 38
  ls ~/.config/gemini/commands/wtfp/ | wc -l  # Should be 5
  ls ~/.opencode/commands/wtfp/ | wc -l       # Should be 5

  Pass criteria:
  - Claude gets 38 commands
  - Gemini gets 5 commands
  - OpenCode gets 5 commands
  - No cross-contamination (each has correct paths)

  ---
  Test Suite 2: Upgrade from v0.4.0 to v0.5.0

  Test 2A: Upgrade Existing Installation

  # Assume you have v0.4.0 installed
  wtf-p --version  # Should show v0.4.0

  # Upgrade
  npm install -g wtf-p@latest

  # Verify upgrade
  wtf-p --version  # Should show v0.5.0
  npx wtf-p doctor

  # Check new components
  ls ~/.claude/agents/wtfp/ | grep -E "outliner|coherence-checker"
  ls ~/.claude/commands/wtfp/ | grep -E "verify-work|execute-outline|settings"

  Pass criteria:
  - Version bumps to v0.5.0
  - New agents appear (outliner, coherence-checker)
  - New commands appear (verify-work, execute-outline, settings, add-todo, check-todos, update, audit-milestone, plan-milestone-gaps,
  submit-milestone)
  - Old commands still present
  - Doctor reports healthy

  Test 2B: Backward Compatibility (Existing Paper)

  # Assumption: You have a v0.4.0 paper project
  cd ~/path/to/existing-v0.4.0-paper

  # Check config
  cat .planning/config.json | grep -E "mode|depth|workflow|model_profile"

  # Run v0.5.0 command
  /wtfp:progress

  # Expected:
  # - Command works without errors
  # - No "missing key" errors
  # - config.json still has v0.4.0 keys (mode, depth, workflow, model_profile)

  Pass criteria:
  - /wtfp:progress runs successfully
  - /wtfp:plan-section works
  - No config migration required
  - Existing .planning/ structure unchanged

  ---
  Test Suite 3: Uninstallation

  Test 3A: Uninstall Claude Installation

  # Verify before
  ls ~/.claude/commands/wtfp/ | head -5

  # Uninstall
  npx wtf-p uninstall

  # Or if that doesn't work:
  npx wtf-p uninstall --claude

  # Verify after
  ls ~/.claude/commands/wtfp/ 2>&1  # Should error: No such file or directory
  ls ~/.claude/agents/wtfp/ 2>&1     # Should error
  ls ~/.claude/write-the-f-paper/ 2>&1  # Should error

  Pass criteria:
  - All WTF-P files removed from ~/.claude/
  - Version tracking file removed
  - No orphaned files left behind

  Test 3B: Uninstall Gemini Installation

  # Verify before
  ls ~/.config/gemini/commands/wtfp/

  # Uninstall
  npx wtf-p uninstall --gemini

  # Verify after
  ls ~/.config/gemini/commands/wtfp/ 2>&1  # Should error

  Pass criteria:
  - All WTF-P files removed from ~/.config/gemini/
  - Claude installation untouched

  Test 3C: Uninstall --all Flag

  # Install to all first
  npx wtf-p --all

  # Uninstall all
  npx wtf-p uninstall --all

  # Verify all gone
  ls ~/.claude/commands/wtfp/ 2>&1           # Should error
  ls ~/.config/gemini/commands/wtfp/ 2>&1    # Should error
  ls ~/.opencode/commands/wtfp/ 2>&1         # Should error

  Pass criteria:
  - All three runtimes cleaned up
  - No WTF-P files remain anywhere

  ---
  Test Suite 4: Core Workflow (New v0.5.0 Features)

  Test 4A: New Paper → Outline → Execute → Verify (E2E)

  # Fresh paper
  mkdir /tmp/wtfp-test && cd /tmp/wtfp-test

  # New paper
  /wtfp:new-paper
  # Title: "Test Paper"
  # What This Is: "Testing v0.5.0 workflow"

  # Create outline
  /wtfp:create-outline
  # Should spawn outliner agent
  # Should create: outline.md, argument-map.md, narrative-arc.md, ROADMAP.md

  # Verify outliner worked
  ls .planning/structure/outline.md
  ls .planning/structure/argument-map.md
  ls .planning/ROADMAP.md

  # Execute outline (if sections planned)
  /wtfp:execute-outline
  # Should run wave-based parallel execution
  # Should spawn coherence-checker after completion

  # Verify work
  /wtfp:verify-work
  # Should present tests one at a time
  # Should persist state in UAT.md

  Pass criteria:
  - outliner creates all 4 structure files
  - execute-outline spawns section-writer agents
  - coherence-checker runs after final wave
  - verify-work loads tests from PLAN.md and argument-map
  - UAT.md persists across /clear

  Test 4B: Git Branching Strategy

  # In existing paper
  cd /tmp/wtfp-test

  # Set branching strategy
  /wtfp:settings
  # Navigate to git.branching_strategy → set to "section"

  # Plan section
  /wtfp:plan-section 01
  # Should create branch: wtfp/section-01-introduction (or similar)

  # Verify branch created
  git branch | grep wtfp

  # Write section
  /wtfp:write-section 01
  # After review passes, should merge branch back

  # Verify branch merged and deleted
  git branch | grep wtfp  # Should not show section branch

  Pass criteria:
  - Section branch created at plan-section
  - Branch merged after write-section completes
  - Branch cleanup happens

  Test 4C: Research Depth Levels

  # Quick depth (no RESEARCH.md)
  /wtfp:research-gap 01 --depth=quick
  # Should give verbal summary only
  ls .planning/sections/01-*/01-RESEARCH.md  # Should NOT exist

  # Standard depth
  /wtfp:research-gap 02 --depth=standard
  # Should create RESEARCH.md with 10-20 sources
  cat .planning/sections/02-*/02-RESEARCH.md | grep "^depth:" # Should show "standard"

  # Deep depth
  /wtfp:research-gap 03 --depth=deep
  # Should create RESEARCH.md with 20-50 sources
  cat .planning/sections/03-*/03-RESEARCH.md | grep "^depth:" # Should show "deep"

  Pass criteria:
  - Quick: no RESEARCH.md created
  - Standard: RESEARCH.md with 10-20 citations
  - Deep: RESEARCH.md with 20-50 citations, exhaustive review

  Test 4D: Todo System

  # Add todo
  /wtfp:add-todo "Revisit methods section flow"
  # Should create file in .planning/todos/pending/

  # Verify
  ls .planning/todos/pending/

  # Check todos
  /wtfp:check-todos
  # Should list pending todos
  # Should offer act/defer/dismiss/done options

  # Verify STATE.md updated
  cat .planning/STATE.md | grep -A2 "Pending Todos"

  Pass criteria:
  - add-todo creates timestamped file in pending/
  - check-todos lists all pending
  - STATE.md tracks count
  - Files move to done/ or dismissed/ based on action

  Test 4E: Milestone Management

  # Audit milestone
  /wtfp:audit-milestone
  # Should check: sections complete, arguments covered, word counts, citations
  # Should create MILESTONE-AUDIT.md

  # Submit milestone
  /wtfp:submit-milestone
  # Should archive to .planning/milestones/v1-initial/
  # Should create MILESTONES.md entry
  # Should update PROJECT.md
  # Should create git tag

  Pass criteria:
  - audit-milestone produces MILESTONE-AUDIT.md with pass/gap status
  - submit-milestone archives all state files
  - Git tag created with section list
  - ROADMAP.md reset for next round

  ---
  Test Suite 5: Regression Testing (Nothing Broke)

  Test 5A: Existing Commands Still Work

  # Core commands that existed in v0.4.0
  /wtfp:new-paper          # Should work
  /wtfp:plan-section 01    # Should work
  /wtfp:write-section 01   # Should work
  /wtfp:review-section 01  # Should work
  /wtfp:progress           # Should work

  Pass criteria:
  - All v0.4.0 commands function correctly
  - No breaking changes
  - Existing workflows unchanged

  Test 5B: Run Full Test Suite

  # From wtfp package directory
  npm test

  # Expected:
  # 646 tests passing
  # 0 failures

  Pass criteria:
  - All 646 tests pass
  - No new test failures introduced

  ---
  What I Actually Verified vs. What Needs Human Testing

  ✓ Verified (Code-Level)

  - 646 tests pass
  - All files exist at expected paths
  - All wiring is correct (agents → commands, config → orchestrators)
  - No stubs or TODOs
  - Backward compatibility keys preserved in config template

  ✗ NOT Verified (Needs Real Testing)

  - npm install actually works (Test 1A-1D)
  - Upgrade from v0.4.0 works (Test 2A-2B)
  - Uninstall cleans up properly (Test 3A-3C)
  - Multi-runtime installation works (Test 1B-1C, 1D)
  - New workflows run end-to-end (Test 4A-4E)
  - Nothing broke from v0.4.0 (Test 5A-5B)

  ---
  Recommended Test Order

  1. Test 5B first - Run npm test to verify code quality
  2. Test 1A - Fresh install to Claude Code
  3. Test 4A - E2E workflow (new-paper → execute-outline → verify-work)
  4. Test 2B - Backward compatibility with real v0.4.0 paper
  5. Test 3A - Uninstall works cleanly
  6. Test 1B-1C - Multi-runtime (if you have Gemini/OpenCode)

  Critical blockers before release:
  - Test 1A must pass (fresh install works)
  - Test 4A must pass (core workflow works)
  - Test 2B must pass (v0.4.0 papers still work)
  - Test 5B must pass (all tests pass)

  Can ship without:
  - Test 1B-1D (multi-runtime) - document as "experimental"
  - Test 4B-4E (new features) - can fix in patch release

Next Steps: Release v0.5.0

  Step 1: Complete Milestone in GSD

  /gsd:complete-milestone

  This will:
  - Archive milestone to .planning/milestones/v0.5.0/
  - Create MILESTONES.md entry with stats
  - Create git tag v0.5.0 with annotated message
  - Update PROJECT.md (move requirements to Validated)
  - Reset ROADMAP.md for v0.6.0 planning

  ---
  Step 2: Prepare npm Release

  Before publishing, verify package.json:

  # Check version is correct
  cat package.json | grep '"version"'  # Should be "0.5.0"

  # Check files are included
  cat package.json | grep -A20 '"files"'

  # Test local install
  npm pack
  tar -tzf wtf-p-0.5.0.tgz | head -20  # Verify contents

  Update if needed:
  - package.json version should be 0.5.0
  - Ensure all necessary files included in files array

  ---
  Step 3: Publish to npm

  # Dry run first (see what would be published)
  npm publish --dry-run

  # Actually publish
  npm publish

  # Verify published
  npm view wtf-p version  # Should show 0.5.0
  npm view wtf-p dist.tarball  # Check size is reasonable

  Expected:
  - Package published to npm registry
  - Available as npm install -g wtf-p@0.5.0

  ---
  Step 4: Create GitHub Release

  # Push tags
  git push origin main
  git push origin v0.5.0

  # Create GitHub release (via web UI or gh CLI)
  gh release create v0.5.0 \
    --title "v0.5.0 - GSD Full Parity" \
    --notes-file CHANGELOG.md \
    --target main

  GitHub release should include:
  - Title: "v0.5.0 - GSD Full Parity"
  - Body: Copy from CHANGELOG.md v0.5.0 section
  - Assets: None needed (npm package is the distribution)

  ---
  Step 5: Verify Release

  # Uninstall old version
  npm uninstall -g wtf-p

  # Install from npm (fresh)
  npm install -g wtf-p

  # Verify version
  wtf-p --version  # Should show v0.5.0

  # Doctor check
  npx wtf-p doctor  # Should report healthy

  Expected:
  - Fresh install from npm registry works
  - Version is v0.5.0
  - All components present

  ---
  Step 6: Update Documentation (Optional but Recommended)

  If you have a docs site or wiki:

  # Update installation docs
  # - Add multi-runtime instructions (--gemini, --opencode, --all)
  # - Update feature list (8 new commands, 2 new agents)
  # - Update workflow diagrams (new: execute-outline, verify-work)

  # Update migration guide
  # - v0.4.0 → v0.5.0 is automatic (backward compatible)
  # - No breaking changes
  # - New config keys have safe defaults

  ---
  Step 7: Announce

  Where to announce:
  1. GitHub Releases (done in Step 4)
  2. npm (done in Step 3)
  3. Discord (if you have GSD community)
  4. Twitter/Social (optional)

  Announcement template:

  🎉 WTF-P v0.5.0 Released - GSD Full Parity

  20 new features bringing Get Shit Done workflow patterns to academic writing:

  ✨ New Workflows
  • verify-work - Conversational UAT for completed sections
  • execute-outline - Wave-based parallel section execution
  • Outliner agent - Generates structure artifacts from PROJECT.md
  • Coherence-checker - 5-pass cross-section verification

  🔧 New Utilities
  • Research depth levels (quick/standard/deep)
  • Git branching strategies (section/submission)
  • Milestone management (audit, gaps, archive)
  • Todo system (add-todo, check-todos)
  • Interactive settings editor

  🚀 Multi-Runtime Support
  • Gemini CLI adapter
  • OpenCode adapter
  • Install to all runtimes: npx wtf-p --all

  📊 Release Stats
  • 646 tests passing (162% of target)
  • 38 commands (8 new)
  • 12 agents (2 new: outliner, coherence-checker)
  • 100% backward compatible with v0.4.0 papers

  Upgrade: npm install -g wtf-p

  Full changelog: https://github.com/user/wtf-p/releases/tag/v0.5.0

  ---
  Release Checklist

  - /gsd:complete-milestone executed
  - Git tag v0.5.0 created and pushed
  - package.json version is 0.5.0
  - npm publish succeeded
  - GitHub release created
  - Fresh install from npm verified
  - Documentation updated (optional)
  - Announcement posted (optional)

  ---
  After Release

  Monitor for issues:
  # Check npm download stats
  npm view wtf-p

  # Watch for GitHub issues
  gh issue list --label "v0.5.0"
