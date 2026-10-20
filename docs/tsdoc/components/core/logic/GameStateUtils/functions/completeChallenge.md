[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [components/core/logic/GameStateUtils](../README.md) / completeChallenge

# Function: completeChallenge()

> **completeChallenge**(`gameState`, `stageId`, `challengeId`): [`GameState`](../../../../../entities/state/GameState/interfaces/GameState.md)

Defined in: [components/core/logic/GameStateUtils.ts:105](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/logic/GameStateUtils.ts#L105)

Marks a challenge as succeeded, and advances the game accordingly.
The recommended stage (the first incomplete one) is unlocked. If that completes the stage, the game moves
straight to the recommended stage when `config.autoAdvanceStages` is set or there is no stages overview,
and otherwise returns to the stages overview.
Once every stage is complete, the overview switches to the finale display.

## Parameters

### gameState

[`GameState`](../../../../../entities/state/GameState/interfaces/GameState.md)

the current game state

### stageId

`string`

the stage id for the challenge

### challengeId

`string`

the challenge id to complete

## Returns

[`GameState`](../../../../../entities/state/GameState/interfaces/GameState.md)

a new game state with the updates applied (the given state is not modified)

## Throws

if the stage or challenge has no state
