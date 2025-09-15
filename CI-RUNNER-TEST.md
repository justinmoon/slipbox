# CI Runner Test - Phase 5

Testing the new CI runner that runs as the `ci` user.

## What Changed
- Runner now runs as `ci` user instead of `justin`
- Runner can manage services via polkit (no sudo)
- Runner can manage Nix profiles directly

## Test Date
2024-11-15 - Phase 5 deployment

This file can be deleted after successful test.