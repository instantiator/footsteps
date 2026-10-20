[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [components/core/logic/GameClickUtils](../README.md) / getNewGameStateForClick

# Function: getNewGameStateForClick()

> **getNewGameStateForClick**(`state`, `targetId`): [`GameState`](../../../../../entities/state/GameState/interfaces/GameState.md) \| `undefined`

Defined in: [components/core/logic/GameClickUtils.ts:16](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/logic/GameClickUtils.ts#L16)

Works out the game state after a click on an overview display element.

## Parameters

### state

[`GameState`](../../../../../entities/state/GameState/interfaces/GameState.md)

### targetId

`string`

## Returns

[`GameState`](../../../../../entities/state/GameState/interfaces/GameState.md) \| `undefined`

the new state, or undefined if the click changes nothing
