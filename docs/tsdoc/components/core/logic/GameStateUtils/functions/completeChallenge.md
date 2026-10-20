[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [components/core/logic/GameStateUtils](../README.md) / completeChallenge

# Function: completeChallenge()

> **completeChallenge**(`gameState`, `stageId`, `challengeId`): [`GameState`](../../../../../entities/state/GameState/interfaces/GameState.md)

Defined in: [components/core/logic/GameStateUtils.ts:104](https://github.com/instantiator/2025-xmas-game/blob/ea2155993261ff7017c8ce5e381acb88812e1d8e/src/components/core/logic/GameStateUtils.ts#L104)

Marks a challenge as succeeded, and advances the game accordingly.
The recommended stage (the first incomplete one) is unlocked. If that completes the stage, the game
returns to the stages overview if it has one, otherwise moves straight to the recommended stage.
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
