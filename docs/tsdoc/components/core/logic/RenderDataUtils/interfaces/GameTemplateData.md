[**Footsteps API**](../../../../../README.md)

***

[Footsteps API](../../../../../README.md) / [components/core/logic/RenderDataUtils](../README.md) / GameTemplateData

# Interface: GameTemplateData

Defined in: [components/core/logic/RenderDataUtils.ts:46](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/logic/RenderDataUtils.ts#L46)

Data to provide to game challenge templates.

## Properties

### challenge

> **challenge**: [`GameChallengeData`](../../../../../entities/data/GameChallengeData/interfaces/GameChallengeData.md) \| `undefined`

Defined in: [components/core/logic/RenderDataUtils.ts:54](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/logic/RenderDataUtils.ts#L54)

Only set for challenge displays.

***

### challengeState

> **challengeState**: [`GameChallengeState`](../../../../../entities/state/GameChallengeState/interfaces/GameChallengeState.md) \| `undefined`

Defined in: [components/core/logic/RenderDataUtils.ts:56](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/logic/RenderDataUtils.ts#L56)

Only set for challenge displays.

***

### componentData

> **componentData**: `Record`\<`string`, `unknown`\>

Defined in: [components/core/logic/RenderDataUtils.ts:50](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/logic/RenderDataUtils.ts#L50)

The display's own `component.data`, authored freely.

***

### gameState

> **gameState**: [`DecoratedGameState`](../../TemplateUtils/type-aliases/DecoratedGameState.md)

Defined in: [components/core/logic/RenderDataUtils.ts:48](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/logic/RenderDataUtils.ts#L48)

The game state, with per-stage flags for templates that can't compute them.

***

### resources

> **resources**: `Record`\<`string`, `string`\>

Defined in: [components/core/logic/RenderDataUtils.ts:52](https://github.com/instantiator/2025-xmas-game/blob/main/src/components/core/logic/RenderDataUtils.ts#L52)

Resolved resource URLs, by resource name.
