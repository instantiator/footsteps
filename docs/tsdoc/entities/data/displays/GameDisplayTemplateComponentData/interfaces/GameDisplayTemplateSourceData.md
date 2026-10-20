[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [entities/data/displays/GameDisplayTemplateComponentData](../README.md) / GameDisplayTemplateSourceData

# Interface: GameDisplayTemplateSourceData

Defined in: [entities/data/displays/GameDisplayTemplateComponentData.ts:28](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/entities/data/displays/GameDisplayTemplateComponentData.ts#L28)

Says where to find a template's text.

## Properties

### content?

> `optional` **content?**: `string`

Defined in: [entities/data/displays/GameDisplayTemplateComponentData.ts:34](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/entities/data/displays/GameDisplayTemplateComponentData.ts#L34)

The template text itself. Used only when `sourceType` is `embedded`.

***

### sourceType

> **sourceType**: [`TemplateSourceType`](../type-aliases/TemplateSourceType.md)

Defined in: [entities/data/displays/GameDisplayTemplateComponentData.ts:30](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/entities/data/displays/GameDisplayTemplateComponentData.ts#L30)

How `templateSource` is resolved, or `embedded` to use `content`.

***

### templateSource?

> `optional` **templateSource?**: `string`

Defined in: [entities/data/displays/GameDisplayTemplateComponentData.ts:32](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/entities/data/displays/GameDisplayTemplateComponentData.ts#L32)

Path or URL of the template, interpreted according to `sourceType`. Unused for `embedded`.
