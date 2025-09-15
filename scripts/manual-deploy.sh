#!/usr/bin/env bash
set -euo pipefail

DIR=$(ssh justin@135.181.179.143 "mktemp -d /tmp/slipbox-XXXXXX")
echo "🚀 Deploying to $DIR"

hsync . "justin@135.181.179.143:$DIR"
ssh justin@135.181.179.143 "cd $DIR && nix build .#slipbox && ci-deploy slipbox .#slipbox"