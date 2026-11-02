#!/bin/bash

set -e
set -o pipefail

# A missing or out-of-date install otherwise fails later, with a misleading error from the schema generator
if ! npm ls --depth=0 >/dev/null 2>&1; then
  echo "node_modules doesn't match package.json. Run: npm ci" >&2
  exit 1
fi

./generate-schemas.sh

echo "Pre-build steps completed."
echo
