[**Footsteps API**](../../../README.md)

***

[Footsteps API](../../../README.md) / [entities/GameSource](../README.md) / RawGameSource

# Interface: RawGameSource

Defined in: [entities/GameSource.ts:30](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/GameSource.ts#L30)

An in-memory repository. It has no location, so cannot use relative paths.

## Extends

- [`GameSourceBase`](GameSourceBase.md)

## Properties

### repository

> **repository**: [`GameRepository`](../../GameRepository/interfaces/GameRepository.md)

Defined in: [entities/GameSource.ts:33](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/GameSource.ts#L33)

The repository itself.

***

### type

> **type**: `"RawRepository"`

Defined in: [entities/GameSource.ts:31](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/GameSource.ts#L31)

Which kind of source this is.

#### Overrides

[`GameSourceBase`](GameSourceBase.md).[`type`](GameSourceBase.md#type)
