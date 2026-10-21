#!/bin/bash
# Run by dev-qual's pre-commit hook after the fast gate. Runs the project's own
# checks (scripts/pre-commit-checks.sh), then regenerates the API docs and the
# JSON schemas when their sources are staged, and stages the result with the commit.
# TypeDoc treats warnings as errors, so an undocumented export blocks the commit.

set -e
set -o pipefail

bash scripts/pre-commit-checks.sh

STAGED="$(git diff --cached --name-only)"

if grep -qE '^(src/|typedoc\.json$|package\.json$)' <<<"$STAGED"; then
  npm run --silent docs:api
  git add -A docs/tsdoc
fi

if grep -qE '^(src/entities/|generate-schemas\.sh$|tsconfig\.schema\.json$)' <<<"$STAGED"; then
  bash generate-schemas.sh >/dev/null
  git add public/schemas
fi
