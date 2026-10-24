#!/bin/bash

set -e
set -o pipefail

echo "Generating schema for GameRepository..."
npx --no-install typescript-json-schema tsconfig.schema.json GameRepository --out public/schemas/game-repository-schema.json --required
echo

echo "Generating schema for GameData..."
npx --no-install typescript-json-schema tsconfig.schema.json GameData --out public/schemas/game-data-schema.json --required
echo
