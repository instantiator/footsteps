[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [entities/data/displays/GameDisplayTemplateComponentData](../README.md) / GameDisplayTemplateComponentData

# Interface: GameDisplayTemplateComponentData

Defined in: [entities/data/displays/GameDisplayTemplateComponentData.ts:11](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/entities/data/displays/GameDisplayTemplateComponentData.ts#L11)

A display built from Mustache templates, drawn as a background layer and a foreground layer.

## Extends

- [`GameDisplayComponentBase`](../../GameDisplayData/interfaces/GameDisplayComponentBase.md)

## Properties

### backgroundStyle?

> `optional` **backgroundStyle?**: `CSSProperties`

Defined in: [entities/data/displays/GameDisplayTemplateComponentData.ts:18](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/entities/data/displays/GameDisplayTemplateComponentData.ts#L18)

CSS for the background layer's container.

***

### backgroundTemplate?

> `optional` **backgroundTemplate?**: [`GameDisplayTemplateSourceData`](GameDisplayTemplateSourceData.md)

Defined in: [entities/data/displays/GameDisplayTemplateComponentData.ts:14](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/entities/data/displays/GameDisplayTemplateComponentData.ts#L14)

Template for the background layer, drawn behind the game's other content.

***

### backgroundTemplateStyle?

> `optional` **backgroundTemplateStyle?**: `CSSProperties`

Defined in: [entities/data/displays/GameDisplayTemplateComponentData.ts:22](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/entities/data/displays/GameDisplayTemplateComponentData.ts#L22)

CSS for the element wrapping the rendered background template.

***

### data

> **data**: `Record`\<`string`, `unknown`\>

Defined in: [entities/data/displays/GameDisplayData.ts:35](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/entities/data/displays/GameDisplayData.ts#L35)

Extra values for this display, passed through to its templates as `componentData`.

#### Inherited from

[`GameDisplayComponentBase`](../../GameDisplayData/interfaces/GameDisplayComponentBase.md).[`data`](../../GameDisplayData/interfaces/GameDisplayComponentBase.md#data)

***

### foregroundStyle?

> `optional` **foregroundStyle?**: `CSSProperties`

Defined in: [entities/data/displays/GameDisplayTemplateComponentData.ts:20](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/entities/data/displays/GameDisplayTemplateComponentData.ts#L20)

CSS for the foreground layer's container.

***

### foregroundTemplate?

> `optional` **foregroundTemplate?**: [`GameDisplayTemplateSourceData`](GameDisplayTemplateSourceData.md)

Defined in: [entities/data/displays/GameDisplayTemplateComponentData.ts:16](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/entities/data/displays/GameDisplayTemplateComponentData.ts#L16)

Template for the foreground layer, drawn in front of the game's other content.

***

### foregroundTemplateStyle?

> `optional` **foregroundTemplateStyle?**: `CSSProperties`

Defined in: [entities/data/displays/GameDisplayTemplateComponentData.ts:24](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/entities/data/displays/GameDisplayTemplateComponentData.ts#L24)

CSS for the element wrapping the rendered foreground template.

***

### type

> **type**: `"template"`

Defined in: [entities/data/displays/GameDisplayTemplateComponentData.ts:12](https://github.com/instantiator/2025-xmas-game/blob/cbb15e480ff469af04954ca740a0022886e0c22d/src/entities/data/displays/GameDisplayTemplateComponentData.ts#L12)

Which kind of component this is.

#### Overrides

[`GameDisplayComponentBase`](../../GameDisplayData/interfaces/GameDisplayComponentBase.md).[`type`](../../GameDisplayData/interfaces/GameDisplayComponentBase.md#type)
