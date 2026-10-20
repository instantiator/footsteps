[**Footsteps API**](../../../README.md)

***

[Footsteps API](../../../README.md) / [providers/GameStateContext](../README.md) / GameStateContextType

# Interface: GameStateContextType

Defined in: [providers/GameStateContext.tsx:5](https://github.com/instantiator/2025-xmas-game/blob/ea2155993261ff7017c8ce5e381acb88812e1d8e/src/providers/GameStateContext.tsx#L5)

The player's progress, and a way to change it.

## Properties

### gameState

> **gameState**: [`GameState`](../../../entities/state/GameState/interfaces/GameState.md)

Defined in: [providers/GameStateContext.tsx:7](https://github.com/instantiator/2025-xmas-game/blob/ea2155993261ff7017c8ce5e381acb88812e1d8e/src/providers/GameStateContext.tsx#L7)

The current progress.

***

### setGameState

> **setGameState**: `Dispatch`\<`SetStateAction`\<[`GameState`](../../../entities/state/GameState/interfaces/GameState.md)\>\>

Defined in: [providers/GameStateContext.tsx:9](https://github.com/instantiator/2025-xmas-game/blob/ea2155993261ff7017c8ce5e381acb88812e1d8e/src/providers/GameStateContext.tsx#L9)

Sets new progress, e.g. after a correct answer.
