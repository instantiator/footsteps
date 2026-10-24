#!/bin/bash

set -e
set -o pipefail

SCHEMA_PATH="./public/schemas/game-data-schema.json"
DATA_FILE="$1"

if [ -z "$DATA_FILE" ]; then
  echo "Usage: $0 <path-to-game-data-json> [--skip-urls]"
  exit 1
fi
shift

if [ ! -f "$DATA_FILE" ]; then
  echo "Error: Data file '$DATA_FILE' not found."
  exit 1
fi

if [ ! -f "$SCHEMA_PATH" ]; then
  echo "Error: Schema file '$SCHEMA_PATH' not found."
  exit 1
fi

# regenerate schemas
./generate-schemas.sh

echo "Validating $DATA_FILE against $SCHEMA_PATH..."
node scripts/validate-schema.ts "$SCHEMA_PATH" "$DATA_FILE"

echo "Checking the game's resource paths, templates and names..."
node scripts/validate-resources.ts game "$DATA_FILE" "$@"

echo "Validation successful for $DATA_FILE."
