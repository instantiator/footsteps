#!/bin/bash
# Turns React Router's build output into a self-contained static site in dist/client/.
#
# Usage: [BASE_URL=/base-path/] finish-static-build.sh   (the same BASE_URL the build used)
#
# - dist/server/ only exists so the build can prerender pages; nothing serves it, so it goes.
# - The SPA fallback page becomes 404.html, which GitHub Pages serves for any path without a page
#   of its own; client-side routing then takes over.
# - With a base path, React Router writes the prerendered pages under dist/client/<base>/ (and the
#   fallback as dist/client/index.html) but the assets at dist/client/. GitHub Pages serves
#   dist/client/ *at* the base path, so the pages move up a level.

set -euo pipefail

rm -rf dist/server

base="$(echo "${BASE_URL:-/}" | sed 's|^/*||; s|/*$||')"
if [ -n "$base" ]; then
  pages="dist/client/$base"
  if [ ! -f "$pages/index.html" ]; then
    echo "No prerendered pages in $pages: has React Router's output layout changed?" >&2
    exit 1
  fi
  mv dist/client/index.html dist/client/404.html
  cp -R "$pages"/. dist/client/
  rm -rf "$pages"
else
  mv dist/client/__spa-fallback.html dist/client/404.html
fi

echo "Static site ready in dist/client/ ($(find dist/client -name '*.html' | wc -l | tr -d ' ') HTML files)."
