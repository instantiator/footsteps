[**Footsteps API**](../../../README.md)

***

[Footsteps API](../../../README.md) / [providers/GameStateContext](../README.md) / GameStateContextType

# Interface: GameStateContextType

Defined in: [providers/GameStateContext.tsx:5](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/providers/GameStateContext.tsx#L5)

The player's progress, and a way to change it.

## Properties

### gameState

> **gameState**: [`GameState`](../../../entities/state/GameState/interfaces/GameState.md)

Defined in: [providers/GameStateContext.tsx:7](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/providers/GameStateContext.tsx#L7)

The current progress.

***

### setGameState

> **setGameState**: `Dispatch`\<`SetStateAction`\<[`GameState`](../../../entities/state/GameState/interfaces/GameState.md)\>\>

Defined in: [providers/GameStateContext.tsx:9](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/providers/GameStateContext.tsx#L9)

Replaces the progress; the game re-renders from it.
