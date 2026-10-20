[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [entities/data/displays/GameDisplayData](../README.md) / GameOverviewDisplay

# Interface: GameOverviewDisplay

Defined in: [entities/data/displays/GameDisplayData.ts:41](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayData.ts#L41)

A display shown when no stage is active.

## Extends

- [`GameDisplayBase`](GameDisplayBase.md)

## Properties

### clickIdToStageId?

> `optional` **clickIdToStageId?**: `Record`\<`string`, `string`\>

Defined in: [entities/data/displays/GameDisplayData.ts:44](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayData.ts#L44)

Maps ids of elements in the template to the stage id that clicking them enters.

***

### component

> **component**: [`GameDisplayComponentData`](../type-aliases/GameDisplayComponentData.md)

Defined in: [entities/data/displays/GameDisplayData.ts:29](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayData.ts#L29)

How this display is rendered.

#### Inherited from

[`GameDisplayBase`](GameDisplayBase.md).[`component`](GameDisplayBase.md#component)

***

### purpose

> **purpose**: [`GameOverviewDisplayPurpose`](../type-aliases/GameOverviewDisplayPurpose.md)

Defined in: [entities/data/displays/GameDisplayData.ts:42](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayData.ts#L42)

When this display is shown.

#### Overrides

[`GameDisplayBase`](GameDisplayBase.md).[`purpose`](GameDisplayBase.md#purpose)
