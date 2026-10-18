#!/bin/bash

set -e
set -o pipefail

echo "Generating license-report.json..."
npx --yes license-report --json > src/assets/license-report.json
echo
