[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [entities/data/displays/GameDisplayData](../README.md) / GameDisplayComponentBase

# Interface: GameDisplayComponentBase

Defined in: [entities/data/displays/GameDisplayData.ts:31](https://github.com/instantiator/2025-xmas-game/blob/ea2155993261ff7017c8ce5e381acb88812e1d8e/src/entities/data/displays/GameDisplayData.ts#L31)

Fields common to every display component.

## Extended by

- [`GameDisplayScrollComponentData`](../../GameDisplayScrollComponentData/interfaces/GameDisplayScrollComponentData.md)
- [`GameDisplayTemplateComponentData`](../../GameDisplayTemplateComponentData/interfaces/GameDisplayTemplateComponentData.md)

## Properties

### data

> **data**: `Record`\<`string`, `unknown`\>

Defined in: [entities/data/displays/GameDisplayData.ts:35](https://github.com/instantiator/2025-xmas-game/blob/ea2155993261ff7017c8ce5e381acb88812e1d8e/src/entities/data/displays/GameDisplayData.ts#L35)

Extra values for this display, passed through to its templates as `componentData`.

***

### type

> **type**: [`GameDisplayComponentType`](../type-aliases/GameDisplayComponentType.md)

Defined in: [entities/data/displays/GameDisplayData.ts:33](https://github.com/instantiator/2025-xmas-game/blob/ea2155993261ff7017c8ce5e381acb88812e1d8e/src/entities/data/displays/GameDisplayData.ts#L33)

Which kind of component this is.
