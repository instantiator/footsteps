[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [entities/data/displays/GameDisplayData](../README.md) / GameDisplayComponentBase

# Interface: GameDisplayComponentBase

Defined in: [entities/data/displays/GameDisplayData.ts:33](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayData.ts#L33)

Fields common to every display component.

## Extended by

- [`GameDisplayPagedComponentBase`](../../GameDisplayDialogComponentData/interfaces/GameDisplayPagedComponentBase.md)
- [`GameDisplayTemplateComponentData`](../../GameDisplayTemplateComponentData/interfaces/GameDisplayTemplateComponentData.md)

## Properties

### data

> **data**: `Record`\<`string`, `unknown`\>

Defined in: [entities/data/displays/GameDisplayData.ts:37](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayData.ts#L37)

Extra values for this display, passed through to its templates as `componentData`.

***

### type

> **type**: [`GameDisplayComponentType`](../type-aliases/GameDisplayComponentType.md)

Defined in: [entities/data/displays/GameDisplayData.ts:35](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayData.ts#L35)

Which kind of component this is.
