[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [entities/data/displays/GameDisplayMediaData](../README.md) / GameDisplayMediaData

# Interface: GameDisplayMediaData

Defined in: [entities/data/displays/GameDisplayMediaData.ts:2](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayMediaData.ts#L2)

Media played with a display. Resources are names defined in the game's `resources`.

## Properties

### audioDescription?

> `optional` **audioDescription?**: `string`

Defined in: [entities/data/displays/GameDisplayMediaData.ts:12](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayMediaData.ts#L12)

Accessible description of the audio, for screen readers. Default: "audio".

***

### motionImageResource?

> `optional` **motionImageResource?**: `string`

Defined in: [entities/data/displays/GameDisplayMediaData.ts:10](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayMediaData.ts#L10)

Resource name of an image shown while the audio is playing.

***

### resource

> **resource**: `string`

Defined in: [entities/data/displays/GameDisplayMediaData.ts:6](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayMediaData.ts#L6)

Resource name of the audio file.

***

### stillImageResource?

> `optional` **stillImageResource?**: `string`

Defined in: [entities/data/displays/GameDisplayMediaData.ts:8](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayMediaData.ts#L8)

Resource name of an image shown while the audio is not playing.

***

### type

> **type**: `"audio"`

Defined in: [entities/data/displays/GameDisplayMediaData.ts:4](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayMediaData.ts#L4)

The kind of media: only audio is supported.
