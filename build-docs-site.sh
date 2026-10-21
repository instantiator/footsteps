#!/bin/bash
# Builds the documentation site into dist/client/docs/, next to the app.
#
# Usage: [BASE_URL=/base-path/] build-docs-site.sh   (the same BASE_URL the app build used)
#
# VitePress renders docs/ (Markdown) into docs-static/. The TypeDoc HTML in docs/tsdoc/
# is not a VitePress page, so it is copied in as a static subtree, then the whole site
# moves into the app's build output, where GitHub Pages serves it at <base>docs/.

set -euo pipefail

if [ ! -d dist/client ]; then
  echo "dist/client is missing: run the app build before the docs build." >&2
  exit 1
fi
if [ ! -f docs/tsdoc/index.html ]; then
  echo "docs/tsdoc/index.html is missing: run npm run docs:api first." >&2
  exit 1
fi

rm -rf docs-static
npx vitepress build docs
cp -R docs/tsdoc docs-static/tsdoc
rm -rf dist/client/docs
mv docs-static dist/client/docs

echo "Docs site ready in dist/client/docs/ ($(find dist/client/docs -name '*.html' | wc -l | tr -d ' ') HTML files)."
