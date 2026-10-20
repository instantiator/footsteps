[**Footsteps API**](../../../README.md)

***

[Footsteps API](../../../README.md) / [providers/GameDataContext](../README.md) / GameDataContextType

# Interface: GameDataContextType

Defined in: [providers/GameDataContext.tsx:14](https://github.com/instantiator/2025-xmas-game/blob/main/src/providers/GameDataContext.tsx#L14)

The requested game, once loaded.

## Properties

### gameData

> **gameData**: [`GameData`](../../../entities/data/GameData/interfaces/GameData.md)

Defined in: [providers/GameDataContext.tsx:16](https://github.com/instantiator/2025-xmas-game/blob/main/src/providers/GameDataContext.tsx#L16)

The game's authored data.

***

### gameId

> **gameId**: `string`

Defined in: [providers/GameDataContext.tsx:18](https://github.com/instantiator/2025-xmas-game/blob/main/src/providers/GameDataContext.tsx#L18)

The game's id in the repository.

***

### resources

> **resources**: `Record`\<`string`, `string`\>

Defined in: [providers/GameDataContext.tsx:20](https://github.com/instantiator/2025-xmas-game/blob/main/src/providers/GameDataContext.tsx#L20)

The game's resource URLs, resolved to absolute URLs by resource name.
