#!/bin/bash

# Post-PR cleanup script - deletes branch, worktree, and closes tmux pane
set -euo pipefail

echo "Starting post-PR cleanup..."

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