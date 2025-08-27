#!/bin/bash

# Post-PR cleanup script - deletes branch, worktree, and closes tmux pane
set -euo pipefail

# Capture the window of the pane running this script at the very start
# TMUX_PANE is set by tmux to the pane where this script is executing
if [ -n "${TMUX:-}" ] && [ -n "${TMUX_PANE:-}" ]; then
    # Get the window ID for the pane running this script
    SCRIPT_WINDOW=$(tmux list-panes -F '#{pane_id} #{window_id}' | grep "^$TMUX_PANE " | awk '{print $2}')
fi

echo "Starting post-PR cleanup..."

# Get current branch name before switching
CURRENT_BRANCH=$(git branch --show-current)
echo "Current branch: $CURRENT_BRANCH"

# Check if we're in a worktree
WORKTREE_PATH=$(git rev-parse --show-toplevel 2>/dev/null || true)
GIT_DIR=$(git rev-parse --git-dir 2>/dev/null || true)

# Check if .git is a file (indicates worktree) or if path contains worktrees
if [ -f "$WORKTREE_PATH/.git" ] || [[ "$GIT_DIR" == *".git/worktrees"* ]]; then
    IS_WORKTREE="true"
    echo "Detected worktree at: $WORKTREE_PATH"
    
    # For worktrees, we just need to remove it - no branch switching needed
    # Move to parent directory first to avoid being in the directory we're deleting
    cd ..
    echo "Removing worktree and its branch..."
    git worktree remove "$WORKTREE_PATH" --force 2>/dev/null || echo "Worktree already removed"
    
    # The branch associated with the worktree is automatically deleted with --force
else
    IS_WORKTREE="false"
    echo "Not in a worktree, switching to default branch..."
    
    # Detect the default branch
    DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "master")
    
    # Try to checkout the default branch
    if ! git checkout "$DEFAULT_BRANCH" 2>/dev/null; then
        echo "Could not checkout $DEFAULT_BRANCH, it might be checked out in another worktree"
        echo "Skipping branch deletion - you may need to delete it manually"
    else
        # Delete local branch only if we successfully switched away from it
        echo "Deleting local branch: $CURRENT_BRANCH"
        git branch -D "$CURRENT_BRANCH" 2>/dev/null || echo "Branch already deleted or doesn't exist"
    fi
fi

# Close tmux window if we're in tmux
if [ -n "${SCRIPT_WINDOW:-}" ]; then
    echo "Detected tmux session, closing window..."
    tmux kill-window -t "$SCRIPT_WINDOW"
fi

echo "✨ Cleanup complete!"