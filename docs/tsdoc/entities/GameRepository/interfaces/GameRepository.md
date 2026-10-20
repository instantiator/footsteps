[**Footsteps API**](../../../README.md)

***

[Footsteps API](../../../README.md) / [entities/GameRepository](../README.md) / GameRepository

# Interface: GameRepository

Defined in: [entities/GameRepository.ts:4](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/entities/GameRepository.ts#L4)

A collection of games, keyed by id. This is the top level of a game repository JSON file.

## Properties

### error?

> `optional` **error?**: `string`

Defined in: [entities/GameRepository.ts:10](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/entities/GameRepository.ts#L10)

Runtime-only message, set by the provider if loading failed. Not authored.

***

### games

> **games**: `object`

Defined in: [entities/GameRepository.ts:12](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/entities/GameRepository.ts#L12)

The games in this repository, keyed by [GameId](../../data/GameData/type-aliases/GameId.md).

#### Index Signature

\[`id`: `string`\]: [`GameData`](../../data/GameData/interfaces/GameData.md)

***

### loading?

> `optional` **loading?**: `boolean`

Defined in: [entities/GameRepository.ts:8](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/entities/GameRepository.ts#L8)

Runtime-only flag, set by the provider while the repository is being fetched. Not authored.

***

### ready?

> `optional` **ready?**: `boolean`

Defined in: [entities/GameRepository.ts:6](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/entities/GameRepository.ts#L6)

Runtime-only flag, set by the provider once loading has succeeded. Not authored.
