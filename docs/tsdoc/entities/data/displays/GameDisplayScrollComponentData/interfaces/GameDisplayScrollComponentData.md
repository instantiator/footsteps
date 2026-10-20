[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [entities/data/displays/GameDisplayScrollComponentData](../README.md) / GameDisplayScrollComponentData

# Interface: GameDisplayScrollComponentData

Defined in: [entities/data/displays/GameDisplayScrollComponentData.ts:4](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayScrollComponentData.ts#L4)

A dialog on the app's old-paper image: see [GameDisplayPagedComponentBase](../../GameDisplayDialogComponentData/interfaces/GameDisplayPagedComponentBase.md) for its fields.

## Extends

- [`GameDisplayPagedComponentBase`](../../GameDisplayDialogComponentData/interfaces/GameDisplayPagedComponentBase.md)

## Properties

### backgroundStyle?

> `optional` **backgroundStyle?**: `CSSProperties`

Defined in: [entities/data/displays/GameDisplayDialogComponentData.ts:12](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayDialogComponentData.ts#L12)

CSS for the background layer's container.

#### Inherited from

[`GameDisplayPagedComponentBase`](../../GameDisplayDialogComponentData/interfaces/GameDisplayPagedComponentBase.md).[`backgroundStyle`](../../GameDisplayDialogComponentData/interfaces/GameDisplayPagedComponentBase.md#backgroundstyle)

***

### backgroundTemplate?

> `optional` **backgroundTemplate?**: [`GameDisplayTemplateSourceData`](../../GameDisplayTemplateComponentData/interfaces/GameDisplayTemplateSourceData.md)

Defined in: [entities/data/displays/GameDisplayDialogComponentData.ts:8](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayDialogComponentData.ts#L8)

Template for the background layer, drawn behind the game's other content.

#### Inherited from

[`GameDisplayPagedComponentBase`](../../GameDisplayDialogComponentData/interfaces/GameDisplayPagedComponentBase.md).[`backgroundTemplate`](../../GameDisplayDialogComponentData/interfaces/GameDisplayPagedComponentBase.md#backgroundtemplate)

***

### backgroundTemplateStyle?

> `optional` **backgroundTemplateStyle?**: `CSSProperties`

Defined in: [entities/data/displays/GameDisplayDialogComponentData.ts:16](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayDialogComponentData.ts#L16)

CSS for the element wrapping the rendered background template.

#### Inherited from

[`GameDisplayPagedComponentBase`](../../GameDisplayDialogComponentData/interfaces/GameDisplayPagedComponentBase.md).[`backgroundTemplateStyle`](../../GameDisplayDialogComponentData/interfaces/GameDisplayPagedComponentBase.md#backgroundtemplatestyle)

***

### contents

> **contents**: [`GameDisplayPageData`](../../GameDisplayDialogComponentData/interfaces/GameDisplayPageData.md)[]

Defined in: [entities/data/displays/GameDisplayDialogComponentData.ts:20](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayDialogComponentData.ts#L20)

The pages, shown one at a time in order.

#### Inherited from

[`GameDisplayPagedComponentBase`](../../GameDisplayDialogComponentData/interfaces/GameDisplayPagedComponentBase.md).[`contents`](../../GameDisplayDialogComponentData/interfaces/GameDisplayPagedComponentBase.md#contents)

***

### data

> **data**: `Record`\<`string`, `unknown`\>

Defined in: [entities/data/displays/GameDisplayData.ts:37](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayData.ts#L37)

Extra values for this display, passed through to its templates as `componentData`.

#### Inherited from

[`GameDisplayPagedComponentBase`](../../GameDisplayDialogComponentData/interfaces/GameDisplayPagedComponentBase.md).[`data`](../../GameDisplayDialogComponentData/interfaces/GameDisplayPagedComponentBase.md#data)

***

### foregroundStyle?

> `optional` **foregroundStyle?**: `CSSProperties`

Defined in: [entities/data/displays/GameDisplayDialogComponentData.ts:14](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayDialogComponentData.ts#L14)

CSS for the foreground layer's container: the column the pages are shown in.

#### Inherited from

[`GameDisplayPagedComponentBase`](../../GameDisplayDialogComponentData/interfaces/GameDisplayPagedComponentBase.md).[`foregroundStyle`](../../GameDisplayDialogComponentData/interfaces/GameDisplayPagedComponentBase.md#foregroundstyle)

***

### foregroundTemplate?

> `optional` **foregroundTemplate?**: [`GameDisplayTemplateSourceData`](../../GameDisplayTemplateComponentData/interfaces/GameDisplayTemplateSourceData.md)

Defined in: [entities/data/displays/GameDisplayDialogComponentData.ts:10](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayDialogComponentData.ts#L10)

Template for each page in the foreground layer, drawn in front of the game's other content.

#### Inherited from

[`GameDisplayPagedComponentBase`](../../GameDisplayDialogComponentData/interfaces/GameDisplayPagedComponentBase.md).[`foregroundTemplate`](../../GameDisplayDialogComponentData/interfaces/GameDisplayPagedComponentBase.md#foregroundtemplate)

***

### foregroundTemplateStyle?

> `optional` **foregroundTemplateStyle?**: `CSSProperties`

Defined in: [entities/data/displays/GameDisplayDialogComponentData.ts:18](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayDialogComponentData.ts#L18)

CSS for the element wrapping the rendered foreground template.

#### Inherited from

[`GameDisplayPagedComponentBase`](../../GameDisplayDialogComponentData/interfaces/GameDisplayPagedComponentBase.md).[`foregroundTemplateStyle`](../../GameDisplayDialogComponentData/interfaces/GameDisplayPagedComponentBase.md#foregroundtemplatestyle)

***

### type

> **type**: `"scroll"`

Defined in: [entities/data/displays/GameDisplayScrollComponentData.ts:5](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayScrollComponentData.ts#L5)

Which kind of component this is.

#### Overrides

[`GameDisplayPagedComponentBase`](../../GameDisplayDialogComponentData/interfaces/GameDisplayPagedComponentBase.md).[`type`](../../GameDisplayDialogComponentData/interfaces/GameDisplayPagedComponentBase.md#type)
