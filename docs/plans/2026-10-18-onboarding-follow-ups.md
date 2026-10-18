---
status: active
---

# Plan: dev-qual onboarding follow-ups

- **Branch:** `chore/dev-qual-onboarding` (continuing)
- **Commits:** one per TODO
- **Orchestrator:** Opus; single model

## Context

These are follow-ups agreed with the user after the [onboarding plan](2026-10-18-dev-qual-onboarding.md) finished.

### Decisions taken

| Decision                                 | Choice                                                                                                     |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Finale overview without a finale display | Fall back to the title screen if there is one, otherwise the stages overview (the reverse of the old code) |
| TypeScript 7                             | Stay on 6.0.3, deferred: typescript-eslint has no TS 7 support (typescript-eslint#10940)                   |
| Node                                     | Move to Node 26 now (LTS on 2026-10-28): CI, `engines.node`, `@types/node`                                 |
| PR CI                                    | Run the full `dev-qual/scripts/check.sh` on pull requests                                                  |
| Keyboard access                          | Small version now: Enter/Space on focusable click targets, plus on the title screen                        |
| Captions                                 | Stay deferred                                                                                              |
| Template ids                             | `useId()` instead of `uuid`'s `v4()`; remove the `uuid` dependency                                         |
| dev-qual installer bug                   | Note it in `dev-qual/docs/outstanding-issues.md`; don't commit or push the submodule                       |

## TODOs

- [x] 1: Reverse the finale overview fallback
- [x] 2: Move to Node 26
- [ ] 3: Add a pull-request CI check
- [ ] 4: Keyboard access to click targets and the title screen
- [ ] 5: Replace uuid with useId()
- [ ] 6: Remove the Vite README boilerplate
- [ ] 7: Note the installer bug in dev-qual (no commit in this repo's history beyond ticking this)
- [ ] 8: Wrap-up: comprehensive check, docs review, outstanding issues

Each TODO's gate is `dev-qual/scripts/check.sh` (full) passing, plus its own tests.
