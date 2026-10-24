#!/bin/bash

set -e
set -o pipefail

echo "Generating license-report.json..."
npx --no-install license-report --json > src/assets/license-report.json
echo
