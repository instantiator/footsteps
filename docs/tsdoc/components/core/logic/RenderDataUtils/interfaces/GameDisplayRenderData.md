[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [components/core/logic/RenderDataUtils](../README.md) / GameDisplayRenderData

# Interface: GameDisplayRenderData

Defined in: [components/core/logic/RenderDataUtils.ts:21](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/logic/RenderDataUtils.ts#L21)

Everything needed to render one display, and to respond to input on it.

## Extends

- [`GameDisplayBase`](../../../../../entities/data/displays/GameDisplayData/interfaces/GameDisplayBase.md)

## Properties

### challengeId

> **challengeId**: `string` \| `undefined`

Defined in: [components/core/logic/RenderDataUtils.ts:27](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/logic/RenderDataUtils.ts#L27)

The challenge the display belongs to; undefined unless it is a challenge display.

***

### component

> **component**: [`GameDisplayComponentData`](../../../../../entities/data/displays/GameDisplayData/type-aliases/GameDisplayComponentData.md)

Defined in: [entities/data/displays/GameDisplayData.ts:27](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/entities/data/displays/GameDisplayData.ts#L27)

How this display is rendered.

#### Inherited from

[`GameDisplayBase`](../../../../../entities/data/displays/GameDisplayData/interfaces/GameDisplayBase.md).[`component`](../../../../../entities/data/displays/GameDisplayData/interfaces/GameDisplayBase.md#component)

***

### purpose

> **purpose**: [`GameDisplayPurpose`](../../../../../entities/data/displays/GameDisplayData/type-aliases/GameDisplayPurpose.md)

Defined in: [entities/data/displays/GameDisplayData.ts:25](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/entities/data/displays/GameDisplayData.ts#L25)

When this display is shown.

#### Inherited from

[`GameDisplayBase`](../../../../../entities/data/displays/GameDisplayData/interfaces/GameDisplayBase.md).[`purpose`](../../../../../entities/data/displays/GameDisplayData/interfaces/GameDisplayBase.md#purpose)

***

### solution

> **solution**: [`GameChallengeSolution`](../../../../../entities/data/GameChallengeSolution/interfaces/GameChallengeSolution.md) \| `undefined`

Defined in: [components/core/logic/RenderDataUtils.ts:29](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/logic/RenderDataUtils.ts#L29)

The solution to check answers against; undefined unless it is a challenge display.

***

### stageId

> **stageId**: `string` \| `undefined`

Defined in: [components/core/logic/RenderDataUtils.ts:25](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/logic/RenderDataUtils.ts#L25)

The stage the display belongs to; undefined for overview displays.

***

### templateData

> **templateData**: [`GameTemplateData`](GameTemplateData.md)

Defined in: [components/core/logic/RenderDataUtils.ts:23](https://github.com/instantiator/2025-xmas-game/blob/d67f65e2019a1627dadc2015b72d76777fad3271/src/components/core/logic/RenderDataUtils.ts#L23)

The Mustache view for the display's template.
