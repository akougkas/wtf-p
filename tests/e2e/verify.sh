#!/bin/bash
# WTF-P E2E Test Verification Script
# Checks file structure and LaTeX compilation

set -e

PROJECT="${1:-.}"
cd "$PROJECT"

echo "========================================"
echo "WTF-P E2E Test Verification"
echo "Project: $PROJECT"
echo "========================================"
echo ""

ERRORS=0
WARNINGS=0

# Color codes (optional, degrades gracefully)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; ((ERRORS++)); }
warn() { echo -e "${YELLOW}⚠${NC} $1"; ((WARNINGS++)); }

# Phase 1: Check .planning/ structure
echo "--- Phase 1: Planning Files ---"

PLANNING_FILES=(
  ".planning/PROJECT.md"
  ".planning/ROADMAP.md"
  ".planning/STATE.md"
  ".planning/config.json"
)

for f in "${PLANNING_FILES[@]}"; do
  [ -f "$f" ] && pass "$f exists" || fail "$f missing"
done

# Check sections directory
if [ -d ".planning/sections" ]; then
  SECTION_COUNT=$(find .planning/sections -type d -mindepth 1 | wc -l)
  [ "$SECTION_COUNT" -gt 0 ] && pass "Section directories: $SECTION_COUNT" || warn "No section directories found"
else
  fail ".planning/sections directory missing"
fi

echo ""

# Phase 2: Check paper/ structure
echo "--- Phase 2: Paper Files ---"

PAPER_FILES=(
  "paper/paper.tex"
)

for f in "${PAPER_FILES[@]}"; do
  [ -f "$f" ] && pass "$f exists" || fail "$f missing"
done

# Check for content files
if [ -d "paper" ]; then
  MD_COUNT=$(find paper -name "*.md" 2>/dev/null | wc -l)
  [ "$MD_COUNT" -gt 0 ] && pass "Markdown content files: $MD_COUNT" || warn "No markdown content in paper/"
fi

echo ""

# Phase 3: LaTeX Compilation
echo "--- Phase 3: LaTeX Compilation ---"

if [ -f "paper/paper.tex" ]; then
  cd paper

  # Check if pdflatex is available
  if command -v pdflatex &> /dev/null; then
    # First pass
    if pdflatex -interaction=nonstopmode -halt-on-error paper.tex > /dev/null 2>&1; then
      pass "pdflatex first pass succeeded"

      # Check for PDF
      if [ -f "paper.pdf" ]; then
        PDF_SIZE=$(stat -f%z paper.pdf 2>/dev/null || stat -c%s paper.pdf 2>/dev/null)
        if [ "$PDF_SIZE" -gt 1000 ]; then
          pass "PDF generated: $(echo $PDF_SIZE | numfmt --to=iec 2>/dev/null || echo ${PDF_SIZE}B)"
        else
          warn "PDF generated but small: ${PDF_SIZE}B"
        fi
      else
        fail "PDF not generated"
      fi

      # Check for LaTeX errors in log
      if [ -f "paper.log" ]; then
        ERROR_COUNT=$(grep -c "^!" paper.log 2>/dev/null || true)
        ERROR_COUNT=${ERROR_COUNT:-0}
        ERROR_COUNT=$(echo "$ERROR_COUNT" | tr -d '[:space:]')
        if [ "$ERROR_COUNT" = "0" ] || [ -z "$ERROR_COUNT" ]; then
          pass "No LaTeX errors in log"
        else
          fail "LaTeX errors found: $ERROR_COUNT"
          grep "^!" paper.log | head -5
        fi

        # Check for warnings (informational)
        if grep -q "Warning" paper.log 2>/dev/null; then
          WARN_COUNT=$(grep -c "Warning" paper.log 2>/dev/null | tr -d '[:space:]')
          warn "LaTeX warnings: $WARN_COUNT"
        fi
      fi
    else
      fail "pdflatex compilation failed"
      [ -f "paper.log" ] && echo "Last 10 lines of log:" && tail -10 paper.log
    fi
  else
    warn "pdflatex not installed - skipping compilation check"
  fi

  cd ..
else
  fail "Cannot compile: paper/paper.tex missing"
fi

echo ""

# Phase 4: Content Validation (optional)
echo "--- Phase 4: Content Validation ---"

# Check PROJECT.md has content
if [ -f ".planning/PROJECT.md" ]; then
  WORD_COUNT=$(wc -w < .planning/PROJECT.md)
  [ "$WORD_COUNT" -gt 50 ] && pass "PROJECT.md has content: $WORD_COUNT words" || warn "PROJECT.md seems sparse: $WORD_COUNT words"
fi

# Check for placeholder text
if [ -f "paper/paper.tex" ]; then
  if grep -qE "\[TODO\]|\[CITE\]|FIXME|XXX" paper/paper.tex 2>/dev/null; then
    PLACEHOLDERS=$(grep -cE "\[TODO\]|\[CITE\]|FIXME|XXX" paper/paper.tex 2>/dev/null | tr -d '[:space:]')
    warn "Placeholder text found: $PLACEHOLDERS occurrences"
  else
    pass "No placeholder text in LaTeX"
  fi
fi

# Check content mentions the topic
if [ -f "paper/paper.tex" ]; then
  if grep -qi "structured\|prompting\|LLM" paper/paper.tex 2>/dev/null; then
    pass "Content mentions expected topic"
  else
    warn "Content may not match expected topic"
  fi
fi

echo ""

# Summary
echo "========================================"
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}TEST PASSED${NC}"
  [ $WARNINGS -gt 0 ] && echo "  ($WARNINGS warnings)"
  exit 0
else
  echo -e "${RED}TEST FAILED${NC}"
  echo "  $ERRORS errors, $WARNINGS warnings"
  exit 1
fi
