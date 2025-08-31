#!/bin/bash
# Simple wrapper to view backup logs
journalctl -u slipbox-backup@"$USER" "$@"