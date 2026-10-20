[**Footsteps API**](../../../README.md)

***

[Footsteps API](../../../README.md) / [entities/GameSource](../README.md) / RemoteGameSource

# Interface: RemoteGameSource

Defined in: [entities/GameSource.ts:16](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/entities/GameSource.ts#L16)

A repository fetched from an absolute URL.

## Extends

- [`GameSourceBase`](GameSourceBase.md)

## Properties

### src

> **src**: `URL`

Defined in: [entities/GameSource.ts:19](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/entities/GameSource.ts#L19)

URL of the repository JSON file. Relative paths resolve against its directory.

***

### type

> **type**: `"RemoteRepository"`

Defined in: [entities/GameSource.ts:17](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/entities/GameSource.ts#L17)

Which kind of source this is.

#### Overrides

[`GameSourceBase`](GameSourceBase.md).[`type`](GameSourceBase.md#type)
