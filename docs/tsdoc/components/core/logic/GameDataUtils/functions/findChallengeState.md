[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [components/core/logic/GameDataUtils](../README.md) / findChallengeState

# Function: findChallengeState()

> **findChallengeState**(`gameState`, `stageId`, `challengeId`): [`GameChallengeState`](../../../../../entities/state/GameChallengeState/interfaces/GameChallengeState.md)

Defined in: [components/core/logic/GameDataUtils.ts:33](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/components/core/logic/GameDataUtils.ts#L33)

Looks up a challenge's state in the game state.

## Parameters

### gameState

[`GameState`](../../../../../entities/state/GameState/interfaces/GameState.md)

### stageId

`string`

### challengeId

`string`

## Returns

[`GameChallengeState`](../../../../../entities/state/GameChallengeState/interfaces/GameChallengeState.md)

## Throws

if the stage, or the challenge within it, has no state
