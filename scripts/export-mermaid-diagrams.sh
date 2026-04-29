#!/usr/bin/env bash
# Export Mermaid diagrams under docs/diagrams/*.mmd to SVG and PNG (for README, slides, PDFs).
# Requires Node/npm (uses npx @mermaid-js/mermaid-cli).
#
# Usage:
#   ./scripts/export-mermaid-diagrams.sh
#   ./scripts/export-mermaid-diagrams.sh docs/diagrams/zero-trust-architecture.mmd

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export PATH="$ROOT/node_modules/.bin:$PATH"

if [[ "$#" -gt 0 ]]; then
  FILES=("$@")
else
  FILES=(docs/diagrams/*.mmd)
fi

for src in "${FILES[@]}"; do
  [[ -f "$src" ]] || { echo "Skip (not a file): $src"; continue; }
  base="${src%.mmd}"
  echo "==> $src"
  npx --yes @mermaid-js/mermaid-cli@latest \
    -i "$src" \
    -o "${base}.svg" \
    -b transparent
  npx --yes @mermaid-js/mermaid-cli@latest \
    -i "$src" \
    -o "${base}.png" \
    -b transparent \
    -w 2400 \
    -H 1800
  echo "    wrote ${base}.svg ${base}.png"
done

echo "Done."
