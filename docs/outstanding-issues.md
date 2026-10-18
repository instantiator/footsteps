# Outstanding issues

Deferred work, each with the condition that says when to act on it.

## dev-qual's installer writes a double blank line into AGENTS.md

`dev-qual/adapters/opencode/install.sh` starts the skills block with `echo ''`, and `merge_block` adds a blank line after the start marker. The result fails markdownlint MD012. We fixed AGENTS.md by hand.

**Act when:** the next `dev-qual/scripts/upgrade.sh` run. Re-check AGENTS.md with `dev-qual/scripts/check.sh --fast`, and fix the installer upstream in instantiator/dev-qual if it's still there.
