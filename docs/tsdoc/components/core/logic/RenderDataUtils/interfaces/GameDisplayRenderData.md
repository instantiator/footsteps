[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [components/core/logic/RenderDataUtils](../README.md) / GameDisplayRenderData

# Interface: GameDisplayRenderData

Defined in: [components/core/logic/RenderDataUtils.ts:22](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/logic/RenderDataUtils.ts#L22)

Everything needed to render one display, and to respond to input on it.

## Extends

- [`GameDisplayBase`](../../../../../entities/data/displays/GameDisplayData/interfaces/GameDisplayBase.md)

## Properties

### challengeId

> **challengeId**: `string` \| `undefined`

Defined in: [components/core/logic/RenderDataUtils.ts:28](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/logic/RenderDataUtils.ts#L28)

The challenge the display belongs to; undefined unless it is a challenge display.

***

### component

> **component**: [`GameDisplayComponentData`](../../../../../entities/data/displays/GameDisplayData/type-aliases/GameDisplayComponentData.md)

Defined in: [entities/data/displays/GameDisplayData.ts:29](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayData.ts#L29)

How this display is rendered.

#### Inherited from

[`GameDisplayBase`](../../../../../entities/data/displays/GameDisplayData/interfaces/GameDisplayBase.md).[`component`](../../../../../entities/data/displays/GameDisplayData/interfaces/GameDisplayBase.md#component)

***

### purpose

> **purpose**: [`GameDisplayPurpose`](../../../../../entities/data/displays/GameDisplayData/type-aliases/GameDisplayPurpose.md)

Defined in: [entities/data/displays/GameDisplayData.ts:27](https://github.com/instantiator/2025-xmas-game/blob/main/src/entities/data/displays/GameDisplayData.ts#L27)

When this display is shown.

#### Inherited from

[`GameDisplayBase`](../../../../../entities/data/displays/GameDisplayData/interfaces/GameDisplayBase.md).[`purpose`](../../../../../entities/data/displays/GameDisplayData/interfaces/GameDisplayBase.md#purpose)

***

### solution

> **solution**: [`GameChallengeSolution`](../../../../../entities/data/GameChallengeSolution/interfaces/GameChallengeSolution.md) \| `undefined`

Defined in: [components/core/logic/RenderDataUtils.ts:30](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/logic/RenderDataUtils.ts#L30)

The solution to check answers against; undefined unless it is a challenge display.

***

### stageId

> **stageId**: `string` \| `undefined`

Defined in: [components/core/logic/RenderDataUtils.ts:26](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/logic/RenderDataUtils.ts#L26)

The stage the display belongs to; undefined for overview displays.

***

### templateData

> **templateData**: [`GameTemplateData`](GameTemplateData.md)

Defined in: [components/core/logic/RenderDataUtils.ts:24](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/logic/RenderDataUtils.ts#L24)

The context for the display's template.
