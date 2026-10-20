[**Footsteps API**](../../../../README.md)

***

[Footsteps API](../../../../README.md) / [entities/state/GameState](../README.md) / createBlankGameState

# Function: createBlankGameState()

> **createBlankGameState**(`game`): [`GameState`](../interfaces/GameState.md)

Defined in: [entities/state/GameState.ts:28](https://github.com/instantiator/2025-xmas-game/blob/ea2155993261ff7017c8ce5e381acb88812e1d8e/src/entities/state/GameState.ts#L28)

Creates the starting state for a game: all challenges unsolved, and the first overview display showing.
With sequential config (the default) only the first stage is unlocked; otherwise all are.

## Parameters

### game

[`GameData`](../../../data/GameData/interfaces/GameData.md)

## Returns

[`GameState`](../interfaces/GameState.md)

## Throws

if the game has no overview display to start from
