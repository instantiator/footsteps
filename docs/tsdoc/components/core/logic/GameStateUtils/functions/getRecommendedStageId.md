[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [components/core/logic/GameStateUtils](../README.md) / getRecommendedStageId

# Function: getRecommendedStageId()

> **getRecommendedStageId**(`gameState`): `string` \| `null`

Defined in: [components/core/logic/GameStateUtils.ts:184](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/logic/GameStateUtils.ts#L184)

Identifies the stage the player should tackle next: the first one that isn't completed.

## Parameters

### gameState

[`GameState`](../../../../../entities/state/GameState/interfaces/GameState.md)

current game state

## Returns

`string` \| `null`

the recommended stage id, or null if every stage is completed
