#!/bin/bash

set -e
set -o pipefail

SCHEMA_PATH="./public/schemas/game-data-schema.json"
DATA_FILE="$1"

if [ -z "$DATA_FILE" ]; then
  echo "Usage: $0 <path-to-game-data-json>"
  exit 1
fi

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
npx --yes ajv-cli validate -s "$SCHEMA_PATH" -d "$DATA_FILE" --verbose

echo "Validation successful for $DATA_FILE."
