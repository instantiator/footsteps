#!/bin/bash

set -e
set -o pipefail

./generate-license-report.sh
./generate-schemas.sh

echo "Pre-build steps completed."
echo
