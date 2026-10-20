#!/bin/bash
# Run by dev-qual's pre-commit hook after the fast gate. Regenerates the API
# docs when their sources are staged, and stages the result with the commit.
# TypeDoc treats warnings as errors, so an undocumented export blocks the commit.

set -e
set -o pipefail

if git diff --cached --name-only | grep -qE '^(src/|typedoc\.json$|package\.json$)'; then
  npm run --silent docs:api
  git add -A docs/tsdoc
fi
