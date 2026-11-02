#!/bin/bash

set -e
set -o pipefail

# A warning, not a failure: an extra package is harmless, but a missing or out-of-date install can fail later with a
# misleading error. This only compares names and versions, so it can't see a damaged file.
if ! npm ls --depth=0 >/dev/null 2>&1; then
  echo "Warning: node_modules doesn't match package.json. If the build fails, run: npm ci" >&2
fi

./generate-schemas.sh

echo "Pre-build steps completed."
echo
