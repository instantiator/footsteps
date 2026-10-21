#!/bin/bash
# Project-specific pre-commit checks, called by pre-commit-fixups.sh after
# dev-qual's fast gate. The validator's unit tests must pass; validating the
# site's own game data is advisory here, and blocks a push through `npm test`.

set -e
set -o pipefail

echo "pre-commit: running the data validator's unit tests..."
npx --no-install vitest run tests/ValidateResources

echo "pre-commit: validating public/game-repository.json (advisory)..."
if ! ./validate-repository.sh public/game-repository.json --skip-urls; then
  echo "pre-commit: game data validation failed — advisory here, but a push will be blocked." >&2
fi
