[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [entities/data/displays/GameDisplayDialogComponentData](../README.md) / GameDisplayPagedComponentBase

# Interface: GameDisplayPagedComponentBase

Defined in: [entities/data/displays/GameDisplayDialogComponentData.ts:6](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayDialogComponentData.ts#L6)

Fields of a display that shows pages one at a time, each with optional audio and an answer input.

## Extends

- [`GameDisplayComponentBase`](../../GameDisplayData/interfaces/GameDisplayComponentBase.md)

## Extended by

- [`GameDisplayDialogComponentData`](GameDisplayDialogComponentData.md)
- [`GameDisplayScrollComponentData`](../../GameDisplayScrollComponentData/interfaces/GameDisplayScrollComponentData.md)

## Properties

### backgroundStyle?

> `optional` **backgroundStyle?**: `CSSProperties`

Defined in: [entities/data/displays/GameDisplayDialogComponentData.ts:12](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayDialogComponentData.ts#L12)

CSS for the background layer's container.

***

### backgroundTemplate?

> `optional` **backgroundTemplate?**: [`GameDisplayTemplateSourceData`](../../GameDisplayTemplateComponentData/interfaces/GameDisplayTemplateSourceData.md)

Defined in: [entities/data/displays/GameDisplayDialogComponentData.ts:8](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayDialogComponentData.ts#L8)

Template for the background layer, drawn behind the game's other content.

***

### backgroundTemplateStyle?

> `optional` **backgroundTemplateStyle?**: `CSSProperties`

Defined in: [entities/data/displays/GameDisplayDialogComponentData.ts:16](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayDialogComponentData.ts#L16)

CSS for the element wrapping the rendered background template.

***

### contents

> **contents**: [`GameDisplayPageData`](GameDisplayPageData.md)[]

Defined in: [entities/data/displays/GameDisplayDialogComponentData.ts:20](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayDialogComponentData.ts#L20)

The pages, shown one at a time in order.

***

### data

> **data**: `Record`\<`string`, `unknown`\>

Defined in: [entities/data/displays/GameDisplayData.ts:37](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayData.ts#L37)

Extra values for this display, passed through to its templates as `componentData`.

#### Inherited from

[`GameDisplayComponentBase`](../../GameDisplayData/interfaces/GameDisplayComponentBase.md).[`data`](../../GameDisplayData/interfaces/GameDisplayComponentBase.md#data)

***

### foregroundStyle?

> `optional` **foregroundStyle?**: `CSSProperties`

Defined in: [entities/data/displays/GameDisplayDialogComponentData.ts:14](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayDialogComponentData.ts#L14)

CSS for the foreground layer's container: the column the pages are shown in.

***

### foregroundTemplate?

> `optional` **foregroundTemplate?**: [`GameDisplayTemplateSourceData`](../../GameDisplayTemplateComponentData/interfaces/GameDisplayTemplateSourceData.md)

Defined in: [entities/data/displays/GameDisplayDialogComponentData.ts:10](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayDialogComponentData.ts#L10)

Template for each page in the foreground layer, drawn in front of the game's other content.

***

### foregroundTemplateStyle?

> `optional` **foregroundTemplateStyle?**: `CSSProperties`

Defined in: [entities/data/displays/GameDisplayDialogComponentData.ts:18](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayDialogComponentData.ts#L18)

CSS for the element wrapping the rendered foreground template.

***

### type

> **type**: [`GameDisplayComponentType`](../../GameDisplayData/type-aliases/GameDisplayComponentType.md)

Defined in: [entities/data/displays/GameDisplayData.ts:35](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayData.ts#L35)

Which kind of component this is.

#### Inherited from

[`GameDisplayComponentBase`](../../GameDisplayData/interfaces/GameDisplayComponentBase.md).[`type`](../../GameDisplayData/interfaces/GameDisplayComponentBase.md#type)
