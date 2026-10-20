[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [components/core/logic/RenderDataUtils](../README.md) / GameTemplateData

# Interface: GameTemplateData

Defined in: [components/core/logic/RenderDataUtils.ts:45](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/logic/RenderDataUtils.ts#L45)

Data to provide to game challenge Mustache templates.

## Properties

### challenge

> **challenge**: [`GameChallengeData`](../../../../../entities/data/GameChallengeData/interfaces/GameChallengeData.md) \| `undefined`

Defined in: [components/core/logic/RenderDataUtils.ts:53](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/logic/RenderDataUtils.ts#L53)

Only set for challenge displays.

***

### challengeState

> **challengeState**: [`GameChallengeState`](../../../../../entities/state/GameChallengeState/interfaces/GameChallengeState.md) \| `undefined`

Defined in: [components/core/logic/RenderDataUtils.ts:55](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/logic/RenderDataUtils.ts#L55)

Only set for challenge displays.

***

### componentData

> **componentData**: `Record`\<`string`, `unknown`\>

Defined in: [components/core/logic/RenderDataUtils.ts:49](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/logic/RenderDataUtils.ts#L49)

The display's own `component.data`, authored freely.

***

### gameState

> **gameState**: [`DecoratedGameState`](../../TemplateUtils/type-aliases/DecoratedGameState.md)

Defined in: [components/core/logic/RenderDataUtils.ts:47](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/logic/RenderDataUtils.ts#L47)

The game state, with per-stage flags for templates that can't compute them.

***

### resources

> **resources**: `Record`\<`string`, `string`\>

Defined in: [components/core/logic/RenderDataUtils.ts:51](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/logic/RenderDataUtils.ts#L51)

Resolved resource URLs, by resource name.
