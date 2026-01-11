#!/bin/bash
# WTF-P End-to-End Test Orchestrator
# Launches Haiku subagents with pre-scripted decisions to test full pipeline
#
# Usage: ./run-test.sh [--dry-run] [--verbose]
#
# Prerequisites:
#   - claude CLI installed
#   - pdflatex installed (for LaTeX verification)
#   - ANTHROPIC_API_KEY set

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="structured-prompting"
PROJECT_DIR="$SCRIPT_DIR/projects/$PROJECT_NAME"
DECISIONS_FILE="$SCRIPT_DIR/decisions.json"
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
LOG_FILE="$SCRIPT_DIR/test-$TIMESTAMP.log"

# Options
DRY_RUN=false
VERBOSE=false
MODEL="haiku"

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true; shift ;;
    --verbose) VERBOSE=true; shift ;;
    --model) MODEL="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Logging
log() {
  local msg="[$(date +%H:%M:%S)] $1"
  echo "$msg" | tee -a "$LOG_FILE"
}

log_verbose() {
  $VERBOSE && log "$1"
}

# Load decisions
if [ ! -f "$DECISIONS_FILE" ]; then
  log "ERROR: decisions.json not found at $DECISIONS_FILE"
  exit 1
fi

DECISIONS=$(cat "$DECISIONS_FILE")
PROJECT_TITLE=$(echo "$DECISIONS" | grep -o '"title": "[^"]*"' | head -1 | cut -d'"' -f4)
CORE_ARGUMENT=$(echo "$DECISIONS" | grep -o '"core_argument": "[^"]*"' | head -1 | cut -d'"' -f4)

log "========================================"
log "WTF-P E2E Test"
log "========================================"
log "Model: $MODEL"
log "Project: $PROJECT_NAME"
log "Title: $PROJECT_TITLE"
log "Log: $LOG_FILE"
log "========================================"

# Test mode context to inject
TEST_CONTEXT="<test_mode>
AUTO-TEST MODE ACTIVE - DO NOT USE AskUserQuestion TOOL.

This is an automated test. You must:
1. NEVER call AskUserQuestion - use the pre-defined decisions below
2. NEVER stop at checkpoints - auto-approve with 'approved'
3. Complete all tasks without user interaction
4. Write section content to paper/ directory (not just .planning/)

Pre-defined decisions:
- Paper type: Research paper
- Venue: ML/AI (arxiv-ml template)
- Mode: Flow
- Depth: Quick
- Document type: IMRaD
- All confirmations: yes/approved
- Writing mode: Co-Author
- Literature level: 0-skip (no research needed)
- LaTeX template: Article (generic)
- Compile: Yes

Project details:
- Title: $PROJECT_TITLE
- Core argument: $CORE_ARGUMENT
- Scope exclusions: Model training, fine-tuning, architecture details

CRITICAL: Do not ask questions. Execute workflows to completion.
</test_mode>"

# Setup test project
setup_project() {
  log "Setting up test project..."

  rm -rf "$PROJECT_DIR"
  mkdir -p "$PROJECT_DIR"
  cd "$PROJECT_DIR"

  git init --quiet

  log "Project directory: $PROJECT_DIR"
}

# Run a workflow phase
run_phase() {
  local phase_num="$1"
  local phase_name="$2"
  local prompt="$3"

  log ""
  log "=== Phase $phase_num: $phase_name ==="

  if $DRY_RUN; then
    log "[DRY RUN] Would execute: $phase_name"
    log_verbose "Prompt: $prompt"
    return 0
  fi

  cd "$PROJECT_DIR"

  # Combine test context with phase-specific prompt
  local full_prompt="$TEST_CONTEXT

$prompt"

  log_verbose "Executing with $MODEL..."

  # Run claude with the prompt
  # Using --print to get output, --model to specify model
  if claude --model "$MODEL" --print "$full_prompt" >> "$LOG_FILE" 2>&1; then
    log "Phase $phase_num complete"
  else
    log "WARNING: Phase $phase_num may have issues (check log)"
  fi
}

# Main execution
main() {
  setup_project

  # Phase 1: Initialize project with new-paper
  run_phase 1 "new-paper" "
You are in directory: $PROJECT_DIR

Run the /wtfp:new-paper workflow to initialize a research paper project.

Paper details:
- Title: Benefits of Structured Prompting for LLMs
- Type: Research paper
- Venue: arxiv-ml (ML/AI)
- Core argument: Structured prompting improves LLM output quality by providing explicit constraints and format guidance, reducing hallucinations and improving task completion rates.
- Key insight: Constraints guide generation toward more accurate outputs
- Scope exclusions: Model training, fine-tuning, architecture
- Mode: Flow
- Depth: Quick

Create PROJECT.md and config.json in .planning/ directory.
Do not ask questions - use the values provided above."

  # Phase 2: Create outline
  run_phase 2 "create-outline" "
You are in directory: $PROJECT_DIR

Run the /wtfp:create-outline workflow.

The project has already been initialized with PROJECT.md.
- Document type: IMRaD (Introduction, Methods, Results, Discussion)
- Accept all generated sections
- Create ROADMAP.md and STATE.md
- Create section directories

Do not ask questions - accept the generated structure."

  # Phase 3: Plan section 1 (Introduction)
  run_phase 3 "plan-section" "
You are in directory: $PROJECT_DIR

Run the /wtfp:plan-section 1 workflow for the Introduction section.

Settings:
- Literature level: 0-skip (no external research needed for this test)
- Writing mode: Co-Author
- Accept the task breakdown

Create .planning/sections/01-*/01-01-PLAN.md with executable tasks.
Do not ask questions - use the settings above."

  # Phase 4: Write section (execute)
  run_phase 4 "write-section" "
You are in directory: $PROJECT_DIR

Run the /wtfp:write-section workflow to execute the plan.

IMPORTANT:
- Auto-approve ALL checkpoints with 'approved'
- Write the Introduction content
- Save output to BOTH:
  - .planning/sections/01-*/01-01-SUMMARY.md (summary)
  - paper/01-introduction.md (actual content for LaTeX)

The paper/ directory should contain the markdown that will be converted to LaTeX.
Do not stop at checkpoints - auto-approve and continue."

  # Phase 5: Export to LaTeX
  run_phase 5 "export-latex" "
You are in directory: $PROJECT_DIR

Run the /wtfp:export-latex workflow.

Settings:
- Template: Article (generic) - use standard \\documentclass{article}
- Compile: Yes, compile with pdflatex

Generate:
- paper/paper.tex (LaTeX document)
- paper/references.bib (even if empty)

The paper.tex should:
- Include the Introduction content from paper/01-introduction.md
- Use standard article class
- Include basic packages (inputenc, amsmath, graphicx, hyperref)
- Have proper LaTeX escaping for special characters

After generating, compile with: pdflatex -interaction=nonstopmode paper.tex

Do not ask questions - use Article template and compile."

  # Verification
  log ""
  log "=== Verification ==="

  if $DRY_RUN; then
    log "[DRY RUN] Would run verification"
  else
    cd "$PROJECT_DIR"
    if "$SCRIPT_DIR/verify.sh" "$PROJECT_DIR" 2>&1 | tee -a "$LOG_FILE"; then
      log ""
      log "========================================"
      log "TEST PASSED"
      log "========================================"
    else
      log ""
      log "========================================"
      log "TEST FAILED - See log for details"
      log "========================================"
      exit 1
    fi
  fi
}

main
