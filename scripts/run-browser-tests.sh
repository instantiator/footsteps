#!/bin/bash
#
# Browser tests: the real camera pipeline in Chromium, against a fake webcam feed.
#
# Prerequisites:
#   - Chromium: npx playwright install chromium
#   - Network access, to download the vision model
#
# Usage: scripts/run-browser-tests.sh [playwright arguments]

set -e
set -o pipefail

if ! npx --no-install playwright --version >/dev/null 2>&1; then
  echo "Playwright is not installed. Run: npm install && npx playwright install chromium" >&2
  exit 1
fi

npx --no-install playwright test "$@"
