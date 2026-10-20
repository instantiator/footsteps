[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [components/core/logic/GameStateUtils](../README.md) / getStageState

# Function: getStageState()

> **getStageState**(`gameState`, `stageId`): [`GameStageState`](../../../../../entities/state/GameStageState/interfaces/GameStageState.md) \| `undefined`

Defined in: [components/core/logic/GameStateUtils.ts:70](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/logic/GameStateUtils.ts#L70)

Retrieves the stage state for the given stage id from the game state.

## Parameters

### gameState

[`GameState`](../../../../../entities/state/GameState/interfaces/GameState.md)

the current game state

### stageId

`string`

the stage id to get the state for

## Returns

[`GameStageState`](../../../../../entities/state/GameStageState/interfaces/GameStageState.md) \| `undefined`

the GameStageState if found, otherwise undefined
