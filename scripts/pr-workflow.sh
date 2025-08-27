#!/bin/bash

# PR workflow script - creates PR and exits (auto-merge handles the rest)
set -euo pipefail

echo "Creating pull request..."

# Use --fill to autofill title and body from commits
PR_OUTPUT=$(gh pr create --fill --web=false 2>&1)
PR_EXIT_CODE=$?

if [ $PR_EXIT_CODE -ne 0 ]; then
    # Check if PR already exists
    if echo "$PR_OUTPUT" | grep -q "already exists"; then
        echo "PR already exists, fetching URL..."
        PR_URL=$(gh pr view --json url --jq '.url')
        echo "Existing PR: $PR_URL"
    else
        echo "Failed to create PR: $PR_OUTPUT"
        exit 1
    fi
else
    PR_URL="$PR_OUTPUT"
    echo "✅ PR created: $PR_URL"
fi

echo ""
echo "GitHub Actions will now:"
echo "  1. Run CI tests"
echo "  2. Auto-merge if tests pass"
echo ""
echo "After PR is merged, run: scripts/post-pr-cleanup.sh"