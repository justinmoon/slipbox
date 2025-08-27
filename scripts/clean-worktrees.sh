#!/bin/bash

echo -e "\n🗑️  Git Worktree Cleaner\n"

# Parse worktrees more carefully
worktrees=()
branches=()

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
        branches+=("$branch")
        current_path=""
    elif [[ -z "$line" ]] && [[ -n "$current_path" ]]; then
        # Worktree without branch (detached HEAD)
        worktrees+=("$current_path")
        branches+=("detached")
        current_path=""
    fi
done < <(git worktree list --porcelain)

if [ ${#worktrees[@]} -eq 0 ]; then
    echo "No worktrees found to clean."
    exit 0
fi

echo "Found worktrees:"
for i in "${!worktrees[@]}"; do
    echo "  $((i+1)). ${branches[$i]} (${worktrees[$i]})"
done

echo -e "\nSelect worktrees to delete:"
echo "  - Enter numbers separated by spaces (e.g., 1 3 5)"
echo "  - Enter 'all' to delete all worktrees"
echo "  - Press Enter to cancel"
read -p "> " selection

if [ -z "$selection" ]; then
    echo "Cancelled."
    exit 0
fi

to_delete=()
to_delete_branches=()

if [ "$selection" = "all" ]; then
    to_delete=("${worktrees[@]}")
    to_delete_branches=("${branches[@]}")
else
    for num in $selection; do
        idx=$((num-1))
        if [ $idx -ge 0 ] && [ $idx -lt ${#worktrees[@]} ]; then
            to_delete+=("${worktrees[$idx]}")
            to_delete_branches+=("${branches[$idx]}")
        fi
    done
fi

if [ ${#to_delete[@]} -eq 0 ]; then
    echo "No valid selections. Cancelled."
    exit 0
fi

echo -e "\nWill delete:"
for i in "${!to_delete[@]}"; do
    echo "  - ${to_delete_branches[$i]} (${to_delete[$i]})"
done

read -p $'\nProceed? (y/N): ' confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "Cancelled."
    exit 0
fi

echo -e "\nDeleting worktrees..."

for i in "${!to_delete[@]}"; do
    wt="${to_delete[$i]}"
    branch="${to_delete_branches[$i]}"
    
    echo "  Removing worktree: $wt"
    git worktree remove "$wt" --force 2>/dev/null || echo "  ⚠️  Could not remove worktree $wt"
    
    if [ "$branch" != "master" ] && [ "$branch" != "main" ] && [ "$branch" != "detached" ] && [ -n "$branch" ]; then
        echo "  Deleting branch: $branch"
        git branch -D "$branch" 2>/dev/null || echo "  ⚠️  Could not delete branch $branch"
    fi
done

echo -e "\n✅ Done!"