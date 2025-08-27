#!/bin/bash

# PR workflow script - creates PR, monitors CI, and cleans up
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
    else
        echo "Failed to create PR: $PR_OUTPUT"
        exit 1
    fi
else
    PR_URL="$PR_OUTPUT"
fi

echo "PR created: $PR_URL"
# Extract PR number from URL
PR_NUMBER=$(echo "$PR_URL" | grep -oE '[0-9]+$')
if [ -z "$PR_NUMBER" ]; then
    echo "Failed to extract PR number from URL: $PR_URL"
    exit 1
fi

# Function to check PR status
check_pr_status() {
    local status
    # The CI job is named "test" based on the workflow file
    status=$(gh pr checks "$PR_NUMBER" --json name,status,conclusion --jq '.[] | select(.name == "test") | .status' 2>/dev/null | head -1)
    echo "${status:-PENDING}"
}

# Function to check if PR is merged
is_pr_merged() {
    gh pr view "$PR_NUMBER" --json merged --jq '.merged' 2>/dev/null || echo "false"
}

# Monitor CI status
MAX_ATTEMPTS=60  # 30 minutes max (30 seconds * 60)
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    ATTEMPT=$((ATTEMPT + 1))
    
    # Check if PR is already merged (auto-merge)
    if [ "$(is_pr_merged)" = "true" ]; then
        echo "✅ PR has been merged!"
        break
    fi
    
    STATUS=$(check_pr_status)
    
    if [ "$STATUS" = "COMPLETED" ]; then
        # Check the conclusion
        CONCLUSION=$(gh pr checks "$PR_NUMBER" --json name,status,conclusion --jq '.[] | select(.name == "test") | .conclusion' 2>/dev/null | head -1)
        
        if [ "$CONCLUSION" = "SUCCESS" ]; then
            echo "✅ CI passed! Waiting for auto-merge..."
            # Wait a bit more for auto-merge to complete
            sleep 10
            if [ "$(is_pr_merged)" = "true" ]; then
                echo "✅ PR has been merged!"
                break
            fi
        else
            echo "❌ CI failed with status: $CONCLUSION"
            echo "Checking CI logs..."
            gh run list --branch "$(git branch --show-current)" --limit 1 --json databaseId --jq '.[0].databaseId' | xargs gh run view --log-failed
            
            echo ""
            echo "CI has failed. Please review the logs above and fix the issues."
            echo "You can:"
            echo "  1. Fix the issues and push new commits"
            echo "  2. Re-run this script after fixing"
            echo ""
            read -p "Press Enter to continue with cleanup..."
            break
        fi
    else
        echo "CI status: $STATUS (attempt $ATTEMPT/$MAX_ATTEMPTS)"
        sleep 30
    fi
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo "⏱️ Timeout waiting for CI to complete"
fi

# Cleanup
echo ""
echo "Starting cleanup..."

# Get current branch name before switching
CURRENT_BRANCH=$(git branch --show-current)
echo "Current branch: $CURRENT_BRANCH"

# Check if we're in a worktree
WORKTREE_PATH=$(git rev-parse --show-toplevel 2>/dev/null || true)
if git rev-parse --path-format=absolute --git-common-dir 2>/dev/null | grep -q "\.git/worktrees"; then
    IS_WORKTREE="true"
else
    IS_WORKTREE="false"
fi

# Switch to main branch first (if not in worktree)
if [ "$IS_WORKTREE" = "false" ]; then
    echo "Switching to main branch..."
    # Detect the default branch
    DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "master")
    git checkout "$DEFAULT_BRANCH" || git checkout master || git checkout main
fi

# Delete local branch
echo "Deleting local branch: $CURRENT_BRANCH"
git branch -D "$CURRENT_BRANCH" 2>/dev/null || echo "Branch already deleted or doesn't exist"

# If in a worktree, remove it
if [ "$IS_WORKTREE" = "true" ] && [ -n "$WORKTREE_PATH" ]; then
    echo "Detected worktree at: $WORKTREE_PATH"
    # Move to parent directory first
    cd ..
    echo "Removing worktree..."
    git worktree remove "$WORKTREE_PATH" --force 2>/dev/null || echo "Worktree already removed"
fi

# Close tmux pane if we're in tmux
if [ -n "$TMUX" ]; then
    echo "Detected tmux session, closing pane..."
    tmux kill-pane
fi

echo "✨ Cleanup complete!"