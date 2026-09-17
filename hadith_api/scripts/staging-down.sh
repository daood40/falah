#!/usr/bin/env bash
# Stops the staging deployment started by scripts/staging-up.sh.
set -uo pipefail
cd "$(dirname "$0")/.."
for f in .staging.pid .staging-rl.pid; do
  [ -f "$f" ] || continue
  kill "$(cat "$f")" 2>/dev/null || true
  rm -f "$f"
done
echo "✓ staging stopped"
