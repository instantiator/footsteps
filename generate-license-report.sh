#!/bin/bash

set -e
set -o pipefail

echo "Generating license-report.json..."
# Only the fields the app shows: the defaults include each package's latest
# npm version, which changes the report whenever anything upstream releases.
npx --no-install license-report --json --fields=name --fields=licenseType > src/assets/license-report.json
echo
