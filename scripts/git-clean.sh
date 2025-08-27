#!/bin/bash

echo -e "\n🧹 Git Cleanup Tool\n"

# Parse worktrees
worktrees=()
worktree_branches=()

while IFS= read -r line; do
    if [[ "$line" == "worktree "* ]]; then
        path="${line#worktree }"
        # Skip the main worktree
        if [[ "$path" != "/Users/justin/code/slipbox" ]]; then
            current_path="$path"
        else
            current_path=""
        fi
    elif [[ "$line" == "branch "* ]] && [[ -n "$current_path" ]]; then
        branch="${line#branch refs/heads/}"
        worktrees+=("$current_path")
        worktree_branches+=("$branch")
        current_path=""
    elif [[ -z "$line" ]] && [[ -n "$current_path" ]]; then
        # Worktree without branch (detached HEAD)
        worktrees+=("$current_path")
        worktree_branches+=("detached")
        current_path=""
    fi
done < <(git worktree list --porcelain)

# Get all local branches
all_branches=$(git branch --format="%(refname:short)")
non_worktree_branches=()

for branch in $all_branches; do
    # Skip master/main
    if [[ "$branch" == "master" ]] || [[ "$branch" == "main" ]]; then
        continue
    fi
    
    # Check if this branch is associated with a worktree
    is_worktree=false
    for wb in "${worktree_branches[@]}"; do
        if [[ "$wb" == "$branch" ]]; then
            is_worktree=true
            break
        fi
    done
    
    if ! $is_worktree; then
        non_worktree_branches+=("$branch")
    fi
done

# Display options
has_items=false

if [ ${#worktrees[@]} -gt 0 ]; then
    has_items=true
    echo "📁 Worktrees:"
    for i in "${!worktrees[@]}"; do
        echo "  w$((i+1)). ${worktree_branches[$i]} (${worktrees[$i]})"
    done
    echo
fi

if [ ${#non_worktree_branches[@]} -gt 0 ]; then
    has_items=true
    echo "🌿 Branches (not associated with worktrees):"
    for i in "${!non_worktree_branches[@]}"; do
        echo "  b$((i+1)). ${non_worktree_branches[$i]}"
    done
    echo
fi

if ! $has_items; then
    echo "✨ Everything is clean! No worktrees or branches to delete."
    exit 0
fi

echo "Select items to delete:"
echo "  - Enter items separated by spaces (e.g., w1 w3 b2)"
echo "  - Enter 'all-worktrees' to delete all worktrees"
echo "  - Enter 'all-branches' to delete all non-worktree branches"
echo "  - Enter 'all' to delete everything"
echo "  - Press Enter to cancel"
read -p "> " selection

if [ -z "$selection" ]; then
    echo "Cancelled."
    exit 0
fi

# Parse selection
to_delete_worktrees=()
to_delete_worktree_branches=()
to_delete_branches=()

if [[ "$selection" == "all" ]]; then
    to_delete_worktrees=("${worktrees[@]}")
    to_delete_worktree_branches=("${worktree_branches[@]}")
    to_delete_branches=("${non_worktree_branches[@]}")
elif [[ "$selection" == "all-worktrees" ]]; then
    to_delete_worktrees=("${worktrees[@]}")
    to_delete_worktree_branches=("${worktree_branches[@]}")
elif [[ "$selection" == "all-branches" ]]; then
    to_delete_branches=("${non_worktree_branches[@]}")
else
    for item in $selection; do
        if [[ "$item" == w* ]]; then
            # Extract number from w1, w2, etc.
            num="${item:1}"
            idx=$((num-1))
            if [ $idx -ge 0 ] && [ $idx -lt ${#worktrees[@]} ]; then
                to_delete_worktrees+=("${worktrees[$idx]}")
                to_delete_worktree_branches+=("${worktree_branches[$idx]}")
            fi
        elif [[ "$item" == b* ]]; then
            # Extract number from b1, b2, etc.
            num="${item:1}"
            idx=$((num-1))
            if [ $idx -ge 0 ] && [ $idx -lt ${#non_worktree_branches[@]} ]; then
                to_delete_branches+=("${non_worktree_branches[$idx]}")
            fi
        fi
    done
fi

# Confirm deletion
if [ ${#to_delete_worktrees[@]} -eq 0 ] && [ ${#to_delete_branches[@]} -eq 0 ]; then
    echo "No valid selections. Cancelled."
    exit 0
fi

echo -e "\n⚠️  Will delete:"
if [ ${#to_delete_worktrees[@]} -gt 0 ]; then
    echo "  Worktrees:"
    for i in "${!to_delete_worktrees[@]}"; do
        echo "    - ${to_delete_worktree_branches[$i]} (${to_delete_worktrees[$i]})"
    done
fi
if [ ${#to_delete_branches[@]} -gt 0 ]; then
    echo "  Branches:"
    for branch in "${to_delete_branches[@]}"; do
        echo "    - $branch"
    done
fi

read -p $'\nProceed? (y/N): ' confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "Cancelled."
    exit 0
fi

echo -e "\n🗑️  Deleting..."

# Delete worktrees and their branches
for i in "${!to_delete_worktrees[@]}"; do
    wt="${to_delete_worktrees[$i]}"
    branch="${to_delete_worktree_branches[$i]}"
    
    echo "  Removing worktree: $wt"
    git worktree remove "$wt" --force 2>/dev/null || echo "    ⚠️  Could not remove worktree $wt"
    
    if [ "$branch" != "master" ] && [ "$branch" != "main" ] && [ "$branch" != "detached" ] && [ -n "$branch" ]; then
        echo "  Deleting branch: $branch"
        git branch -D "$branch" 2>/dev/null || echo "    ⚠️  Could not delete branch $branch"
    fi
done

# Delete non-worktree branches
for branch in "${to_delete_branches[@]}"; do
    echo "  Deleting branch: $branch"
    git branch -D "$branch" 2>/dev/null || echo "    ⚠️  Could not delete branch $branch"
done

echo -e "\n✅ Done!"