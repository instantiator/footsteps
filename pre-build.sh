#!/bin/bash

set -e
set -o pipefail

./generate-schemas.sh

echo "Pre-build steps completed."
echo
