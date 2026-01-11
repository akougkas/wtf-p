#!/bin/bash
# WCN Workflow Swap Script
# Usage: ./swap-workflows.sh [wcn|verbose]

WORKFLOW_DIR="$HOME/.claude/write-the-f-paper/workflows"

if [ "$1" == "wcn" ]; then
    echo "Swapping to WCN workflows..."
    cd "$WORKFLOW_DIR"
    for f in *.md; do
        [ -f "${f%.md}.wcn.md" ] && {
            mv "$f" "${f}.verbose"
            cp "${f%.md}.wcn.md" "$f"
            echo "  $f → WCN"
        }
    done
    echo "Done. WCN workflows active."

elif [ "$1" == "verbose" ]; then
    echo "Swapping to verbose workflows..."
    cd "$WORKFLOW_DIR"
    for f in *.verbose; do
        [ -f "$f" ] && {
            base="${f%.verbose}"
            mv "$f" "$base"
            echo "  $base → Verbose"
        }
    done
    echo "Done. Verbose workflows active."

else
    echo "Usage: $0 [wcn|verbose]"
    echo ""
    echo "  wcn     - Use WCN-compressed workflows"
    echo "  verbose - Use original verbose workflows"
    exit 1
fi
