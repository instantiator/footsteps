#!/bin/bash

set -e
set -o pipefail

./validate-repository.sh public/game-repository.json

npx --no-install vitest run