#!/bin/bash
# Turns React Router's build output into a self-contained static site in dist/client/.
#
# Usage: finish-static-build.sh [base-path]   e.g. finish-static-build.sh /2025-xmas-game/
#
# - dist/server/ only exists so the build can prerender pages; nothing serves it, so it goes.
# - With a base path, React Router writes the prerendered pages under dist/client/<base>/ but the
#   assets at dist/client/, and leaves the SPA fallback as dist/client/index.html. GitHub Pages serves
#   dist/client/ *at* the base path, so the pages move up a level, and the fallback becomes 404.html,
#   which Pages serves for any other path (client-side routing then takes over).

set -euo pipefail

rm -rf dist/server

base="$(echo "${1:-/}" | sed 's|^/*||; s|/*$||')"
if [ -n "$base" ]; then
  pages="dist/client/$base"
  if [ ! -f "$pages/index.html" ]; then
    echo "No prerendered pages in $pages: has React Router's output layout changed?" >&2
    exit 1
  fi
  mv dist/client/index.html dist/client/404.html
  cp -R "$pages"/. dist/client/
  rm -rf "$pages"
fi

echo "Static site ready in dist/client/ ($(find dist/client -name '*.html' | wc -l | tr -d ' ') HTML files)."
