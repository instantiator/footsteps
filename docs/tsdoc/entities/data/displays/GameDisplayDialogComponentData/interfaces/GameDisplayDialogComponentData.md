[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [entities/data/displays/GameDisplayDialogComponentData](../README.md) / GameDisplayDialogComponentData

# Interface: GameDisplayDialogComponentData

Defined in: [entities/data/displays/GameDisplayDialogComponentData.ts:51](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayDialogComponentData.ts#L51)

A paged display on a background image of the game's choosing, scaled to fit, with the text kept inside its margins.

## Extends

- [`GameDisplayPagedComponentBase`](GameDisplayPagedComponentBase.md)

## Properties

### backgroundStyle?

> `optional` **backgroundStyle?**: `CSSProperties`

Defined in: [entities/data/displays/GameDisplayDialogComponentData.ts:12](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayDialogComponentData.ts#L12)

CSS for the background layer's container.

#### Inherited from

[`GameDisplayPagedComponentBase`](GameDisplayPagedComponentBase.md).[`backgroundStyle`](GameDisplayPagedComponentBase.md#backgroundstyle)

***

### backgroundTemplate?

> `optional` **backgroundTemplate?**: [`GameDisplayTemplateSourceData`](../../GameDisplayTemplateComponentData/interfaces/GameDisplayTemplateSourceData.md)

Defined in: [entities/data/displays/GameDisplayDialogComponentData.ts:8](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayDialogComponentData.ts#L8)

Template for the background layer, drawn behind the game's other content.

#### Inherited from

[`GameDisplayPagedComponentBase`](GameDisplayPagedComponentBase.md).[`backgroundTemplate`](GameDisplayPagedComponentBase.md#backgroundtemplate)

***

### backgroundTemplateStyle?

> `optional` **backgroundTemplateStyle?**: `CSSProperties`

Defined in: [entities/data/displays/GameDisplayDialogComponentData.ts:16](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayDialogComponentData.ts#L16)

CSS for the element wrapping the rendered background template.

#### Inherited from

[`GameDisplayPagedComponentBase`](GameDisplayPagedComponentBase.md).[`backgroundTemplateStyle`](GameDisplayPagedComponentBase.md#backgroundtemplatestyle)

***

### contents

> **contents**: [`GameDisplayPageData`](GameDisplayPageData.md)[]

Defined in: [entities/data/displays/GameDisplayDialogComponentData.ts:20](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayDialogComponentData.ts#L20)

The pages, shown one at a time in order.

#### Inherited from

[`GameDisplayPagedComponentBase`](GameDisplayPagedComponentBase.md).[`contents`](GameDisplayPagedComponentBase.md#contents)

***

### data

> **data**: `Record`\<`string`, `unknown`\>

Defined in: [entities/data/displays/GameDisplayData.ts:37](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayData.ts#L37)

Extra values for this display, passed through to its templates as `componentData`.

#### Inherited from

[`GameDisplayPagedComponentBase`](GameDisplayPagedComponentBase.md).[`data`](GameDisplayPagedComponentBase.md#data)

***

### foregroundStyle?

> `optional` **foregroundStyle?**: `CSSProperties`

Defined in: [entities/data/displays/GameDisplayDialogComponentData.ts:14](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayDialogComponentData.ts#L14)

CSS for the foreground layer's container: the column the pages are shown in.

#### Inherited from

[`GameDisplayPagedComponentBase`](GameDisplayPagedComponentBase.md).[`foregroundStyle`](GameDisplayPagedComponentBase.md#foregroundstyle)

***

### foregroundTemplate?

> `optional` **foregroundTemplate?**: [`GameDisplayTemplateSourceData`](../../GameDisplayTemplateComponentData/interfaces/GameDisplayTemplateSourceData.md)

Defined in: [entities/data/displays/GameDisplayDialogComponentData.ts:10](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayDialogComponentData.ts#L10)

Template for each page in the foreground layer, drawn in front of the game's other content.

#### Inherited from

[`GameDisplayPagedComponentBase`](GameDisplayPagedComponentBase.md).[`foregroundTemplate`](GameDisplayPagedComponentBase.md#foregroundtemplate)

***

### foregroundTemplateStyle?

> `optional` **foregroundTemplateStyle?**: `CSSProperties`

Defined in: [entities/data/displays/GameDisplayDialogComponentData.ts:18](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayDialogComponentData.ts#L18)

CSS for the element wrapping the rendered foreground template.

#### Inherited from

[`GameDisplayPagedComponentBase`](GameDisplayPagedComponentBase.md).[`foregroundTemplateStyle`](GameDisplayPagedComponentBase.md#foregroundtemplatestyle)

***

### imageMargins?

> `optional` **imageMargins?**: [`GameDisplayDialogMargins`](GameDisplayDialogMargins.md)

Defined in: [entities/data/displays/GameDisplayDialogComponentData.ts:56](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayDialogComponentData.ts#L56)

Where the text sits on the image. Defaults to no margin.

***

### imageResource?

> `optional` **imageResource?**: `string`

Defined in: [entities/data/displays/GameDisplayDialogComponentData.ts:54](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayDialogComponentData.ts#L54)

Resource name of the background image. Without one, the dialog fills its display.

***

### type

> **type**: `"dialog"`

Defined in: [entities/data/displays/GameDisplayDialogComponentData.ts:52](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayDialogComponentData.ts#L52)

Which kind of component this is.

#### Overrides

[`GameDisplayPagedComponentBase`](GameDisplayPagedComponentBase.md).[`type`](GameDisplayPagedComponentBase.md#type)
