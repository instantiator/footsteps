[**Footsteps API**](../../../README.md)

***

[Footsteps API](../../../README.md) / [entities/GameSource](../README.md) / LocalGameSource

# Interface: LocalGameSource

Defined in: [entities/GameSource.ts:23](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/entities/GameSource.ts#L23)

A repository served from this site.

## Extends

- [`GameSourceBase`](GameSourceBase.md)

## Properties

### path

> **path**: `string`

Defined in: [entities/GameSource.ts:26](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/entities/GameSource.ts#L26)

Path under this site's base URL. Relative paths resolve against the site.

***

### type

> **type**: `"LocalRepository"`

Defined in: [entities/GameSource.ts:24](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/entities/GameSource.ts#L24)

Which kind of source this is.

#### Overrides

[`GameSourceBase`](GameSourceBase.md).[`type`](GameSourceBase.md#type)
