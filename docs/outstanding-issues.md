# Outstanding issues

Deferred work, each with the condition that says when to act on it.

## dev-qual's installer writes a double blank line into AGENTS.md

`dev-qual/adapters/opencode/install.sh` starts the skills block with `echo ''`, and `merge_block` adds a blank line after the start marker. The result fails markdownlint MD012. We fixed AGENTS.md by hand.

**Act when:** the next `dev-qual/scripts/upgrade.sh` run. Re-check AGENTS.md with `dev-qual/scripts/check.sh --fast`, and fix the installer upstream in instantiator/dev-qual if it's still there.

## Accepted risk: sprintf-js DoS advisory via @tensorflow/tfjs

`@tensorflow/tfjs@4.22.0` (latest) depends on `argparse@1` → `sprintf-js@1.0.3`, which [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) covers. Every sprintf-js release (≤1.1.3) is affected, so no override can fix it, and npm's suggested "fix" is a downgrade to tfjs 2.1.0. argparse is only used by tfjs's CLI `bin`, and the browser bundle doesn't include it (`grep` of `dist/` finds no sprintf/argparse code). Moderate severity.

**Act when:** `@tensorflow/tfjs` publishes a release that drops `argparse@1`, or a patched `sprintf-js` is published. Check with `npm audit`.
