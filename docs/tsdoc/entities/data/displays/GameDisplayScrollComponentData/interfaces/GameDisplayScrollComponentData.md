[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [entities/data/displays/GameDisplayScrollComponentData](../README.md) / GameDisplayScrollComponentData

# Interface: GameDisplayScrollComponentData

Defined in: [entities/data/displays/GameDisplayScrollComponentData.ts:6](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayScrollComponentData.ts#L6)

A display of paged text on a paper image, with optional audio and answer input per page.

## Extends

- [`GameDisplayComponentBase`](../../GameDisplayData/interfaces/GameDisplayComponentBase.md)

## Properties

### backgroundStyle?

> `optional` **backgroundStyle?**: `CSSProperties`

Defined in: [entities/data/displays/GameDisplayScrollComponentData.ts:13](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayScrollComponentData.ts#L13)

CSS for the background layer's container.

***

### backgroundTemplate?

> `optional` **backgroundTemplate?**: [`GameDisplayTemplateSourceData`](../../GameDisplayTemplateComponentData/interfaces/GameDisplayTemplateSourceData.md)

Defined in: [entities/data/displays/GameDisplayScrollComponentData.ts:9](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayScrollComponentData.ts#L9)

Template for the background layer, drawn behind the game's other content.

***

### backgroundTemplateStyle?

> `optional` **backgroundTemplateStyle?**: `CSSProperties`

Defined in: [entities/data/displays/GameDisplayScrollComponentData.ts:17](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayScrollComponentData.ts#L17)

CSS for the element wrapping the rendered background template.

***

### contents

> **contents**: [`GameDisplayScrollComponentDataContent`](GameDisplayScrollComponentDataContent.md)[]

Defined in: [entities/data/displays/GameDisplayScrollComponentData.ts:21](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayScrollComponentData.ts#L21)

The pages of the scroll, shown one at a time in order.

***

### data

> **data**: `Record`\<`string`, `unknown`\>

Defined in: [entities/data/displays/GameDisplayData.ts:35](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayData.ts#L35)

Extra values for this display, passed through to its templates as `componentData`.

#### Inherited from

[`GameDisplayComponentBase`](../../GameDisplayData/interfaces/GameDisplayComponentBase.md).[`data`](../../GameDisplayData/interfaces/GameDisplayComponentBase.md#data)

***

### foregroundStyle?

> `optional` **foregroundStyle?**: `CSSProperties`

Defined in: [entities/data/displays/GameDisplayScrollComponentData.ts:15](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayScrollComponentData.ts#L15)

CSS for the foreground layer's container.

***

### foregroundTemplate?

> `optional` **foregroundTemplate?**: [`GameDisplayTemplateSourceData`](../../GameDisplayTemplateComponentData/interfaces/GameDisplayTemplateSourceData.md)

Defined in: [entities/data/displays/GameDisplayScrollComponentData.ts:11](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayScrollComponentData.ts#L11)

Template for the foreground layer, drawn in front of the game's other content.

***

### foregroundTemplateStyle?

> `optional` **foregroundTemplateStyle?**: `CSSProperties`

Defined in: [entities/data/displays/GameDisplayScrollComponentData.ts:19](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayScrollComponentData.ts#L19)

CSS for the element wrapping the rendered foreground template.

***

### type

> **type**: `"scroll"`

Defined in: [entities/data/displays/GameDisplayScrollComponentData.ts:7](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayScrollComponentData.ts#L7)

Which kind of component this is.

#### Overrides

[`GameDisplayComponentBase`](../../GameDisplayData/interfaces/GameDisplayComponentBase.md).[`type`](../../GameDisplayData/interfaces/GameDisplayComponentBase.md#type)
